// @ts-nocheck
import { Router, Request, Response } from "express";
import { runQuery, runQueryOne } from "../database/pool";
import { toCamelCase } from "../database/mapper";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const search = req.query.search as string | undefined;
    const city = req.query.city as string | undefined;
    const where: string[] = [];
    const binds: any[] = [];

    if (search) {
      binds.push(`%${search.toUpperCase()}%`);
      where.push(`UPPER(name) LIKE :${binds.length}`);
    }
    if (city) {
      binds.push(`%${city.toUpperCase()}%`);
      where.push(`UPPER(address) LIKE :${binds.length}`);
    }

    const banks = await runQuery(
      `SELECT bank_id, name, latitude, longitude, address, phone, email, is_verified, created_at, updated_at
       FROM blood_banks
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY name`,
      binds
    );
    return res.status(200).json({ success: true, data: banks.map(toCamelCase), message: "Blood banks retrieved successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to retrieve blood banks" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const bank = await runQueryOne(
      `SELECT bank_id, name, latitude, longitude, address, phone, email, is_verified, created_at, updated_at
       FROM blood_banks WHERE bank_id = :1`,
      [Number(req.params.id)]
    );
    if (!bank) return res.status(404).json({ success: false, message: "Blood bank not found" });

    const inventory = await runQuery(
      `SELECT inventory_id, blood_group, component, units, expiry_date, updated_at
       FROM blood_inventory WHERE bank_id = :1 ORDER BY blood_group, component`,
      [Number(req.params.id)]
    );
    return res.status(200).json({
      success: true,
      data: { ...toCamelCase(bank), inventory: inventory.map(toCamelCase) },
      message: "Blood bank retrieved successfully",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to retrieve blood bank" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const { name, latitude, longitude, address, phone, email } = req.body;
    if (!name || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ success: false, message: "name, latitude and longitude are required" });
    }
    const bank = await runQueryOne(
      `INSERT INTO blood_banks (name, latitude, longitude, address, phone, email)
       VALUES (:1, :2, :3, :4, :5, :6)
       RETURNING bank_id, name, latitude, longitude, address, phone, email, is_verified, created_at`,
      [name, latitude, longitude, address ?? null, phone ?? null, email ?? null]
    );
    return res.status(201).json({ success: true, data: toCamelCase(bank), message: "Blood bank created successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to create blood bank" });
  }
});

router.put("/:id", async (req: Request, res: Response) => {
  try {
    const allowed: Record<string, string> = {
      name: "name", latitude: "latitude", longitude: "longitude",
      address: "address", phone: "phone", email: "email",
      is_verified: "is_verified",
    };
    const fields: string[] = [];
    const binds: any[] = [];
    for (const [key, column] of Object.entries(allowed)) {
      if (req.body[key] !== undefined) {
        binds.push(req.body[key]);
        fields.push(`${column} = :${binds.length}`);
      }
    }
    if (!fields.length) return res.status(400).json({ success: false, message: "No fields to update" });
    binds.push(Number(req.params.id));
    const bank = await runQueryOne(
      `UPDATE blood_banks SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE bank_id = :${binds.length}
       RETURNING bank_id, name, latitude, longitude, address, phone, email, is_verified, updated_at`,
      binds
    );
    if (!bank) return res.status(404).json({ success: false, message: "Blood bank not found" });
    return res.status(200).json({ success: true, data: toCamelCase(bank), message: "Blood bank updated successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to update blood bank" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const bank = await runQueryOne(
      `DELETE FROM blood_banks WHERE bank_id = :1 RETURNING bank_id`,
      [Number(req.params.id)]
    );
    if (!bank) return res.status(404).json({ success: false, message: "Blood bank not found" });
    return res.status(200).json({ success: true, data: null, message: "Blood bank deleted successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to delete blood bank" });
  }
});

export default router;
