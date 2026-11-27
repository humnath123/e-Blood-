# E-Blood Backend API

**Base URL:** https://e-blood-j14l.onrender.com

---

## Authentication

- **POST /auth/register** – Register a new user.
  - **Auth:** None
  - **Request body:**
    ```json
    {
      "identifier": "string (email or phone)",
      "email": "string",
      "username": "string",
      "phone": "string (format 97x... or 98x...)",
      "bloodGroup": "enum [A+, A-, B+, B-, AB+, AB-, O+, O-]",
      "password": "string (min 6 chars)",
      "role": "enum [patient, donor, bloodbank_staff, hospital_staff, ngo, admin]"
    }
    ```
  - **Success (201):**
    ```json
    {
      "success": true,
      "data": {
        "token": "jwt-access-token",
        "user": { id, email, username, role, isActive, isEmailVerified, createdAt, updatedAt }
      },
      "message": "Registration successful",
      "error": null
    }
    ```
  - **Error responses:**
    - 400 `VALIDATION_ERROR`
    - 409 `CONSTRAINT_VIOLATION` – user with this email/phone already exists
    - 500 `REGISTRATION_FAILED`

- **POST /auth/login** – Login.
  - **Auth:** None
  - **Request body:**
    ```json
    {
      "identifier": "string (phone or email)",
      "password": "string"
    }
    ```
  - **Success (200):**
    ```json
    {
      "success": true,
      "data": { "token": "...", "user": {...} },
      "message": "Login successful",
      "error": null
    }
    ```
  - **Error responses:**
    - 401 `AUTH_FAILED` – invalid credentials or account disabled
    - 500 `LOGIN_FAILED`

- **POST /auth/refresh** – Refresh access token using refresh token.
  - **Auth:** None (body only)
  - **Request body:** `{ "refreshToken": "string" }`
  - **Success (200):**
    ```json
    { "success": true, "data": { "accessToken": "...", "refreshToken": "..." }, "error": null }
    ```
  - **Error responses:**
    - 401 `INVALID_REFRESH_TOKEN` – missing, invalid, or expired
    - 401 `REVOKED_REFRESH_TOKEN` – token revoked
    - 500 `REFRESH_FAILED`

- **POST /auth/logout** – Revoke all refresh tokens for the authenticated user.
  - **Auth:** `authenticate` (JWT access token required)
  - **Success (200):** `{ "success": true, "data": { message: "Logged out successfully" }, "error": null }`
  - **Error (500):** `LOGOUT_FAILED`

- **POST /auth/forgot-password** – Send password reset code (development logs code to console).
  - **Auth:** None
  - **Request body:** `{ "identifier": "email or phone" }`
  - **Success (200):** `{ "success": true, "data": { message: "If an account with that identifier exists, a reset code has been sent." }, "error": null }`
  - **Error (400):** `MISSING_IDENTIFIER`

- **POST /auth/reset-password** – Reset password with reset code.
  - **Auth:** None
  - **Request body:**
    ```json
    {
      "identifier": "email or phone",
      "resetCode": "6-digit code",
      "newPassword": "string (min 6 chars)",
      "confirmPassword": "string (optional)"
    }
    ```
  - **Success (200):** `{ "success": true, "data": null, "message": "Password has been reset successfully." }`
  - **Error responses:**
    - 400 `MISSING_REQUIRED_FIELDS`
    - 400 `INVALID_RESET_CODE` – not 6 digits or NaN
    - 404 `USER_NOT_FOUND`
    - 500 `RESET_PASSWORD_FAILED`

- **GET /auth/me** – Get current user profile (authenticated).
  - **Auth:** `authenticate` (JWT)
  - **Success (200):** `{ "success": true, "data": { id, username, email, phone, role, isActive, isEmailVerified, createdAt, updatedAt }, "message": "Profile retrieved successfully" }`
  - **Error responses:** 404 `USER_NOT_FOUND`, 500 `PROFILE_FETCH_FAILED`

