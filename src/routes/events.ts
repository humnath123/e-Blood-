import { Router, Request, Response } from "express";
import { z } from "zod";
import * as oracledb from "oracledb";
import { runQuery, runQueryOne, withTransaction } from "../database/pool";
import { toCamelCase } from "../database/mapper";
import { createAuditLog } from "../middleware/audit";
import { canTransition, eventTransitions } from "../services/workflows";

const router = Router();
const eventStatuses = [
  "DRAFT", "PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED",
  "ONGOING", "COMPLETED", "CANCELLED", "POSTPONED",
] as const;
const eventIdSchema = z.coerce.number().int().positive();
const dateSchema = z.string().datetime({ offset: true });

const eventFields = {
  title: z.string().trim().min(1).max(150),
  description: z.string().max(10000).optional(),
  banner_url: z.string().url().max(1000).optional(),
  organizer_name: z.string().trim().min(1).max(150),
  organizer_contact: z.string().trim().max(200).optional(),
  location: z.string().trim().min(1).max(500),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  starts_at: dateSchema,
  ends_at: dateSchema,
  registration_deadline: dateSchema,
  max_participants: z.number().int().positive().optional(),
};

const createEventSchema = z.object(eventFields);
const updateEventSchema = z.object({
  title: eventFields.title.optional(),
  description: eventFields.description,
  banner_url: eventFields.banner_url,
  organizer_name: eventFields.organizer_name.optional(),
  organizer_contact: eventFields.organizer_contact,
  location: eventFields.location.optional(),
  latitude: eventFields.latitude,
  longitude: eventFields.longitude,
  starts_at: dateSchema.optional(),
  ends_at: dateSchema.optional(),
  registration_deadline: dateSchema.optional(),
  max_participants: eventFields.max_participants,
}).refine((value) => Object.values(value).some((item) => item !== undefined), "At least one field is required");

const statusSchema = z.object({ status: z.enum(eventStatuses) });
const attendanceSchema = z.object({ attendance_status: z.enum(["ATTENDED", "NO_SHOW"]) });
const donationSchema = z.object({ donation_id: z.number().int().positive() });

type EventRow = Record<string, any>;

const jsonError = (res: Response, status: number, code: string, message: string) =>
  res.status(status).json({ success: false, error: { code, message }, data: null });

function actor(req: Request) {
  const user = (req as any).user;
  return { userId: Number(user?.userId), role: String(user?.role ?? "").toLowerCase() };
}

function isManager(event: EventRow, user: ReturnType<typeof actor>) {
  return user.role === "admin" || Number(event.CREATED_BY) === user.userId;
}

function eventSelect(where: string) {
  return `SELECT e.event_id, e.title, e.description, e.banner_url, e.organizer_name,
                 e.organizer_contact, e.location, e.latitude, e.longitude,
                 e.starts_at, e.ends_at, e.registration_deadline,
                 e.max_participants, e.status, e.created_by, e.created_at, e.updated_at,
                 (SELECT COUNT(*) FROM event_registrations r
                   WHERE r.event_id = e.event_id AND r.registration_status <> 'CANCELLED') AS registrations_count,
                 (SELECT COUNT(*) FROM event_registrations r
                   WHERE r.event_id = e.event_id AND r.registration_status = 'ATTENDED') AS attendance_count,
                 (SELECT COUNT(*) FROM event_registrations r
                   WHERE r.event_id = e.event_id AND r.donation_id IS NOT NULL) AS donations_count
          FROM donation_events e ${where}`;
}

async function getEvent(id: number) {
  return runQueryOne<EventRow>(eventSelect("WHERE e.event_id = :1"), [id]);
}

