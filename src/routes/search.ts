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

    // Haversine distance (km) inline in each query.
    // Oracle named binds count EACH occurrence, so we use positional :1..:N
    // with an array whose length equals the total number of placeholders.

    // Priority 1: Blood Banks with stock (verified only, sorted by distance)
    // Placeholders: :1=bloodGroup :2=component :3=units :4=lat :5=lng :6=radius
    // :4,:5,:6 each appear twice -> total 9 placeholders
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
          COS(RADIANS(:4)) * COS(RADIANS(latitude)) * COS(RADIANS(longitude) - RADIANS(:5))
          + SIN(RADIANS(:4)) * SIN(RADIANS(latitude))
        )) AS distanceKm
      FROM blood_banks
      WHERE is_verified = 1
        AND (
          :4 IS NULL
          OR (6371 * ACOS(
            COS(RADIANS(:4)) * COS(RADIANS(latitude)) * COS(RADIANS(longitude) - RADIANS(:5))
            + SIN(RADIANS(:4)) * SIN(RADIANS(latitude))
          )) <= :6
        )
        AND EXISTS (
          SELECT 1 FROM blood_inventory bi
          WHERE bi.bank_id = blood_banks.bank_id
            AND bi.blood_group = :1
            AND (:2 IS NULL OR bi.component = :2)
            AND bi.units >= :3
        )
      ORDER BY distanceKm ASC
    `;

    // Priority 2: Hospitals with stock (verified only, sorted by distance)
    // Placeholders: :1=lat :2=lng :3=radius  (each appears twice)
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
          COS(RADIANS(:1)) * COS(RADIANS(latitude)) * COS(RADIANS(longitude) - RADIANS(:2))
          + SIN(RADIANS(:1)) * SIN(RADIANS(latitude))
        )) AS distanceKm
      FROM hospitals
      WHERE is_verified = 1
        AND (
          :1 IS NULL
          OR (6371 * ACOS(
            COS(RADIANS(:1)) * COS(RADIANS(latitude)) * COS(RADIANS(longitude) - RADIANS(:2))
            + SIN(RADIANS(:1)) * SIN(RADIANS(latitude))
          )) <= :3
        )
      ORDER BY distanceKm ASC
    `;

    // Priority 3: Compatible available eligible donors in radius
    // Placeholders: :1=lat :2=lng :3=radius  (each appears twice)
    const donorQuery = `
      SELECT 
        user_id AS "user_id",
        username,
        phone,
        latitude,
        longitude,
        role,
        (6371 * ACOS(
          COS(RADIANS(:1)) * COS(RADIANS(latitude)) * COS(RADIANS(longitude) - RADIANS(:2))
          + SIN(RADIANS(:1)) * SIN(RADIANS(latitude))
        )) AS distanceKm
      FROM users
      WHERE role = 'donor'
        AND is_active = 1
        AND (last_donated_at IS NULL OR last_donated_at < ADD_MONTHS(CURRENT_TIMESTAMP, -3))
        AND (
          :1 IS NULL
          OR (6371 * ACOS(
            COS(RADIANS(:1)) * COS(RADIANS(latitude)) * COS(RADIANS(longitude) - RADIANS(:2))
            + SIN(RADIANS(:1)) * SIN(RADIANS(latitude))
          )) <= :3
        )
      ORDER BY distanceKm ASC
    `;

    // Build bind arrays matching the total placeholder count.
    const latB = latitude ?? null;
    const lngB = longitude ?? null;

    // bank: 1=bloodGroup 2=component 3=units 4=lat(x2) 5=lng(x2) 6=radius(x2)
    const bankBinds = [
      { val: bloodGroup, dir: oracledb.BIND_IN },
      { val: component ?? null, dir: oracledb.BIND_IN },
      { val: units, dir: oracledb.BIND_IN },
      { val: latB, dir: oracledb.BIND_IN },
      { val: latB, dir: oracledb.BIND_IN },
      { val: lngB, dir: oracledb.BIND_IN },
      { val: lngB, dir: oracledb.BIND_IN },
      { val: radiusKm, dir: oracledb.BIND_IN },
      { val: radiusKm, dir: oracledb.BIND_IN },
    ];

    // hospital/donor: 1=lat(x2) 2=lng(x2) 3=radius(x2)
    const coordBinds = (lat: any, lng: any, radius: number) => [
      { val: lat, dir: oracledb.BIND_IN },
      { val: lat, dir: oracledb.BIND_IN },
      { val: lng, dir: oracledb.BIND_IN },
      { val: lng, dir: oracledb.BIND_IN },
      { val: radius, dir: oracledb.BIND_IN },
      { val: radius, dir: oracledb.BIND_IN },
    ];

    // Execute queries in parallel
    const [bankResult, hospitalResult, donorResult] = await Promise.all([
      runQuery<Record<string, any>>(bankQuery, bankBinds),
      runQuery<Record<string, any>>(hospitalQuery, coordBinds(latB, lngB, radiusKm)),
      runQuery<Record<string, any>>(donorQuery, coordBinds(latB, lngB, radiusKm)),
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
      error: null,
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