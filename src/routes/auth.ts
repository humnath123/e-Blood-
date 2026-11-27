// @ts-nocheck
import { Router, Request, Response } from "express";
import { z } from "zod";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import * as oracledb from "oracledb";
import { runQueryOne, withTransaction } from "../database/pool";
import { toCamelCase } from "../database/mapper";
import env, { env as cfg } from "../config";
import { createAuditLog } from "../middleware/audit";
import { authenticate } from "../middleware/auth";
import { sendRegistrationEmail } from "../services/registration-email";
import logger from "../logger";

// JWT config accessor (config.ts default-exports the normalized env object)
const getJwtConfig = () => ({
  accessSecret: (cfg as any).JWT_ACCESS_SECRET,
  refreshSecret: (cfg as any).JWT_REFRESH_SECRET,
  accessExpires: (cfg as any).JWT_ACCESS_EXPIRES,
  refreshExpires: (cfg as any).JWT_REFRESH_EXPIRES,
});

// Treat blank strings from clients (Flutter/Swagger often send "" for unused
// optional fields) as "not provided" so optional validators don't reject them.
const blankToUndefined = (value: any) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

// Normalise the raw request body before validation:
// - trim/blank -> undefined for every field
// - derive `identifier` from email/phone when the client omits it
const normalizeRegisterBody = (body: any) => {
  if (!body || typeof body !== "object") return body;
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(body)) {
    out[key] = blankToUndefined(value);
  }
  if (!out.identifier) {
    out.identifier = out.email ?? out.phone;
  }
  return out;
};

// Validation schemas
const registerSchema = z.preprocess(
  normalizeRegisterBody,
  z.object({
    identifier: z.string().min(1).optional(),
    email: z.string().email("Invalid email").optional(),
    username: z.string().min(1).optional(),
    phone: z.string().regex(/^9[78]\d{8}$/).optional(),
    bloodGroup: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]).optional(),
    password: z.string().min(6, "Password must be at least 6 characters"),
    role: z.enum(["patient", "donor", "bloodbank_staff", "hospital_staff", "ngo", "admin"]),
  }).refine(
    (value) => Boolean(value.identifier || value.email || value.phone),
    "identifier, email or phone is required"
  ).refine(
    (value) => Boolean(value.identifier || (value.email && value.username)),
    "email and username are required"
  )
);

const loginSchema = z.preprocess(
  (body: any) => {
    if (!body || typeof body !== "object") return body;
    const out: Record<string, any> = {};
    for (const [key, value] of Object.entries(body)) {
      out[key] = blankToUndefined(value);
    }
    if (!out.identifier) {
      out.identifier = out.email ?? out.phone;
    }
    return out;
  },
  z.object({
    identifier: z.string().min(1, "Identifier required").refine(
      (val) => /^9[78]\d{8}$/.test(val) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
      "Identifier must be a valid Nepali phone (starting 97 or 98) or email"
    ),
    password: z.string().min(6, "Password must be at least 6 characters"),
  })
);

// Password hashing helper
const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

// Compare password helper
const comparePassword = async (candidate: string, hash: string): Promise<boolean> => {
  return await bcrypt.compare(candidate, hash);
};

// JWT sign helpers
const signAccessToken = (userId: number): string => {
  const { accessSecret, accessExpires } = getJwtConfig();
  return jwt.sign({ userId, type: "access" }, accessSecret, {
    expiresIn: accessExpires as any,
  });
};

const signRefreshToken = (userId: number): string => {
  const { refreshSecret, refreshExpires } = getJwtConfig();
  return jwt.sign({ userId, type: "refresh" }, refreshSecret, {
    expiresIn: refreshExpires as any,
  });
};

// JWT verify middleware (simple)
const verifyAccessToken = (token: string): { userId: number; type: string } | null => {
  try {
    const decoded: any = jwt.verify(token, getJwtConfig().accessSecret);
    if (decoded.type === "access" && decoded.userId) {
      return { userId: decoded.userId, type: "access" };
    }
    return null;
  } catch {
    return null;
  }
};

