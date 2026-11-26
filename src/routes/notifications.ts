// @ts-nocheck
import { Router, Request, Response } from "express";
import { runQuery, runQueryOne } from "../database/pool";
import { toCamelCase } from "../database/mapper";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const authenticatedUserId = (req as any).user?.userId;
    const userId = Number(req.query.userId ?? authenticatedUserId);
    if (!userId) return res.status(400).json({ success: false, message: "userId is required" });

    const notifications = await runQuery(
      `SELECT notification_id, recipient_id, type, title, message, is_read, related_id, related_type, created_at
       FROM notifications WHERE recipient_id = :1 ORDER BY created_at DESC`,
      [userId]
    );
    return res.status(200).json({
      success: true,
      data: notifications.map(toCamelCase),
      message: "Notifications retrieved successfully",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to retrieve notifications" });
  }
});

router.post("/:id/read", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const id = Number(req.params.id);
    await runQuery(
      `UPDATE notifications SET is_read = 1 WHERE notification_id = :1 AND recipient_id = :2`,
      [id, userId],
      { autoCommit: true }
    );
    const notification = await runQueryOne(
      `SELECT notification_id, recipient_id, type, title, message, is_read, related_id, related_type, created_at
       FROM notifications WHERE notification_id = :1 AND recipient_id = :2`,
      [id, userId]
    );
    if (!notification) return res.status(404).json({ success: false, message: "Notification not found" });
    return res.status(200).json({ success: true, data: toCamelCase(notification), message: "Notification marked as read" });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to mark notification as read" });
  }
});

router.post("/read-all", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    await runQueryOne(
      `UPDATE notifications SET is_read = 1 WHERE recipient_id = :1 AND is_read = 0`,
      [userId]
    );
    return res.status(200).json({ success: true, data: null, message: "All notifications marked as read" });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to mark notifications as read" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const id = Number(req.params.id);
    const existing = await runQueryOne(
      `SELECT notification_id FROM notifications WHERE notification_id = :1 AND recipient_id = :2`,
      [id, userId]
    );
    if (!existing) return res.status(404).json({ success: false, message: "Notification not found" });
    await runQuery(
      `DELETE FROM notifications WHERE notification_id = :1 AND recipient_id = :2`,
      [id, userId],
      { autoCommit: true }
    );
    return res.status(200).json({ success: true, data: null, message: "Notification deleted successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to delete notification" });
  }
});

export default router;
