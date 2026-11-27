# eBlood — Complete Flutter App Build Prompt (for opencode / frontend developer)

> Hand this entire document to opencode (or any Flutter coding agent / developer).
> It is reverse-engineered from the live eBlood Node/Express + Oracle backend so the
> generated Flutter app matches the API **exactly** — endpoint paths, HTTP methods,
> request field names (camelCase vs snake_case), response shapes, auth, and enums.
> Do NOT invent endpoints or rename fields. This document is the source of truth.

---

## 1. Product summary

eBlood is a blood-donation platform with these user roles:
`patient`, `donor`, `bloodbank_staff`, `hospital_staff`, `ngo`, `admin`.

Core capabilities: register/login, donor profile + availability, search blood
availability near you, create/track blood requests, donor↔request matching,
donations + certificates, rewards/points, NGO campaigns, donation events,
blood-bank inventory & orders, inter-facility transports, notifications, and an
admin console (verify banks/hospitals, stats, change roles).

---

## 2. Backend connection facts (do not deviate)

- **Base URL (prod):** `https://e-blood-magw.onrender.com`
- **API prefix:** `/api/v1`  → full base = `https://e-blood-magw.onrender.com/api/v1`
- **Dev/LAN base:** `http://<your-laptop-ip>:3000/api/v1`
- **Content-Type:** `application/json` on every request. Never send form-encoded.
- **Auth:** JWT. Header `Authorization: Bearer <accessToken>` on protected routes.
- **Cold start:** Render free tier sleeps. First request can take ~50s. Use 60s
  timeouts and a friendly "Waking server…" state. `GET /api/v1/health` returns
  `{ success, status, database }` and is a good warm-up ping.
- **Seeded admin (for testing the admin console):**
  identifier `admin@eblood.local` · password `Admin@12345`.

### 2.1 Standard response envelope
Success:
```jsonc
{ "success": true, "data": <payload>, "message": "…", "error": null }
```
Error:
```jsonc
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "…" }, "data": null }
```
Handle these exceptions:
- Some list endpoints return `data` as a **bare array** (donors, blood-banks,
  notifications, events, transports).
- Some legacy routes return `{ success:false, message }` with **no `error` object**
  (`PUT /requests/:id`, `PUT /donations/:id`, donors, blood-banks, notifications).
- `message`, `error`, and `data` are all nullable. Always null-check.

---

## 3. Tech stack & versions

- Flutter 3.22+ / Dart 3.3+
- `dio` (HTTP), `flutter_secure_storage` (tokens), `provider` (state),
  `go_router` (navigation), `intl` (dates).
- Models: hand-written `fromJson/toJson` OR `freezed`+`json_serializable`
  (your choice) — **field names must match §6 exactly**.
- Suggested but optional: `google_maps_flutter` or `flutter_map` for location,
  `geolocator` for device coords, `image_picker` for event banners.

---

## 4. Architecture to generate

```
lib/
  main.dart
  app.dart                      # MaterialApp.router + theme + go_router
  core/
    constants.dart              # BASE_URL, enums + wire<->enum helpers
    api_client.dart             # Dio + interceptors (auth, refresh, error)
    secure_store.dart           # persist accessToken + refreshToken
    api_result.dart             # ApiResult<T> (ok/fail) + ApiError(code,message)
    error_mapper.dart           # error.code -> user-facing message
  models/                       # one file per resource (exact keys from §6)
    auth.dart user.dart blood_request.dart search_result.dart inventory.dart
    order.dart donation.dart reward.dart campaign.dart donor.dart
    blood_bank.dart notification.dart transport.dart event.dart admin_stats.dart
  repositories/                 # one per feature; wraps ApiClient, returns ApiResult
    auth_repository.dart profile_repository.dart search_repository.dart
    requests_repository.dart inventory_repository.dart orders_repository.dart
    donations_repository.dart rewards_repository.dart campaigns_repository.dart
    donors_repository.dart blood_banks_repository.dart notifications_repository.dart
    transports_repository.dart events_repository.dart admin_repository.dart
  features/
    auth/        login, register, forgot_password, reset_password
    dashboard/   role-aware home
    search/      availability list + map
    requests/    create, list, detail, matches(accept/decline)
    profile/     view, edit, location, donor availability
    donations/   history, certificate
    rewards/     points + redeem + history
    campaigns/   list, create, join, stats
    events/      list, detail, create, register, manage
    inventory/   staff: list, add, update, expiring
    orders/      staff: list, create, update status
    transports/  staff: list, create, assign, status, location, confirm
    donors/ blood_banks/
    notifications/
    admin/       verify banks/hospitals, stats, change role
  widgets/       PrimaryButton, AppTextField, BloodGroupSelector, LoadingView,
                 ErrorView, EmptyView, SectionCard, StatusChip
```