// Hash a refresh token for DB storage
const hashRefreshToken = (token: string): string => {
  const crypto = require("crypto");
  return crypto.createHash("sha256").update(token).digest("hex");
};

// Refresh-token expiry helper (7 days, matching JWT_REFRESH_EXPIRES default)
const refreshExpiryDate = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

// Revoke all refresh tokens for a user
const revokeAllUserRefreshTokens = async (userId: number): Promise<void> => {
  await runQueryOne(
    "UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = :1 AND revoked_at IS NULL",
    [userId]
  );
};

// Safe Zod parse
const safeParseZod = (schema: any, obj: any) => {
  const result = schema.safeParse(obj);
  if (!result.success) {
    return { error: result.error };
  }
  return { data: result.data };
};

// Enhanced error handler for Oracle errors
const handleOracleError = (err: any, defaultMsg: string) => {
  if (err.code) {
    switch (err.code) {
      case "ORA-00001":
        return { code: "CONSTRAINT_VIOLATION", message: "Duplicate entry. The resource already exists." };
      case "ORA-02291":
        return { code: "FOREIGN_KEY_VIOLATION", message: "Referenced resource does not exist." };
      case "ORA-12514":
      case "ORA-12541":
        return { code: "DB_CONNECTION_ERROR", message: "Database connection error. Please try again later." };
      case "ORA-01017":
        return { code: "INVALID_CREDENTIALS", message: "Invalid username or password." };
      case "ORA-01403":
        return { code: "NOT_FOUND", message: "Resource not found." };
      default:
        if (err.message?.includes("unique constraint")) {
          return { code: "CONSTRAINT_VIOLATION", message: "Duplicate entry." };
        }
    }
  }
  return { code: "DATABASE_ERROR", message: defaultMsg };
};

const router = Router();

