import { Router, Request, Response } from "express";
import { z } from "zod";
import * as oracledb from "oracledb";
import { runQuery, runQueryOne, withTransaction } from "../database/pool";
import { toCamelCase } from "../database/mapper";
import { createAuditLog } from "../middleware/audit";
import { canTransition, transportTransitions } from "../services/workflows";

const router = Router();
const statuses = [
  "PENDING", "APPROVED", "ASSIGNED", "PICKED_UP", "IN_TRANSIT", "ARRIVED",
  "DELIVERED", "COMPLETED", "REJECTED", "CANCELLED", "DELAYED", "FAILED",
] as const;
const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
const components = ["whole_blood", "plasma", "platelets", "rbc"] as const;
const transportIdSchema = z.coerce.number().int().positive();

const createTransportSchema = z.object({
  blood_request_id: z.number().int().positive().optional(),
  source_bank_id: z.number().int().positive(),
  destination_hospital_id: z.number().int().positive(),
  blood_group: z.enum(bloodGroups),
  component: z.enum(components).default("whole_blood"),
  units: z.number().int().positive(),
  pickup_address: z.string().trim().min(1).max(500),
  destination_address: z.string().trim().min(1).max(500),
  pickup_latitude: z.number().min(-90).max(90).optional(),
  pickup_longitude: z.number().min(-180).max(180).optional(),
  destination_latitude: z.number().min(-90).max(90).optional(),
  destination_longitude: z.number().min(-180).max(180).optional(),
  estimated_arrival: z.string().datetime({ offset: true }).optional(),
});

const assignSchema = z.object({
  driver_user_id: z.number().int().positive(),
  vehicle_identifier: z.string().trim().min(1).max(50),
});

const statusSchema = z.object({
  status: z.enum(statuses),
  notes: z.string().trim().max(1000).optional(),
});

const locationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  estimated_arrival: z.string().datetime({ offset: true }).optional(),
  notes: z.string().trim().max(1000).optional(),
});

const deliverySchema = z.object({
  confirmation: z.string().trim().min(1).max(2000),
});

type TransportRow = Record<string, any>;

const jsonError = (res: Response, status: number, code: string, message: string) =>
  res.status(status).json({ success: false, error: { code, message }, data: null });

function actor(req: Request) {
  const user = (req as any).user;
  return {
    userId: Number(user?.userId),
    role: String(user?.role ?? "").toLowerCase(),
    facilityId: Number((req as any).facilityId) || null,
  };
}

function mayManage(row: TransportRow, user: ReturnType<typeof actor>) {
  return user.role === "admin" ||
    (user.role === "bloodbank_staff" && user.facilityId === Number(row.SOURCE_BANK_ID));
}

function mayView(row: TransportRow, user: ReturnType<typeof actor>) {
  return mayManage(row, user) ||
    user.userId === Number(row.REQUESTER_ID) ||
    user.userId === Number(row.ASSIGNED_DRIVER_ID);
}

async function getTransport(id: number) {
  return runQueryOne<TransportRow>(
    `SELECT transport_id, blood_request_id, requester_id, source_bank_id,
            destination_hospital_id, assigned_driver_id, vehicle_identifier,
            blood_group, component, units, pickup_address, destination_address,
            pickup_latitude, pickup_longitude, destination_latitude,
            destination_longitude, current_latitude, current_longitude,
            location_updated_at, estimated_arrival, status, delay_reason,
            delivery_confirmation, delivery_confirmed_by, delivery_confirmed_at,
            created_at, updated_at
     FROM blood_transports WHERE transport_id = :1`,
    [id]
  );
}

async function addHistory(
  connection: oracledb.Connection,
  transportId: number,
  actorId: number,
  action: string,
  fromStatus: string | null,
  toStatus: string | null,
  details: { latitude?: number; longitude?: number; eta?: Date; notes?: string } = {}
) {
  const changed = await connection.execute(
    `INSERT INTO blood_transport_history
       (transport_id, actor_id, action, from_status, to_status,
        latitude, longitude, estimated_arrival, notes)
     VALUES (:transportId, :actorId, :action, :fromStatus, :toStatus,
             :latitude, :longitude, :eta, :notes)`,
    {
      transportId,
      actorId,
      action,
      fromStatus,
      toStatus,
      latitude: details.latitude ?? null,
      longitude: details.longitude ?? null,
      eta: details.eta ?? null,
      notes: details.notes ?? null,
    },
    { autoCommit: false }
  );
}

