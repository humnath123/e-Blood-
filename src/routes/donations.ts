import { Router, Request, Response } from "express";
import { z } from "zod";
import * as oracledb from "oracledb";
import { runQueryOne, runQuery } from "../database/pool";
import { toCamelCase } from "../database/mapper";
import { createAuditLog } from "../middleware/audit";
import { getBrandLogoAttachment, getMailer } from "../services/mailer";
import { buildDonationCertificate } from "../services/donation-certificate";
import {
  buildDonationCertificateEmail,
  certificateLogoCid,
} from "../services/donation-certificate-email";

const router = Router();
const donationCertificateQuery = `
  SELECT d.donation_id AS "donationId",
         d.bank_id AS "bankId",
         d.status AS "status",
         d.collected_at AS "donationDate",
         d.certificate_id AS "certificateId",
         d.certificate_sent_at AS "certificateSentAt",
         d.certificate_delivery_status AS "certificateDeliveryStatus",
         d.certificate_delivery_attempted_at AS "certificateDeliveryAttemptedAt",
         u.username AS "username",
         u.first_name AS "firstName",
         u.last_name AS "lastName",
         u.email AS "email",
         d.blood_group AS "donationBloodGroup",
         u.blood_group AS "userBloodGroup"
  FROM donations d
  JOIN users u ON u.user_id = d.user_id
  WHERE d.donation_id = :1
`;

// Validation schemas
const createDonationSchema = z.object({
  bank_id: z.number().int().positive("Invalid blood bank ID"),
  components: z.enum(['whole_blood', 'plasma', 'platelets', 'rbc']).default('whole_blood'),
  units: z.number().min(1).default(1),
});
const certificateIssueSchema = z.object({ retry: z.boolean().optional() }).strict();

