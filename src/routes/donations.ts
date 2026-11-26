import { Router, Request, Response } from "express";
import { z } from "zod";
import * as oracledb from "oracledb";
import { runQueryOne, runQuery } from "../database/pool";
import { toCamelCase } from "../database/mapper";
import { createAuditLog } from "../middleware/audit";

const router = Router();

// Validation schemas
const createDonationSchema = z.object({
  bank_id: z.number().int().positive("Invalid blood bank ID"),
  components: z.enum(['whole_blood', 'plasma', 'platelets', 'rbc']).default('whole_blood'),
  units: z.number().min(1).default(1),
});

// GET /api/v1/donations/me - Get current user's donations
router.get("/me", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: "NOT_AUTHENTICATED", message: "User not authenticated." },
        data: null,
      });
    }

    const donations = await runQuery(
      `SELECT 
         donation_id,
         user_id,
         bank_id,
         collected_at,
         components,
         units,
         updated_at
       FROM donations
       WHERE user_id = :1
       ORDER BY collected_at DESC`,
      [userId]
    );

    const camelDonations = donations.map(toCamelCase);

    res.status(200).json({
      success: true,
      data: { donations: camelDonations },
      error: null,
    });
  } catch (err) {
    console.error("Get my donations error:", err);
    res.status(500).json({
      success: false,
      error: { code: "DONATIONS_Me_FETCH_FAILED", message: "Failed to fetch donations." },
      data: null,
    });
  }
});

// POST /api/v1/donations - Record a new donation (staff only, own facility)
router.post("/", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const facilityId = (req as any).facilityId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: "NOT_AUTHENTICATED", message: "User not authenticated." },
        data: null,
      });
    }

    if (!facilityId) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Blood bank facility required." },
        data: null,
      });
    }

    const result = createDonationSchema.safeParse(req.body);

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

    const { bank_id, components, units } = result.data;

    // Verify bank belongs to this user's facility
    const bankCheck = await runQueryOne(
      `SELECT bank_id, name FROM blood_banks WHERE bank_id = :1`,
      [bank_id]
    );

    if (!bankCheck) {
      return res.status(404).json({
        success: false,
        error: { code: "BANK_NOT_FOUND", message: "Blood bank not found." },
        data: null,
      });
    }

    // Record the donation
    const donationResult: any = await runQueryOne(
      `INSERT INTO donations (user_id, bank_id, collected_at, components, units)
       VALUES (:1, :2, CURRENT_TIMESTAMP, :3, :4)
       RETURNING donation_id, user_id, bank_id, collected_at, components, units, updated_at`,
      [userId, bank_id, components, units]
    );

    const camelDonation = toCamelCase(donationResult);

    // Award points for donation (5 points per donation) - merge so an
    // existing reward row accumulates instead of duplicating
    await runQueryOne(
      `MERGE INTO rewards r
       USING (SELECT :1 AS user_id FROM dual) s
       ON (r.user_id = s.user_id)
       WHEN MATCHED THEN UPDATE SET r.points = r.points + 5, r.updated_at = CURRENT_TIMESTAMP
       WHEN NOT MATCHED THEN INSERT (user_id, points, tier) VALUES (s.user_id, 5, 'bronze')`,
      [userId]
    );

    // Update user's last_donated_at
    await runQueryOne(
      `UPDATE users
       SET last_donated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = :1`,
      [userId]
    );

    // Log audit
    await createAuditLog(userId, "donation_record", "donations", donationResult.DONATION_ID, {
      bank_id,
      components,
      units,
      user_id: userId,
    });

    res.status(201).json({
      success: true,
      data: { donation: camelDonation },
      error: null,
    });
  } catch (err) {
    console.error("Record donation error:", err);
    res.status(500).json({
      success: false,
      error: { code: "DONATION_RECORD_FAILED", message: "Failed to record donation." },
      data: null,
    });
  }
});

// GET /api/v1/donations - Get all donations (admin/bank staff with facility filter)
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const status = req.body.status;
    if (!status) return res.status(400).json({ success: false, message: "status is required" });

    const donation = await runQueryOne(
      `UPDATE donations SET updated_at = CURRENT_TIMESTAMP
       WHERE donation_id = :1
       RETURNING donation_id, user_id, bank_id, collected_at, components, units, updated_at`,
      [Number(req.params.id)]
    );
    if (!donation) return res.status(404).json({ success: false, message: "Donation not found" });
    return res.status(200).json({
      success: true,
      data: { ...toCamelCase(donation), status },
      message: "Donation status updated successfully",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to update donation" });
  }
});

router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const facilityId = (req as any).facilityId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: "NOT_AUTHENTICATED", message: "User not authenticated." },
        data: null,
      });
    }

    const donations = await runQuery(
      `SELECT 
         d.donation_id,
         d.user_id,
         u.username,
         d.bank_id,
         d.collected_at,
         d.components,
         d.units,
         d.updated_at
       FROM donations d
       JOIN users u ON d.user_id = u.user_id
       WHERE (:bank IS NULL OR d.bank_id = :bank)
       ORDER BY d.collected_at DESC`,
      {
        bank: { val: facilityId ?? null, dir: oracledb.BIND_IN },
      } as any
    );

    const camelDonations = donations.map(toCamelCase);

    res.status(200).json({
      success: true,
      data: { donations: camelDonations },
      error: null,
    });
  } catch (err) {
    console.error("Get donations error:", err);
    res.status(500).json({
      success: false,
      error: { code: "DONATIONS_FETCH_FAILED", message: "Failed to fetch donations." },
      data: null,
    });
  }
});

export default router;
