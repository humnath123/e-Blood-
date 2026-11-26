const operation = (
  tag: string,
  summary: string,
  requestBody?: any,
  parameters: any[] = [],
  secured = false
) => ({
  tags: [tag],
  summary,
  ...(secured ? { security: [{ bearerAuth: [] }] } : {}),
  ...(parameters.length ? { parameters } : {}),
  ...(requestBody ? { requestBody } : {}),
  responses: {
    "200": { description: "Successful response" },
    "400": { description: "Validation or request error" },
    "401": { description: "Authentication required" },
    "404": { description: "Resource not found" },
  },
});

const jsonBody = (properties: Record<string, any>, required: string[] = []) => ({
  required: true,
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties,
        required,
      },
    },
  },
});

const idParam = (name = "id") => ({
  name,
  in: "path",
  required: true,
  schema: { type: "integer" },
});

export const swaggerDocument = {
  openapi: "3.0.0",
  info: {
    title: "eBlood API",
    version: "1.0.0",
    description: "Blood-finding application for Nepal",
  },
  servers: [{ url: "/api/v1", description: "API v1" }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
  },
  paths: {
    "/health": { get: operation("System", "Check API and Oracle database health") },
    "/auth/register": { post: operation("Auth", "Register a user", jsonBody({ identifier: { type: "string" }, password: { type: "string" }, role: { type: "string" }, bloodGroup: { type: "string" } }, ["identifier", "password", "role"])) },
    "/auth/login": { post: operation("Auth", "Log in", jsonBody({ identifier: { type: "string" }, password: { type: "string" } }, ["identifier", "password"])) },
    "/auth/refresh": { post: operation("Auth", "Refresh access token", jsonBody({ refreshToken: { type: "string" } }, ["refreshToken"])) },
    "/auth/logout": { post: operation("Auth", "Log out", undefined, [], true) },
    "/auth/forgot-password": { post: operation("Auth", "Request password reset code", jsonBody({ identifier: { type: "string" } }, ["identifier"])) },
    "/auth/reset-password": { post: operation("Auth", "Reset password", jsonBody({ identifier: { type: "string" }, resetCode: { type: "string" }, newPassword: { type: "string" } }, ["identifier", "resetCode", "newPassword"])) },
    "/auth/google": { post: operation("Auth", "Google sign-in (development stub)") },
    "/auth/me": { get: operation("Auth", "Get authenticated profile", undefined, [], true) },
    "/auth/password": { post: operation("Auth", "Update password", jsonBody({ currentPassword: { type: "string" }, newPassword: { type: "string" } }, ["currentPassword", "newPassword"]), [], true) },
    "/me": {
      get: operation("Profile", "Get current profile", undefined, [], true),
      patch: operation("Profile", "Update current profile", jsonBody({ username: { type: "string" }, email: { type: "string" }, phone: { type: "string" }, blood_group: { type: "string" } }), [], true),
    },
    "/me/location": { patch: operation("Profile", "Update location", jsonBody({ latitude: { type: "number" }, longitude: { type: "number" } }, ["latitude", "longitude"]), [], true) },
    "/me/donor-availability": { patch: operation("Profile", "Update donor availability", jsonBody({ is_available: { type: "boolean" } }), [], true) },
    "/search": { post: operation("Search", "Search blood banks, hospitals and eligible donors", jsonBody({ bloodGroup: { type: "string" }, component: { type: "string" }, units: { type: "integer" }, latitude: { type: "number" }, longitude: { type: "number" }, radiusKm: { type: "number" } }, ["bloodGroup"])) },
    "/requests": {
      get: operation("Requests", "List blood requests", undefined, [{ name: "status", in: "query", schema: { type: "string" } }, { name: "blood_group", in: "query", schema: { type: "string" } }], true),
      post: operation("Requests", "Create blood request", jsonBody({ blood_group: { type: "string" }, component: { type: "string" }, units_needed: { type: "integer" }, urgency: { type: "string" }, hospital_id: { type: "integer" }, latitude: { type: "number" }, longitude: { type: "number" } }, ["blood_group", "component", "units_needed"]), [], true),
    },
    "/requests/{id}": {
      get: operation("Requests", "Get a blood request", undefined, [idParam()], true),
      put: operation("Requests", "Update a blood request", jsonBody({ bloodGroup: { type: "string" }, unitsRequired: { type: "integer" }, urgency: { type: "string" }, status: { type: "string" } }), [idParam()], true),
      delete: operation("Requests", "Delete a blood request", undefined, [idParam()], true),
    },
    "/requests/{id}/cancel": { patch: operation("Requests", "Cancel a blood request", undefined, [idParam()], true) },
    "/requests/{id}/matches/{matchId}/respond": { patch: operation("Requests", "Respond to a blood request match", jsonBody({ response: { type: "string", enum: ["accept", "decline"] } }, ["response"]), [idParam(), idParam("matchId")], true) },
    "/inventory": {
      get: operation("Inventory", "Get facility inventory", undefined, [], true),
      post: operation("Inventory", "Add or restock inventory", jsonBody({ blood_group: { type: "string" }, component: { type: "string" }, units: { type: "integer" }, expiry_date: { type: "string" } }, ["blood_group", "component", "units"]), [], true),
    },
    "/inventory/expiring": { get: operation("Inventory", "Get expiring inventory", undefined, [{ name: "days", in: "query", schema: { type: "integer", default: 7 } }], true) },
    "/inventory/{id}": { patch: operation("Inventory", "Update inventory", jsonBody({ units: { type: "integer" }, is_verified: { type: "boolean" } }), [idParam()], true) },
    "/orders": {
      get: operation("Orders", "List current user's orders", undefined, [], true),
      post: operation("Orders", "Create order", jsonBody({ inventory_id: { type: "integer" }, units_ordered: { type: "integer" } }, ["inventory_id", "units_ordered"]), [], true),
    },
    "/orders/{id}/status": { patch: operation("Orders", "Update order status", jsonBody({ status: { type: "string" }, payment_status: { type: "string" } }, ["status"]), [idParam()], true) },
    "/donations/me": { get: operation("Donations", "Get current user's donations", undefined, [], true) },
    "/donations": {
      get: operation("Donations", "List facility donations", undefined, [], true),
      post: operation("Donations", "Record donation", jsonBody({ bank_id: { type: "integer" }, components: { type: "string" }, units: { type: "integer" } }, ["bank_id", "components", "units"]), [], true),
    },
    "/donations/{id}": { put: operation("Donations", "Update donation status", jsonBody({ status: { type: "string" } }, ["status"]), [idParam()], true) },
    "/donations/{id}/certificate": {
      post: {
        ...operation("Donations", "Email a completed donation certificate to the donor", {
          required: false,
          content: jsonBody({ retry: { type: "boolean", description: "Set true for an authorized resend or recovery attempt." } }).content,
        }, [idParam()], true),
        responses: {
          "200": { description: "Certificate emailed and sent timestamp saved" },
          "400": { description: "Invalid donation ID" },
          "401": { description: "Authentication required" },
          "403": { description: "Administrator or blood bank staff access required" },
          "404": { description: "Donation not found" },
          "409": { description: "Donation is not completed, delivery is in progress, or an authorized retry is required" },
          "422": { description: "Donor email or first/last name is missing" },
          "502": { description: "Certificate email delivery failed" },
          "503": { description: "SMTP is not configured" },
        },
      },
    },
    "/donors": {
      get: operation("Donors", "List donors", undefined, [{ name: "bloodGroup", in: "query", schema: { type: "string" } }, { name: "search", in: "query", schema: { type: "string" } }, { name: "city", in: "query", schema: { type: "string" } }], true),
      post: operation("Donors", "Create donor", jsonBody({ email: { type: "string" }, username: { type: "string" }, password: { type: "string" }, phone: { type: "string" } }, ["email", "username", "password", "phone"]), [], true),
    },
    "/donors/{id}": {
      get: operation("Donors", "Get donor", undefined, [idParam()], true),
      put: operation("Donors", "Update donor", jsonBody({ username: { type: "string" }, email: { type: "string" }, phone: { type: "string" } }), [idParam()], true),
      delete: operation("Donors", "Delete donor", undefined, [idParam()], true),
    },
    "/blood-banks": {
      get: operation("Blood Banks", "List blood banks", undefined, [{ name: "city", in: "query", schema: { type: "string" } }, { name: "search", in: "query", schema: { type: "string" } }], true),
      post: operation("Blood Banks", "Create blood bank", jsonBody({ name: { type: "string" }, latitude: { type: "number" }, longitude: { type: "number" }, address: { type: "string" }, phone: { type: "string" }, email: { type: "string" } }, ["name", "latitude", "longitude"]), [], true),
    },
    "/blood-banks/{id}": {
      get: operation("Blood Banks", "Get blood bank", undefined, [idParam()], true),
      put: operation("Blood Banks", "Update blood bank", jsonBody({ name: { type: "string" }, address: { type: "string" }, phone: { type: "string" }, email: { type: "string" } }), [idParam()], true),
      delete: operation("Blood Banks", "Delete blood bank", undefined, [idParam()], true),
    },
    "/notifications": { get: operation("Notifications", "List notifications", undefined, [{ name: "userId", in: "query", schema: { type: "integer" } }], true) },
    "/notifications/{id}/read": { post: operation("Notifications", "Mark notification as read", undefined, [idParam()], true) },
    "/notifications/read-all": { post: operation("Notifications", "Mark all notifications as read", undefined, [], true) },
    "/notifications/{id}": { delete: operation("Notifications", "Delete notification", undefined, [idParam()], true) },
    "/rewards": { get: operation("Rewards", "Get rewards", undefined, [], true) },
    "/rewards/{id}/redeem": { post: operation("Rewards", "Redeem reward", jsonBody({ points_to_redeem: { type: "integer" } }), [idParam()], true) },
    "/rewards/redemptions": { get: operation("Rewards", "Get redemption history", undefined, [], true) },
    "/campaigns": {
      get: operation("Campaigns", "List campaigns", undefined, [], true),
      post: operation("Campaigns", "Create campaign", jsonBody({ title: { type: "string" }, description: { type: "string" }, target_blood_group: { type: "string" }, target_units: { type: "integer" }, target_date: { type: "string" } }, ["title", "target_blood_group", "target_units", "target_date"]), [], true),
    },
    "/campaigns/{id}/join": { post: operation("Campaigns", "Join campaign", undefined, [idParam()], true) },
    "/campaigns/stats": { get: operation("Campaigns", "Get campaign statistics", undefined, [], true) },
    "/transports": {
      get: operation("Blood Transport", "List transport requests", undefined, [{ name: "status", in: "query", schema: { type: "string" } }], true),
      post: operation("Blood Transport", "Create a blood transport request", jsonBody({
        blood_request_id: { type: "integer" },
        source_bank_id: { type: "integer" },
        destination_hospital_id: { type: "integer" },
        blood_group: { type: "string", enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] },
        component: { type: "string", enum: ["whole_blood", "plasma", "platelets", "rbc"] },
        units: { type: "integer" },
        pickup_address: { type: "string" },
        destination_address: { type: "string" },
        pickup_latitude: { type: "number" },
        pickup_longitude: { type: "number" },
        destination_latitude: { type: "number" },
        destination_longitude: { type: "number" },
        estimated_arrival: { type: "string", format: "date-time" },
      }, ["source_bank_id", "destination_hospital_id", "blood_group", "units", "pickup_address", "destination_address"]), [], true),
    },
    "/transports/{id}": { get: operation("Blood Transport", "Get a transport request", undefined, [idParam()], true) },
    "/transports/{id}/history": { get: operation("Blood Transport", "Get transport audit history", undefined, [idParam()], true) },
    "/transports/{id}/assign": {
      patch: operation("Blood Transport", "Assign an active blood bank staff driver and vehicle", jsonBody({
        driver_user_id: { type: "integer" },
        vehicle_identifier: { type: "string" },
      }, ["driver_user_id", "vehicle_identifier"]), [idParam()], true),
    },
    "/transports/{id}/status": {
      patch: operation("Blood Transport", "Advance a transport workflow status", jsonBody({
        status: { type: "string", enum: ["APPROVED", "PICKED_UP", "IN_TRANSIT", "ARRIVED", "COMPLETED", "REJECTED", "CANCELLED", "DELAYED", "FAILED"] },
        notes: { type: "string" },
      }, ["status"]), [idParam()], true),
    },
    "/transports/{id}/location": {
      patch: operation("Blood Transport", "Record the latest GPS coordinates and optional ETA", jsonBody({
        latitude: { type: "number" },
        longitude: { type: "number" },
        estimated_arrival: { type: "string", format: "date-time" },
        notes: { type: "string" },
      }, ["latitude", "longitude"]), [idParam()], true),
    },
    "/transports/{id}/confirm-delivery": {
      post: operation("Blood Transport", "Confirm delivery after arrival", jsonBody({ confirmation: { type: "string" } }, ["confirmation"]), [idParam()], true),
    },
    "/events": {
      get: operation("Donation Events", "List donation events", undefined, [{ name: "status", in: "query", schema: { type: "string" } }], true),
      post: operation("Donation Events", "Create a draft donation event", jsonBody({
        title: { type: "string" },
        description: { type: "string" },
        banner_url: { type: "string", format: "uri" },
        organizer_name: { type: "string" },
        organizer_contact: { type: "string" },
        location: { type: "string" },
        latitude: { type: "number" },
        longitude: { type: "number" },
        starts_at: { type: "string", format: "date-time" },
        ends_at: { type: "string", format: "date-time" },
        registration_deadline: { type: "string", format: "date-time" },
        max_participants: { type: "integer" },
      }, ["title", "organizer_name", "location", "starts_at", "ends_at", "registration_deadline"]), [], true),
    },
    "/events/{id}": {
      get: operation("Donation Events", "Get a donation event", undefined, [idParam()], true),
      patch: operation("Donation Events", "Edit a draft or published event", jsonBody({ title: { type: "string" }, description: { type: "string" }, banner_url: { type: "string" }, location: { type: "string" }, starts_at: { type: "string", format: "date-time" }, ends_at: { type: "string", format: "date-time" }, registration_deadline: { type: "string", format: "date-time" } }), [idParam()], true),
      delete: operation("Donation Events", "Delete a draft event", undefined, [idParam()], true),
    },
    "/events/{id}/status": { patch: operation("Donation Events", "Advance event lifecycle status", jsonBody({ status: { type: "string", enum: ["PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "ONGOING", "COMPLETED", "CANCELLED", "POSTPONED"] } }, ["status"]), [idParam()], true) },
    "/events/{id}/register": {
      post: operation("Donation Events", "Register the authenticated donor", undefined, [idParam()], true),
      delete: operation("Donation Events", "Cancel the authenticated donor registration", undefined, [idParam()], true),
    },
    "/events/{id}/registrations": { get: operation("Donation Events", "List event registrations", undefined, [idParam()], true) },
    "/events/{id}/registrations/{registrationId}/attendance": {
      patch: operation("Donation Events", "Record attendance independently from donation completion", jsonBody({ attendance_status: { type: "string", enum: ["ATTENDED", "NO_SHOW"] } }, ["attendance_status"]), [idParam(), idParam("registrationId")], true),
    },
    "/events/{id}/registrations/{registrationId}/donation": {
      patch: operation("Donation Events", "Link a completed donation record to an attended registration", jsonBody({ donation_id: { type: "integer" } }, ["donation_id"]), [idParam(), idParam("registrationId")], true),
    },
    "/events/{id}/statistics": { get: operation("Donation Events", "Get database-backed event statistics", undefined, [idParam()], true) },
    "/admin/blood-banks/{id}/verify": { patch: operation("Admin", "Verify blood bank", undefined, [idParam()], true) },
    "/admin/hospitals/{id}/verify": { patch: operation("Admin", "Verify hospital", undefined, [idParam()], true) },
    "/admin/stats": { get: operation("Admin", "Get platform statistics", undefined, [], true) },
    "/admin/users/{id}/role": { patch: operation("Admin", "Update user role", jsonBody({ role: { type: "string" } }, ["role"]), [idParam()], true) },
  },
};
