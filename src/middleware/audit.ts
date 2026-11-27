import { Request, Response, NextFunction } from "express";
import * as oracledb from "oracledb";
import { runQuery, runQueryOne } from "../database/pool";
import { toCamelCase } from "../database/mapper";

// Initialize audit log for a request
export const initAudit = (req: Request, res: Response, next: NextFunction) => {
  // Store the start time and user info
  req.audit = {
    userId: (req as any).user?.userId,
    startTime: Date.now(),
    actions: [],
  };
  next();
};

// Log an audit action (middleware wrapper)
export const logAuditAction = (action: string, entityType: string, entityId: number, details?: any) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const auditUserId = (req as any).audit?.userId;
    if (auditUserId) {
      await runQueryOne(
        `INSERT INTO audit_log (user_id, action, entity_type, entity_id, ip_address)
         VALUES (:1, :2, :3, :4, :5)`,
        [
          { val: auditUserId, dir: oracledb.BIND_IN },
          { val: action, dir: oracledb.BIND_IN },
          { val: entityType, dir: oracledb.BIND_IN },
          { val: entityId, dir: oracledb.BIND_IN },
          { val: req.ip, dir: oracledb.BIND_IN },
        ]
      );
    }
    next();
  };
};

// Simple createAuditLog helper for direct use in routes (non-middleware)
// Usage: await createAuditLog(userId, action, entityType, entityId, details, ip)
export const createAuditLog = async (userId: number, action: string, entityType: string, entityId: number, details?: Record<string, any>, ip?: string) => {
  try {
    await runQueryOne(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, ip_address)
       VALUES (:1, :2, :3, :4, :5)`,
      [
        { val: userId || null, dir: oracledb.BIND_IN },
        { val: action, dir: oracledb.BIND_IN },
        { val: entityType, dir: oracledb.BIND_IN },
        { val: entityId, dir: oracledb.BIND_IN },
        { val: ip ?? null, dir: oracledb.BIND_IN },
      ]
    );
  } catch (error) {
    console.warn("Audit log write failed:", error);
  }
};
export const getAuditLogs = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: "NOT_AUTHENTICATED", message: "User not authenticated." },
        data: null,
      });
    }

    // Check admin role
    const userRole = (req as any).user?.role;
    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { code: "RBAC_DENIED", message: "Admin role required." },
        data: null,
      });
    }

    const logs: any[] = await runQuery(
      `SELECT 
         log_id,
         user_id,
         action,
         entity_type,
         entity_id,
         ip_address,
         created_at
       FROM audit_log
       ORDER BY created_at DESC
       FETCH FIRST 100 ROWS ONLY`
    );

    res.status(200).json({
      success: true,
      data: { logs: logs.map(toCamelCase) },
      error: null,
    });
  } catch (err) {
    console.error("Get audit logs error:", err);
    res.status(500).json({
      success: false,
      error: { code: "AUDIT_LOGS_FAILED", message: "Failed to fetch audit logs." },
      data: null,
    });
  }
};