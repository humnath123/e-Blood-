import { Router, Request, Response } from "express";
import { z } from "zod";
import * as oracledb from "oracledb";
import { runQueryOne, runQuery, withTransaction } from "../database/pool";
import { toCamelCase } from "../database/mapper";
import { createAuditLog } from "../middleware/audit";

const router = Router();

// Validation schemas
const createOrderSchema = z.object({
  inventory_id: z.number().int().positive("Invalid inventory ID"),
  units_ordered: z.number().min(1).default(1),
});

const updateOrderStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled']),
  payment_status: z.enum(['pending', 'paid', 'failed', 'refunded']).optional(),
});

// POST /api/v1/orders - Create new order (with stock locking and 5% donor discount)
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

    const result = createOrderSchema.safeParse(req.body);

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

    const { inventory_id, units_ordered } = result.data;

    // Use withTransaction for proper transaction management
    const transactionResult = await withTransaction(async (conn) => {
      // First, check if user has donated before for 5% discount
      const userDonationCheck = await conn.execute(
        `SELECT last_donated_at FROM users WHERE user_id = :1`,
        [userId],
        { autoCommit: false }
      );
      const donationRows = userDonationCheck.rows ?? [];
      const hasDonated = donationRows.length > 0 && (donationRows[0] as any).LAST_DONATED_AT !== null;

      // Check inventory stock with FOR UPDATE lock
      const stockResult = await conn.execute(
        `SELECT units, blood_group, component, bank_id FROM blood_inventory WHERE inventory_id = :1 AND bank_id = :2 FOR UPDATE`,
        [inventory_id, facilityId],
        { autoCommit: false }
      );

      const stockRows = stockResult.rows ?? [];
      if (stockRows.length === 0) {
        return { success: false, error: "Inventory item not found or not accessible to this facility" };
      }

      const stockUnitRow = stockRows[0] as any;
      const stockUnits = Number(stockUnitRow.UNITS ?? stockUnitRow.units);

      // Check if sufficient stock exists
      if (stockUnits < units_ordered) {
        return { success: false, error: "Insufficient stock available" };
      }

      // Calculate discount: 5% if user has donated before
      const discountPercent = hasDonated ? 5 : 0;
      const discountAmount = Math.round(units_ordered * 0.05 * 100) / 100; // round to 2 decimal places for display

      // Create the order with discounted units calculation
      // For now, we track the discount but order uses full units_ordered
      // The discount can be applied to total_amount payment later
      const orderStatus = hasDonated ? 'pending' : 'pending';

      // Insert the order (RETURNING order_id INTO an out bind)
      const insertResult: any = await conn.execute(
        `INSERT INTO orders (user_id, inventory_id, units_ordered, status, discount_applied, payment_status)
         VALUES (:user_id, :inventory_id, :units, 'pending', :discount, 'pending')
         RETURNING order_id INTO :order_id`,
        [
          { val: userId, dir: oracledb.BIND_IN },
          { val: inventory_id, dir: oracledb.BIND_IN },
          { val: units_ordered, dir: oracledb.BIND_IN },
          { val: discountPercent, dir: oracledb.BIND_IN },
          { val: 0, dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        ],
        { autoCommit: false }
      );

      const orderId = insertResult.outBinds.order_id;

      // Decrement stock
      await conn.execute(
        `UPDATE blood_inventory SET units = units - :1, updated_at = CURRENT_TIMESTAMP WHERE inventory_id = :2`,
        [units_ordered, inventory_id],
        { autoCommit: false }
      );

      // Return the created order details
      const orderQuery = await conn.execute(
        `SELECT order_id, user_id, inventory_id, units_ordered, status, discount_applied, payment_status, total_amount, created_at, updated_at FROM orders WHERE order_id = :1`,
        [orderId],
        { autoCommit: false }
      );

      const orderRows = orderQuery.rows ?? [];
      if (orderRows.length === 0) {
        throw new Error("Created order could not be reloaded");
      }
      const camelOrder = toCamelCase(orderRows[0] as Record<string, any>);

      return { success: true, result: camelOrder, orderId: Number(orderId) };
    });

    if (!transactionResult.success) {
      return res.status(400).json({
        success: false,
        error: { code: "ORDER_CREATION_FAILED", message: transactionResult.error || "Failed to create order." },
        data: null,
      });
    }

    const order = transactionResult.result;
    const createdOrderId = transactionResult.orderId;
    if (!order || createdOrderId === undefined) {
      throw new Error("Order transaction returned no order");
    }

    // Log audit
    await createAuditLog(userId, "order_create", "orders", createdOrderId, {
      inventory_id,
      units_ordered,
      discount_applied: order.discount_applied,
    });

    res.status(201).json({
      success: true,
      data: { order },
      error: null,
    });
  } catch (err) {
    console.error("Create order error:", err);
    res.status(500).json({
      success: false,
      error: { code: "ORDER_CREATION_FAILED", message: "Failed to create order. Please try again." },
      data: null,
    });
  }
});

// GET /api/v1/orders - Get user's orders
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

    const orders = await runQuery(
      `SELECT 
         order_id,
         user_id,
         inventory_id,
         units_ordered,
         status,
         payment_status,
         total_amount,
         created_at,
         updated_at
       FROM orders
       WHERE user_id = :1
       ORDER BY created_at DESC`,
      [userId]
    );

    const camelOrders = orders.map(toCamelCase);

    res.status(200).json({
      success: true,
      data: { orders: camelOrders },
      error: null,
    });
  } catch (err) {
    console.error("Get orders error:", err);
    res.status(500).json({
      success: false,
      error: { code: "ORDERS_FETCH_FAILED", message: "Failed to fetch orders." },
      data: null,
    });
  }
});

// PATCH /api/v1/orders/:id/status - Update order status (staff only)
router.patch("/:id/status", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const facilityId = (req as any).facilityId;
    const { id } = req.params;
    const { status, payment_status } = req.body;

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
        error: { code: "FORBIDDEN", message: "Facility required." },
        data: null,
      });
    }

    const result = updateOrderStatusSchema.safeParse(req.body);

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

    // Check if order exists and belongs to this facility (via inventory)
    const orderCheck = await runQueryOne(
      `SELECT o.order_id, i.bank_id, o.status, o.payment_status
       FROM orders o
       JOIN blood_inventory i ON o.inventory_id = i.inventory_id
       WHERE o.order_id = :1 AND i.bank_id = :2`,
      [Number(id), facilityId]
    );

    if (!orderCheck) {
      return res.status(404).json({
        success: false,
        error: { code: "ORDER_NOT_FOUND", message: "Order not found." },
        data: null,
      });
    }

    // Update order status
    const updateResult: any = await runQueryOne(
      `UPDATE orders
       SET status = :1, payment_status = NVL(:2, payment_status), updated_at = CURRENT_TIMESTAMP
       WHERE order_id = :3
       RETURNING order_id, user_id, inventory_id, units_ordered, status, payment_status, total_amount, created_at, updated_at`,
      [status, payment_status ? payment_status : null, Number(id)]
    );

    const camelResult = toCamelCase(updateResult);

    // Log audit
    await createAuditLog(userId, "order_status_update", "orders", Number(id), {
      status,
      payment_status,
    });

    res.status(200).json({
      success: true,
      data: { order: camelResult },
      error: null,
    });
  } catch (err) {
    console.error("Update order status error:", err);
    res.status(500).json({
      success: false,
      error: { code: "ORDER_STATUS_UPDATE_FAILED", message: "Failed to update order status." },
      data: null,
    });
  }
});

export default router;