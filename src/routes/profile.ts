import { Router, Request, Response } from "express";
import { z } from "zod";
import * as oracledb from "oracledb";
import { runQueryOne, runQuery } from "../database/pool";
import env from "../config";
import { toCamelCase, mapBooleanFields } from "../database/mapper";
import { createAuditLog } from "../middleware/audit";

const router = Router();

// Validation schemas
const updateProfileSchema = z.object({
  username: z.string().min(1, "Username required").optional(),
  email: z.string().email("Invalid email").optional(),
  phone: z
    .string()
    .regex(/^9[78]\d{8}$/, "Nepali phone must start with 97 or 98")
    .optional(),
  blood_group: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]).optional(),
});

const updateLocationSchema = z.object({
  latitude: z.number().min(-90).max(90, "Latitude must be between -90 and 90"),
  longitude: z.number().min(-180).max(180, "Longitude must be between -180 and 180"),
});

const updateDonorAvailabilitySchema = z.object({
  is_available: z.boolean(),
});

// GET /me - Get current user profile
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: "NOT_AUTHENTICATED", message: "User not authenticated." },
        data: null,
      });
    }

    const user = await runQueryOne(
      `SELECT user_id, username, email, phone, role, is_active, is_available, blood_group, last_donated_at, created_at
       FROM users WHERE user_id = :1`,
      [userId]
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: "USER_NOT_FOUND", message: "User not found." },
        data: null,
      });
    }

    const camelUser = toCamelCase(user) as {
      userId: number;
      username: string;
      email: string;
      phone: string | null;
      role: string;
      isActive: number;
      isAvailable: number;
      bloodGroup: string | null;
      lastDonatedAt: string | null;
      createdAt: string;
    };

    const userResponse = {
      user_id: camelUser.userId,
      username: camelUser.username,
      email: camelUser.email,
      phone: camelUser.phone,
      role: camelUser.role,
      is_active: camelUser.isActive,
      is_available: camelUser.isAvailable,
      blood_group: camelUser.bloodGroup,
      last_donated_at: camelUser.lastDonatedAt,
      created_at: camelUser.createdAt,
    };

    res.status(200).json({
      success: true,
      data: userResponse,
      error: null,
    });
  } catch (err) {
    console.error("Get profile error:", err);
    res.status(500).json({
      success: false,
      error: { code: "PROFILE_FETCH_FAILED", message: "Failed to fetch profile." },
      data: null,
    });
  }
});

// PATCH /me - Update profile
router.patch("/", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: "NOT_AUTHENTICATED", message: "User not authenticated." },
        data: null,
      });
    }

    const result = updateProfileSchema.safeParse(req.body);

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

    const updates = result.data;
    if (updates.blood_group && (req as any).user?.role !== "donor") {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Only donor accounts can update blood group." },
        data: null,
      });
    }
    const updateFields: string[] = [];
    const binds: any[] = [];
    let bindIndex = 1;

    if (updates.username !== undefined) {
      updateFields.push(`username = :${bindIndex}`);
      binds.push(updates.username);
      bindIndex++;
    }

    if (updates.email !== undefined) {
      updateFields.push(`email = :${bindIndex}`);
      binds.push(updates.email);
      bindIndex++;
    }

    if (updates.phone !== undefined) {
      updateFields.push(`phone = :${bindIndex}`);
      binds.push(updates.phone);
      bindIndex++;
    }

    if (updates.blood_group !== undefined) {
      updateFields.push(`blood_group = :${bindIndex}`);
      binds.push(updates.blood_group);
      bindIndex++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: "NO_UPDATES", message: "No fields to update." },
        data: null,
      });
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

    const query = `UPDATE users SET ${updateFields.join(", ")} WHERE user_id = :${bindIndex} RETURNING user_id`;
    binds.push(userId);

    const updated: any = await runQueryOne(query, binds);
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: { code: "USER_NOT_FOUND", message: "User not found." },
        data: null,
      });
    }

    // Log audit
    await createAuditLog(userId, "profile_update", "users", userId, {
      updated_fields: Object.keys(updates),
    });

    const user = await runQueryOne(
      `SELECT user_id, username, email, phone, role, is_active, last_donated_at, created_at
       FROM users WHERE user_id = :1`,
      [userId]
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: "USER_NOT_FOUND", message: "User not found." },
        data: null,
      });
    }

    const camelUser = toCamelCase(user) as {
      userId: number;
      username: string;
      email: string;
      phone: string | null;
      role: string;
      isActive: number;
      lastDonatedAt: string | null;
      createdAt: string;
    };

    const userResponse = {
      user_id: camelUser.userId,
      username: camelUser.username,
      email: camelUser.email,
      phone: camelUser.phone,
      role: camelUser.role,
      is_active: camelUser.isActive,
      last_donated_at: camelUser.lastDonatedAt,
      created_at: camelUser.createdAt,
    };

    res.status(200).json({
      success: true,
      data: userResponse,
      error: null,
    });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({
      success: false,
      error: { code: "PROFILE_UPDATE_FAILED", message: "Failed to update profile." },
      data: null,
    });
  }
});

// PATCH /me/location - Update user location
router.patch("/location", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: "NOT_AUTHENTICATED", message: "User not authenticated." },
        data: null,
      });
    }

    const result = updateLocationSchema.safeParse(req.body);

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

    const { latitude, longitude } = result.data;

    // Update user location
    await runQueryOne(
      "UPDATE users SET latitude = :1, longitude = :2, updated_at = CURRENT_TIMESTAMP WHERE user_id = :3",
      [
        { val: latitude, dir: oracledb.BIND_IN },
        { val: longitude, dir: oracledb.BIND_IN },
        { val: userId, dir: oracledb.BIND_IN },
      ]
    );

    // Log audit
    await createAuditLog(userId, "location_update", "users", userId, {
      latitude,
      longitude,
    });

    res.status(200).json({
      success: true,
      data: { latitude, longitude },
      error: null,
    });
  } catch (err) {
    console.error("Update location error:", err);
    res.status(500).json({
      success: false,
      error: { code: "LOCATION_UPDATE_FAILED", message: "Failed to update location." },
      data: null,
    });
  }
});

// PATCH /me/donor-availability - Update donor availability
router.patch("/donor-availability", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: "NOT_AUTHENTICATED", message: "User not authenticated." },
        data: null,
      });
    }

    const result = updateDonorAvailabilitySchema.safeParse(req.body);

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

    const { is_available } = result.data;

    const updated = await runQueryOne(
      `UPDATE users
       SET is_available = :1, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = :2 AND role = 'donor'
       RETURNING user_id`,
      [is_available ? 1 : 0, userId]
    );
    if (!updated) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Only donor accounts can update donor availability." },
        data: null,
      });
    }

    // Log audit
    await createAuditLog(userId, "donor_availability_update", "users", userId, {
      is_available,
    });

    res.status(200).json({
      success: true,
      data: { is_available },
      error: null,
    });
  } catch (err) {
    console.error("Update donor availability error:", err);
    res.status(500).json({
      success: false,
      error: { code: "DONOR_AVAILABILITY_UPDATE_FAILED", message: "Failed to update donor availability." },
      data: null,
    });
  }
});

export default router;