// ============================================================
// POST /auth/register
// ============================================================
router.post("/register", async (req: Request, res: Response) => {
  const result = safeParseZod(registerSchema, req.body);
  if (result.error) {
    return res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: result.error.issues.map((e: any) => e.message).join(", "),
      },
      data: null,
    });
  }

  logger.info("Registration attempt started", { identifier: result.data.identifier ? "[provided]" : result.data.email ? "[email]" : result.data.phone ? "[phone]" : undefined });

  const identifier = result.data.identifier ?? result.data.email ?? result.data.phone;
  const password = result.data.password;
  const role = "PATIENT"; // Default role for registration; can be adjusted based on your app's logic

  try {
    // Check if user already exists (by email or phone)
    logger.info("Checking existing user", { identifier: identifier ? "[provided]" : undefined });
    const existingUser = await runQueryOne(
      "SELECT user_id, password_hash, role FROM users WHERE email = :1 OR phone = :2",
      [identifier, identifier]
    );

    if (existingUser) {
      logger.warn("Registration failed: user already exists", { identifier });
      return res.status(409).json({
        success: false,
        error: {
          code: "CONSTRAINT_VIOLATION",
          message: "User with this email or phone already exists.",
        },
        data: null,
      });
    }

    // Hash password
    logger.info("Hashing password");
    const passwordHash = await hashPassword(password);

    // Determine if identifier is phone or email
    const isPhone = /^9[78]\d{8}$/.test(identifier);
    const username = isPhone
      ? `user_${identifier.slice(-4)}`
      : identifier.split("@")[0];

    // Insert user + store refresh token in one transaction
    const transactionResult = await withTransaction(async (conn: any) => {
      const finalUsername = isPhone ? `user_${identifier.slice(-4)}` : identifier.split("@")[0];

      const userValues = {
        username: finalUsername,
        email: isPhone ? null : identifier,
        phone: isPhone ? identifier : null,
        password_hash: passwordHash,
        role: role,
        blood_group: result.data.bloodGroup ?? null,
      };

      try {
        await conn.execute(
          `INSERT INTO users (user_id, username, email, phone, password_hash, role, blood_group)
           VALUES (seq_users.NEXTVAL, :username, :email, :phone, :password_hash, :role, :blood_group)`,
          userValues,
          { autoCommit: false }
        );
      } catch (insertError: any) {
        throw insertError;
      }

      const userRes: any = await conn.execute(
        `SELECT user_id FROM users WHERE username = :1`,
        [finalUsername],
        { autoCommit: false, outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const userId: number = userRes.rows[0].USER_ID;

      // Store refresh token hash for the new user
      const refreshToken = signRefreshToken(userId);
      const refreshTokenHash = hashRefreshToken(refreshToken);

      await conn.execute(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, revoked_at)
         VALUES (:user_id, :token_hash, :expires_at, NULL)`,
        [
          { val: userId, dir: oracledb.BIND_IN },
          { val: refreshTokenHash, dir: oracledb.BIND_IN },
          { val: refreshExpiryDate(), dir: oracledb.BIND_IN },
        ],
        { autoCommit: false }
      );

      // withTransaction commits this
      return { success: true, result: { userId, refreshToken } };
    });

    if (!transactionResult.success) {
      logger.error("Registration transaction failed", { error: transactionResult.error });
      return res.status(500).json({
        success: false,
        error: { code: "TRANSACTION_FAILED", message: "Failed to register user." },
        data: null,
      });
    }

    const { userId, refreshToken } = transactionResult.result!;
    const accessToken = signAccessToken(userId);

    if (!isPhone) {
      void sendRegistrationEmail({
        recipientEmail: identifier,
        userName: identifier.split("@")[0],
        bloodGroup: result.data.bloodGroup,
      }).catch((error: unknown) => {
        logger.error("Registration email delivery failed", { error: error instanceof Error ? error.message : String(error) });
      });
    }

    // Return response (exclude password hash)
    const userResponse = {
      user_id: userId,
      username,
      email: isPhone ? null : identifier,
      phone: isPhone ? identifier : null,
      role,
      is_active: 1,
    };

    res.status(201).json({
      success: true,
      data: {
        token: accessToken,
        refreshToken,
        user: {
          id: userId,
          email: isPhone ? null : identifier,
          username: isPhone ? `user_${identifier.slice(-4)}` : identifier.split("@")[0],
          firstName: "",
          lastName: "",
          isActive: 1,
          isEmailVerified: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      message: "Registration successful",
      error: null,
    });
  } catch (err: any) {
    logger.error("Registration unexpected error", {
      errorMessage: err.message,
      stack: process.env.NODE_ENV !== "production" ? err.stack : undefined,
    });
    // Handle Oracle-specific errors
    const oracleError = handleOracleError(err, "Registration failed. Please try again.");
    // Map constraint violations (e.g. duplicate username/email/phone) to 409,
    // not a generic 500, so clients can react correctly.
    const status = oracleError.code === "CONSTRAINT_VIOLATION" ? 409 : 500;
    res.status(status).json({
      success: false,
      error: { code: oracleError.code, message: oracleError.message },
      data: null,
    });
  }
});

// ============================================================
// POST /auth/login
// ============================================================
router.post("/login", async (req: Request, res: Response) => {
  logger.info("Login attempt started", { identifier: req.body.identifier ? "[credential]" : undefined });

  const result = safeParseZod(loginSchema, req.body);
  if (result.error) {
    return res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: result.error.issues.map((e: any) => e.message).join(", "),
      },
      data: null,
    });
  }

  const { identifier, password } = result.data;

  try {
    const isPhone = /^9[78]\d{8}$/.test(identifier);

    logger.info("Querying user by identifier", { identifier: identifier ? "[provided]" : undefined });

    const user: any = await runQueryOne(
      `SELECT user_id, password_hash, role, username, phone, email, is_active
       FROM users WHERE phone = :1 OR email = :2`,
      [identifier, identifier]
    );

    if (!user) {
      logger.warn("Login failed: user not found", { identifier: identifier ? "[provided]" : undefined });
      await createAuditLog(0, "login_failed", "users", 0, {
        identifierMasked: identifier.slice(0, 3) + "*****" + identifier.slice(-4),
      });
      return res.status(401).json({
        success: false,
        error: { code: "AUTH_FAILED", message: "Invalid credentials." },
        data: null,
      });
    }

    // Check if account is active
    if (Number(user.IS_ACTIVE ?? user.is_active) === 0) {
      logger.warn("Login failed: account disabled", { userId: user.user_id });
      return res.status(401).json({
        success: false,
        error: { code: "ACCOUNT_DISABLED", message: "Account is disabled." },
        data: null,
      });
    }

    // Compare password (Oracle column names are UPPER in object output format)
    const passwordValid = await comparePassword(password, user.PASSWORD_HASH ?? user.password_hash);

    if (!passwordValid) {
      logger.warn("Login failed: invalid password", { userId: user.user_id });
      await createAuditLog(Number(user.USER_ID ?? user.user_id), "login_failed", "users", Number(user.USER_ID ?? user.user_id), {
        identifierMasked: identifier.slice(0, 3) + "*****" + identifier.slice(-4),
      });
      return res.status(401).json({
        success: false,
        error: { code: "AUTH_FAILED", message: "Invalid credentials." },
        data: null,
      });
    }

    const userId = Number(user.USER_ID ?? user.user_id);

    // Sign tokens
    const accessToken = signAccessToken(userId);
    const refreshToken = signRefreshToken(userId);

    // Store new refresh token hash
    const refreshTokenHash = hashRefreshToken(refreshToken);
    await runQueryOne(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, revoked_at)
       VALUES (:user_id, :token_hash, :expires_at, NULL)`,
      [
        { val: userId, dir: oracledb.BIND_IN },
        { val: refreshTokenHash, dir: oracledb.BIND_IN },
        { val: refreshExpiryDate(), dir: oracledb.BIND_IN },
      ]
    );

    // Log successful login
    await createAuditLog(userId, "user_login", "users", userId, {
      identifierMasked: identifier.slice(0, 3) + "*****" + identifier.slice(-4),
    });

    // Return response
    const userResponse = {
      user_id: userId,
      username: user.USERNAME ?? user.username,
      email: isPhone ? null : user.EMAIL ?? user.email,
      phone: isPhone ? user.PHONE ?? user.phone : null,
      role: user.ROLE ?? user.role,
      is_active: Number(user.IS_ACTIVE ?? user.is_active),
    };

    res.status(200).json({
      success: true,
      data: {
        token: accessToken,
        refreshToken,
        user: {
          id: userId,
          email: isPhone ? null : user.EMAIL ?? user.email,
          username: user.USERNAME ?? user.username,
          firstName: "",
          lastName: "",
          isActive: Number(user.IS_ACTIVE ?? user.is_active),
          isEmailVerified: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      message: "Login successful",
      error: null,
    });
  } catch (err: any) {
    logger.error("Login unexpected error", {
      errorMessage: err.message,
      stack: process.env.NODE_ENV !== "production" ? err.stack : undefined,
    });
    // Handle Oracle-specific errors
    const oracleError = handleOracleError(err, "Login failed. Please try again.");
    res.status(500).json({
      success: false,
      error: { code: oracleError.code, message: oracleError.message },
      data: null,
    });
  }
});

// ============================================================
// POST /auth/refresh
// ============================================================
router.post("/refresh", async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({
      success: false,
      error: { code: "MISSING_REFRESH_TOKEN", message: "Refresh token required." },
      data: null,
    });
  }

  try {
    // Verify refresh token
    let decoded: any;
    try {
      decoded = jwt.verify(refreshToken, getJwtConfig().refreshSecret);
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: { code: "INVALID_REFRESH_TOKEN", message: "Invalid or expired refresh token." },
        data: null,
      });
    }

    if (!decoded.userId) {
      return res.status(401).json({
        success: false,
        error: { code: "INVALID_REFRESH_TOKEN", message: "Invalid refresh token payload." },
        data: null,
      });
    }

    const userId = Number(decoded.userId);

    // Look up the specific stored token by its hash (rotation: one live token per user)
    const tokenHash = hashRefreshToken(refreshToken);
    const validToken = await runQueryOne(
      "SELECT token_id FROM refresh_tokens WHERE user_id = :1 AND token_hash = :2 AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP",
      [
        { val: userId, dir: oracledb.BIND_IN },
        { val: tokenHash, dir: oracledb.BIND_IN },
      ]
    );

    if (!validToken) {
      return res.status(401).json({
        success: false,
        error: { code: "REVOKED_REFRESH_TOKEN", message: "Refresh token has been revoked." },
        data: null,
      });
    }

    const tokenId = Number((validToken as any).TOKEN_ID ?? (validToken as any).token_id);

    // Revoke the used refresh token (rotation)
    await runQueryOne(
      "UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE token_id = :1",
      [tokenId]
    );

    // Create new refresh token
    const newRefreshToken = signRefreshToken(userId);
    const newRefreshTokenHash = hashRefreshToken(newRefreshToken);
    await runQueryOne(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, revoked_at)
       VALUES (:user_id, :token_hash, :expires_at, NULL)`,
      [
        { val: userId, dir: oracledb.BIND_IN },
        { val: newRefreshTokenHash, dir: oracledb.BIND_IN },
        { val: refreshExpiryDate(), dir: oracledb.BIND_IN },
      ]
    );

    // Sign new access token
    const newAccessToken = signAccessToken(userId);

    // Log token refresh
    await createAuditLog(userId, "token_refresh", "refresh_tokens", userId, {
      action: "refreshed_access_token",
    });

    res.status(200).json({
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
      error: null,
    });
  } catch (err) {
    console.error("Refresh token error:", err);
    res.status(500).json({
      success: false,
      error: { code: "REFRESH_FAILED", message: "Token refresh failed. Please log in again." },
      data: null,
    });
  }
});

// ============================================================
// POST /auth/logout
// ============================================================
router.post("/logout", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    if (userId) {
      await revokeAllUserRefreshTokens(userId);
      await createAuditLog(userId, "user_logout", "users", userId, {
        action: "logged_out",
      });
    }

    res.status(200).json({
      success: true,
      data: { message: "Logged out successfully" },
      error: null,
    });
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({
      success: false,
      error: { code: "LOGOUT_FAILED", message: "Logout failed. Please try again." },
      data: null,
    });
  }
});

// ============================================================
// POST /auth/forgot-password
// ============================================================
router.post("/forgot-password", async (req: Request, res: Response) => {
  const identifier = req.body.identifier ?? req.body.email ?? req.body.phone;
  if (!identifier) {
    return res.status(400).json({
      success: false,
      error: { code: "MISSING_IDENTIFIER", message: "email or phone is required" },
      data: null,
    });
  }

  try {
    const user: any = await runQueryOne(
      "SELECT user_id, username, phone, email FROM users WHERE phone = :phone OR email = :email",
      {
        phone: { val: identifier, dir: oracledb.BIND_IN },
        email: { val: identifier, dir: oracledb.BIND_IN },
      } as any
    );

    if (user) {
      // Generate a 6-digit reset code
      const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

      // In development, log the reset code to console
      console.log(`Password reset code for ${user.USERNAME ?? user.username} (${user.PHONE ?? user.phone ?? user.EMAIL ?? user.email}): ${resetCode}`);

      // TODO: In production, send reset code via SMS/Email
    }

    // Don't reveal whether user exists
    res.status(200).json({
      success: true,
      data: { message: "If an account with that identifier exists, a reset code has been sent." },
      error: null,
    });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({
      success: false,
      error: { code: "FORGOT_PASSWORD_FAILED", message: "Failed to process forgot password request." },
      data: null,
    });
  }
});

// ============================================================
// POST /auth/reset-password
// ============================================================
router.post("/reset-password", async (req: Request, res: Response) => {
  const identifier = req.body.identifier ?? req.body.email;
  const resetCode = req.body.resetCode ?? req.body.otp;
  const newPassword = req.body.newPassword ?? req.body.password;
  if (req.body.confirmPassword !== undefined && req.body.confirmPassword !== newPassword) {
    return res.status(400).json({
      success: false,
      error: { code: "PASSWORD_MISMATCH", message: "Passwords do not match" },
      data: null,
    });
  }

  if (!identifier || !resetCode || !newPassword) {
    return res.status(400).json({
      success: false,
      error: { code: "MISSING_REQUIRED_FIELDS", message: "Reset code and new password required." },
      data: null,
    });
  }

  try {
    const user: any = await runQueryOne(
      "SELECT user_id FROM users WHERE phone = :phone OR email = :email",
      {
        phone: { val: identifier, dir: oracledb.BIND_IN },
        email: { val: identifier, dir: oracledb.BIND_IN },
      } as any
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: "USER_NOT_FOUND", message: "User not found." },
        data: null,
      });
    }

    // TODO: In a real app, verify the reset code against what was stored
    // For now, we'll accept any 6-digit code (development stub)
    if (String(resetCode).length !== 6 || isNaN(Number(resetCode))) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_RESET_CODE", message: "Invalid reset code format." },
        data: null,
      });
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    // Update user password
    await runQueryOne(
      "UPDATE users SET password_hash = :1, updated_at = CURRENT_TIMESTAMP WHERE user_id = :2",
      [
        { val: passwordHash, dir: oracledb.BIND_IN },
        { val: Number(user.USER_ID ?? user.user_id), dir: oracledb.BIND_IN },
      ]
    );

    const userId = Number(user.USER_ID ?? user.user_id);

    // Invalidate all refresh tokens after a password reset
    await revokeAllUserRefreshTokens(userId);

    // Log password reset
    await createAuditLog(userId, "password_reset", "users", userId, {
      action: "password_reset_via_code",
    });

    res.status(200).json({
      success: true,
      data: { message: "Password has been reset successfully." },
      error: null,
    });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({
      success: false,
      error: { code: "RESET_PASSWORD_FAILED", message: "Failed to reset password. Please try again." },
      data: null,
    });
  }
});

// ============================================================
// GET /auth/me - current user profile (authenticated)
// ============================================================
router.get("/me", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const user: any = await runQueryOne(
      `SELECT user_id, username, email, phone, role, is_active, created_at
       FROM users WHERE user_id = :1`,
      [userId]
    );
    if (!user) return res.status(404).json({ success: false, error: { code: "USER_NOT_FOUND", message: "User not found" }, data: null });
    return res.status(200).json({
      success: true,
      data: toCamelCase(user),
      message: "Profile retrieved successfully",
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: { code: "PROFILE_FETCH_FAILED", message: "Failed to retrieve profile" }, data: null });
  }
});

// ============================================================
// POST /auth/password - change password (authenticated)
// ============================================================
router.post("/password", authenticate, async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: { code: "MISSING_REQUIRED_FIELDS", message: "currentPassword and newPassword are required" }, data: null });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ success: false, error: { code: "PASSWORD_TOO_SHORT", message: "New password must be at least 6 characters" }, data: null });
    }

    const userId = (req as any).user?.userId;
    const user: any = await runQueryOne(
      `SELECT password_hash FROM users WHERE user_id = :1`,
      [userId]
    );
    if (!user) return res.status(404).json({ success: false, error: { code: "USER_NOT_FOUND", message: "User not found" }, data: null });

    const valid = await comparePassword(currentPassword, user.PASSWORD_HASH ?? user.password_hash);
    if (!valid) return res.status(401).json({ success: false, error: { code: "WRONG_PASSWORD", message: "Current password is incorrect" }, data: null });

    const passwordHash = await hashPassword(newPassword);
    await runQueryOne(
      `UPDATE users SET password_hash = :1, updated_at = CURRENT_TIMESTAMP WHERE user_id = :2`,
      [
        { val: passwordHash, dir: oracledb.BIND_IN },
        { val: userId, dir: oracledb.BIND_IN },
      ]
    );
    await revokeAllUserRefreshTokens(userId);

    return res.status(200).json({ success: true, data: null, message: "Password updated successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, error: { code: "PASSWORD_UPDATE_FAILED", message: "Failed to update password" }, data: null });
  }
});

// Google sign-in stub
router.post("/google", async (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      message: "Google sign-in stub - not implemented in development mode",
    },
    error: null,
  });
});

export default router;