- **POST /auth/password** – Change password (authenticated).
  - **Auth:** `authenticate`
  - **Request body:** `{ "currentPassword": "string", "newPassword": "string" }`
  - **Success (200):** `{ "success": true, "data": null, "message": "Password updated successfully" }`
  - **Error responses:**
    - 400 `MISSING_REQUIRED_FIELDS`
    - 401 `WRONG_PASSWORD`
    - 400 `PASSWORD_TOO_SHORT` – new password < 6 chars
    - 500 `PASSWORD_UPDATE_FAILED`

- **POST /auth/google** – Google sign-in stub (development only).
  - **Auth:** None
  - **Success (200):** `{ "success": true, "data": { message: "Google sign-in stub - not implemented in development mode" }, "error": null }`

---

## Admin

- **PATCH /admin/blood-banks/:id/verify** – Verify a blood bank (admin only).
  - **Auth:** `requireAdmin` (role must be `admin`)
  - **Success (200):** `{ "success": true, "data": { bloodBank: {...} }, "error": null }`
  - **Error responses:**
    - 401 `NOT_AUTHENTICATED`
    - 403 `RBAC_DENIED` – admin role required
    - 500 `ADMIN_VERIFY_BANK_FAILED`

- **PATCH /admin/hospitals/:id/verify** – Verify a hospital (admin only).
  - **Auth:** `requireAdmin`
  - **Success/Error** same structure as blood‑bank verify.

- **GET /admin/stats** – Get system-wide stats (admin only).
  - **Auth:** `requireAdmin`
  - **Success (200):** `{ "success": true, "data": { stats: {...} }, "error": null }`
  - **Error responses:** 401, 403, 500 `ADMIN_STATS_FAILED`

- **PATCH /admin/users/:id/role** – Update a user’s role (admin only).
  - **Auth:** `requireAdmin`
  - **Request body:** `{ "role": "enum [patient, donor, bloodbank_staff, hospital_staff, ngo, admin]" }`
  - **Success (200):** `{ "success": true, "data": { user: {...} }, "error": null }`
  - **Error responses:**
    - 400 `INVALID_ROLE`
    - 401, 403, 500 `ADMIN_ROLE_UPDATE_FAILED`

---

## Profile (authenticated user)

- **GET /me** – Retrieve profile.
  - **Auth:** `authenticate`
  - **Success (200):** see auth `/me` success above.
  - **Error:** 401, 404, 500

- **PATCH /me** – Update profile (username, email, phone, bloodGroup).
  - **Auth:** `authenticate`
  - **Request body** validated by `updateProfileSchema` (all fields optional).
  - **Success (200):** profile object.
  - **Error responses:**
    - 400 `VALIDATION_ERROR`
    - 403 – only donor accounts may update blood group
    - 401, 500

- **PATCH /me/location** – Update user latitude/longitude.
  - **Auth:** `authenticate`
  - **Request body:** `{ "latitude": number, "longitude": number }` (validated by `updateLocationSchema`).
  - **Success (200):** `{ "success": true, "data": { latitude, longitude }, "error": null }`
  - **Error responses:** 400, 401, 500

- **PATCH /me/donor-availability** – Set donor availability flag.
  - **Auth:** `authenticate`
  - **Request body:** `{ "is_available": boolean }` (validated by `updateDonorAvailabilitySchema`).
  - **Success (200):** `{ "success": true, "data": { is_available }, "error": null }`
  - **Error responses:** 400, 403 (non‑donor), 401, 500

---

## Donors

