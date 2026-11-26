import { Router, Request, Response } from "express";
import { z } from "zod";
import { runQuery, runQueryOne } from "../database/pool";
import { toCamelCase } from "../database/mapper";
import { createAuditLog } from "../middleware/audit";

const router = Router();

// Helper: check if user has admin role
const requireAdmin = (req: Request, res: Response, next: any) => {
  const user = (req as any).user;
  const userId = user?.userId;
  const role = user?.role;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: { code: "NOT_AUTHENTICATED", message: "User not authenticated." },
    });
  }

  if (role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: { code: "RBAC_DENIED", message: "Admin role required." },
    });
  }

  next();
};

// PATCH /admin/blood-banks/:id/verify - Verify blood bank
router.patch("/blood-banks/:id/verify", async (req: Request, res: Response) => {
  try {
    requireAdmin(req, res, async () => {
      const { id } = req.params;

      const result: any = await runQueryOne(
        `UPDATE blood_banks
         SET is_verified = 1, updated_at = CURRENT_TIMESTAMP
         WHERE bank_id = :1
         RETURNING bank_id, name, is_verified, updated_at`,
        [Number(id)]
      );

      const camelResult = toCamelCase(result);

      // Log audit
      await createAuditLog((req as any).user.userId, "bank_verify", "blood_banks", Number(id), {
        bank_id: Number(id),
        verified: true,
      });

      res.status(200).json({
        success: true,
        data: { bloodBank: camelResult },
        error: null,
      });
    });
  } catch (err) {
    console.error("Verify blood bank error:", err);
    res.status(500).json({
      success: false,
      error: { code: "ADMIN_VERIFY_BANK_FAILED", message: "Failed to verify blood bank." },
      data: null,
    });
  }
});

// PATCH /admin/hospitals/:id/verify - Verify hospital
router.patch("/hospitals/:id/verify", async (req: Request, res: Response) => {
  try {
    requireAdmin(req, res, async () => {
      const { id } = req.params;

      const result: any = await runQueryOne(
        `UPDATE hospitals
         SET is_verified = 1, updated_at = CURRENT_TIMESTAMP
         WHERE hospital_id = :1
         RETURNING hospital_id, name, is_verified, updated_at`,
        [Number(id)]
      );

      const camelResult = toCamelCase(result);

      // Log audit
      await createAuditLog((req as any).user.userId, "hospital_verify", "hospitals", Number(id), {
        hospital_id: Number(id),
        verified: true,
      });

      res.status(200).json({
        success: true,
        data: { hospital: camelResult },
        error: null,
      });
    });
  } catch (err) {
    console.error("Verify hospital error:", err);
    res.status(500).json({
      success: false,
      error: { code: "ADMIN_VERIFY_HOSPITAL_FAILED", message: "Failed to verify hospital." },
      data: null,
    });
  }
});

// GET /admin/stats - Get system stats
router.get("/stats", async (req: Request, res: Response) => {
  try {
    requireAdmin(req, res, async () => {
      const stats: any = await runQueryOne(
        `SELECT 
           (SELECT COUNT(*) FROM users WHERE role = 'patient') AS total_patients,
           (SELECT COUNT(*) FROM users WHERE role = 'donor') AS total_donors,
           (SELECT COUNT(*) FROM users WHERE role = 'bloodbank_staff') AS total_bloodbank_staff,
           (SELECT COUNT(*) FROM users WHERE role = 'hospital_staff') AS total_hospital_staff,
           (SELECT COUNT(*) FROM users WHERE role = 'ngo') AS total_ngo,
           (SELECT COUNT(*) FROM users WHERE role = 'admin') AS total_admin,
           (SELECT COUNT(*) FROM blood_banks) AS total_blood_banks,
           (SELECT COUNT(*) FROM hospitals) AS total_hospitals,
           (SELECT COUNT(*) FROM blood_inventory WHERE units > 0) AS available_units`,
        []
      );

      const camelStats = toCamelCase(stats);

      res.status(200).json({
        success: true,
        data: { stats: camelStats },
        error: null,
      });
    });
  } catch (err) {
    console.error("Get admin stats error:", err);
    res.status(500).json({
      success: false,
      error: { code: "ADMIN_STATS_FAILED", message: "Failed to fetch admin stats." },
      data: null,
    });
  }
});

// PATCH /admin/users/:id/role - Update user role (admin only)
router.patch("/users/:id/role", async (req: Request, res: Response) => {
  try {
    requireAdmin(req, res, async () => {
      const { id } = req.params;
      const { role } = req.body;

      if (!role || !['patient', 'donor', 'bloodbank_staff', 'hospital_staff', 'ngo', 'admin'].includes(role)) {
        return res.status(400).json({
          success: false,
          error: { code: "INVALID_ROLE", message: "Invalid role specified." },
          data: null,
        });
      }

      const result: any = await runQueryOne(
        `UPDATE users
         SET role = :1, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = :2
         RETURNING user_id, username, email, phone, role, is_active`,
        [role, Number(id)]
      );

      const camelResult = toCamelCase(result);

      // Log audit
      await createAuditLog((req as any).user!.userId, "user_role_update", "users", Number(id), {
        old_role: (req as any).user?.role,
        new_role: role,
      });

      res.status(200).json({
        success: true,
        data: { user: camelResult },
        error: null,
      });
    });
  } catch (err) {
    console.error("Update user role error:", err);
    res.status(500).json({
      success: false,
      error: { code: "ADMIN_ROLE_UPDATE_FAILED", message: "Failed to update user role." },
      data: null,
    });
  }
});

export default router;