State: a global `AuthProvider` (tokens, current user, role) + per-feature
`ChangeNotifier`s. Routing: `go_router` with `redirect` that:
- sends unauthenticated users to `/login`,
- role-gates `/admin/*` (admin), `/inventory`,`/orders`,`/transports` (staff),
- keeps `/search`, `/requests`, `/profile`, `/donations`, `/rewards`,
  `/campaigns`, `/events`, `/notifications` for any logged-in user.

---

## 5. Auth & token lifecycle (implement exactly)

### 5.1 Persistence
- Store `accessToken` and `refreshToken` in `flutter_secure_storage`.
- On app start, read tokens; if present, try `GET /api/v1/me` to validate; on 401
  attempt refresh; if that fails, clear and go to `/login`.

### 5.2 Dio interceptors
- **onRequest:** if `accessToken` present and route not in
  `[register, login, refresh]`, set `Authorization: Bearer <accessToken>`.
- **onError (401, once):** call `POST /api/v1/auth/refresh` with stored
  `refreshToken`. On success persist new `accessToken`+`refreshToken`
  (rotation!) and retry the original request. On failure clear storage → `/login`.
- Timeouts: connect 60s, receive 60s.

### 5.3 Endpoints
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh` `{ "refreshToken": "…" }` → `data.accessToken`, `data.refreshToken` (note: `accessToken`, not `token`)
- `POST /api/v1/auth/logout` (auth) — revokes refresh tokens
- `POST /api/v1/auth/forgot-password` `{ "identifier": "email|phone" }` → always 200
- `POST /api/v1/auth/reset-password` `{ "identifier", "resetCode"(6 digits), "newPassword", "confirmPassword"? }`
- `POST /api/v1/auth/password` (auth) `{ "currentPassword", "newPassword" }`

> NOTE: forgot/reset are currently dev stubs — the code is printed in the **server
> console**, not emailed. Show a "check with admin / contact support" hint in the UI.

---

## 6. Data models (exact field names)

> `⇢` = JSON key to use in `fromJson`. Types are Dart. Nullable marked `?`.

### AuthUser (from register/login `data.user`)
`id:int`, `email:String?`, `username:String`, `firstName:String`, `lastName:String`,
`isActive:int`, `isEmailVerified:bool`, `createdAt:String`, `updatedAt:String`.
Login/Register also return `data.token:String` and `data.refreshToken:String`.

### MeProfile (`GET /api/v1/me` — **snake_case!**)
`user_id:int`, `username:String`, `email:String?`, `phone:String?`, `role:String`,
`is_active:int`, `is_available:int`, `blood_group:String?`,
`last_donated_at:String?`, `created_at:String`.

### BloodRequest (camelCase)
`requestId:int`, `userId:int`, `username:String?`, `phone:String?`,
`hospitalId:int?`, `bloodGroup:String`, `component:String`, `unitsNeeded:int`,
`urgency:String`, `status:String`, `createdAt:String`, `updatedAt:String?`.

### SearchResult (`POST /api/v1/search` → `data`)
`bloodBanks:List<Place>`, `hospitals:List<Place>`, `donors:List<DonorSearch>`.
- `Place`: `bankId?/hospitalId?:int`, `name:String`, `latitude:num`,
  `longitude:num`, `address:String?`, `phone:String?`, `email:String?`,
  `isVerified:int`, `distanceKm:num?`.
- `DonorSearch`: `userId:int`, `username:String`, `phone:String` (masked `"*****"`),
  `bloodGroup:String`, `latitude:num`, `longitude:num`, `role:String`, `distanceKm:num?`.

### InventoryItem (camelCase)
`inventoryId:int`, `bloodGroup:String`, `component:String`, `units:int`,
`expiryDate:String?`, `lastRested:String?`, `createdAt:String?`, `updatedAt:String?`,
`daysUntilExpiry:int?` (only in `/expiring`).

### Order (camelCase)
`orderId:int`, `userId:int`, `inventoryId:int`, `unitsOrdered:int`, `status:String`,
`discountApplied:num`, `paymentStatus:String`, `totalAmount:num`,
`createdAt:String`, `updatedAt:String`.

### Donation (camelCase)
`donationId:int`, `userId:int`, `username:String?`, `bankId:int`,
`collectedAt:String`, `components:String`, `units:int`, `updatedAt:String?`.

### Reward (camelCase)
`rewardId:int`, `userId:int`, `points:int`, `tier:String`, `updatedAt:String?`.
Redemption: `redemptionId:int`, `rewardId:int`, `pointsSpent:int`,
`redemptionType:String`, `redeemedAt:String`.

### Campaign (camelCase)
`campaignId:int`, `title:String`, `description:String?`,
`targetBloodGroup:String`, `targetUnits:int`, `targetDate:String`,
`createdBy:int`, `createdAt:String`, `participantsCount:int`.

### Donor (camelCase)
`userId:int`, `username:String`, `email:String?`, `phone:String?`, `role:String`,
`lastDonatedAt:String?`, `isActive:int`, `createdAt:String?`,
`bloodGroup:String?`, `isAvailable:int?`.

### BloodBank (camelCase)
`bankId:int`, `name:String`, `latitude:num`, `longitude:num`, `address:String?`,
`phone:String?`, `email:String?`, `isVerified:int`, `createdAt:String?`,
`updatedAt:String?`, `inventory:List<InventoryItem>?` (only on `/:id`).

### Notification (camelCase)
`notificationId:int`, `recipientId:int`, `type:String`, `title:String`,
`message:String`, `isRead:int`, `relatedId:int?`, `relatedType:String?`,
`createdAt:String`.

### Transport (camelCase)
`transportId:int`, `bloodRequestId:int?`, `requesterId:int`,
`sourceBankId:int`, `destinationHospitalId:int`, `assignedDriverId:int?`,
`vehicleIdentifier:String?`, `bloodGroup:String`, `component:String`,
`units:int`, `pickupAddress:String`, `destinationAddress:String`,
`currentLatitude:num?`, `currentLongitude:num?`, `locationUpdatedAt:String?`,
`estimatedArrival:String?`, `status:String`, `createdAt:String`, `updatedAt:String?`.

### Event (camelCase)
`eventId:int`, `title:String`, `description:String?`, `bannerUrl:String?`,
`organizerName:String`, `organizerContact:String?`, `location:String`,
`latitude:num?`, `longitude:num?`, `startsAt:String`, `endsAt:String`,
`registrationDeadline:String`, `maxParticipants:int?`, `status:String`,
`createdBy:int`, `createdAt:String`, `updatedAt:String?`,
`registrationsCount:int?`, `attendanceCount:int?`, `donationsCount:int?`.

### AdminStats (`GET /api/v1/admin/stats` → `data.stats`)
`totalPatients:int`, `totalDonors:int`, `totalBloodbankStaff:int`,
`totalHospitalStaff:int`, `totalNgo:int`, `totalAdmin:int`,
`totalBloodBanks:int`, `totalHospitals:int`, `availableUnits:int`.

---

## 7. Full endpoint catalog (exact)

Legend: `[auth]` Bearer required · `[facility]` bloodbank_staff scoped to own bank.

### 7.1 Profile `/api/v1/me`
- `GET /api/v1/me` `[auth]` → snake_case MeProfile.
- `PATCH /api/v1/me` `[auth]` body (optional): `{ username?, email?, phone?, blood_group? }` (`blood_group` donor-only).
- `PATCH /api/v1/me/location` `[auth]` `{ latitude, longitude }`.
- `PATCH /api/v1/me/donor-availability` `[auth]` `{ is_available: bool }` (donor-only).

### 7.2 Search `/api/v1/search` (public)
- `POST /api/v1/search`
  `{ bloodGroup(required enum), component?, units?=1, latitude?, longitude?, radiusKm?=50 }`

### 7.3 Requests `/api/v1/requests` `[auth]`
- `POST /api/v1/requests`
  `{ blood_group(req), component?='whole_blood', units_needed?=1, urgency?='normal', hospital_id?, latitude?, longitude? }`
  (lat/lng together or neither). → 201 `data:{ request, emailAlerts }`.
- `GET /api/v1/requests?status=&blood_group=&all=1` → `data:{ requests:[…] }`.
- `GET /api/v1/requests/:id` → `data:{ request }`.
- `PATCH /api/v1/requests/:id/cancel`.
- `PUT /api/v1/requests/:id` `{ bloodGroup?, unitsRequired?, urgency?, status? }`.
- `DELETE /api/v1/requests/:id` (own → soft cancel).
- `PATCH /api/v1/requests/:id/matches/:matchId/respond` `{ response:'accept'|'decline' }`.

### 7.4 Inventory `/api/v1/inventory` `[auth][facility]`
- `GET /api/v1/inventory` → `data:{ inventory:[…] }`.
- `POST /api/v1/inventory` `{ blood_group, component?, units?, expiry_date? }`.
- `PATCH /api/v1/inventory/:id` `{ units? }`.
- `GET /api/v1/inventory/expiring?days=7` → `data:{ expiring:[…] }`.

### 7.5 Orders `/api/v1/orders` `[auth][facility]`
- `POST /api/v1/orders` `{ inventory_id, units_ordered? }`.
- `GET /api/v1/orders` → `data:{ orders:[…] }` (own).
- `PATCH /api/v1/orders/:id/status` `{ status, payment_status? }`.

### 7.6 Donations `/api/v1/donations` `[auth][facility]`
- `GET /api/v1/donations/me` → `data:{ donations:[…] }` (your history).
- `POST /api/v1/donations` `{ bank_id, components?, units? }` (staff).
- `POST /api/v1/donations/:id/certificate` `{ retry? }` (admin/bloodbank_staff).
- `PUT /api/v1/donations/:id` `{ status }` (staff).
- `GET /api/v1/donations` (facility list).

### 7.7 Rewards `/api/v1/rewards` `[auth]`
- `GET /api/v1/rewards` → `data:{ rewards: Reward|null }`.
- `POST /api/v1/rewards/:id/redeem` `{ points_to_redeem? }`.
- `GET /api/v1/rewards/redemptions` → `data:{ redemptions:[…] }`.

### 7.8 Campaigns `/api/v1/campaigns` `[auth]`
- `GET /api/v1/campaigns` → `data:{ campaigns:[…] }`.
- `POST /api/v1/campaigns` `{ title, description?, target_blood_group, target_units, target_date(ISO) }`.
- `POST /api/v1/campaigns/:id/join` (donor).
- `GET /api/v1/campaigns/stats` → `data:{ stats:{ totalCampaigns, totalParticipants } }`.

### 7.9 Donors `/api/v1/donors` `[auth]`
- `GET /api/v1/donors?bloodGroup=&search=` → **bare array**.
- `GET /api/v1/donors/:id` → object.
- `POST /api/v1/donors` `{ email, username, password, phone, bloodGroup? }`.
- `PUT /api/v1/donors/:id` `{ username?, email?, phone? }`.
- `DELETE /api/v1/donors/:id` (soft).

### 7.10 Blood banks `/api/v1/blood-banks` `[auth]`
- `GET /api/v1/blood-banks?search=&city=` → **bare array**.
- `GET /api/v1/blood-banks/:id` → `{ …bank, inventory:[…] }`.
- `POST /api/v1/blood-banks` `{ name, latitude, longitude, address?, phone?, email? }`.
- `PUT /api/v1/blood-banks/:id` selective.
- `DELETE /api/v1/blood-banks/:id`.

### 7.11 Notifications `/api/v1/notifications` `[auth]`
- `GET /api/v1/notifications` → **bare array**.
- `POST /api/v1/notifications/:id/read`.
- `POST /api/v1/notifications/read-all`.
- `DELETE /api/v1/notifications/:id`.

### 7.12 Transports `/api/v1/transports` `[auth][facility]`
Statuses: `PENDING, APPROVED, ASSIGNED, PICKED_UP, IN_TRANSIT, ARRIVED, DELIVERED, COMPLETED, REJECTED, CANCELLED, DELAYED, FAILED`.
- `POST /api/v1/transports` `{ blood_request_id?, source_bank_id, destination_hospital_id, blood_group, component?='whole_blood', units, pickup_address, destination_address, pickup_latitude?, pickup_longitude?, destination_latitude?, destination_longitude?, estimated_arrival?(ISO offset) }`.
- `GET /api/v1/transports?status=` → **bare array** (role-filtered).
- `GET /api/v1/transports/:id`, `GET /api/v1/transports/:id/history`.
- `PATCH /api/v1/transports/:id/assign` `{ driver_user_id, vehicle_identifier }`.
- `PATCH /api/v1/transports/:id/status` `{ status, notes? }`.
- `PATCH /api/v1/transports/:id/location` `{ latitude, longitude, estimated_arrival?, notes? }`.
- `POST /api/v1/transports/:id/confirm-delivery` `{ confirmation }`.

### 7.13 Events `/api/v1/events` `[auth]`
Statuses: `DRAFT, PUBLISHED, REGISTRATION_OPEN, REGISTRATION_CLOSED, ONGOING, COMPLETED, CANCELLED, POSTPONED`. Attendance: `ATTENDED, NO_SHOW`.
- `GET /api/v1/events?status=` → **bare array**.
- `POST /api/v1/events` (admin/ngo/bloodbank_staff) `{ title, description?, banner_url?, organizer_name, organizer_contact?, location, latitude?, longitude?, starts_at(ISO offset), ends_at(ISO offset), registration_deadline(ISO offset), max_participants? }`.
- `GET /api/v1/events/:id`, `GET /api/v1/events/:id/statistics`, `GET /api/v1/events/:id/registrations`.
- `POST /api/v1/events/:id/register` (donor), `DELETE /api/v1/events/:id/register`.
- `PATCH /api/v1/events/:id/registrations/:registrationId/attendance` `{ attendance_status }`.
- `PATCH /api/v1/events/:id/registrations/:registrationId/donation` `{ donation_id }`.
- `PATCH /api/v1/events/:id/status` `{ status }`.
- `PATCH /api/v1/events/:id` (edit), `DELETE /api/v1/events/:id` (draft only).

### 7.14 Admin `/api/v1/admin` `[auth]` + role `admin` (else 403 `RBAC_DENIED`)
- `PATCH /api/v1/admin/blood-banks/:id/verify`.
- `PATCH /api/v1/admin/hospitals/:id/verify`.
- `GET /api/v1/admin/stats` → `data:{ stats: AdminStats }`.
- `PATCH /api/v1/admin/users/:id/role` `{ role }`.

### 7.15 Health (public)
- `GET /api/v1/health` → `{ success, status, database }`.

---

## 8. Enums (wire strings are exact)

```dart
enum BloodGroup { aPos, aNeg, bPos, bNeg, abPos, abNeg, oPos, oNeg }   // A+,A-,B+,B-,AB+,AB-,O+,O-
enum Role { patient, donor, bloodbankStaff, hospitalStaff, ngo, admin } // bloodbank_staff, hospital_staff
enum Component { wholeBlood, plasma, platelets, rbc }                   // whole_blood, ...
enum Urgency { normal, urgent, critical }
enum RequestStatus { open, fulfilled, cancelled }
enum OrderStatus { pending, confirmed, shipped, delivered, cancelled }
enum PaymentStatus { pending, paid, failed, refunded }
enum TransportStatus { pending, approved, assigned, pickedUp, inTransit, arrived, delivered, completed, rejected, cancelled, delayed, failed }
enum EventStatus { draft, published, registrationOpen, registrationClosed, ongoing, completed, cancelled, postponed }
```
Each enum needs `String get wire` and `static fromWire(String)`. Unknown wire →
fallback (e.g. `Role.patient`) so new backend values never crash the app.

---

## 9. Screen-by-screen spec

**Auth**
- Login: identifier (phone/email) + password. "Forgot password?" link.
- Register: role selector, (email OR phone), username (required with email),
  password + confirm, blood group (donor). On 409 → "account exists".
- Forgot: identifier → always "if it exists, a code was sent".
- Reset: identifier + 6-digit code + new password + confirm.

**Dashboard (role-aware)**
- Patient: quick "Request blood", "Search", active requests, notifications.
- Donor: search, availability toggle, my donations, rewards, events, campaigns.
- bloodbank_staff: inventory summary + expiring, orders, record donation, transports.
- hospital_staff: requests, transports, orders.
- ngo: campaigns, events.
- admin: stats cards, verify banks/hospitals, change user roles.

**Search**: blood group + component + radius; list/map of banks, hospitals, donors
(show distance; donor phone masked). Tap → detail.

**Requests**: create form (blood group, component, units, urgency, hospital,
optional location) → list (filter status) → detail with timeline; donor sees
matches with Accept/Decline.

**Profile**: view (snake_case), edit, set location (GPS), donor availability switch.

**Donations**: history list; staff "record donation"; issue/download certificate.

**Rewards**: points card + tier, redeem, history.

**Campaigns/Events**: list + detail; create (ngo/admin/staff); join/register;
manage (status transitions, registrations, attendance).

**Inventory/Orders/Transports (staff)**: list + create + status/location updates;
transports stepper (PENDING→…→DELIVERED) with "confirm delivery".

**Notifications**: list (unread bold), mark read, read-all, delete.

**Admin**: stats grid, verify buttons, role dropdown per user.

Every screen: LoadingView, ErrorView (message from `error.message`), EmptyView.

---

## 10. Error handling map

| code | UI |
|---|---|
| `VALIDATION_ERROR` | inline field messages / toast with `message` |
| `CONSTRAINT_VIOLATION` | "Already exists" |
| `AUTH_FAILED`, `INVALID_ACCESS_TOKEN`, `NOT_AUTHENTICATED` | force logout → login |
| `FORBIDDEN`, `RBAC_DENIED` | "You don't have permission" |
| `USER_NOT_FOUND`, `REQUEST_NOT_FOUND`, … | "Not found" |
| timeout / no network | "Server is waking up, please retry" |
| else | show `error.message` |

---

## 11. Sample ApiClient (Dio) skeleton

```dart
class ApiClient {
  ApiClient(this._store) {
    _dio = Dio(BaseOptions(
      baseUrl: '$BASE_URL/api/v1',
      connectTimeout: const Duration(seconds: 60),
      receiveTimeout: const Duration(seconds: 60),
      contentType: Headers.jsonContentType,
    ));
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (o, h, n) async {
        final t = await _store.accessToken;
        if (t != null && !_isPublic(o.path)) o.headers['Authorization'] = 'Bearer $t';
        n.next(o);
      },
      onError: (e, h, n) async {
        if (e.response?.statusCode == 401 && !e.requestOptions.extra['retried']) {
          e.requestOptions.extra['retried'] = true;
          final rt = await _store.refreshToken;
          if (rt != null) {
            try {
              final r = await Dio(BaseOptions(baseUrl: '$BASE_URL/api/v1'))
                  .post('/auth/refresh', data: {'refreshToken': rt});
              final a = r.data['data']['accessToken'] as String;
              final nr = r.data['data']['refreshToken'] as String;
              await _store.save(a, nr);
              e.requestOptions.headers['Authorization'] = 'Bearer $a';
              return h.resolve(await _dio.fetch(e.requestOptions));
            } catch (_) { await _store.clear(); }
          }
        }
        n.next(e);
      },
    ));
  }
  // get/post/patch/put/delete helpers returning ApiResult<T>…
}
```

---

## 12. Acceptance checklist

- [ ] Login/register persist tokens (secure storage); cold-start "waking" UX.
- [ ] 401 → refresh → retry once → logout on failure.
- [ ] Role-based navigation per §9.
- [ ] Create request (snake_case body) → appears in list; donor match accept/decline.
- [ ] Search returns banks/hospitals/donors with distance; donor phone masked.
- [ ] `/me` parses snake_case; edit + location + availability round-trip.
- [ ] Donations history + certificate (staff).
- [ ] Rewards points + redeem + history.
- [ ] Campaigns list/create/join/stats; Events list/create/register/manage.
- [ ] Staff: inventory add/update/expiring; orders; transports workflow + confirm.
- [ ] Notifications list (bare array) + read/read-all/delete.
- [ ] Admin (admin@eblood.local / Admin@12345): stats, verify, change role.
- [ ] All errors read `error.message` with fallbacks; no secrets in app.

Build feature-by-feature, compiling after each. Re-read §6/§7 for any field name —
they are the contract. Do not add endpoints not listed here.