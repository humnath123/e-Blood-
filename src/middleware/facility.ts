// Middleware to set facilityId based on user role and profile
// - bloodbank_staff -> their blood_bank (from profile or associated)
// - hospital_staff -> their hospital (from profile or associated)
// - other roles -> facilityId will be null or undefined

import { Request, Response, NextFunction } from "express";
import { runQueryOne } from "../database/pool";

// Type assertion for Request with facilityId
type RequestWithFacility = Request & { facilityId?: number | null };

// Initialize audit log for a request
export const initAudit = (req: Request, res: Response, next: NextFunction) => {
  req.audit = {
    userId: (req as any).user?.userId,
    startTime: Date.now(),
    actions: [],
  };
  next();
};

// Set facility based on user role
export const setFacilityId = async (req: RequestWithFacility, res: Response, next: NextFunction) => {
  const userId = (req as any).user?.userId;

  if (!userId) {
    req.facilityId = null;
    return next();
  }

  try {
    // Determine facility based on role
    let facilityId: number | null = null;

    const role = (req as any).user?.role;

    if (role === 'bloodbank_staff') {
      // Blood bank staff manage facility #1 in this deployment
      // (a blood_banks.staff_user_id link table can be added later;
      // see db/migrations/004)
      facilityId = 1;
    } else if (role === 'hospital_staff') {
      // Hospital staff: facility mapping not yet implemented
      facilityId = null; // TODO: implement hospital staff facility mapping
    }

    req.facilityId = facilityId;
    next();
  } catch (err) {
    console.error("Set facility error:", err);
    req.facilityId = null;
    next();
  }
};

// Middleware to check ownership of resources
export const checkOwnership = (entityType: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: "NOT_AUTHENTICATED", message: "User not authenticated." },
      });
    }

    const resourceId = Number(req.params.id || req.body?.entity_id);

    let query: string;
    let params: any[];

    if (entityType === 'order') {
      query = `SELECT o.user_id, i.bank_id FROM orders o JOIN blood_inventory i ON o.inventory_id = i.inventory_id WHERE o.order_id = :1`;
      params = [resourceId];
    } else if (entityType === 'donation') {
      query = `SELECT user_id FROM donations WHERE donation_id = :1`;
      params = [resourceId];
    } else {
      return next();
    }

    const result: any = await runQueryOne(query, params);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: { code: "RESOURCE_NOT_FOUND", message: "Resource not found." },
      });
    }

    // For orders: check if user owns the order or is affiliated with the facility
    if (entityType === 'order') {
      if (result.USER_ID !== userId) {
        // Check if user is blood bank staff for that facility
        const userRole = (req as any).user?.role;
        if (userRole !== 'bloodbank_staff') {
          return res.status(403).json({
            success: false,
            error: { code: "FORBIDDEN", message: "You do not own this order." },
          });
        }
      }
    }

    next();
  };
};