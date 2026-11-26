import { Router, Request, Response } from "express";
import { z } from "zod";
import { runQuery, runQueryOne } from "../database/pool";
import { toCamelCase } from "../database/mapper";
import { createAuditLog } from "../middleware/audit";

const router = Router();

// GET /api/v1/rewards - Get user's rewards
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

    const rewards = await runQueryOne(
      `SELECT reward_id, user_id, points, tier, updated_at FROM rewards WHERE user_id = :1`,
      [userId]
    );

    if (!rewards) {
      return res.status(200).json({
        success: true,
        data: { rewards: null },
        error: null,
      });
    }

    const camelRewards = toCamelCase(rewards);

    res.status(200).json({
      success: true,
      data: { rewards: camelRewards },
      error: null,
    });
  } catch (err) {
    console.error("Get rewards error:", err);
    res.status(500).json({
      success: false,
      error: { code: "REWARDS_FETCH_FAILED", message: "Failed to fetch rewards." },
      data: null,
    });
  }
});

// POST /api/v1/rewards/:id/redeem - Redeem rewards points
router.post("/:id/redeem", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { id } = req.params;
    const { points_to_redeem } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: "NOT_AUTHENTICATED", message: "User not authenticated." },
        data: null,
      });
    }

    const rewardId = Number(id);

    // Check user's current points
    const rewards = await runQueryOne(
      `SELECT points, tier FROM rewards WHERE user_id = :1`,
      [userId]
    );

    if (!rewards) {
      return res.status(404).json({
        success: false,
        error: { code: "REWARDS_NOT_FOUND", message: "No rewards record found." },
        data: null,
      });
    }

    const pointsAvailable = Number(rewards.POINTS ?? rewards.points);

    // If points_to_redeem not specified, redeem all available
    const pointsRedeem = points_to_redeem ? Math.min(points_to_redeem, pointsAvailable) : pointsAvailable;

    if (pointsRedeem <= 0) {
      return res.status(400).json({
        success: false,
        error: { code: "INSUFFICIENT_POINTS", message: "No points available to redeem." },
        data: null,
      });
    }

    // Redeem points - subtract from balance (optimistic WHERE guard against overspend)
    const redemptionResult: any = await runQueryOne(
      `UPDATE rewards
       SET points = points - :1, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = :2 AND points >= :1
       RETURNING reward_id, user_id, points, tier`,
      [pointsRedeem, userId]
    );

    if (!redemptionResult) {
      return res.status(400).json({
        success: false,
        error: { code: "INSUFFICIENT_POINTS", message: "Not enough points to redeem." },
        data: null,
      });
    }

    // The user's own reward record is the source of truth for reward_id
    const ownReward: any = await runQueryOne(
      `SELECT reward_id FROM rewards WHERE user_id = :1`,
      [userId]
    );
    const actualRewardId = Number((ownReward as any)?.REWARD_ID ?? ownReward?.reward_id ?? rewardId);

    const camelResult = toCamelCase(redemptionResult);

    // Create redemption record
    await runQueryOne(
      `INSERT INTO reward_redemptions (user_id, reward_id, redemption_type, points_spent)
       VALUES (:1, :2, 'points_redeem', :3)`,
      [userId, actualRewardId, pointsRedeem]
    );

    // Log audit
    await createAuditLog(userId, "reward_redeem", "reward_redemptions", actualRewardId, {
      points_redeemed: pointsRedeem,
      points_before: pointsAvailable,
      points_after: pointsAvailable - pointsRedeem,
    });

    res.status(200).json({
      success: true,
      data: { redemption: camelResult },
      error: null,
    });
  } catch (err) {
    console.error("Redeem rewards error:", err);
    res.status(500).json({
      success: false,
      error: { code: "REWARD_REDEEM_FAILED", message: "Failed to redeem rewards." },
      data: null,
    });
  }
});

// GET /api/v1/rewards/redemptions - Get user's redemption history
router.get("/redemptions", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: "NOT_AUTHENTICATED", message: "User not authenticated." },
        data: null,
      });
    }

    const redemptions = await runQuery(
      `SELECT 
         redemption_id,
         reward_id,
         points_spent,
         redemption_type,
         redeemed_at
       FROM reward_redemptions
       WHERE user_id = :1
       ORDER BY redeemed_at DESC`,
      [userId]
    );

    const camelRedemptions = (redemptions as any[]).map(toCamelCase);

    res.status(200).json({
      success: true,
      data: { redemptions: camelRedemptions },
      error: null,
    });
  } catch (err) {
    console.error("Get redemptions error:", err);
    res.status(500).json({
      success: false,
      error: { code: "REDEMPTIONS_FETCH_FAILED", message: "Failed to fetch redemptions." },
      data: null,
    });
  }
});

export default router;