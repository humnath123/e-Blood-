// @ts-nocheck
import { Router, Request, Response } from "express";
import { z } from "zod";
import * as oracledb from "oracledb";
import { runQuery } from "../database/pool";
import { toCamelCase } from "../database/mapper";

const router = Router();

// Search schema
const searchSchema = z.object({
  bloodGroup: z.string()
    .regex(/^[A-Z][+-]$/, "Invalid blood group format")
    .refine(
      (val) => ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].includes(val),
      "Blood group must be one of: A+, A-, B+, B-, AB+, AB-, O+, O-"
    ),
  component: z.enum(['whole_blood', 'plasma', 'platelets', 'rbc']).optional(),
  units: z.number().min(1).default(1),
  latitude: z.number().min(-90).max(90, "Latitude must be between -90 and 90").optional(),
  longitude: z.number().min(-180).max(180, "Longitude must be between -180 and 180").optional(),
  radiusKm: z.number().min(0.1).max(200).default(50),
});

// POST /api/v1/search - Search blood banks, hospitals, and donors
router.post("/", async (req: Request, res: Response) => {
  try {
    const result = searchSchema.safeParse(req.body);

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

    const { bloodGroup, component, units, latitude, longitude, radiusKm } = result.data;

    // Use Oracle named bind parameters (:name style) with a binds object.
    // This avoids the NJS-098 error that occurs when positional :1..:N arrays
    // have duplicate placeholder references in the SQL string (e.g., :4 appears
    // twice in the Haversine distance formula). Each named placeholder maps directly
    // to a property in the binds object, so the oracle driver counts correctly.

    // --- Priority 1: Blood Banks with stock (verified only, sorted by distance) ---
    const bankQuery = `
      SELECT 
        bank_id AS "bank_id",
        name,
        latitude,
        longitude,
        address,
        phone,
        email,
        is_verified AS "is_verified",
        (6371 * ACOS(
          COS(RADIANS(:lat)) * COS(RADIANS(latitude)) * COS(RADIANS(longitude) - RADIANS(:lng))
          + SIN(RADIANS(:lat)) * SIN(RADIANS(latitude))
        )) AS distanceKm
      FROM blood_banks
      WHERE is_verified = 1
        AND (
          :lat IS NULL
          OR (6371 * ACOS(
            COS(RADIANS(:lat)) * COS(RADIANS(latitude)) * COS(RADIANS(longitude) - RADIANS(:lng))
            + SIN(RADIANS(:lat)) * SIN(RADIANS(latitude))
          )) <= :radius
        )
      ORDER BY distanceKm ASC
    `;

    // --- Priority 2: Hospitals with stock (verified only, sorted by distance) ---
    const hospitalQuery = `
      SELECT 
        hospital_id AS "hospital_id",
        name,
        latitude,
        longitude,
        address,
        phone,
        email,
        is_verified AS "is_verified",
        (6371 * ACOS(
          COS(RADIANS(:lat)) * COS(RADIANS(latitude)) * COS(RADIANS(longitude) - RADIANS(:lng))
          + SIN(RADIANS(:lat)) * SIN(RADIANS(latitude))
        )) AS distanceKm
      FROM hospitals
      WHERE is_verified = 1
        AND (
          :lat IS NULL
          OR (6371 * ACOS(
            COS(RADIANS(:lat)) * COS(RADIANS(latitude)) * COS(RADIANS(longitude) - RADIANS(:lng))
            + SIN(RADIANS(:lat)) * SIN(RADIANS(latitude))
          )) <= :radius
        )
      ORDER BY distanceKm ASC
    `;

    // --- Priority 3: Compatible available eligible donors in radius ---
    const donorQuery = `
      SELECT 
        user_id AS "user_id",
        username,
        phone,
        blood_group AS "blood_group",
        latitude,
        longitude,
        role,
        (6371 * ACOS(
          COS(RADIANS(:lat)) * COS(RADIANS(latitude)) * COS(RADIANS(longitude) - RADIANS(:lng))
          + SIN(RADIANS(:lat)) * SIN(RADIANS(latitude))
        )) AS distanceKm
      FROM users
      WHERE role = 'donor'
        AND is_active = 1
        AND is_available = 1
        AND blood_group = :blood_group
        AND latitude IS NOT NULL
        AND longitude IS NOT NULL
        AND (last_donated_at IS NULL OR last_donated_at < ADD_MONTHS(CURRENT_TIMESTAMP, -3))
        AND (6371 * ACOS(
          COS(RADIANS(:lat)) * COS(RADIANS(latitude)) * COS(RADIANS(longitude) - RADIANS(:lng))
          + SIN(RADIANS(:lat)) * SIN(RADIANS(latitude))
        )) <= :radius
      ORDER BY distanceKm ASC
    `;

    // Single binds object with named properties - works for all three queries above.
    // Using named binds eliminates the NJS-098 error "X placeholders but Y bind values"
    // because the oracle driver maps each :name to the corresponding property, regardless
    // of how many times the same placeholder appears in the SQL.
    const binds = {
      lat: latitude ?? null,
      lng: longitude ?? null,
      radius: radiusKm,
      blood_group: bloodGroup,
      component: component ?? null,
      units: units,
    };

    // Execute queries in parallel using the same named binds object for all queries.
    const [bankResult, hospitalResult, donorResult] = await Promise.all([
      runQuery<Record<string, any>>(bankQuery, binds),
      runQuery<Record<string, any>>(hospitalQuery, binds),
      runQuery<Record<string, any>>(donorQuery, binds),
    ]);

    // Transform results to camelCase (Oracle returns UPPER_SNAKE_CASE keys)
    const banks = bankResult.map((row) => toCamelCase(row));
    const hospitals = hospitalResult.map((row) => toCamelCase(row));
    // Mask donor phone until they accept a match
    const donors = donorResult.map((row) => ({
      ...toCamelCase(row),
      phone: '*****',
    }));

    res.status(200).json({
      success: true,
      data: {
        bloodBanks: banks,
        hospitals: hospitals,
        donors: donors,
      },
      message: "Search completed successfully",
    });

  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({
      success: false,
      error: { code: "SEARCH_FAILED", message: "Search failed. Please try again." },
      data: null,
    });
  }
});

export default router;