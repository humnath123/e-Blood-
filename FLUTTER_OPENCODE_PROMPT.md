# eBlood — Flutter App Prompt for opencode

> Paste everything below into opencode (or your Flutter coding agent) as the build
> brief. It is generated from a full analysis of the eBlood Express/Oracle backend
> so the generated Flutter app matches the real API contract exactly.

---

## 0. Mission

Build a complete, production-ready **Flutter** mobile app for the **eBlood** blood
donation platform that talks to the existing REST backend with **zero guesswork on
endpoints, field names, or auth**. Use the exact contract in this document. Do not
invent endpoints. When a field name below is `camelCase` or `snake_case`, use it
**verbatim** — the backend is inconsistent on purpose and the app must match it.

- **Base URL:** `https://e-blood-magw.onrender.com`
- **API prefix:** `/api/v1`
- **Auth scheme:** JWT Bearer. Header: `Authorization: Bearer <accessToken>`.
- **Content type:** `application/json` for all requests (send JSON, never form-encoded).
- **Tech stack:** Flutter 3.x (Dart 3), `dio` for HTTP, `flutter_secure_storage` for
  tokens, `provider` (or `riverpod` if you prefer) for state, `go_router` for routing.
  Use `json_serializable`/`freezed` **or** hand-written `fromJson/toJson` — your call,
  but field names must match this doc.

> The backend is cool with the cold start: the FIRST request after Render sleeps can
> take ~50s (free tier). Use a Dio timeout of 60s and show a "Waking server…" state.

---

## 1. Response envelope (applies to almost every endpoint)

```jsonc
{
  "success": true,
  "data": { /* ...payload, shape varies... */ },
  "message": "Human readable message",   // present on many, not all
  "error": null
}
```

On failure:

```jsonc
{
  "success": false,
  "error": { "code": "VALIDATION_ERROR", "message": "readable text" },
  "data": null
}
```

**Rules for the app:**
- Treat `success == false` OR HTTP status >= 400 as an error. Prefer `error.message`
  for the toast; fall back to `message`; fall back to a generic string.
- Some legacy routes (donors, blood-banks, notifications, `PUT /requests/:id`,
  `PUT /donations/:id`) return a **non-standard** error shape `{ success:false, message }`
  with **no `error` object** and sometimes `data` is a **bare array**. Handle both.
- `data` is sometimes an object (`{ requests: [...] }`), sometimes a bare array
  (`[ ... ]`), sometimes `null`. Always null-check.

---

## 2. Auth & token lifecycle

### 2.1 Register — `POST /api/v1/auth/register` (public)
Body (only `password` + `role` are strictly required, but you must identify the user):

```jsonc
{
  "identifier": "98XXXXXXXX",        // phone OR email; optional if you send email+username or phone
  "email": "user@example.com",        // optional
  "username": "user",                 // required if no identifier and using email
  "phone": "98XXXXXXXX",              // optional; Nepali mobile, starts 97/98 + 8 digits
  "bloodGroup": "A+",                 // optional enum
  "password": "secret123",            // required, min 6
  "role": "donor"                     // required enum
}
```
- `role` ∈ `patient, donor, bloodbank_staff, hospital_staff, ngo, admin`
- `bloodGroup` ∈ `A+, A-, B+, B-, AB+, AB-, O+, O-`
- **Send `identifier` = the phone or email** to keep it simple. Empty strings are
  tolerated (treated as "not provided") but prefer omitting unused fields.
- **201** response:
```jsonc
{ "success": true, "data": {
    "token": "<access JWT>",
    "refreshToken": "<refresh JWT>",
    "user": { "id": 12, "email": "...", "username": "...", "firstName": "",
              "lastName": "", "isActive": 1, "isEmailVerified": true,
              "createdAt": "ISO", "updatedAt": "ISO" }
  }, "message": "Registration successful", "error": null }
```
- Errors: `400 VALIDATION_ERROR`, `409 CONSTRAINT_VIOLATION` (already exists).

### 2.2 Login — `POST /api/v1/auth/login` (public)
```jsonc
{ "identifier": "98XXXXXXXX or email", "password": "secret123" }
```
- `identifier` must be a Nepali phone (97/98) or a valid email.
- **200** same shape as register (`data.token`, `data.refreshToken`, `data.user`).
- Errors: `401 AUTH_FAILED`, `401 ACCOUNT_DISABLED`, `400 VALIDATION_ERROR`.