router.get("/", async (req: Request, res: Response) => {
  const user = actor(req);
  const requestedStatus = typeof req.query.status === "string" ? req.query.status.toUpperCase() : undefined;
  if (requestedStatus && !eventStatuses.includes(requestedStatus as (typeof eventStatuses)[number])) {
    return jsonError(res, 400, "INVALID_STATUS", "Unknown event status.");
  }
  try {
    const predicates: string[] = [];
    const binds: any[] = [];
    if (user.role !== "admin") {
      predicates.push("e.status <> 'DRAFT' OR e.created_by = :1");
      binds.push(user.userId);
    }
    if (requestedStatus) {
      predicates.push(`e.status = :${binds.length + 1}`);
      binds.push(requestedStatus);
    }
    const where = predicates.length
      ? `WHERE (${predicates.join(") AND (")})`
      : "";
    const events = await runQuery(eventSelect(where) + " ORDER BY e.starts_at", binds);
    return res.status(200).json({ success: true, data: events.map(toCamelCase), message: "Donation events retrieved." });
  } catch (error) {
    console.error("List donation events error:", error);
    return jsonError(res, 500, "EVENTS_FETCH_FAILED", "Failed to retrieve donation events.");
  }
});

router.post("/", async (req: Request, res: Response) => {
  const user = actor(req);
  if (!["admin", "ngo", "bloodbank_staff"].includes(user.role)) {
    return jsonError(res, 403, "FORBIDDEN", "Only administrators, NGOs, and blood bank staff can create donation events.");
  }
  const parsed = createEventSchema.safeParse(req.body);
  if (!parsed.success) return jsonError(res, 400, "VALIDATION_ERROR", parsed.error.issues.map((issue) => issue.message).join(", "));
  const input = parsed.data;
  const startsAt = new Date(input.starts_at);
  const endsAt = new Date(input.ends_at);
  const deadline = new Date(input.registration_deadline);
  if (endsAt <= startsAt || deadline > startsAt) {
    return jsonError(res, 400, "INVALID_EVENT_DATES", "End time must follow the start time, and registration must close by the start time.");
  }
  try {
    const event: any = await runQueryOne(
      `INSERT INTO donation_events
         (title, description, banner_url, organizer_name, organizer_contact,
          location, latitude, longitude, starts_at, ends_at, registration_deadline,
          max_participants, status, created_by)
       VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, :10, :11, :12, 'DRAFT', :13)
       RETURNING event_id, title, description, banner_url, organizer_name, organizer_contact,
                 location, latitude, longitude, starts_at, ends_at, registration_deadline,
                 max_participants, status, created_by, created_at`,
      [
        input.title, input.description ?? null, input.banner_url ?? null,
        input.organizer_name, input.organizer_contact ?? null, input.location,
        input.latitude ?? null, input.longitude ?? null, startsAt, endsAt,
        deadline, input.max_participants ?? null, user.userId,
      ]
    );
    if (!event) throw new Error("Donation event was not returned after insert.");
    const eventId = Number(event.EVENT_ID);
    await createAuditLog(user.userId, "event_create", "donation_events", eventId, undefined, req.ip);
    return res.status(201).json({ success: true, data: event ? toCamelCase(event) : null, message: "Donation event created as draft." });
  } catch (error) {
    console.error("Create donation event error:", error);
    return jsonError(res, 500, "EVENT_CREATE_FAILED", "Failed to create donation event.");
  }
});

router.get("/:id/statistics", async (req: Request, res: Response) => {
  const id = eventIdSchema.safeParse(req.params.id);
  if (!id.success) return jsonError(res, 400, "INVALID_EVENT_ID", "Event ID must be a positive integer.");
  try {
    const event = await getEvent(id.data);
    if (!event) return jsonError(res, 404, "EVENT_NOT_FOUND", "Donation event not found.");
    if (String(event.STATUS) === "DRAFT" && !isManager(event, actor(req))) {
      return jsonError(res, 404, "EVENT_NOT_FOUND", "Donation event not found.");
    }
    return res.status(200).json({
      success: true,
      data: {
        eventId: id.data,
        registrations: Number(event.REGISTRATIONS_COUNT),
        attendance: Number(event.ATTENDANCE_COUNT),
        confirmedDonations: Number(event.DONATIONS_COUNT),
      },
      message: "Donation event statistics retrieved.",
    });
  } catch (error) {
    console.error("Get donation event statistics error:", error);
    return jsonError(res, 500, "EVENT_STATS_FAILED", "Failed to retrieve event statistics.");
  }
});

