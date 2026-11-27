// @ts-nocheck
import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import { runQuery, runQueryOne } from "../database/pool";
import { toCamelCase } from "../database/mapper";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const bloodGroup = req.query.bloodGroup as string | undefined;
    const search = req.query.search as string | undefined;
    const city = req.query.city as string | undefined;
    const where: string[] = ["u.role = 'donor'", "u.is_active = 1"];
    const binds: any[] = [];

    if (bloodGroup) {
      binds.push(bloodGroup);
      where.push(`EXISTS (
        SELECT 1 FROM blood_inventory bi
        JOIN blood_banks bb ON bb.bank_id = bi.bank_id
        WHERE bi.blood_group = :${binds.length}
      )`);
    }
    if (search) {
      binds.push(`%${search.toUpperCase()}%`);
      binds.push(`%${search.toUpperCase()}%`);
      where.push(`(UPPER(u.username) LIKE :${binds.length - 1} OR UPPER(u.email) LIKE :${binds.length})`);
    }

    const rows = await runQuery(
      `SELECT u.user_id, u.username, u.email, u.phone, u.role, u.last_donated_at,
              u.is_active, u.created_at
       FROM users u
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY u.created_at DESC`,
      binds
    );
    return res.status(200).json({ success: true, data: rows.map(toCamelCase), message: "Donors retrieved successfully" });
  } catch (err) {
    console.error("Get donors error:", err);
    return res.status(500).json({ success: false, message: "Failed to retrieve donors" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const donor = await runQueryOne(
      `SELECT user_id, username, email, phone, role, last_donated_at, is_active, created_at
       FROM users WHERE user_id = :1 AND role = 'donor'`,
      [Number(req.params.id)]
    );
    if (!donor) return res.status(404).json({ success: false, message: "Donor not found" });
    return res.status(200).json({ success: true, data: toCamelCase(donor), message: "Donor retrieved successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to retrieve donor" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const { email, username, password, phone, bloodGroup } = req.body;
    if (!email || !username || !password || !phone) {
      return res.status(400).json({ success: false, message: "email, username, password and phone are required" });
    }
    if (bloodGroup && !["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].includes(bloodGroup)) {
      return res.status(400).json({ success: false, message: "Invalid bloodGroup" });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await runQueryOne(
      `INSERT INTO users (user_id, username, email, phone, password_hash, role, blood_group)
       VALUES (seq_users.NEXTVAL, :1, :2, :3, :4, 'donor', :5)
       RETURNING user_id, username, email, phone, role, blood_group, is_active, is_available, created_at`,
      [username, email, phone, passwordHash, bloodGroup ?? null]
    );
    return res.status(201).json({
      success: true,
      data: toCamelCase(result),
      message: "Donor created successfully",
    });
  } catch (err: any) {
    if (err?.code?.startsWith("ORA-00001")) {
      return res.status(409).json({ success: false, message: "Donor already exists" });
    }
    return res.status(500).json({ success: false, message: "Failed to create donor" });
  }
});

router.put("/:id", async (req: Request, res: Response) => {
  try {
    const fields: string[] = [];
    const binds: any[] = [];
    for (const [key, column] of [["username", "username"], ["email", "email"], ["phone", "phone"]] as const) {
      if (req.body[key] !== undefined) {
        binds.push(req.body[key]);
        fields.push(`${column} = :${binds.length}`);
      }
    }
    if (!fields.length) return res.status(400).json({ success: false, message: "No fields to update" });
    binds.push(Number(req.params.id));
    const row = await runQueryOne(
      `UPDATE users SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = :${binds.length} AND role = 'donor'
       RETURNING user_id, username, email, phone, role, is_active, updated_at`,
      binds
    );
    if (!row) return res.status(404).json({ success: false, message: "Donor not found" });
    return res.status(200).json({ success: true, data: toCamelCase(row), message: "Donor updated successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to update donor" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const row = await runQueryOne(
      `UPDATE users SET is_active = 0, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = :1 AND role = 'donor'
       RETURNING user_id`,
      [Number(req.params.id)]
    );
    if (!row) return res.status(404).json({ success: false, message: "Donor not found" });
    return res.status(200).json({ success: true, data: null, message: "Donor deleted successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to delete donor" });
  }
});

export default router;
