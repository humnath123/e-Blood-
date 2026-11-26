import { Router, Request, Response } from "express";
import { z } from "zod";
import { runQuery, runQueryOne } from "../database/pool";
import { toCamelCase } from "../database/mapper";
import { createAuditLog } from "../middleware/audit";

const router = Router();

// Validation schemas
const inventoryItemSchema = z.object({
  blood_group: z.string()
    .regex(/^[A-Z][+-]$/, "Invalid blood group format")
    .refine(
      (val) => ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].includes(val),
      "Blood group must be one of: A+, A-, B+, B-, AB+, AB-, O+, O-"
    ),
  component: z.enum(['whole_blood', 'plasma', 'platelets', 'rbc']),
  units: z.number().min(1).default(1),
  expiry_date: z.string().optional(),
});

const updateInventorySchema = z.object({
  units: z.number().min(0).default(0),
  is_verified: z.boolean().optional(),
});

// GET /api/v1/inventory - Get own facility's inventory (blood bank staff only)
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const facilityId = (req as any).facilityId; // Set by middleware

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

    const inventory = await runQuery(
      `SELECT 
         inventory_id,
         blood_group,
         component,
         units,
         expiry_date,
         last_rested,
         created_at,
         updated_at
       FROM blood_inventory
       WHERE bank_id = :1
       ORDER BY blood_group, expiry_date ASC`,
      [facilityId]
    );

    const camelCaseInventory = inventory.map(toCamelCase);

    res.status(200).json({
      success: true,
      data: { inventory: camelCaseInventory },
      error: null,
    });
  } catch (err) {
    console.error("Get inventory error:", err);
    res.status(500).json({
      success: false,
      error: { code: "INVENTORY_FETCH_FAILED", message: "Failed to fetch inventory." },
      data: null,
    });
  }
});

// POST /api/v1/inventory - Add new inventory item (blood bank staff only)
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

    const result = inventoryItemSchema.safeParse(req.body);

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

    const { blood_group, component, units, expiry_date: rawExpiry } = result.data;

    // expiry_date is required by the schema (NOT NULL); default to +42 days
    // if the client omits it (whole blood shelf life ~42 days)
    const expiry_date = rawExpiry ?? new Date(Date.now() + 42 * 24 * 60 * 60 * 1000).toISOString();

    // Set default component if not provided
    const finalComponent = component || 'whole_blood';

    // Check if inventory item already exists for this blood group/component
    const existing = await runQueryOne(
      `SELECT inventory_id FROM blood_inventory WHERE bank_id = :1 AND blood_group = :2 AND component = :3`,
      [facilityId, blood_group, finalComponent]
    );

    if (existing) {
      // Update existing inventory
      const result = await runQueryOne(
        `UPDATE blood_inventory 
         SET units = units + :1, updated_at = CURRENT_TIMESTAMP
         WHERE bank_id = :2 AND blood_group = :3 AND component = :4
         RETURNING inventory_id, blood_group, component, units, expiry_date, updated_at`,
        [units, facilityId, blood_group, finalComponent]
      );

      if (!result) {
        throw new Error("Inventory update returned no row");
      }
      const camelResult = toCamelCase(result);

      // Log audit
      await createAuditLog(userId, "inventory_restock", "blood_inventory", facilityId, {
        blood_group,
        component: finalComponent,
        units_added: units,
        new_total: camelResult.units,
      });

      res.status(200).json({
        success: true,
        data: { inventory: camelResult },
        error: null,
      });
    } else {
      // Create new inventory item (expiry_date is guaranteed non-null above)
      const result = await runQueryOne(
        `INSERT INTO blood_inventory (bank_id, blood_group, component, units, expiry_date)
         VALUES (:1, :2, :3, :4, TO_TIMESTAMP(:5, 'YYYY-MM-DD HH24:MI:SS'))
         RETURNING inventory_id, blood_group, component, units, expiry_date, updated_at`,
        [facilityId, blood_group, finalComponent, units, expiry_date]
      );

      if (!result) {
        throw new Error("Inventory insert returned no row");
      }
      const camelResult = toCamelCase(result);

      // Log audit
      await createAuditLog(userId, "inventory_add", "blood_inventory", facilityId, {
        blood_group,
        component: finalComponent,
        units_added: units,
        expiry_date,
      });

      res.status(201).json({
        success: true,
        data: { inventory: camelResult },
        error: null,
      });
    }
  } catch (err) {
    console.error("Add inventory error:", err);
    res.status(500).json({
      success: false,
      error: { code: "INVENTORY_ADD_FAILED", message: "Failed to add inventory item." },
      data: null,
    });
  }
});

// PATCH /api/v1/inventory/:id - Update inventory item
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const facilityId = (req as any).facilityId;
    const { id } = req.params;

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

    const result = updateInventorySchema.safeParse(req.body);

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

    const { units } = result.data;

    // Check if inventory item exists and belongs to this facility
    const inventoryCheck = await runQueryOne(
      `SELECT inventory_id, units FROM blood_inventory WHERE inventory_id = :1 AND bank_id = :2`,
      [Number(id), facilityId]
    );

    if (!inventoryCheck) {
      return res.status(404).json({
        success: false,
        error: { code: "INVENTORY_NOT_FOUND", message: "Inventory item not found." },
        data: null,
      });
    }

    // Update units
    const updateResult: any = await runQueryOne(
      `UPDATE blood_inventory 
       SET units = :1, updated_at = CURRENT_TIMESTAMP
       WHERE inventory_id = :2 AND bank_id = :3
       RETURNING inventory_id, blood_group, component, units, expiry_date, updated_at`,
      [units, Number(id), facilityId]
    );

    const camelResult = toCamelCase(updateResult);

    // Log audit
    await createAuditLog(userId, "inventory_update", "blood_inventory", facilityId, {
      inventory_id: Number(id),
      units_before: inventoryCheck?.units,
      units_after: units,
    });

    res.status(200).json({
      success: true,
      data: { inventory: camelResult },
      error: null,
    });
  } catch (err) {
    console.error("Update inventory error:", err);
    res.status(500).json({
      success: false,
      error: { code: "INVENTORY_UPDATE_FAILED", message: "Failed to update inventory item." },
      data: null,
    });
  }
});

// GET /api/v1/inventory/expiring - Get inventory expiring soon
router.get("/expiring", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const facilityId = (req as any).facilityId;
    const { days } = req.query;

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

    const daysNum = days ? Number(days) : 7;

    const expiring = await runQuery(
      `SELECT 
         inventory_id,
         blood_group,
         component,
         units,
         expiry_date,
         (CURRENT_DATE - expiry_date) AS days_until_expiry
       FROM blood_inventory
       WHERE bank_id = :1
         AND expiry_date <= CURRENT_DATE + :2
         AND units > 0
       ORDER BY expiry_date ASC`,
      [facilityId, daysNum]
    );

    const camelExpiring = expiring.map(toCamelCase);

    res.status(200).json({
      success: true,
      data: { expiring: camelExpiring },
      error: null,
    });
  } catch (err) {
    console.error("Get expiring inventory error:", err);
    res.status(500).json({
      success: false,
      error: { code: "INVENTORY_EXPIRING_FAILED", message: "Failed to fetch expiring inventory." },
      data: null,
    });
  }
});

export default router;