// POST /api/v1/donations/:id/certificate
router.post("/:id/certificate", async (req: Request, res: Response) => {
  const user = (req as any).user;
  const role = String(user?.role ?? "").toLowerCase();
  if (role !== "admin" && role !== "bloodbank_staff") {
    return res.status(user ? 403 : 401).json({
      success: false,
      error: {
        code: user ? "FORBIDDEN" : "NOT_AUTHENTICATED",
        message: user
          ? "Only administrators and blood bank staff can issue donation certificates."
          : "User not authenticated.",
      },
      data: null,
    });
  }

  const donationId = Number(req.params.id);
  if (!Number.isSafeInteger(donationId) || donationId < 1) {
    return res.status(400).json({
      success: false,
      error: { code: "INVALID_DONATION_ID", message: "Donation ID must be a positive integer." },
      data: null,
    });
  }
  const request = certificateIssueSchema.safeParse(req.body ?? {});
  if (!request.success) {
    return res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: request.error.issues.map((issue) => issue.message).join(", ") },
      data: null,
    });
  }
  const retry = request.data.retry ?? false;

  try {
    const donation = await runQueryOne<Record<string, any>>(donationCertificateQuery, [donationId]);
    if (!donation) {
      return res.status(404).json({
        success: false,
        error: { code: "DONATION_NOT_FOUND", message: "Donation not found." },
        data: null,
      });
    }

    if (String(donation.status ?? "").toLowerCase() !== "completed") {
      return res.status(409).json({
        success: false,
        error: { code: "DONATION_NOT_COMPLETED", message: "A certificate can only be issued for a completed donation." },
        data: null,
      });
    }

    if (role === "bloodbank_staff" && Number((req as any).facilityId) !== Number(donation.bankId)) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "You can only issue certificates for donations at your blood bank." },
        data: null,
      });
    }

    const donorEmail = String(donation.email ?? "").trim();
    if (!donorEmail) {
      return res.status(422).json({
        success: false,
        error: { code: "DONOR_EMAIL_MISSING", message: "The donor does not have an email address on file." },
        data: null,
      });
    }

    const candidateCertificateId = `EBLD-DON-${String(donationId).padStart(8, "0")}`;
    const certificateRecord: any = await runQueryOne(
      `UPDATE donations
       SET certificate_id = NVL(certificate_id, :1),
           certificate_delivery_status = NVL(certificate_delivery_status, 'pending')
       WHERE donation_id = :2 AND LOWER(status) = 'completed'
       RETURNING certificate_id, certificate_delivery_status, certificate_sent_at`,
      [candidateCertificateId, donationId]
    );
    if (!certificateRecord) {
      return res.status(409).json({
        success: false,
        error: { code: "DONATION_NOT_COMPLETED", message: "A certificate can only be issued for a completed donation." },
        data: null,
      });
    }

    const certificateId = String(
      certificateRecord.CERTIFICATE_ID ?? certificateRecord.certificate_id ?? candidateCertificateId
    );
    const deliveryStatus = String(
      certificateRecord.CERTIFICATE_DELIVERY_STATUS ??
      certificateRecord.certificate_delivery_status ??
      "pending"
    ).toLowerCase();
    if (deliveryStatus === "sent" && !retry) {
      return res.status(409).json({
        success: false,
        error: { code: "CERTIFICATE_ALREADY_SENT", message: "This certificate has already been emailed. Set retry to true to authorize a resend." },
        data: { certificateId, certificateSentAt: certificateRecord.CERTIFICATE_SENT_AT ?? null },
      });
    }
    if (["sending", "failed"].includes(deliveryStatus) && !retry) {
      return res.status(409).json({
        success: false,
        error: { code: deliveryStatus === "sending" ? "CERTIFICATE_DELIVERY_IN_PROGRESS" : "CERTIFICATE_RETRY_REQUIRED", message: "Set retry to true to retry or recover certificate delivery." },
        data: { certificateId, deliveryStatus },
      });
    }
    let mailer: ReturnType<typeof getMailer>;
    try {
      mailer = getMailer();
      if (!mailer) {
        return res.status(503).json({
          success: false,
          error: { code: "SMTP_NOT_CONFIGURED", message: "SMTP is not configured for certificate delivery." },
          data: null,
        });
      }
    } catch (error) {
      console.error("Certificate mailer configuration failed:", error instanceof Error ? error.message : "UNKNOWN");
      return res.status(503).json({
        success: false,
        error: { code: "SMTP_CONFIGURATION_INVALID", message: "SMTP configuration is invalid for certificate delivery." },
        data: null,
      });
    }

    const firstName = String(donation.firstName ?? "").trim();
    const lastName = String(donation.lastName ?? "").trim();
    if (!firstName || !lastName) {
      return res.status(422).json({
        success: false,
        error: { code: "DONOR_NAME_MISSING", message: "The donor profile must include both first and last names before a certificate can be issued." },
        data: null,
      });
    }
    const donorName = `${firstName} ${lastName}`;
    let pdf: Buffer;
    try {
      pdf = await buildDonationCertificate({
        donorName,
        bloodGroup: String(donation.donationBloodGroup ?? donation.userBloodGroup ?? ""),
        donationDate: donation.donationDate,
        certificateId,
      });
    } catch (error) {
      console.error("Donation certificate generation failed:", error);
      return res.status(500).json({
        success: false,
        error: { code: "CERTIFICATE_GENERATION_FAILED", message: "Failed to generate the donation certificate." },
        data: null,
      });
    }

    const claimedCertificate: any = await runQueryOne(
      `UPDATE donations
       SET certificate_delivery_status = 'sending',
           certificate_delivery_attempted_at = CURRENT_TIMESTAMP
       WHERE donation_id = :1 AND certificate_id = :2
         AND (certificate_delivery_status = 'pending'
              OR (:3 = 1 AND certificate_delivery_status IN ('failed', 'sent'))
            OR (:4 = 1 AND certificate_delivery_status = 'sending'
                  AND certificate_delivery_attempted_at < CURRENT_TIMESTAMP - INTERVAL '15' MINUTE))
       RETURNING donation_id`,
      [donationId, certificateId, retry ? 1 : 0, retry ? 1 : 0]
    );
    if (!claimedCertificate) {
      const current: any = await runQueryOne(
        `SELECT certificate_delivery_status, certificate_sent_at
         FROM donations WHERE donation_id = :1`,
        [donationId]
      );
      return res.status(409).json({
        success: false,
        error: { code: "CERTIFICATE_DELIVERY_CONFLICT", message: "Certificate delivery was claimed by another request or requires an authorized retry." },
        data: {
          certificateId,
          deliveryStatus: String(current?.CERTIFICATE_DELIVERY_STATUS ?? "unknown").toLowerCase(),
          certificateSentAt: current?.CERTIFICATE_SENT_AT ?? null,
        },
      });
    }

    try {
      const email = buildDonationCertificateEmail(donorName, certificateId);
      await mailer.transporter.sendMail({
        from: mailer.from,
        to: donorEmail,
        ...email,
        attachments: [{
          filename: `eBlood-certificate-${certificateId}.pdf`,
          content: pdf,
          contentType: "application/pdf",
        }, getBrandLogoAttachment(certificateLogoCid)],
      });
    } catch (error) {
      const code = (error as { code?: unknown })?.code;
      console.error(
        "Donation certificate email failed:",
        typeof code === "string" ? code : error instanceof Error ? error.message : "UNKNOWN"
      );
      await runQueryOne(
        `UPDATE donations SET certificate_delivery_status = 'failed'
         WHERE donation_id = :1 AND certificate_id = :2
           AND certificate_delivery_status = 'sending'`,
        [donationId, certificateId]
      );
      return res.status(502).json({
        success: false,
        error: { code: "CERTIFICATE_EMAIL_FAILED", message: "The certificate was generated, but email delivery failed. Retry to resend it with the same certificate ID." },
        data: { certificateId, deliveryStatus: "failed" },
      });
    }

    const sentRecord: any = await runQueryOne(
      `UPDATE donations
       SET certificate_delivery_status = 'sent',
           certificate_sent_at = CURRENT_TIMESTAMP
       WHERE donation_id = :1 AND certificate_id = :2
         AND certificate_delivery_status = 'sending'
       RETURNING certificate_sent_at, certificate_delivery_status`,
      [donationId, certificateId]
    );
    if (!sentRecord) {
      throw new Error("Email was accepted, but certificate delivery status could not be saved.");
    }

    return res.status(200).json({
      success: true,
      data: {
        donationId,
        certificateId,
        certificateSentAt: sentRecord?.CERTIFICATE_SENT_AT ?? sentRecord?.certificate_sent_at ?? null,
        deliveryStatus: String(sentRecord?.CERTIFICATE_DELIVERY_STATUS ?? "sent").toLowerCase(),
        recipient: donorEmail,
      },
      message: "Donation certificate emailed successfully.",
      error: null,
    });
  } catch (err) {
    console.error("Issue donation certificate error:", err);
    return res.status(500).json({
      success: false,
      error: { code: "CERTIFICATE_ISSUE_FAILED", message: "Failed to issue the donation certificate." },
      data: null,
    });
  }
});