router.get("/:id/registrations", async (req: Request, res: Response) => {
  const id = eventIdSchema.safeParse(req.params.id);
  if (!id.success) return jsonError(res, 400, "INVALID_EVENT_ID", "Event ID must be a positive integer.");
  try {
    const event = await getEvent(id.data);
    if (!event) return jsonError(res, 404, "EVENT_NOT_FOUND", "Donation event not found.");
    if (!isManager(event, actor(req))) return jsonError(res, 403, "FORBIDDEN", "Only the event organizer or an administrator can view registrations.");
    const registrations = await runQuery(
      `SELECT registration_id, event_id, user_id, registration_status,
              registered_at, attendance_at, donation_id, donation_confirmed_at
       FROM event_registrations WHERE event_id = :1 ORDER BY registered_at`,
      [id.data]
    );
    return res.status(200).json({ success: true, data: registrations.map(toCamelCase), message: "Event registrations retrieved." });
  } catch (error) {
    console.error("List event registrations error:", error);
    return jsonError(res, 500, "EVENT_REGISTRATIONS_FAILED", "Failed to retrieve event registrations.");
  }
});

router.post("/:id/register", async (req: Request, res: Response) => {
  const id = eventIdSchema.safeParse(req.params.id);
  const user = actor(req);
  if (!id.success) return jsonError(res, 400, "INVALID_EVENT_ID", "Event ID must be a positive integer.");
  if (user.role !== "donor") return jsonError(res, 403, "FORBIDDEN", "Only donor accounts can register for donation events.");
  try {
    const event = await getEvent(id.data);
    if (!event) return jsonError(res, 404, "EVENT_NOT_FOUND", "Donation event not found.");
    const registrationResult = await withTransaction(async (connection) => {
      const lockedEvent: any = await connection.execute(
        `SELECT status, registration_deadline, max_participants
         FROM donation_events WHERE event_id = :1 FOR UPDATE`,
        [id.data],
        { outFormat: oracledb.OUT_FORMAT_OBJECT, autoCommit: false }
      );
      const lockedRow = lockedEvent.rows?.[0];
      if (!lockedRow) return { success: false, error: "EVENT_NOT_FOUND" };
      if (
        String(lockedRow.STATUS) !== "REGISTRATION_OPEN" ||
        new Date(lockedRow.REGISTRATION_DEADLINE) <= new Date()
      ) {
        return { success: false, error: "REGISTRATION_CLOSED" };
      }

      const countResult: any = await connection.execute(
        `SELECT COUNT(*) AS registrations_count FROM event_registrations
         WHERE event_id = :1 AND registration_status <> 'CANCELLED'`,
        [id.data],
        { outFormat: oracledb.OUT_FORMAT_OBJECT, autoCommit: false }
      );
      if (
        lockedRow.MAX_PARTICIPANTS !== null &&
        Number(countResult.rows?.[0]?.REGISTRATIONS_COUNT) >= Number(lockedRow.MAX_PARTICIPANTS)
      ) {
        return { success: false, error: "EVENT_FULL" };
      }

      const existingResult: any = await connection.execute(
        `SELECT registration_id, registration_status FROM event_registrations
         WHERE event_id = :1 AND user_id = :2`,
        [id.data, user.userId],
        { outFormat: oracledb.OUT_FORMAT_OBJECT, autoCommit: false }
      );
      const existing = existingResult.rows?.[0];
      if (existing && String(existing.REGISTRATION_STATUS) !== "CANCELLED") {
        return { success: false, error: "ALREADY_REGISTERED" };
      }
      if (existing) {
        await connection.execute(
          `UPDATE event_registrations
           SET registration_status = 'REGISTERED', registered_at = CURRENT_TIMESTAMP,
               attendance_at = NULL, donation_id = NULL, donation_confirmed_at = NULL
           WHERE registration_id = :1`,
          [existing.REGISTRATION_ID],
          { autoCommit: false }
        );
      } else {
        await connection.execute(
          `INSERT INTO event_registrations (event_id, user_id) VALUES (:1, :2)`,
          [id.data, user.userId],
          { autoCommit: false }
        );
      }
      await connection.execute(
        `INSERT INTO notifications (recipient_id, type, title, message, related_id, related_type)
         VALUES (:1, 'event_registration', 'New event registration', :2, :3, 'event')`,
        [event.CREATED_BY, `A donor registered for ${event.TITLE}.`, id.data],
        { autoCommit: false }
      );
      return { success: true, result: { eventId: id.data, registrationStatus: "REGISTERED" } };
    });
    if (!registrationResult.success) {
      const error = registrationResult.error;
      if (error === "EVENT_NOT_FOUND") return jsonError(res, 404, "EVENT_NOT_FOUND", "Donation event not found.");
      if (error === "REGISTRATION_CLOSED") return jsonError(res, 409, "REGISTRATION_CLOSED", "Registration is not open for this event.");
      if (error === "EVENT_FULL") return jsonError(res, 409, "EVENT_FULL", "This event has reached its registration limit.");
      return jsonError(res, 409, "ALREADY_REGISTERED", "You are already registered for this event.");
    }
    await createAuditLog(user.userId, "event_register", "event_registrations", id.data, undefined, req.ip);
    return res.status(201).json({ success: true, data: registrationResult.result, message: "Successfully registered for the event." });
  } catch (error) {
    if ((error as any)?.code === "ORA-00001") {
      return jsonError(res, 409, "ALREADY_REGISTERED", "You are already registered for this event.");
    }
    console.error("Register for donation event error:", error);
    return jsonError(res, 500, "EVENT_REGISTRATION_FAILED", "Failed to register for the event.");
  }
});