async function notifyParticipants(
  row: TransportRow,
  title: string,
  message: string,
  transportId: number,
  additionalRecipients: number[] = []
) {
  const recipients = new Set([
    Number(row.REQUESTER_ID),
    Number(row.ASSIGNED_DRIVER_ID),
    ...additionalRecipients,
  ].filter((userId) => Number.isSafeInteger(userId) && userId > 0));
  try {
    for (const recipientId of recipients) {
      await runQueryOne(
        `INSERT INTO notifications (recipient_id, type, title, message, related_id, related_type)
         VALUES (:1, 'blood_transport', :2, :3, :4, 'transport')`,
        [recipientId, title, message, transportId]
      );
    }
    return true;
  } catch (error) {
    console.error("Create blood transport notification failed:", error);
    return false;
  }
}

router.post("/", async (req: Request, res: Response) => {
  const user = actor(req);
  if (!["admin", "bloodbank_staff", "hospital_staff"].includes(user.role)) {
    return jsonError(res, 403, "FORBIDDEN", "Only administrators, blood bank staff, and hospital staff can request transport.");
  }
  const parsed = createTransportSchema.safeParse(req.body);
  if (!parsed.success) {
    return jsonError(res, 400, "VALIDATION_ERROR", parsed.error.issues.map((issue) => issue.message).join(", "));
  }

  const input = parsed.data;
  if (user.role === "bloodbank_staff" && user.facilityId !== input.source_bank_id) {
    return jsonError(res, 403, "FORBIDDEN", "You can only request transport from your assigned blood bank.");
  }

  try {
    const [bank, hospital] = await Promise.all([
      runQueryOne("SELECT bank_id FROM blood_banks WHERE bank_id = :1", [input.source_bank_id]),
      runQueryOne("SELECT hospital_id FROM hospitals WHERE hospital_id = :1", [input.destination_hospital_id]),
    ]);
    if (!bank) return jsonError(res, 404, "BLOOD_BANK_NOT_FOUND", "Source blood bank not found.");
    if (!hospital) return jsonError(res, 404, "HOSPITAL_NOT_FOUND", "Destination hospital not found.");

    if (input.blood_request_id) {
      const request = await runQueryOne<TransportRow>(
        `SELECT request_id, hospital_id, blood_group, component, units_needed, status
         FROM blood_requests WHERE request_id = :1`,
        [input.blood_request_id]
      );
      if (!request) return jsonError(res, 404, "BLOOD_REQUEST_NOT_FOUND", "Linked blood request not found.");
      if (
        !["open", "matched"].includes(String(request.STATUS).toLowerCase()) ||
        String(request.BLOOD_GROUP) !== input.blood_group ||
        String(request.COMPONENT) !== input.component ||
        Number(request.UNITS_NEEDED) < input.units ||
        (request.HOSPITAL_ID && Number(request.HOSPITAL_ID) !== input.destination_hospital_id)
      ) {
        return jsonError(res, 409, "BLOOD_REQUEST_MISMATCH", "Transport details do not match the linked blood request.");
      }
    }

    const transaction = await withTransaction(async (connection) => {
      const inserted: any = await connection.execute(
        `INSERT INTO blood_transports
           (blood_request_id, requester_id, source_bank_id, destination_hospital_id,
            blood_group, component, units, pickup_address, destination_address,
            pickup_latitude, pickup_longitude, destination_latitude, destination_longitude,
            estimated_arrival, status)
         VALUES (:requestId, :requesterId, :bankId, :hospitalId, :bloodGroup, :component,
                 :units, :pickupAddress, :destinationAddress, :pickupLatitude,
                 :pickupLongitude, :destinationLatitude, :destinationLongitude,
                 :eta, 'PENDING')
         RETURNING transport_id INTO :transportId`,
        {
          requestId: input.blood_request_id ?? null,
          requesterId: user.userId,
          bankId: input.source_bank_id,
          hospitalId: input.destination_hospital_id,
          bloodGroup: input.blood_group,
          component: input.component,
          units: input.units,
          pickupAddress: input.pickup_address,
          destinationAddress: input.destination_address,
          pickupLatitude: input.pickup_latitude ?? null,
          pickupLongitude: input.pickup_longitude ?? null,
          destinationLatitude: input.destination_latitude ?? null,
          destinationLongitude: input.destination_longitude ?? null,
          eta: input.estimated_arrival ? new Date(input.estimated_arrival) : null,
          transportId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        },
        { autoCommit: false }
      );
      const transportId = Number(inserted.outBinds.transportId);
      await addHistory(connection, transportId, user.userId, "CREATED", null, "PENDING");
      return { success: true, result: { transportId } };
    });

    const transportId = Number(transaction.result?.transportId);
    const transport = await getTransport(transportId);
    await createAuditLog(user.userId, "transport_create", "blood_transports", transportId, undefined, req.ip);
    return res.status(201).json({ success: true, data: transport ? toCamelCase(transport) : null, message: "Transport request created." });
  } catch (error) {
    console.error("Create blood transport error:", error);
    return jsonError(res, 500, "TRANSPORT_CREATE_FAILED", "Failed to create transport request.");
  }
});