### 2.3 Refresh — `POST /api/v1/auth/refresh` (public, token in body)
```jsonc
{ "refreshToken": "<refresh JWT>" }
```
- **200** → `{ "success": true, "data": { "accessToken": "...", "refreshToken": "..." } }`
  (note: `accessToken`, NOT `token`, here).
- Errors: `401 MISSING_REFRESH_TOKEN`, `401 INVALID_REFRESH_TOKEN`,
  `401 REVOKED_REFRESH_TOKEN`.
- Refresh tokens **rotate**: every refresh invalidates the old one. Always store the
  new `refreshToken`.

### 2.4 Logout — `POST /api/v1/auth/logout` (auth)
No body. Revokes all refresh tokens. **200** `{ data: { message } }`.

### 2.5 Forgot / Reset password (public)
- `POST /api/v1/auth/forgot-password` `{ "identifier": "email or phone" }` → always 200.
- `POST /api/v1/auth/reset-password`
  `{ "identifier": "...", "resetCode": "6 digits", "newPassword": "...", "confirmPassword": "..." }`
  - `confirmPassword` optional but if present must match. `resetCode` must be 6 digits.

### 2.6 Change password (auth) — `POST /api/v1/auth/password`
`{ "currentPassword": "...", "newPassword": "..." }` (new min 6).

### 2.7 Token handling in the app
- Persist `accessToken` + `refreshToken` in `flutter_secure_storage`.
- Dio `onRequest`: attach `Authorization: Bearer <accessToken>` (skip for register/login/refresh).
- Dio `onError`: if `401` and not already retried, call `/auth/refresh`; on success
  store new tokens and retry the original request once; on failure clear storage and
  route to Login.
- Never log tokens or passwords.

---

## 3. Roles → app sections

| role | primary surfaces |
|---|---|
| `patient` | create blood requests, search, track requests, notifications |
| `donor` | search, respond to matches, my donations, rewards, events, campaigns, donor availability |
| `bloodbank_staff` | inventory, orders, donations (record/certificate), transports, events |
| `hospital_staff` | requests, transports, orders |
| `ngo` | campaigns, events |
| `admin` | admin verify/stats/role, everything |

Build a role-aware bottom nav / drawer. Hide surfaces a role can't use. The backend
enforces authorization anyway (403 `FORBIDDEN` / `RBAC_DENIED`), but the UX should
only show what's relevant.

---

## 4. Endpoint catalog (exact)

> `[auth]` = requires `Authorization: Bearer`. `[facility]` = bloodbank_staff scoped
> to their own bank (server sets `facilityId = 1` for bloodbank_staff).

### 4.1 Profile — `/api/v1/me`
- `GET /api/v1/me` `[auth]` → **snake_case** data:
  `{ user_id, username, email, phone, role, is_active, is_available, blood_group, last_donated_at, created_at }`
- `PATCH /api/v1/me` `[auth]` body (all optional): `{ username?, email?, phone?, blood_group? }`
  (`blood_group` only for `donor`, else 403). Returns same snake_case object.
- `PATCH /api/v1/me/location` `[auth]` `{ latitude, longitude }` (numbers).
- `PATCH /api/v1/me/donor-availability` `[auth]` `{ is_available: bool }` (donor only).

> IMPORTANT: `/me` responses are **snake_case**, unlike the rest of the API which is
> camelCase. Model them separately.

### 4.2 Search — `/api/v1/search` (public)
- `POST /api/v1/search`
```jsonc
{ "bloodGroup": "O+", "component": "whole_blood", "units": 1,
  "latitude": 27.7, "longitude": 85.3, "radiusKm": 50 }
```
  - `bloodGroup` required (enum). `component` ∈ `whole_blood, plasma, platelets, rbc`.
  - `units` default 1, `radiusKm` default 50.
  - **200** → `data: { bloodBanks:[…], hospitals:[…], donors:[…] }`.
  - donor `phone` is masked to `"*****"` (you cannot see donor phone until a match accept).
  - each result has `distanceKm` when lat/lng supplied.

### 4.3 Blood requests — `/api/v1/requests` `[auth]`
- `POST /api/v1/requests`
```jsonc
{ "blood_group": "A+", "component": "whole_blood", "units_needed": 2,
  "urgency": "urgent", "hospital_id": 3, "latitude": 27.7, "longitude": 85.3 }
```
  - `blood_group` required (enum). `component` default `whole_blood`.
    `units_needed` default 1. `urgency` ∈ `normal, urgent, critical` (default normal).
    `hospital_id` optional. lat/lng must be sent **together or not at all**.
  - **201** → `data: { request: {...}, emailAlerts: {enabled,matched,sent,failed} }`.
