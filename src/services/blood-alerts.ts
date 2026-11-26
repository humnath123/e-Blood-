import env from "../config";
import { runQuery, runQueryOne } from "../database/pool";
import { BLOOD_ALERT_LOGO_CID, buildBloodRequestEmail } from "./blood-request-email";
import { getBrandLogoAttachment, getMailer } from "./mailer";

type BloodRequestAlert = {
  requestId: number;
  userId: number;
  hospitalId?: number | null;
  bloodGroup: string;
  component: string;
  unitsNeeded: number;
  urgency: string;
  latitude?: number;
  longitude?: number;
};

type AlertRecipient = {
  recipient_email: string;
  recipient_name: string;
  recipient_type: string;
  distance_km: number;
};

const alertRecipientsQuery = `
  SELECT recipient_email AS "recipient_email",
         recipient_name AS "recipient_name",
         recipient_type AS "recipient_type",
         distance_km AS "distance_km"
  FROM (
    SELECT recipient_email, recipient_name, recipient_type, distance_km
    FROM (
      SELECT u.email AS recipient_email,
             u.username AS recipient_name,
             'donor' AS recipient_type,
             6371 * ACOS(LEAST(1, GREATEST(-1,
               COS(RADIANS(:originLat)) * COS(RADIANS(u.latitude))
               * COS(RADIANS(u.longitude) - RADIANS(:originLng))
               + SIN(RADIANS(:originLat)) * SIN(RADIANS(u.latitude))
             ))) AS distance_km
      FROM users u
      WHERE u.role = 'donor'
        AND u.is_active = 1
        AND u.is_available = 1
        AND u.email IS NOT NULL
        AND u.blood_group = :bloodGroup
        AND u.latitude IS NOT NULL
        AND u.longitude IS NOT NULL
        AND (u.last_donated_at IS NULL
             OR u.last_donated_at <= ADD_MONTHS(CURRENT_TIMESTAMP, -3))
      UNION ALL
      SELECT b.email AS recipient_email,
             b.name AS recipient_name,
             'blood bank' AS recipient_type,
             6371 * ACOS(LEAST(1, GREATEST(-1,
               COS(RADIANS(:originLat)) * COS(RADIANS(b.latitude))
               * COS(RADIANS(b.longitude) - RADIANS(:originLng))
               + SIN(RADIANS(:originLat)) * SIN(RADIANS(b.latitude))
             ))) AS distance_km
      FROM blood_banks b
      WHERE b.is_verified = 1
        AND b.email IS NOT NULL
        AND b.latitude IS NOT NULL
        AND b.longitude IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM blood_inventory bi
          WHERE bi.bank_id = b.bank_id
            AND bi.blood_group = :bloodGroup
            AND bi.component = :component
            AND bi.units >= :unitsNeeded
            AND bi.expiry_date > CURRENT_TIMESTAMP
        )
      UNION ALL
      SELECT h.email AS recipient_email,
             h.name AS recipient_name,
             'hospital' AS recipient_type,
             6371 * ACOS(LEAST(1, GREATEST(-1,
               COS(RADIANS(:originLat)) * COS(RADIANS(h.latitude))
               * COS(RADIANS(h.longitude) - RADIANS(:originLng))
               + SIN(RADIANS(:originLat)) * SIN(RADIANS(h.latitude))
             ))) AS distance_km
      FROM hospitals h
      WHERE h.is_verified = 1
        AND h.email IS NOT NULL
        AND h.latitude IS NOT NULL
        AND h.longitude IS NOT NULL
    )
    WHERE distance_km <= :radiusKm
    ORDER BY distance_km
  )
  WHERE ROWNUM <= :maxRecipients
`;

async function getRequestLocation(alert: BloodRequestAlert) {
  if (alert.latitude !== undefined && alert.longitude !== undefined) {
    return { latitude: alert.latitude, longitude: alert.longitude };
  }

  if (alert.hospitalId) {
    const hospital = await runQueryOne(
      `SELECT latitude, longitude FROM hospitals WHERE hospital_id = :1`,
      [alert.hospitalId]
    ) as any;
    if (hospital?.LATITUDE != null && hospital?.LONGITUDE != null) {
      return { latitude: Number(hospital.LATITUDE), longitude: Number(hospital.LONGITUDE) };
    }
  }

  const requester = await runQueryOne(
    `SELECT latitude, longitude FROM users WHERE user_id = :1`,
    [alert.userId]
  ) as any;
  if (requester?.LATITUDE != null && requester?.LONGITUDE != null) {
    return { latitude: Number(requester.LATITUDE), longitude: Number(requester.LONGITUDE) };
  }

  return null;
}

export async function notifyNearbyBloodResources(alert: BloodRequestAlert) {
  const mailer = getMailer();
  if (!mailer) return { enabled: false, matched: 0, sent: 0, failed: 0 };

  const location = await getRequestLocation(alert);
  if (!location) return { enabled: true, matched: 0, sent: 0, failed: 0 };

  const nearbyRecipients = await runQuery<AlertRecipient>(alertRecipientsQuery, {
    originLat: location.latitude,
    originLng: location.longitude,
    bloodGroup: alert.bloodGroup,
    component: alert.component,
    unitsNeeded: alert.unitsNeeded,
    radiusKm: env.BLOOD_ALERT_RADIUS_KM,
    maxRecipients: env.BLOOD_ALERT_MAX_RECIPIENTS,
  });
  const recipients = Array.from(
    new Map(nearbyRecipients.map((recipient) => [recipient.recipient_email.toLowerCase(), recipient])).values()
  );

  if (recipients.length === 0) {
    return { enabled: true, matched: 0, sent: 0, failed: 0 };
  }
  const deliveries = await Promise.allSettled(
    recipients.map((recipient) => {
      const email = buildBloodRequestEmail(alert, recipient, env.APP_BASE_URL);
      return mailer.transporter.sendMail({
        from: mailer.from,
        to: recipient.recipient_email,
        subject: email.subject,
        text: email.text,
        html: email.html,
        attachments: [getBrandLogoAttachment(BLOOD_ALERT_LOGO_CID)],
      });
    })
  );
  const sent = deliveries.filter((delivery) => delivery.status === "fulfilled").length;
  const failed = deliveries.length - sent;

  if (failed > 0) {
    console.error(`Blood request email alerts: ${failed} of ${deliveries.length} deliveries failed`);
    for (const delivery of deliveries) {
      if (delivery.status === "rejected") {
        const code = (delivery.reason as { code?: unknown })?.code;
        console.error(
          "Blood request email delivery error:",
          typeof code === "string" ? code : "UNKNOWN"
        );
      }
    }
  }

  return { enabled: true, matched: recipients.length, sent, failed };
}
