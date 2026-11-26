import { Router, Request, Response } from "express";
import { z } from "zod";
import { runQuery, runQueryOne } from "../database/pool";
import { toCamelCase } from "../database/mapper";
import { createAuditLog } from "../middleware/audit";
import { notifyNearbyBloodResources } from "../services/blood-alerts";

const router = Router();

// Validation schemas
const createRequestSchema = z.object({
  blood_group: z.string()
    .regex(/^[A-Z][+-]$/, "Invalid blood group format")
    .refine(
      (val) => ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].includes(val),
      "Blood group must be one of: A+, A-, B+, B-, AB+, AB-, O+, O-"
    ),
  component: z.enum(['whole_blood', 'plasma', 'platelets', 'rbc']).default('whole_blood'),
  units_needed: z.number().min(1).default(1),
  urgency: z.enum(['normal', 'urgent', 'critical']).default('normal'),
  hospital_id: z.number().int().positive().nullable().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
}).refine(
  (request) => (request.latitude === undefined) === (request.longitude === undefined),
  "latitude and longitude must be provided together"
);

// POST /api/v1/requests - Create new blood request
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

    const result = createRequestSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: result.error.issues.map((e: any) => e.message).join(", "),
        },
        data: null,
      });
    }

    const { blood_group, component, units_needed, urgency, hospital_id, latitude, longitude } = result.data;

    const requestResult: any = await runQueryOne(
      `INSERT INTO blood_requests (user_id, hospital_id, blood_group, component, units_needed, urgency, status)
       VALUES (:1, :2, :3, :4, :5, :6, 'open')
       RETURNING request_id, user_id, hospital_id, blood_group, component, units_needed, urgency, status, created_at`,
      [userId, hospital_id ?? null, blood_group, component, units_needed, urgency]
    );

    if (!requestResult) {
      throw new Error("Blood request insert returned no row");
    }
    const camelRequest = toCamelCase(requestResult);

    // Log audit
    await createAuditLog(userId, "request_create", "blood_requests", Number(requestResult.REQUEST_ID ?? requestResult.request_id), {
      blood_group,
      component,
      units_needed,
      urgency,
    });

    let emailAlerts = { enabled: false, matched: 0, sent: 0, failed: 0 };
    try {
      emailAlerts = await notifyNearbyBloodResources({
        requestId: Number(requestResult.REQUEST_ID ?? requestResult.request_id),
        userId,
        hospitalId: hospital_id,
        bloodGroup: blood_group,
        component,
        unitsNeeded: units_needed,
        urgency,
        latitude,
        longitude,
      });
    } catch (alertError) {
      console.error("Failed to send nearby blood request alerts:", alertError);
      emailAlerts = { enabled: true, matched: 0, sent: 0, failed: 1 };
    }

    res.status(201).json({
      success: true,
      data: { request: camelRequest, emailAlerts },
      error: null,
    });
  } catch (err) {
    console.error("Create request error:", err);
    res.status(500).json({
      success: false,
      error: { code: "REQUEST_CREATION_FAILED", message: "Failed to create blood request." },
      data: null,
    });
  }
});

// GET /api/v1/requests - Get all requests (with optional filters)
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const status = req.query.status as string;
    const bloodGroup = req.query.blood_group as string;

    const query = `
      SELECT 
        r.request_id,
        r.user_id,
        u.username,
        u.phone,
        r.hospital_id,
        r.blood_group,
        r.component,
        r.units_needed,
        r.urgency,
        r.status,
        r.created_at
      FROM blood_requests r
      JOIN users u ON r.user_id = u.user_id
    `;
    const params: any[] = [];
    const where: string[] = [];

    // By default only the user's own requests are listed; pass ?all=1 to list everything
    const showAll = req.query.all === "1";
    if (!showAll && userId) {
      where.push(`r.user_id = :${params.length + 1}`);
      params.push(userId);
    }

    if (bloodGroup) {
      where.push(`r.blood_group = :${params.length + 1}`);
      params.push(bloodGroup);
    }

    if (status) {
      where.push(`r.status = :${params.length + 1}`);
      params.push(status);
    }

    const fullQuery = where.length ? `${query} WHERE ${where.join(" AND ")}` : query;

    const requests = await runQuery(fullQuery, params);

    const camelRequests = requests.map(toCamelCase);

    res.status(200).json({
      success: true,
      data: { requests: camelRequests },
      error: null,
    });
  } catch (err) {
    console.error("Get requests error:", err);
    res.status(500).json({
      success: false,
      error: { code: "REQUESTS_FETCH_FAILED", message: "Failed to fetch blood requests." },
      data: null,
    });
  }
});

// GET /api/v1/requests/:id - Get single request
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;

    const request = await runQueryOne(
      `SELECT 
         r.request_id,
         r.user_id,
         u.username,
         u.phone,
         r.hospital_id,
         r.blood_group,
         r.component,
         r.units_needed,
         r.urgency,
         r.status,
         r.created_at,
         r.updated_at
       FROM blood_requests r
       JOIN users u ON r.user_id = u.user_id
       WHERE r.request_id = :1`,
      [Number(id)]
    );

    if (!request) {
      return res.status(404).json({
        success: false,
        error: { code: "REQUEST_NOT_FOUND", message: "Blood request not found." },
        data: null,
      });
    }

    const camelRequest = toCamelCase(request);

    res.status(200).json({
      success: true,
      data: { request: camelRequest },
      error: null,
    });
  } catch (err) {
    console.error("Get request error:", err);
    res.status(500).json({
      success: false,
      error: { code: "REQUEST_FETCH_FAILED", message: "Failed to fetch blood request." },
      data: null,
    });
  }
});