router.get("/", async (req: Request, res: Response) => {
  const user = actor(req);
  try {
    let predicate = "";
    let binds: any[] = [];
    if (user.role === "admin") {
      predicate = "1 = 1";
    } else if (user.role === "bloodbank_staff") {
      if (!user.facilityId) return jsonError(res, 403, "FACILITY_REQUIRED", "Blood bank facility is not configured.");
      predicate = "source_bank_id = :1";
      binds = [user.facilityId];
    } else if (user.role === "hospital_staff") {
      predicate = "requester_id = :1";
      binds = [user.userId];
    } else {
      predicate = "(requester_id = :1 OR assigned_driver_id = :2)";
      binds = [user.userId, user.userId];
    }

    const status = typeof req.query.status === "string" ? req.query.status.toUpperCase() : undefined;
    if (status && !statuses.includes(status as (typeof statuses)[number])) {
      return jsonError(res, 400, "INVALID_STATUS", "Unknown transport status.");
    }
    if (status) {
      predicate += ` AND status = :${binds.length + 1}`;
      binds.push(status);
    }
    const transports = await runQuery(
      `SELECT transport_id, blood_request_id, requester_id, source_bank_id,
              destination_hospital_id, assigned_driver_id, vehicle_identifier,
              blood_group, component, units, pickup_address, destination_address,
              current_latitude, current_longitude, location_updated_at,
              estimated_arrival, status, created_at, updated_at
       FROM blood_transports WHERE ${predicate} ORDER BY created_at DESC`,
      binds
    );
    return res.status(200).json({ success: true, data: transports.map(toCamelCase), message: "Transport requests retrieved." });
  } catch (error) {
    console.error("List blood transports error:", error);
    return jsonError(res, 500, "TRANSPORTS_FETCH_FAILED", "Failed to retrieve transport requests.");
  }
});