- `GET /api/v1/requests?status=open&blood_group=A+&all=1` `[auth]`
  (default = only your own; `all=1` lists everyone) → `data: { requests:[…] }`.
- `GET /api/v1/requests/:id` `[auth]` → `data: { request:{…} }`.
- `PATCH /api/v1/requests/:id/cancel` `[auth]` (requester or staff; must be `open`).
- `PUT /api/v1/requests/:id` `[auth]` body subset `{ bloodGroup?, unitsRequired?, urgency?, status? }`.
- `DELETE /api/v1/requests/:id` `[auth]` soft-cancels own request.
- `PATCH /api/v1/requests/:id/matches/:matchId/respond` `[auth]` `{ "response": "accept"|"decline" }`.

Request object fields (camelCase): `requestId, userId, username, phone, hospitalId,
bloodGroup, component, unitsNeeded, urgency, status, createdAt`.

### 4.4 Inventory — `/api/v1/inventory` `[auth][facility]`
- `GET /api/v1/inventory` → `data: { inventory:[…] }`.
- `POST /api/v1/inventory` `{ blood_group, component?, units?, expiry_date? }`
  (restocks if exists → 200, else 201).
- `PATCH /api/v1/inventory/:id` `{ units? }`.
- `GET /api/v1/inventory/expiring?days=7` → `data: { expiring:[…] }`.

### 4.5 Orders — `/api/v1/orders` `[auth][facility]`
- `POST /api/v1/orders` `{ inventory_id, units_ordered? }` → 201 `data:{ order }`.
- `GET /api/v1/orders` → `data:{ orders:[…] }` (own).
- `PATCH /api/v1/orders/:id/status` `{ status, payment_status? }`
  - `status` ∈ `pending, confirmed, shipped, delivered, cancelled`
  - `payment_status` ∈ `pending, paid, failed, refunded`

### 4.6 Donations — `/api/v1/donations` `[auth][facility]`
- `GET /api/v1/donations/me` → `data:{ donations:[…] }` (your donation history).
- `POST /api/v1/donations` `{ bank_id, components?, units? }` (staff records a donation).
- `POST /api/v1/donations/:id/certificate` `{ retry? }` (admin/bloodbank_staff; emails PDF).
- `PUT /api/v1/donations/:id` `{ status }` (staff).
- `GET /api/v1/donations` (facility list).

### 4.7 Rewards — `/api/v1/rewards` `[auth]`
- `GET /api/v1/rewards` → `data:{ rewards: { rewardId, userId, points, tier, updatedAt } | null }`.
- `POST /api/v1/rewards/:id/redeem` `{ points_to_redeem? }` (omit = redeem all).
- `GET /api/v1/rewards/redemptions` → `data:{ redemptions:[…] }`.

### 4.8 Campaigns (NGO) — `/api/v1/campaigns` `[auth]`
- `GET /api/v1/campaigns` → `data:{ campaigns:[…] }`.
- `POST /api/v1/campaigns` `{ title, description?, target_blood_group, target_units, target_date(ISO) }`.
- `POST /api/v1/campaigns/:id/join` (donor).
- `GET /api/v1/campaigns/stats` → `data:{ stats:{ totalCampaigns, totalParticipants } }`.

### 4.9 Donors — `/api/v1/donors` `[auth]`
- `GET /api/v1/donors?bloodGroup=O+&search=ram` → **bare array** `data:[…]`.
- `GET /api/v1/donors/:id` → `data:{…}`.
- `POST /api/v1/donors` `{ email, username, password, phone, bloodGroup? }`.
- `PUT /api/v1/donors/:id` `{ username?, email?, phone? }`.
- `DELETE /api/v1/donors/:id` (soft delete).

### 4.10 Blood banks — `/api/v1/blood-banks` `[auth]`
- `GET /api/v1/blood-banks?search=&city=` → **bare array** `data:[…]`.
- `GET /api/v1/blood-banks/:id` → `data:{ …bank, inventory:[…] }`.
- `POST /api/v1/blood-banks` `{ name, latitude, longitude, address?, phone?, email? }`.
- `PUT /api/v1/blood-banks/:id` selective update.
- `DELETE /api/v1/blood-banks/:id`.

### 4.11 Notifications — `/api/v1/notifications` `[auth]`
- `GET /api/v1/notifications` → **bare array** `data:[…]`
  (`notificationId, recipientId, type, title, message, isRead, relatedId, relatedType, createdAt`).