// GET /api/v1/donations/me - Get current user's donations
router.get("/me", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: "NOT_AUTHENTICATED", message: "User not authenticated." },
        data: null,
      });
    }

    const donations = await runQuery(
      `SELECT 
         donation_id,
         user_id,
         bank_id,
         collected_at,
         components,
         units,
         updated_at
       FROM donations
       WHERE user_id = :1
       ORDER BY collected_at DESC`,
      [userId]
    );

    const camelDonations = donations.map(toCamelCase);

    res.status(200).json({
      success: true,
      data: { donations: camelDonations },
      error: null,
    });
  } catch (err) {
    console.error("Get my donations error:", err);
    res.status(500).json({
      success: false,
      error: { code: "DONATIONS_Me_FETCH_FAILED", message: "Failed to fetch donations." },
      data: null,
    });
  }
});

// POST /api/v1/donations - Record a new donation (staff only, own facility)
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

    const result = createDonationSchema.safeParse(req.body);

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

    const { bank_id, components, units } = result.data;

    // Verify bank belongs to this user's facility
    const bankCheck = await runQueryOne(
      `SELECT bank_id, name FROM blood_banks WHERE bank_id = :1`,
      [bank_id]
    );

    if (!bankCheck) {
      return res.status(404).json({
        success: false,
        error: { code: "BANK_NOT_FOUND", message: "Blood bank not found." },
        data: null,
      });
    }

    // Record the donation
    const donationResult: any = await runQueryOne(
      `INSERT INTO donations (user_id, bank_id, collected_at, components, units)
       VALUES (:1, :2, CURRENT_TIMESTAMP, :3, :4)
       RETURNING donation_id, user_id, bank_id, collected_at, components, units, updated_at`,
      [userId, bank_id, components, units]
    );

    const camelDonation = toCamelCase(donationResult);

    // Award points for donation (5 points per donation) - merge so an
    // existing reward row accumulates instead of duplicating
    await runQueryOne(
      `MERGE INTO rewards r
       USING (SELECT :1 AS user_id FROM dual) s
       ON (r.user_id = s.user_id)
       WHEN MATCHED THEN UPDATE SET r.points = r.points + 5, r.updated_at = CURRENT_TIMESTAMP
       WHEN NOT MATCHED THEN INSERT (user_id, points, tier) VALUES (s.user_id, 5, 'bronze')`,
      [userId]
    );

    // Update user's last_donated_at
    await runQueryOne(
      `UPDATE users
       SET last_donated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = :1`,
      [userId]
    );

    // Log audit
    await createAuditLog(userId, "donation_record", "donations", donationResult.DONATION_ID, {
      bank_id,
      components,
      units,
      user_id: userId,
    });

    res.status(201).json({
      success: true,
      data: { donation: camelDonation },
      error: null,
    });
  } catch (err) {
    console.error("Record donation error:", err);
    res.status(500).json({
      success: false,
      error: { code: "DONATION_RECORD_FAILED", message: "Failed to record donation." },
      data: null,
    });
  }
});