// PATCH /api/v1/requests/:id/cancel - Cancel a request
router.patch("/:id/cancel", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;

    // Check if request exists
    const requestCheck = await runQueryOne(
      `SELECT request_id, user_id, status FROM blood_requests WHERE request_id = :1`,
      [Number(id)]
    );

    if (!requestCheck) {
      return res.status(404).json({
        success: false,
        error: { code: "REQUEST_NOT_FOUND", message: "Blood request not found." },
        data: null,
      });
    }

    // Check permissions: either the requester can cancel, or staff can
    const isRequester = requestCheck.USER_ID === userId;
    const isStaff = (req as any).user?.role === 'bloodbank_staff' || (req as any).user?.role === 'hospital_staff';

    if (!isRequester && !isStaff) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "You do not have permission to cancel this request." },
        data: null,
      });
    }

    if (requestCheck.STATUS !== 'open') {
      return res.status(400).json({
        success: false,
        error: { code: "CANT_CANCEL", message: "Only open requests can be cancelled." },
        data: null,
      });
    }

    // Cancel the request
    await runQueryOne(
      `UPDATE blood_requests SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE request_id = :1`,
      [Number(id)]
    );

    // Log audit
    await createAuditLog(userId, "request_cancel", "blood_requests", Number(id), {
      request_id: Number(id),
      cancelled_by: userId,
    });

    res.status(200).json({
      success: true,
      data: { message: "Request cancelled successfully." },
      error: null,
    });
  } catch (err) {
    console.error("Cancel request error:", err);
    res.status(500).json({
      success: false,
      error: { code: "REQUEST_CANCEL_FAILED", message: "Failed to cancel request." },
      data: null,
    });
  }
});

// PATCH /api/v1/requests/:id/matches/:matchId/respond - Donor responds to match
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const requestId = Number(req.params.id);
    const allowed: Record<string, string> = {
      bloodGroup: "blood_group",
      unitsRequired: "units_needed",
      urgency: "urgency",
      status: "status",
    };
    const fields: string[] = [];
    const binds: any[] = [];

    for (const [key, column] of Object.entries(allowed)) {
      if (req.body[key] !== undefined) {
        binds.push(req.body[key]);
        fields.push(`${column} = :${binds.length}`);
      }
    }
    if (!fields.length) {
      return res.status(400).json({ success: false, message: "No fields to update" });
    }
    binds.push(requestId);
    const row = await runQueryOne(
      `UPDATE blood_requests SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE request_id = :${binds.length}
       RETURNING request_id, user_id, hospital_id, blood_group, component, units_needed, urgency, status, created_at, updated_at`,
      binds
    );
    if (!row) return res.status(404).json({ success: false, message: "Blood request not found" });
    return res.status(200).json({ success: true, data: toCamelCase(row), message: "Blood request updated successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to update blood request" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const row = await runQueryOne(
      `UPDATE blood_requests SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
       WHERE request_id = :1 AND user_id = :2
       RETURNING request_id`,
      [Number(req.params.id), userId]
    );
    if (!row) return res.status(404).json({ success: false, message: "Blood request not found" });
    return res.status(200).json({ success: true, data: null, message: "Blood request deleted successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to delete blood request" });
  }
});

router.patch("/:id/matches/:matchId/respond", async (req: Request, res: Response) => {
  try {
    const { id, matchId } = req.params;
    const { response } = req.body; // 'accept' or 'decline'
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: "NOT_AUTHENTICATED", message: "User not authenticated." },
        data: null,
      });
    }

    if (!['accept', 'decline'].includes(response)) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_RESPONSE", message: "Response must be 'accept' or 'decline'." },
        data: null,
      });
    }

    // Check if match exists
    const matchCheck = await runQueryOne(
      `SELECT match_id, request_id, user_id, status, contacted FROM request_matches WHERE match_id = :1`,
      [Number(matchId)]
    );

    if (!matchCheck) {
      return res.status(404).json({
        success: false,
        error: { code: "MATCH_NOT_FOUND", message: "Match not found." },
        data: null,
      });
    }

    // Update match status
    const newStatus = response === 'accept' ? 'fulfilled' : 'declined';
    
    const contactRevealed = response === 'accept' ? 1 : matchCheck.CONTACTED;

    await runQueryOne(
      `UPDATE request_matches SET status = :1, contacted = :2 WHERE match_id = :3`,
      [newStatus, contactRevealed, Number(matchId)]
    );

    // If acceptor, also update request status to fulfilled
    if (response === 'accept') {
      // Check if all requests for this blood group from this hospital are fulfilled
      await runQueryOne(
        `UPDATE blood_requests SET status = 'fulfilled' WHERE request_id = :1`,
        [Number(id)]
      );

      // Log that contact was revealed
      await createAuditLog(userId, "match_accept", "request_matches", Number(matchId), {
        match_id: Number(matchId),
        accepted_by: userId,
        contact_revealed: true,
      });
    } else {
      // Log decline
      await createAuditLog(userId, "match_decline", "request_matches", Number(matchId), {
        match_id: Number(matchId),
        declined_by: userId,
      });
    }

    res.status(200).json({
      success: true,
      data: { message: `Donor ${response === 'accept' ? 'accepted' : 'declined'} the match.` },
      error: null,
    });
  } catch (err) {
    console.error("Respond to match error:", err);
    res.status(500).json({
      success: false,
      error: { code: "MATCH_RESPONSE_FAILED", message: "Failed to respond to match." },
      data: null,
    });
  }
});

export default router;