- `POST /api/v1/notifications/:id/read`.
- `POST /api/v1/notifications/read-all`.
- `DELETE /api/v1/notifications/:id`.

### 4.12 Transports — `/api/v1/transports` `[auth][facility]`
Statuses: `PENDING, APPROVED, ASSIGNED, PICKED_UP, IN_TRANSIT, ARRIVED, DELIVERED,
COMPLETED, REJECTED, CANCELLED, DELAYED, FAILED`.
- `POST /api/v1/transports`
```jsonc
{ "blood_request_id": 1, "source_bank_id": 1, "destination_hospital_id": 2,
  "blood_group": "A+", "component": "whole_blood", "units": 2,
  "pickup_address": "...", "destination_address": "...",
  "pickup_latitude": 27.7, "pickup_longitude": 85.3,
  "destination_latitude": 27.7, "destination_longitude": 85.3,
  "estimated_arrival": "2026-01-01T10:00:00+05:45" }
```
- `GET /api/v1/transports?status=IN_TRANSIT` (role-filtered).
- `GET /api/v1/transports/:id` , `GET /api/v1/transports/:id/history`.
- `PATCH /api/v1/transports/:id/assign` `{ driver_user_id, vehicle_identifier }`.
- `PATCH /api/v1/transports/:id/status` `{ status, notes? }`.
- `PATCH /api/v1/transports/:id/location` `{ latitude, longitude, estimated_arrival?, notes? }`.
- `POST /api/v1/transports/:id/confirm-delivery` `{ confirmation }`.

### 4.13 Events — `/api/v1/events` `[auth]`
Statuses: `DRAFT, PUBLISHED, REGISTRATION_OPEN, REGISTRATION_CLOSED, ONGOING, COMPLETED,
CANCELLED, POSTPONED`. Attendance: `ATTENDED, NO_SHOW`.
- `GET /api/v1/events?status=REGISTRATION_OPEN` → **bare array** `data:[…]`.
- `POST /api/v1/events` (admin/ngo/bloodbank_staff) `{ title, description?, banner_url?,
  organizer_name, organizer_contact?, location, latitude?, longitude?, starts_at, ends_at,
  registration_deadline, max_participants? }` (ISO datetimes with offset).
- `GET /api/v1/events/:id`, `GET /api/v1/events/:id/statistics`,
  `GET /api/v1/events/:id/registrations`.
- `POST /api/v1/events/:id/register` (donor), `DELETE /api/v1/events/:id/register`.
- `PATCH /api/v1/events/:id/registrations/:registrationId/attendance` `{ attendance_status }`.
- `PATCH /api/v1/events/:id/registrations/:registrationId/donation` `{ donation_id }`.
- `PATCH /api/v1/events/:id/status` `{ status }`.
- `PATCH /api/v1/events/:id` (edit), `DELETE /api/v1/events/:id` (draft only).

### 4.14 Admin — `/api/v1/admin` `[auth]` + role `admin` (else 403 `RBAC_DENIED`)
- `PATCH /api/v1/admin/blood-banks/:id/verify`.
- `PATCH /api/v1/admin/hospitals/:id/verify`.
- `GET /api/v1/admin/stats` → `data:{ stats:{ totalPatients, totalDonors,
  totalBloodbankStaff, totalHospitalStaff, totalNgo, totalAdmin, totalBloodBanks,
  totalHospitals, availableUnits } }`.
- `PATCH /api/v1/admin/users/:id/role` `{ role }` (enum above).

### 4.15 Health (public, for "server waking" UX)
- `GET /api/v1/health` → `{ success, status, database }`.

---

## 5. Enums (central constants file)

```dart
enum BloodGroup { aPos, aNeg, bPos, bNeg, abPos, abNeg, oPos, oNeg } // wire: A+, A-, ...
enum Role { patient, donor, bloodbankStaff, hospitalStaff, ngo, admin } // wire: bloodbank_staff, ...
enum Component { wholeBlood, plasma, platelets, rbc } // wire: whole_blood, ...
enum Urgency { normal, urgent, critical }
enum RequestStatus { open, fulfilled, cancelled }
enum OrderStatus { pending, confirmed, shipped, delivered, cancelled }
enum PaymentStatus { pending, paid, failed, refunded }
enum TransportStatus { pending, approved, assigned, pickedUp, inTransit, arrived, delivered, completed, rejected, cancelled, delayed, failed }
enum EventStatus { draft, published, registrationOpen, registrationClosed, ongoing, completed, cancelled, postponed }
```
Provide `wireValue` / `fromWire` helpers. The wire values are the exact strings above.