// GET /api/v1/donations - Get all donations (admin/bank staff with facility filter)
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const status = req.body.status;
    if (!status) return res.status(400).json({ success: false, message: "status is required" });

    const donation = await runQueryOne(
      `UPDATE donations SET updated_at = CURRENT_TIMESTAMP
       WHERE donation_id = :1
       RETURNING donation_id, user_id, bank_id, collected_at, components, units, updated_at`,
      [Number(req.params.id)]
    );
    if (!donation) return res.status(404).json({ success: false, message: "Donation not found" });
    return res.status(200).json({
      success: true,
      data: { ...toCamelCase(donation), status },
      message: "Donation status updated successfully",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to update donation" });
  }
});

router.get("/", async (req: Request, res: Response) => {
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

    const donations = await runQuery(
      `SELECT 
         d.donation_id,
         d.user_id,
         u.username,
         d.bank_id,
         d.collected_at,
         d.components,
         d.units,
         d.updated_at
       FROM donations d
       JOIN users u ON d.user_id = u.user_id
       WHERE (:bank IS NULL OR d.bank_id = :bank)
       ORDER BY d.collected_at DESC`,
      {
        bank: { val: facilityId ?? null, dir: oracledb.BIND_IN },
      } as any
    );

    const camelDonations = donations.map(toCamelCase);

    res.status(200).json({
      success: true,
      data: { donations: camelDonations },
      error: null,
    });
  } catch (err) {
    console.error("Get donations error:", err);
    res.status(500).json({
      success: false,
      error: { code: "DONATIONS_FETCH_FAILED", message: "Failed to fetch donations." },
      data: null,
    });
  }
});

export default router;