router.delete("/:id/register", async (req: Request, res: Response) => {
  const id = eventIdSchema.safeParse(req.params.id);
  const user = actor(req);
  if (!id.success) return jsonError(res, 400, "INVALID_EVENT_ID", "Event ID must be a positive integer.");
  try {
    const result = await runQueryOne(
      `UPDATE event_registrations
       SET registration_status = 'CANCELLED'
       WHERE event_id = :1 AND user_id = :2 AND registration_status = 'REGISTERED'
       RETURNING registration_id`,
      [id.data, user.userId]
    );
    if (!result) return jsonError(res, 404, "REGISTRATION_NOT_FOUND", "Active event registration not found.");
    await createAuditLog(user.userId, "event_registration_cancel", "event_registrations", Number(result.REGISTRATION_ID), undefined, req.ip);
    return res.status(200).json({ success: true, data: null, message: "Event registration cancelled." });
  } catch (error) {
    console.error("Cancel event registration error:", error);
    return jsonError(res, 500, "EVENT_REGISTRATION_CANCEL_FAILED", "Failed to cancel event registration.");
  }
});

router.patch("/:id/registrations/:registrationId/attendance", async (req: Request, res: Response) => {
  const eventId = eventIdSchema.safeParse(req.params.id);
  const registrationId = eventIdSchema.safeParse(req.params.registrationId);
  const parsed = attendanceSchema.safeParse(req.body);
  if (!eventId.success || !registrationId.success) return jsonError(res, 400, "INVALID_ID", "Event and registration IDs must be positive integers.");
  if (!parsed.success) return jsonError(res, 400, "VALIDATION_ERROR", parsed.error.issues.map((issue) => issue.message).join(", "));
  try {
    const event = await getEvent(eventId.data);
    if (!event) return jsonError(res, 404, "EVENT_NOT_FOUND", "Donation event not found.");
    if (!isManager(event, actor(req))) return jsonError(res, 403, "FORBIDDEN", "Only the event organizer or an administrator can record attendance.");
    const updated = await runQueryOne(
      `UPDATE event_registrations
         SET registration_status = :1,
             attendance_at = CASE WHEN :2 = 'ATTENDED' THEN CURRENT_TIMESTAMP ELSE NULL END
         WHERE registration_id = :3 AND event_id = :4
         AND registration_status IN ('REGISTERED', 'ATTENDED', 'NO_SHOW')
       RETURNING registration_id, registration_status, attendance_at`,
      [parsed.data.attendance_status, parsed.data.attendance_status, registrationId.data, eventId.data]
    );
    if (!updated) return jsonError(res, 404, "REGISTRATION_NOT_FOUND", "Event registration not found.");
    await createAuditLog(actor(req).userId, "event_attendance_update", "event_registrations", registrationId.data, {
      attendanceStatus: parsed.data.attendance_status,
    }, req.ip);
    return res.status(200).json({ success: true, data: updated ? toCamelCase(updated) : null, message: "Attendance recorded." });
  } catch (error) {
    console.error("Record event attendance error:", error);
    return jsonError(res, 500, "EVENT_ATTENDANCE_FAILED", "Failed to record attendance.");
  }
});

