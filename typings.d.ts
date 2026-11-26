import * as express from "express";

// Extend Request type to include audit property
declare global {
  namespace Express {
    interface Request {
      audit?: {
        userId?: number;
        startTime: number;
        actions: string[];
      };
      facilityId?: number | null;
    }
    interface User {
      userId?: number;
      role?: string;
    }
  }
}