---

## 6. Project structure to generate

```
lib/
  main.dart
  app.dart                         # MaterialApp, router, theme
  core/
    constants.dart                 # BASE_URL, enums + wire helpers
    api_client.dart                # Dio + interceptors (auth, refresh, error)
    secure_store.dart              # token persistence
    result.dart                  # Result<T> / ApiError wrapper
    errors.dart                   # map error.code -> user message
  models/                          # one file per resource, exact field names
    auth_models.dart  user.dart  blood_request.dart  search_result.dart
    inventory.dart  order.dart  donation.dart  reward.dart  campaign.dart
    donor.dart  blood_bank.dart  notification.dart  transport.dart
    event.dart  admin_stats.dart
  repositories/                    # one per feature, wraps ApiClient
    auth_repository.dart  profile_repository.dart  search_repository.dart
    requests_repository.dart  inventory_repository.dart  orders_repository.dart
    donations_repository.dart  rewards_repository.dart  campaigns_repository.dart
    donors_repository.dart  blood_banks_repository.dart
    notifications_repository.dart  transports_repository.dart
    events_repository.dart  admin_repository.dart
  features/
    auth/        (login, register, forgot, reset, otp)
    home/        (role-aware dashboard)
    search/      (blood availability + map/list)
    requests/    (create, list, detail, matches)
    profile/     (view/edit, location, donor availability)
    donations/   (history, certificate)
    rewards/
    campaigns/
    events/
    inventory/   orders/   (staff)
    transports/  (staff)
    donors/  blood_banks/
    notifications/
    admin/
  widgets/       # shared: PrimaryButton, TextField, BloodGroupChip, LoadingView, ErrorView
```

State: one `AuthProvider` (tokens + current user + role) and per-feature providers.
Routing: `go_router` with a redirect that sends unauthenticated users to `/login`
and role-gates admin/staff routes.

---

## 7. Implementation requirements

1. **ApiClient** wraps Dio with `baseOptions` (`baseUrl = $BASE_URL/api/v1`,
   `connectTimeout/ receiveTimeout = 60s`, `Content-Type: application/json`).
2. **Auth interceptor** attaches the bearer token; **error interceptor** does the
   refresh-and-retry-once flow (§2.7) and surfaces `ApiError(code, message)`.
3. **Models**: every `fromJson` reads the exact keys in §4. For `/me` use the
   snake_case keys. For list endpoints that return a bare array, the repository
   returns `List<T>` directly; for `{ requests: [...] }` unwrap `.data['requests']`.
4. **Error mapping**: `VALIDATION_ERROR` → inline field errors if possible;
   `CONSTRAINT_VIOLATION` → "already exists"; `AUTH_FAILED`/`INVALID_ACCESS_TOKEN`
   → force logout; `FORBIDDEN`/`RBAC_DENIED` → "not allowed"; network/timeout →
   "Server is waking up, retry in a moment"; else show `error.message`.
5. **Forms** must send JSON with the exact keys (e.g. requests use `blood_group`,
   `units_needed` — snake_case; search uses `bloodGroup`, `radiusKm` — camelCase).
6. **Null safety**: `data`, `error`, `message`, and `user` fields are all nullable.
7. **No secrets** in the app. Tokens only in secure storage.
8. Provide a `.env`/config constant for `BASE_URL` so dev (LAN `http://<ip>:3000`)
   vs prod (`https://e-blood-magw.onrender.com`) is switchable.

---

## 8. Acceptance checklist

- [ ] Login + register persist tokens and survive app restart (secure storage).
- [ ] 401 auto-refresh + retry works; failed refresh logs out cleanly.
- [ ] Role-based navigation matches §3.
- [ ] Create blood request (snake_case body) returns 201 and shows in list.
- [ ] Search returns banks/hospitals/donors with distance.
- [ ] `/me` parses snake_case; profile edit round-trips.
- [ ] Donor availability toggle (donor only) works.
- [ ] Notifications list (bare array) + mark read + read-all work.
- [ ] Staff: inventory add/update + expiring; orders status; donation record + certificate.
- [ ] Transports status workflow + location + confirm-delivery.
- [ ] Events list/create/register + admin verify/stats/role.
- [ ] All error toasts read from `error.message` with sane fallbacks.

Build it feature-by-feature, compiling after each. Do not add endpoints not listed
here. When unsure of a field name, re-read §4 — it is the source of truth.
```