import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import env from "../config";
import { runQueryOne } from "../database/pool";

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: { code: "NOT_AUTHENTICATED", message: "Bearer access token required." },
      data: null,
    });
  }

  try {
    const decoded = jwt.verify(authorization.slice(7), env.JWT_ACCESS_SECRET) as {
      userId?: number;
      type?: string;
    };

    if (decoded.type !== "access" || !decoded.userId) {
      throw new Error("Invalid access token");
    }

    const user = await runQueryOne(
      `SELECT user_id, role, is_active FROM users WHERE user_id = :1`,
      [decoded.userId]
    ) as any;

    if (!user || Number(user.IS_ACTIVE) !== 1) {
      return res.status(401).json({
        success: false,
        error: { code: "NOT_AUTHENTICATED", message: "Account is invalid or inactive." },
        data: null,
      });
    }

    (req as any).user = {
      userId: Number(user.USER_ID),
      role: user.ROLE,
    };
    next();
  } catch {
    return res.status(401).json({
      success: false,
      error: { code: "INVALID_ACCESS_TOKEN", message: "Access token is invalid or expired." },
      data: null,
    });
  }
};