router.patch("/:id/registrations/:registrationId/donation", async (req: Request, res: Response) => {
  const eventId = eventIdSchema.safeParse(req.params.id);
  const registrationId = eventIdSchema.safeParse(req.params.registrationId);
  const parsed = donationSchema.safeParse(req.body);
  if (!eventId.success || !registrationId.success) return jsonError(res, 400, "INVALID_ID", "Event and registration IDs must be positive integers.");
  if (!parsed.success) return jsonError(res, 400, "VALIDATION_ERROR", parsed.error.issues.map((issue) => issue.message).join(", "));
  const user = actor(req);
  try {
    const event = await getEvent(eventId.data);
    if (!event) return jsonError(res, 404, "EVENT_NOT_FOUND", "Donation event not found.");
    if (!isManager(event, user)) return jsonError(res, 403, "FORBIDDEN", "Only the event organizer or an administrator can confirm donations.");
    const registration = await runQueryOne<EventRow>(
      `SELECT registration_id, user_id, registration_status, donation_id
       FROM event_registrations WHERE registration_id = :1 AND event_id = :2`,
      [registrationId.data, eventId.data]
    );
    if (!registration) return jsonError(res, 404, "REGISTRATION_NOT_FOUND", "Event registration not found.");
    if (String(registration.REGISTRATION_STATUS) !== "ATTENDED") {
      return jsonError(res, 409, "ATTENDANCE_REQUIRED", "Attendance must be recorded before confirming a donation.");
    }
    if (registration.DONATION_ID) return jsonError(res, 409, "DONATION_ALREADY_CONFIRMED", "A donation is already linked to this registration.");
    const donation = await runQueryOne(
      `SELECT d.donation_id FROM donations d
       JOIN donation_events e ON e.event_id = :1
       WHERE d.donation_id = :2 AND d.user_id = :3
         AND LOWER(d.status) = 'completed'
         AND d.collected_at BETWEEN e.starts_at AND e.ends_at`,
      [eventId.data, parsed.data.donation_id, registration.USER_ID]
    );
    if (!donation) return jsonError(res, 404, "COMPLETED_DONATION_NOT_FOUND", "No completed donation for this donor matches the supplied ID.");
    const updated = await runQueryOne(
      `UPDATE event_registrations
       SET donation_id = :1, donation_confirmed_at = CURRENT_TIMESTAMP
       WHERE registration_id = :2 AND event_id = :3 AND donation_id IS NULL
       RETURNING registration_id, donation_id, donation_confirmed_at`,
      [parsed.data.donation_id, registrationId.data, eventId.data]
    );
    if (!updated) return jsonError(res, 409, "DONATION_ALREADY_CONFIRMED", "A donation is already linked to this registration.");
    await createAuditLog(user.userId, "event_donation_confirm", "event_registrations", registrationId.data, {
      donationId: parsed.data.donation_id,
    }, req.ip);
    return res.status(200).json({ success: true, data: updated ? toCamelCase(updated) : null, message: "Completed donation linked to event attendance." });
  } catch (error) {
    console.error("Confirm event donation error:", error);
    return jsonError(res, 500, "EVENT_DONATION_CONFIRM_FAILED", "Failed to confirm the event donation.");
  }
});