router.get("/:id/history", async (req: Request, res: Response) => {
  const id = transportIdSchema.safeParse(req.params.id);
  if (!id.success) return jsonError(res, 400, "INVALID_TRANSPORT_ID", "Transport ID must be a positive integer.");
  try {
    const transport = await getTransport(id.data);
    if (!transport) return jsonError(res, 404, "TRANSPORT_NOT_FOUND", "Transport request not found.");
    if (!mayView(transport, actor(req))) return jsonError(res, 403, "FORBIDDEN", "You cannot view this transport request.");
    const history = await runQuery(
      `SELECT history_id, transport_id, actor_id, action, from_status, to_status,
              latitude, longitude, estimated_arrival, notes, created_at
       FROM blood_transport_history WHERE transport_id = :1 ORDER BY created_at, history_id`,
      [id.data]
    );
    return res.status(200).json({ success: true, data: history.map(toCamelCase), message: "Transport history retrieved." });
  } catch (error) {
    console.error("Get blood transport history error:", error);
    return jsonError(res, 500, "TRANSPORT_HISTORY_FAILED", "Failed to retrieve transport history.");
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  const id = transportIdSchema.safeParse(req.params.id);
  if (!id.success) return jsonError(res, 400, "INVALID_TRANSPORT_ID", "Transport ID must be a positive integer.");
  try {
    const transport = await getTransport(id.data);
    if (!transport) return jsonError(res, 404, "TRANSPORT_NOT_FOUND", "Transport request not found.");
    if (!mayView(transport, actor(req))) return jsonError(res, 403, "FORBIDDEN", "You cannot view this transport request.");
    return res.status(200).json({ success: true, data: toCamelCase(transport), message: "Transport request retrieved." });
  } catch (error) {
    console.error("Get blood transport error:", error);
    return jsonError(res, 500, "TRANSPORT_FETCH_FAILED", "Failed to retrieve transport request.");
  }
});

router.patch("/:id/assign", async (req: Request, res: Response) => {
  const id = transportIdSchema.safeParse(req.params.id);
  const parsed = assignSchema.safeParse(req.body);
  if (!id.success) return jsonError(res, 400, "INVALID_TRANSPORT_ID", "Transport ID must be a positive integer.");
  if (!parsed.success) return jsonError(res, 400, "VALIDATION_ERROR", parsed.error.issues.map((issue) => issue.message).join(", "));
  const user = actor(req);
  if (user.role !== "admin" && user.role !== "bloodbank_staff") {
    return jsonError(res, 403, "FORBIDDEN", "Only administrators and blood bank staff can assign transport.");
  }

  try {
    const transport = await getTransport(id.data);
    if (!transport) return jsonError(res, 404, "TRANSPORT_NOT_FOUND", "Transport request not found.");
    if (!mayManage(transport, user)) return jsonError(res, 403, "FORBIDDEN", "You cannot assign this transport.");
    if (String(transport.STATUS) !== "APPROVED") {
      return jsonError(res, 409, "INVALID_TRANSPORT_STATE", "Transport must be approved before assignment.");
    }
    const driver = await runQueryOne<TransportRow>(
      `SELECT user_id, role, is_active FROM users WHERE user_id = :1`,
      [parsed.data.driver_user_id]
    );
    if (!driver || String(driver.ROLE).toLowerCase() !== "bloodbank_staff" || Number(driver.IS_ACTIVE) !== 1) {
      return jsonError(res, 422, "INVALID_DRIVER", "The assigned driver must be an active blood bank staff account.");
    }

    const result = await withTransaction(async (connection) => {
      const changed = await connection.execute(
        `UPDATE blood_transports
         SET assigned_driver_id = :1, vehicle_identifier = :2, status = 'ASSIGNED',
             updated_at = CURRENT_TIMESTAMP
         WHERE transport_id = :3 AND status = 'APPROVED'`,
        [parsed.data.driver_user_id, parsed.data.vehicle_identifier, id.data],
        { autoCommit: false }
      );
      if (changed.rowsAffected !== 1) return { success: false, error: "Transport state changed before assignment." };
      await addHistory(connection, id.data, user.userId, "ASSIGNED", "APPROVED", "ASSIGNED", {
        notes: `Driver ${parsed.data.driver_user_id}; vehicle ${parsed.data.vehicle_identifier}`,
      });
      return { success: true, result: true };
    });
    if (!result.success) return jsonError(res, 409, "INVALID_TRANSPORT_STATE", result.error ?? "Unable to assign transport.");
    const updated = await getTransport(id.data);
    await createAuditLog(user.userId, "transport_assign", "blood_transports", id.data, undefined, req.ip);
    const notificationSent = await notifyParticipants(
      transport,
      "Blood transport assigned",
      `Transport ${id.data} has been assigned.`,
      id.data,
      [parsed.data.driver_user_id]
    );
    return res.status(200).json({
      success: true,
      data: updated ? toCamelCase(updated) : null,
      message: "Driver and vehicle assigned.",
      ...(notificationSent ? {} : { warning: "Assignment saved, but one or more notifications could not be created." }),
    });
  } catch (error) {
    console.error("Assign blood transport error:", error);
    return jsonError(res, 500, "TRANSPORT_ASSIGN_FAILED", "Failed to assign transport.");
  }
});

router.patch("/:id/status", async (req: Request, res: Response) => {
  const id = transportIdSchema.safeParse(req.params.id);
  const parsed = statusSchema.safeParse(req.body);
  if (!id.success) return jsonError(res, 400, "INVALID_TRANSPORT_ID", "Transport ID must be a positive integer.");
  if (!parsed.success) return jsonError(res, 400, "VALIDATION_ERROR", parsed.error.issues.map((issue) => issue.message).join(", "));
  const user = actor(req);

  try {
    const transport = await getTransport(id.data);
    if (!transport) return jsonError(res, 404, "TRANSPORT_NOT_FOUND", "Transport request not found.");
    const currentStatus = String(transport.STATUS);
    const nextStatus = parsed.data.status;
    const isManager = mayManage(transport, user);
    const isRequesterCancellation =
      user.userId === Number(transport.REQUESTER_ID) &&
      nextStatus === "CANCELLED" &&
      ["PENDING", "APPROVED"].includes(currentStatus);
    const isAssignedDriver = user.userId === Number(transport.ASSIGNED_DRIVER_ID);
    const driverStatuses = ["PICKED_UP", "IN_TRANSIT", "DELAYED", "ARRIVED", "FAILED"];
    if (!isManager && !isRequesterCancellation && !(isAssignedDriver && driverStatuses.includes(nextStatus))) {
      return jsonError(res, 403, "FORBIDDEN", "You are not authorized to make this transport status change.");
    }
    if (nextStatus === "ASSIGNED" || nextStatus === "DELIVERED") {
      return jsonError(res, 400, "USE_DEDICATED_ACTION", "Use the assignment or delivery confirmation endpoint for this status.");
    }
    if (!canTransition(transportTransitions, currentStatus, nextStatus)) {
      return jsonError(res, 409, "INVALID_TRANSPORT_TRANSITION", `Cannot move transport from ${currentStatus} to ${nextStatus}.`);
    }
    if (nextStatus === "APPROVED" && user.role !== "admin" && user.role !== "bloodbank_staff") {
      return jsonError(res, 403, "FORBIDDEN", "Only administrators and blood bank staff can approve transport.");
    }
    if (nextStatus === "REJECTED" && user.role !== "admin" && user.role !== "bloodbank_staff") {
      return jsonError(res, 403, "FORBIDDEN", "Only administrators and blood bank staff can reject transport.");
    }
    if (nextStatus === "COMPLETED" && user.role !== "admin" && user.role !== "bloodbank_staff") {
      return jsonError(res, 403, "FORBIDDEN", "Only administrators and blood bank staff can complete transport.");
    }

    const result = await withTransaction(async (connection) => {
      const changed = await connection.execute(
        `UPDATE blood_transports
         SET status = :1, delay_reason = :2,
             updated_at = CURRENT_TIMESTAMP
         WHERE transport_id = :3 AND status = :4`,
        [nextStatus, nextStatus === "DELAYED" ? parsed.data.notes ?? null : null, id.data, currentStatus],
        { autoCommit: false }
      );
      if (changed.rowsAffected !== 1) return { success: false, error: "Transport state changed before update." };
      await addHistory(connection, id.data, user.userId, "STATUS_CHANGED", currentStatus, nextStatus, {
        notes: parsed.data.notes,
      });
      return { success: true, result: true };
    });
    if (!result.success) return jsonError(res, 409, "INVALID_TRANSPORT_STATE", result.error ?? "Unable to update transport.");
    const updated = await getTransport(id.data);
    await createAuditLog(user.userId, "transport_status_update", "blood_transports", id.data, {
      from: currentStatus,
      to: nextStatus,
    }, req.ip);
    const notificationSent = await notifyParticipants(
      transport,
      "Blood transport update",
      `Transport ${id.data} status is now ${nextStatus}.`,
      id.data
    );
    return res.status(200).json({
      success: true,
      data: updated ? toCamelCase(updated) : null,
      message: "Transport status updated.",
      ...(notificationSent ? {} : { warning: "Status saved, but one or more notifications could not be created." }),
    });
  } catch (error) {
    console.error("Update blood transport status error:", error);
    return jsonError(res, 500, "TRANSPORT_STATUS_UPDATE_FAILED", "Failed to update transport status.");
  }
});

router.patch("/:id/location", async (req: Request, res: Response) => {
  const id = transportIdSchema.safeParse(req.params.id);
  const parsed = locationSchema.safeParse(req.body);
  if (!id.success) return jsonError(res, 400, "INVALID_TRANSPORT_ID", "Transport ID must be a positive integer.");
  if (!parsed.success) return jsonError(res, 400, "VALIDATION_ERROR", parsed.error.issues.map((issue) => issue.message).join(", "));
  const user = actor(req);

  try {
    const transport = await getTransport(id.data);
    if (!transport) return jsonError(res, 404, "TRANSPORT_NOT_FOUND", "Transport request not found.");
    if (!mayManage(transport, user) && user.userId !== Number(transport.ASSIGNED_DRIVER_ID)) {
      return jsonError(res, 403, "FORBIDDEN", "Only the assigned driver or transport manager can update location.");
    }
    if (!["PICKED_UP", "IN_TRANSIT", "DELAYED", "ARRIVED"].includes(String(transport.STATUS))) {
      return jsonError(res, 409, "INVALID_TRANSPORT_STATE", "Location updates are only accepted after pickup and before delivery.");
    }
    const eta = parsed.data.estimated_arrival ? new Date(parsed.data.estimated_arrival) : undefined;
    const result = await withTransaction(async (connection) => {
      const changed = await connection.execute(
        `UPDATE blood_transports
         SET current_latitude = :1, current_longitude = :2,
             location_updated_at = CURRENT_TIMESTAMP,
             estimated_arrival = NVL(:3, estimated_arrival),
             updated_at = CURRENT_TIMESTAMP
         WHERE transport_id = :4 AND status = :5
           AND status IN ('PICKED_UP', 'IN_TRANSIT', 'DELAYED', 'ARRIVED')`,
        [parsed.data.latitude, parsed.data.longitude, eta ?? null, id.data, String(transport.STATUS)],
        { autoCommit: false }
      );
      if (changed.rowsAffected !== 1) return { success: false, error: "Transport state changed before location update." };
      await addHistory(connection, id.data, user.userId, "LOCATION_UPDATED", String(transport.STATUS), String(transport.STATUS), {
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
        eta,
        notes: parsed.data.notes,
      });
      return { success: true, result: true };
    });
    if (!result.success) return jsonError(res, 409, "INVALID_TRANSPORT_STATE", result.error ?? "Unable to update location.");
    const updated = await getTransport(id.data);
    await createAuditLog(user.userId, "transport_location_update", "blood_transports", id.data, undefined, req.ip);
    return res.status(200).json({ success: true, data: updated ? toCamelCase(updated) : null, message: "Transport location and ETA updated." });
  } catch (error) {
    console.error("Update transport location error:", error);
    return jsonError(res, 500, "TRANSPORT_LOCATION_UPDATE_FAILED", "Failed to update transport location.");
  }
});

router.post("/:id/confirm-delivery", async (req: Request, res: Response) => {
  const id = transportIdSchema.safeParse(req.params.id);
  const parsed = deliverySchema.safeParse(req.body);
  if (!id.success) return jsonError(res, 400, "INVALID_TRANSPORT_ID", "Transport ID must be a positive integer.");
  if (!parsed.success) return jsonError(res, 400, "VALIDATION_ERROR", parsed.error.issues.map((issue) => issue.message).join(", "));
  const user = actor(req);

  try {
    const transport = await getTransport(id.data);
    if (!transport) return jsonError(res, 404, "TRANSPORT_NOT_FOUND", "Transport request not found.");
    if (!mayManage(transport, user) && user.userId !== Number(transport.ASSIGNED_DRIVER_ID)) {
      return jsonError(res, 403, "FORBIDDEN", "Only the assigned driver or transport manager can confirm delivery.");
    }
    if (String(transport.STATUS) !== "ARRIVED") {
      return jsonError(res, 409, "INVALID_TRANSPORT_STATE", "Transport must be marked arrived before delivery confirmation.");
    }
    const result = await withTransaction(async (connection) => {
      const changed = await connection.execute(
        `UPDATE blood_transports
         SET status = 'DELIVERED', delivery_confirmation = :1,
             delivery_confirmed_by = :2, delivery_confirmed_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE transport_id = :3 AND status = 'ARRIVED'`,
        [parsed.data.confirmation, user.userId, id.data],
        { autoCommit: false }
      );
      if (changed.rowsAffected !== 1) return { success: false, error: "Transport state changed before confirmation." };
      await addHistory(connection, id.data, user.userId, "DELIVERY_CONFIRMED", "ARRIVED", "DELIVERED", {
        notes: parsed.data.confirmation,
      });
      return { success: true, result: true };
    });
    if (!result.success) return jsonError(res, 409, "INVALID_TRANSPORT_STATE", result.error ?? "Unable to confirm delivery.");
    const updated = await getTransport(id.data);
    await createAuditLog(user.userId, "transport_delivery_confirmed", "blood_transports", id.data, undefined, req.ip);
    const notificationSent = await notifyParticipants(
      transport,
      "Blood delivery confirmed",
      `Transport ${id.data} delivery has been confirmed.`,
      id.data
    );
    return res.status(200).json({
      success: true,
      data: updated ? toCamelCase(updated) : null,
      message: "Delivery confirmed.",
      ...(notificationSent ? {} : { warning: "Delivery saved, but one or more notifications could not be created." }),
    });
  } catch (error) {
    console.error("Confirm transport delivery error:", error);
    return jsonError(res, 500, "TRANSPORT_DELIVERY_CONFIRM_FAILED", "Failed to confirm delivery.");
  }
});

export default router;