- **GET /** – List donors (query: `bloodGroup`, `search`, `city`).
  - **Auth:** None (public)
  - **Success (200):** `{ "success": true, "data": { donors: [...] }, "message": "Donors retrieved successfully" }`
  - **Error (500):** `Get donors error`

- **GET /:id** – Get donor by ID.
  - **Auth:** None
  - **Success (200):** donor object.
  - **Error:** 404, 500

- **POST /** – Create a new donor account.
  - **Auth:** None (public)
  - **Request body:** `{ "email", "username", "password", "phone", "bloodGroup?" }`
  - **Success (201):** created donor object.
  - **Error responses:**
    - 400 validation
    - 409 `Donor already exists` (ORA-00001)
    - 500

- **PUT /:id** – Update donor fields (username, email, phone).
  - **Auth:** None
  - **Request body:** selective fields.
  - **Success (200):** updated donor.
  - **Error:** 400 (no fields), 404, 500

- **DELETE /:id** – Soft‑delete donor (set is_active = 0).
  - **Auth:** None
  - **Success (200):** `{ "success": true, "data": null, "message": "Donor deleted successfully" }`
  - **Error:** 404, 500

---

## Blood Banks

- **GET /** – List blood banks (query: `search`, `city`).
  - **Auth:** None
  - **Success (200):** list with `toCamelCase`.
  - **Error (500)**

- **GET /:id** – Get blood bank with inventory.
  - **Auth:** None
  - **Success (200):** `{ "success": true, "data": { ...bank, inventory: [...] }, "message": "Blood bank retrieved successfully" }`
  - **Error:** 404, 500

- **POST /** – Create a blood bank (no auth in code; typically admin).
  - **Request body:** `{ "name", "latitude", "longitude", "address?", "phone?", "email?" }`
  - **Success (201):** created bank.
  - **Error:** 400, 500

- **PUT /:id** – Update blood bank fields.
  - **Request body:** selective fields from allowed list.
  - **Success (200):** updated bank.
  - **Error:** 400, 404, 500

- **DELETE /:id** – Delete blood bank.
  - **Success (200):** `{ "success": true, "data": null, "message": "Blood bank deleted successfully" }`
  - **Error:** 404, 500

---

## Inventory (blood bank staff – requires JWT + facilityId)

- **GET /** – Get own facility's inventory.
  - **Auth:** `authenticate` + `facilityId` (set by middleware)
  - **Success (200):** `{ "success": true, "data": { inventory: [...] }, "error": null }`
  - **Error responses:** 401 `NOT_AUTHENTICATED`, 403 `FORBIDDEN`, 500 `INVENTORY_FETCH_FAILED`

- **POST /** – Add new inventory item.
  - **Auth:** same as above
  - **Request body:** validated by `inventoryItemSchema` (`bloodGroup`, `component`, `units?`, `expiry_date?`).
  - **Success (201)** or **(200)** if updating existing item.
  - **Error responses:** 400 `VALIDATION_ERROR`, 401, 403, 500 `INVENTORY_ADD_FAILED`

- **PATCH /:id** – Update inventory item units.
  - **Auth:** same
  - **Request body:** `{ "units": number }` (validated by `updateInventorySchema`).
  - **Success (200):** updated inventory.
  - **Error responses:** 400, 401, 403, 404 `INVENTORY_NOT_FOUND`, 500 `INVENTORY_UPDATE_FAILED`

- **GET /expiring** – Get inventory expiring soon (default 7 days, `?days=N`).
  - **Auth:** same
  - **Query:** `days` (optional integer)
  - **Success (200):** `{ "success": true, "data": { expiring: [...] } }`
  - **Error responses:** 401, 403, 500 `INVENTORY_EXPIRING_FAILED`

---

## Events (donation events)

- **GET /** – List events (filterable by `status` query; non‑admin users see non‑DRAFT events).
  - **Auth:** None (public, but role‑based filtering)
  - **Success (200):** `{ "success": true, "data": { events: [...] }, "message": "Donation events retrieved." }`
  - **Error (500):** `EVENTS_FETCH_FAILED`

- **POST /** – Create a new donation event.
  - **Auth:** JWT; role must be `admin`, `ngo`, or `bloodbank_staff`.
  - **Request body:** validated by `createEventSchema` (title, description?, banner_url?, organizer_name, organizer_contact?, location, latitude?, longitude?, starts_at, ends_at, registration_deadline, max_participants?).
  - **Success (201):** `{ "success": true, "data": { campaign: {...} }, "message": "Donation event created as draft." }`
  - **Error responses:** 400 `VALIDATION_ERROR`, 403 `FORBIDDEN`, 400 `INVALID_EVENT_DATES`, 500 `EVENT_CREATE_FAILED`

- **GET /:id/statistics** – Event statistics (attendance, registrations, donations).
  - **Auth:** None, but checks manager rights if event is DRAFT.
  - **Success (200):** `{ "success": true, "data": { eventId, registrations, attendance, confirmedDonations }, "message": "..." }`
  - **Error responses:** 400 `INVALID_EVENT_ID`, 404 `EVENT_NOT_FOUND`, 403 `FORBIDDEN`, 500

- **GET /:id/registrations** – List registrations for an event (organizer/admin only).
  - **Auth:** JWT; must be organizer or admin.
  - **Success (200):** list of registrations.
  - **Error responses:** 400, 403, 404, 500

- **POST /:id/register** – Register a donor for an event.
  - **Auth:** JWT; role must be `donor`.
  - **Success (201):** `{ "success": true, "data": { registrationStatus: "REGISTERED" }, "message": "Successfully registered for the event." }`
  - **Error responses:**
    - 400 `INVALID_EVENT_ID`
    - 403 `FORBIDDEN` – only donors
    - 404 `EVENT_NOT_FOUND`
    - 409 `REGISTRATION_CLOSED`, `EVENT_FULL`, `ALREADY_REGISTERED`

- **DELETE /:id/register** – Cancel event registration.
  - **Auth:** JWT (donor)
  - **Success (200):** `{ "success": true, "data": null, "message": "Event registration cancelled." }`
  - **Error responses:** 400 `INVALID_EVENT_ID`, 404 `REGISTRATION_NOT_FOUND`, 500

- **PATCH /:id/registrations/:registrationId/attendance** – Record attendance status.
  - **Auth:** JWT; must be organizer or admin.
  - **Request body:** `{ "attendance_status": "ATTENDED" | "NO_SHOW" }`
  - **Success (200):** recorded attendance.
  - **Error responses:** 400, 403, 404, 500 `EVENT_ATTENDANCE_FAILED`

- **PATCH /:id/registrations/:registrationId/donation** – Link a completed donation to a registration.
  - **Auth:** JWT; organizer/admin.
  - **Request body:** `{ "donation_id": number }`
  - **Success (200):** linked donation object.
  - **Error responses:** 400, 403, 404, 409 `ATTENDANCE_REQUIRED`, `DONATION_ALREADY_CONFIRMED`, 500

- **PATCH /:id/status** – Change event status (DRAFT → PUBLISHED → COMPLETED, etc.).
  - **Auth:** JWT; organizer/admin.
  - **Request body:** `{ "status": "enum [DRAFT, PUBLISHED, REGISTRATION_OPEN, REGISTRATION_CLOSED, ONGOING, COMPLETED, CANCELLED, POSTPONED]" }`
  - **Success (200):** updated event.
  - **Error responses:** 400 `INVALID_EVENT_TRANSITION`, 403, 409 `INVALID_EVENT_TRANSITION`, 500 `EVENT_STATUS_UPDATE_FAILED`

- **PATCH /:id** – Edit event details (title, dates, participant limit, etc.).
  - **Auth:** JWT; organizer/admin.
  - **Request body:** partial fields from `updateEventSchema`.
  - **Success (200):** updated event.
  - **Error responses:** 400, 403, 409 `EVENT_NOT_EDITABLE`, `CAPACITY_BELOW_REGISTRATIONS`, `INVALID_EVENT_DATES`, 500

- **DELETE /:id** – Delete event (only DRAFT events).
  - **Auth:** JWT; organizer/admin.
  - **Success (200):** `{ "success": true, "data": null, "message": "Draft donation event deleted." }`
  - **Error responses:** 403, 409 `EVENT_NOT_DELETABLE`, 500

- **GET /:id** – Get a single event by ID.
  - **Auth:** None (but DRAFT events visible only to organizer/admin).
  - **Success (200):** event object.
  - **Error responses:** 400 `INVALID_EVENT_ID`, 404, 500

---

## Notifications

- **GET /** – List notifications for a user (query `userId` or use authenticated user).
  - **Auth:** JWT (userId from token or query param).
  - **Query:** `userId` (optional; defaults to authenticated user).
  - **Success (200):** `{ "success": true, "data": { notifications: [...] }, "message": "Notifications retrieved successfully" }`
  - **Error (500)**

- **POST /:id/read** – Mark a single notification as read.
  - **Auth:** JWT
  - **Success (200):** `{ "success": true, "data": { ... }, "message": "Notification marked as read" }`
  - **Error responses:** 404 `Notification not found`, 500

- **POST /read-all** – Mark all unread notifications as read.
  - **Auth:** JWT
  - **Success (200):** `{ "success": true, "data": null, "message": "All notifications marked as read" }`
  - **Error (500)**

- **DELETE /:id** – Delete a notification.
  - **Auth:** JWT
  - **Success (200):** `{ "success": true, "data": null, "message": "Notification deleted successfully" }`
  - **Error responses:** 404, 500

---

## Search

- **POST /** – Search blood banks, hospitals, and donors near coordinates.
  - **Auth:** None (public)
  - **Request body:** validated by `searchSchema` (`bloodGroup`, `component?`, `units?`, `latitude`, `longitude`, `radiusKm?` default 50km).
  - **Success (200):**
    ```json
    {
      "success": true,
      "data": {
        "bloodBanks": [...],
        "hospitals": [...],
        "donors": [...]
      },
      "message": "Search completed successfully"
    }
    ```
  - **Error (500):** `SEARCH_FAILED`

---

## Requests (blood requests)

- **POST /** – Create a new blood request.
  - **Auth:** JWT (requires `userId`).
  - **Request body:** validated by `createRequestSchema` (`bloodGroup`, `component?`, `units_needed?`, `urgency?`, `hospital_id?`, `latitude?`, `longitude?` – must provide both lat/long or neither).
  - **Success (201):** `{ "success": true, "data": { request: {...}, emailAlerts: {enabled, matched, sent, failed} }, "error": null }`
  - **Error responses:** 400 `VALIDATION_ERROR`, 500 `REQUEST_CREATION_FAILED`

- **GET /** – List requests (default: only current user's; use `?all=1` to list all).
  - **Auth:** JWT (optional; if no token returns 401).
  - **Query params:** `status`, `blood_group`.
  - **Success (200):** `{ "success": true, "data": { requests: [...] }, "message": "Requests retrieved successfully" }`
  - **Error (500):** `REQUESTS_FETCH_FAILED`

- **GET /:id** – Get a single request.
  - **Auth:** JWT (optional).
  - **Success (200):** request object.
  - **Error responses:** 404 `REQUEST_NOT_FOUND`, 500

- **PATCH /:id/cancel** – Cancel a request (requester or staff).
  - **Auth:** JWT; user must be the requester or have role `bloodbank_staff`/`hospital_staff`.
  - **Success (200):** `{ "success": true, "data": { message: "Request cancelled successfully." }, "error": null }`
  - **Error responses:**
    - 403 `FORBIDDEN` – you do not have permission
    - 400 `CANT_CANCEL` – only open requests
    - 404, 500

- **PUT /:id** – Update a blood request (staff can modify fields).
  - **Auth:** JWT (staff role).
  - **Request body:** selective fields (`bloodGroup`, `unitsRequired`, `urgency`, `status`).
  - **Success (200):** updated request.
  - **Error:** 400, 404, 500

- **DELETE /:id** – Soft‑delete a request (user can cancel own).
  - **Auth:** JWT (user’s own requests).
  - **Success (200):** `{ "success": true, "data": null, "message": "Blood request deleted successfully" }`
  - **Error:** 404, 500

- **PATCH /:id/matches/:matchId/respond** – Donor responds to a match.
  - **Auth:** JWT.
  - **Request body:** `{ "response": "accept" | "decline" }`
  - **Success (200):** `{ "success": true, "data": { message: "Donor accepted the match." }, "error": null }`
  - **Error responses:**
    - 400 `INVALID_RESPONSE`
    - 401 `NOT_AUTHENTICATED`
    - 404 `MATCH_NOT_FOUND`
    - 500 `MATCH_RESPONSE_FAILED`

---

## Rewards

- **GET /** – Get user's rewards points balance.
  - **Auth:** JWT.
  - **Success (200):** `{ "success": true, "data": { rewards: { reward_id, points, tier } } }` (or `null` if no record).
  - **Error responses:** 401 `NOT_AUTHENTICATED`, 500 `REWARDS_FETCH_FAILED`

- **POST /:id/redeem** – Redeem points.
  - **Auth:** JWT.
  - **Request body:** `{ "points_to_redeem"? }` – if omitted, redeems all available.
  - **Success (200):** `{ "success": true, "data": { redemption: { reward_id, points, tier } }, "error": null }`
  - **Error responses:**
    - 400 `INSUFFICIENT_POINTS`
    - 401, 404 `REWARDS_NOT_FOUND`, 500 `REWARD_REDEEM_FAILED`

- **GET /redemptions** – Get redemption history.
  - **Auth:** JWT.
  - **Success (200):** `{ "success": true, "data": { redemptions: [...] } }`
  - **Error responses:** 401, 500 `REDEMPTIONS_FETCH_FAILED`

---

## Campaigns (NGO campaigns)

- **GET /** – List all campaigns.
  - **Auth:** None (public).
  - **Success (200):** `{ "success": true, "data": { campaigns: [...] } }`
  - **Error (500):** `CAMPAIGNS_FETCH_FAILED`

- **POST /** – Create a new campaign (admin or ngo).
  - **Auth:** JWT; user must have `userId`.
  - **Request body:** validated by `createCampaignSchema` (`title`, `description?`, `target_blood_group`, `target_units`, `target_date`).
  - **Success (201):** `{ "success": true, "data": { campaign: {...} }, "error": null }`
  - **Error responses:** 400, 401, 500 `CAMPAIGN_CREATE_FAILED`

- **POST /:id/join** – Join a campaign as a participant.
  - **Auth:** JWT; role must be `donor`.
  - **Success (200):** `{ "success": true, "data": { message: "Successfully joined the campaign." }, "error": null }`
  - **Error responses:**
    - 401, 404 `CAMPAIGN_NOT_FOUND`
    - 409 `ALREADY_PARTICIPATING`
    - 403 if user is not a donor

- **GET /stats** – Get campaign statistics (total campaigns, total participants).
  - **Auth:** None (public).
  - **Success (200):** `{ "success": true, "data": { stats: {...} } }`
  - **Error (500):** `CAMPAIGN_STATS_FAILED`

- **GET /:id** – Get a single campaign by ID (organizer/admin sees full details; others see limited).
  - **Auth:** None, but DRAFT events visible only to organizer/admin.
  - **Success (200):** campaign object.
  - **Error responses:** 400 `INVALID_EVENT_ID`, 404, 500

- **PATCH /:id** – Edit campaign details (title, dates, participant limit, etc.).
  - **Auth:** JWT; must be organizer or admin.
  - **Request body:** partial fields from `updateEventSchema`.
  - **Success (200):** updated campaign.
  - **Error responses:** 400, 403, 409 `EVENT_NOT_EDITABLE`, `CAPACITY_BELOW_REGISTRATIONS`, `INVALID_EVENT_DATES`, 500

- **DELETE /:id** – Delete campaign (only DRAFT).
  - **Auth:** JWT; organizer/admin.
  - **Success (200):** `{ "success": true, "data": null, "message": "Draft donation event deleted." }`
  - **Error responses:** 403, 409 `EVENT_NOT_DELETABLE`, 500

---

*Generated from the source code of the E‑Blood backend. All endpoints use the base URL `https://e-blood-j14l.onrender.com`. No secrets (passwords, JWT secrets, DB credentials) are included.*