router.patch("/:id/status", async (req: Request, res: Response) => {
  const id = eventIdSchema.safeParse(req.params.id);
  const parsed = statusSchema.safeParse(req.body);
  if (!id.success) return jsonError(res, 400, "INVALID_EVENT_ID", "Event ID must be a positive integer.");
  if (!parsed.success) return jsonError(res, 400, "VALIDATION_ERROR", parsed.error.issues.map((issue) => issue.message).join(", "));
  const user = actor(req);
  try {
    const event = await getEvent(id.data);
    if (!event) return jsonError(res, 404, "EVENT_NOT_FOUND", "Donation event not found.");
    if (!isManager(event, user)) return jsonError(res, 403, "FORBIDDEN", "Only the event organizer or an administrator can change event status.");
    const currentStatus = String(event.STATUS);
    const nextStatus = parsed.data.status;
    if (!canTransition(eventTransitions, currentStatus, nextStatus)) {
      return jsonError(res, 409, "INVALID_EVENT_TRANSITION", `Cannot move event from ${currentStatus} to ${nextStatus}.`);
    }
    const updated = await runQueryOne(
      `UPDATE donation_events
       SET status = :1, updated_at = CURRENT_TIMESTAMP
       WHERE event_id = :2 AND status = :3
       RETURNING event_id, status, updated_at`,
      [nextStatus, id.data, currentStatus]
    );
    if (!updated) return jsonError(res, 409, "EVENT_STATE_CHANGED", "Event status changed before this update.");
    await createAuditLog(user.userId, "event_status_update", "donation_events", id.data, {
      from: currentStatus,
      to: nextStatus,
    }, req.ip);
    let notificationFailed = false;
    try {
      await runQueryOne(
        `INSERT INTO notifications (recipient_id, type, title, message, related_id, related_type)
         SELECT user_id, 'event_update', :1, :2, :3, 'event'
         FROM event_registrations
         WHERE event_id = :4 AND registration_status <> 'CANCELLED'`,
        [
          `Donation event ${nextStatus.toLowerCase()}`,
          `${event.TITLE} is now ${nextStatus.toLowerCase()}.`,
          id.data,
          id.data,
        ]
      );
    } catch (error) {
      notificationFailed = true;
      console.error("Create event status notification failed:", error);
    }
    return res.status(200).json({
      success: true,
      data: updated ? toCamelCase(updated) : null,
      message: "Donation event status updated.",
      ...(notificationFailed ? { warning: "Event status saved, but participant notifications could not be created." } : {}),
    });
  } catch (error) {
    console.error("Update donation event status error:", error);
    return jsonError(res, 500, "EVENT_STATUS_UPDATE_FAILED", "Failed to update event status.");
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  const id = eventIdSchema.safeParse(req.params.id);
  const parsed = updateEventSchema.safeParse(req.body);
  if (!id.success) return jsonError(res, 400, "INVALID_EVENT_ID", "Event ID must be a positive integer.");
  if (!parsed.success) return jsonError(res, 400, "VALIDATION_ERROR", parsed.error.issues.map((issue) => issue.message).join(", "));
  const user = actor(req);
  try {
    const event = await getEvent(id.data);
    if (!event) return jsonError(res, 404, "EVENT_NOT_FOUND", "Donation event not found.");
    if (!isManager(event, user)) return jsonError(res, 403, "FORBIDDEN", "Only the event organizer or an administrator can edit this event.");
    if (!["DRAFT", "PUBLISHED", "POSTPONED"].includes(String(event.STATUS))) {
      return jsonError(res, 409, "EVENT_NOT_EDITABLE", "Event details can only be edited while draft, published, or postponed.");
    }
    const fields: Record<string, string> = {
      title: "title",
      description: "description",
      banner_url: "banner_url",
      organizer_name: "organizer_name",
      organizer_contact: "organizer_contact",
      location: "location",
      latitude: "latitude",
      longitude: "longitude",
      starts_at: "starts_at",
      ends_at: "ends_at",
      registration_deadline: "registration_deadline",
      max_participants: "max_participants",
    };
    const entries = Object.entries(parsed.data).filter(([, value]) => value !== undefined);
    const nextStart = parsed.data.starts_at ? new Date(parsed.data.starts_at) : new Date(event.STARTS_AT);
    const nextEnd = parsed.data.ends_at ? new Date(parsed.data.ends_at) : new Date(event.ENDS_AT);
    const nextDeadline = parsed.data.registration_deadline
      ? new Date(parsed.data.registration_deadline)
      : new Date(event.REGISTRATION_DEADLINE);
    if (nextEnd <= nextStart || nextDeadline > nextStart) {
      return jsonError(res, 400, "INVALID_EVENT_DATES", "End time must follow the start time, and registration must close by the start time.");
    }
    if (parsed.data.max_participants !== undefined) {
      const activeRegistrations = await runQueryOne<EventRow>(
        `SELECT COUNT(*) AS registrations_count FROM event_registrations
         WHERE event_id = :1 AND registration_status <> 'CANCELLED'`,
        [id.data]
      );
      if (parsed.data.max_participants < Number(activeRegistrations?.REGISTRATIONS_COUNT ?? 0)) {
        return jsonError(res, 409, "CAPACITY_BELOW_REGISTRATIONS", "Maximum participants cannot be below the current registration count.");
      }
    }
    const binds: any[] = [];
    const assignments = entries.map(([key, value]) => {
      binds.push(["starts_at", "ends_at", "registration_deadline"].includes(key) ? new Date(value as string) : value);
      return `${fields[key]} = :${binds.length}`;
    });
    binds.push(id.data);
    const eventIdBind = binds.length;
    binds.push("DRAFT", "PUBLISHED", "POSTPONED");
    const updated = await runQueryOne(
      `UPDATE donation_events SET ${assignments.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE event_id = :${eventIdBind}
         AND status IN (:${eventIdBind + 1}, :${eventIdBind + 2}, :${eventIdBind + 3})
       RETURNING event_id, title, description, banner_url, organizer_name, organizer_contact,
                 location, latitude, longitude, starts_at, ends_at, registration_deadline,
                 max_participants, status, updated_at`,
      binds
    );
    if (!updated) return jsonError(res, 409, "EVENT_NOT_EDITABLE", "Event status changed before this update.");
    await createAuditLog(user.userId, "event_update", "donation_events", id.data, {
      fields: entries.map(([key]) => key),
    }, req.ip);
    return res.status(200).json({ success: true, data: updated ? toCamelCase(updated) : null, message: "Donation event updated." });
  } catch (error) {
    console.error("Update donation event error:", error);
    return jsonError(res, 500, "EVENT_UPDATE_FAILED", "Failed to update donation event.");
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  const id = eventIdSchema.safeParse(req.params.id);
  if (!id.success) return jsonError(res, 400, "INVALID_EVENT_ID", "Event ID must be a positive integer.");
  const user = actor(req);
  try {
    const event = await getEvent(id.data);
    if (!event) return jsonError(res, 404, "EVENT_NOT_FOUND", "Donation event not found.");
    if (!isManager(event, user)) return jsonError(res, 403, "FORBIDDEN", "Only the event organizer or an administrator can delete this event.");
    if (String(event.STATUS) !== "DRAFT") {
      return jsonError(res, 409, "EVENT_NOT_DELETABLE", "Only draft events can be deleted; publish cancellation for other events.");
    }
    const deleted = await runQueryOne(
      "DELETE FROM donation_events WHERE event_id = :1 AND status = 'DRAFT' RETURNING event_id",
      [id.data]
    );
    if (!deleted) return jsonError(res, 409, "EVENT_NOT_DELETABLE", "Event status changed before deletion.");
    await createAuditLog(user.userId, "event_delete", "donation_events", id.data, undefined, req.ip);
    return res.status(200).json({ success: true, data: null, message: "Draft donation event deleted." });
  } catch (error) {
    console.error("Delete donation event error:", error);
    return jsonError(res, 500, "EVENT_DELETE_FAILED", "Failed to delete donation event.");
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  const id = eventIdSchema.safeParse(req.params.id);
  if (!id.success) return jsonError(res, 400, "INVALID_EVENT_ID", "Event ID must be a positive integer.");
  try {
    const event = await getEvent(id.data);
    if (!event) return jsonError(res, 404, "EVENT_NOT_FOUND", "Donation event not found.");
    if (String(event.STATUS) === "DRAFT" && !isManager(event, actor(req))) {
      return jsonError(res, 404, "EVENT_NOT_FOUND", "Donation event not found.");
    }
    return res.status(200).json({ success: true, data: toCamelCase(event), message: "Donation event retrieved." });
  } catch (error) {
    console.error("Get donation event error:", error);
    return jsonError(res, 500, "EVENT_FETCH_FAILED", "Failed to retrieve donation event.");
  }
});

export default router;
