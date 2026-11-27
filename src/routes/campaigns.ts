import { Router, Request, Response } from "express";
import { z } from "zod";
import { runQuery, runQueryOne } from "../database/pool";
import { toCamelCase } from "../database/mapper";
import { createAuditLog } from "../middleware/audit";

const router = Router();

// Validation schemas
const createCampaignSchema = z.object({
  title: z.string().min(1, "Title required"),
  description: z.string().optional(),
  target_blood_group: z.string()
    .regex(/^[A-Z][+-]$/, "Invalid blood group format")
    .refine(
      (val) => ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].includes(val),
      "Blood group must be one of: A+, A-, B+, B-, AB+, AB-, O+, O-"
    ),
  target_units: z.number().int().min(1, "Target units must be at least 1"),
  target_date: z.string().datetime("Invalid target date format"),
});

const joinCampaignSchema = z.object({
  campaign_id: z.number().int().positive("Invalid campaign ID"),
});

// GET /api/v1/campaigns - Get all campaigns
router.get("/", async (req: Request, res: Response) => {
  try {
    const campaigns: any[] = await runQuery(
      `SELECT 
         campaign_id,
         title,
         description,
         target_blood_group,
         target_units,
         target_date,
         created_by,
         created_at,
         (SELECT COUNT(*) FROM campaign_participants WHERE campaign_id = c.campaign_id) AS participants_count
       FROM ngo_campaigns c
       ORDER BY created_at DESC`
    );

    // toCamelCase must not recurse into Lob objects (they hold circular refs).
    // The mapper's isPlainObject guard handles this, but we also strip out any
    // Lob objects defensively before mapping.
    const sanitize = (row: any) => {
      if (!row || typeof row !== "object") return row;
      const out: any = {};
      for (const [k, v] of Object.entries(row)) {
        if (v && typeof (v as any).getData === "function") {
          out[k] = null; // Lob object - can't serialize
        } else {
          out[k] = v;
        }
      }
      return out;
    };
    const camelCampaigns = campaigns.map((row) => toCamelCase(sanitize(row)));

    res.status(200).json({
      success: true,
      data: { campaigns: camelCampaigns },
      error: null,
    });
  } catch (err) {
    console.error("Get campaigns error:", err);
    res.status(500).json({
      success: false,
      error: { code: "CAMPAIGNS_FETCH_FAILED", message: "Failed to fetch campaigns." },
      data: null,
    });
  }
});

// POST /api/v1/campaigns - Create new campaign (admin/ngo)
router.post("/", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: "NOT_AUTHENTICATED", message: "User not authenticated." },
        data: null,
      });
    }

    const result = createCampaignSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: (result.error as any).issues.map((e: any) => e.message).join(", "),
        },
        data: null,
      });
    }

    const { title, description, target_blood_group, target_units, target_date } = result.data;

    // Create campaign
    const campaignResult: any = await runQueryOne(
      `INSERT INTO ngo_campaigns (title, description, target_blood_group, target_units, target_date, created_by)
       VALUES (:1, :2, :3, :4, :5, :6)
       RETURNING campaign_id, title, description, target_blood_group, target_units, target_date, created_by, created_at`,
      [title, description, target_blood_group, target_units, new Date(target_date), userId]
    );

    const camelCampaign = toCamelCase(campaignResult);

    // Log audit
    await createAuditLog(userId, "campaign_create", "ngo_campaigns", campaignResult.CAMPAIGN_ID, {
      title,
      target_blood_group,
      target_units,
    });

    res.status(201).json({
      success: true,
      data: { campaign: camelCampaign },
      error: null,
    });
  } catch (err) {
    console.error("Create campaign error:", err);
    res.status(500).json({
      success: false,
      error: { code: "CAMPAIGN_CREATE_FAILED", message: "Failed to create campaign." },
      data: null,
    });
  }
});

// POST /api/v1/campaigns/:id/join - Join a campaign
router.post("/:id/join", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const campaignId = Number(req.params.id);

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: "NOT_AUTHENTICATED", message: "User not authenticated." },
        data: null,
      });
    }

    // Check if campaign exists
    const campaignCheck = await runQueryOne(
      `SELECT campaign_id FROM ngo_campaigns WHERE campaign_id = :1`,
      [campaignId]
    );

    if (!campaignCheck) {
      return res.status(404).json({
        success: false,
        error: { code: "CAMPAIGN_NOT_FOUND", message: "Campaign not found." },
        data: null,
      });
    }

    // Check if user already joined
    const existingParticipant = await runQueryOne(
      `SELECT participant_id FROM campaign_participants WHERE campaign_id = :1 AND user_id = :2`,
      [campaignId, userId]
    );

    if (existingParticipant) {
      return res.status(409).json({
        success: false,
        error: { code: "ALREADY_PARTICIPATING", message: "You have already joined this campaign." },
        data: null,
      });
    }

    // Add participant
    await runQueryOne(
      `INSERT INTO campaign_participants (campaign_id, user_id) VALUES (:1, :2)`,
      [campaignId, userId]
    );

    // Log audit
    await createAuditLog(userId, "campaign_join", "campaign_participants", campaignId, {
      campaign_id: campaignId,
      user_id: userId,
    });

    res.status(200).json({
      success: true,
      data: { message: "Successfully joined the campaign." },
      error: null,
    });
  } catch (err) {
    console.error("Join campaign error:", err);
    res.status(500).json({
      success: false,
      error: { code: "CAMPAIGN_JOIN_FAILED", message: "Failed to join campaign." },
      data: null,
    });
  }
});

// GET /api/v1/campaigns/stats - Get campaign stats (admin)
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const stats = await runQuery(
      `SELECT 
         COUNT(*) AS total_campaigns,
         SUM(participants_count) AS total_participants,
         COUNT(CASE WHEN created_by = :1 THEN 1 END) AS admin_created_campaigns
       FROM (
         SELECT c.campaign_id, COUNT(cp.participant_id) AS participants_count, c.created_by
         FROM ngo_campaigns c
         LEFT JOIN campaign_participants cp ON c.campaign_id = cp.campaign_id
         GROUP BY c.campaign_id, c.created_by
       )`
    );

    // Actually let me simplify this
    const statsResult: any = await runQueryOne(
      `SELECT 
         COUNT(*) AS total_campaigns,
         (SELECT COUNT(*) FROM campaign_participants) AS total_participants
       FROM ngo_campaigns`
    );

    const camelStats = toCamelCase(statsResult);

    res.status(200).json({
      success: true,
      data: { stats: camelStats },
      error: null,
    });
  } catch (err) {
    console.error("Get campaign stats error:", err);
    res.status(500).json({
      success: false,
      error: { code: "CAMPAIGN_STATS_FAILED", message: "Failed to fetch campaign stats." },
      data: null,
    });
  }
});

export default router;