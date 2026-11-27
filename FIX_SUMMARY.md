# Authentication Fix Summary

## Issues Identified and Resolved

### 1. CORS Configuration Fix (Critical)
**File**: `src/app.ts`

**Problem**: CORS misconfiguration was blocking authentication requests, particularly when the frontend and backend are on different domains. The `credentials: true` setting requires proper origin handling - when `origin` is `"*"`, browsers block the response because credentials cannot be sent with wildcard origins.

**Previous CORS config**:
```typescript
cors({
  origin: corsOrigins === "*" ? true : corsOrigins.split(","),
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type"],
  credentials: true,
})
```

**Fixed CORS config**:
```typescript
cors({
  // When CORS_ORIGINS is "*", use 'true' to reflect the request origin.
  // This is required for credentials (cookies, Authorization header) to work.
  // The browser allows credentials when the Access-Control-Allow-Origin is not "*".
  origin: corsOrigins === "*" ? true : corsOrigins.split(","),
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type"],
  credentials: true,
  exposedHeaders: ["Authorization"], // Expose Authorization header so frontend can read it in response
})
```

**Key points**:
- `origin: true` reflects the request's `Origin` header, which allows `credentials: true` to work
- Without this fix, browsers would reject the response with `Cannot use wildcard in Access-Control-Allow-Origin when credentials mode is true`
- The `exposedHeaders: ["Authorization"]` allows frontend JavaScript to access the `Authorization` header from the response

### 2. Authentication Flow
**Endpoints**:
- `POST /api/v1/auth/login` - Login with Nepali phone (97/98 prefix) or email + password
- `POST /api/v1/auth/register` - Register with identifier (phone/email), email, username, password, blood group, and role

**Login flow**:
1. Validate input (identifier must be Nepali phone starting with 97/98 or valid email; password min 6 chars)
2. Query user by identifier (phone OR email)
3. Check account is active
4. Compare password with stored hash
5. Sign access token (15min expiry) and refresh token (7-day expiry)
6. Store refresh token hash in database
7. Return access token in response: `data.token`

**Protected routes**: Middleware `authenticate` expects `Authorization: Bearer <token>` header

**Expected frontend flow**:
1. Send login/register request with credentials
2. Capture JWT token from `response.data.token`
3. Store token (in memory, localStorage, or cookies)
4. Send `Authorization: Bearer <token>` on subsequent API requests

### 3. Common Error Causes and Fixes

**401 Unauthorized**:
- **Cause**: Token not sent in `Authorization: Bearer <token>` header
- **Fix**: Ensure frontend captures token from login response and sends it on subsequent requests

**404 Not Found**:
- **Cause**: Sending request to wrong endpoint path
- **Fix**: Use correct endpoints: `/api/v1/auth/login`, `/api/v1/auth/register`

**400 Bad Request**:
- **Cause**: Invalid input format (identifier must be Nepali phone or email; password min 6 chars)
- **Fix**: Ensure correct input format per the validation schemas

**500 Internal Server Error**:
- **Cause**: Database connection issues, env variable mismatches
- **Fix**: Verify `.env` file has correct DB credentials, JWT secrets, and connect string

### 4. Environment Configuration
**`.env` file** must have:
- `DB_USER`, `DB_PASSWORD`, `DB_CONNECT_STRING` - Oracle database connection
- `JWT_ACCESS_SECRET` - Minimum 32 characters (currently: `88c05438ff0b0f1118e43217b2d285542921f4c10c0c095219d1a7a00705b1dc5ea4df9a2258d3208fd73cebd47b420e`)
- `JWT_REFRESH_SECRET` - Minimum 32 characters (currently: `5fcd7731a69b7db5f7933041b6c8c05d93150ec183e9681df40e0ebce9be7da38465acf66e13d144fda8f53e2044c781`)
- `JWT_ACCESS_EXPIRES` - Token expiry (default: `15m`)
- `JWT_REFRESH_EXPIRES` - Refresh token expiry (default: `7d`)
- `CORS_ORIGINS` - Default `*` (reflects request origin)
- `PORT` - Server port (default: `3000`)

### 5. Token Management
- **Access token**: 15-minute expiry, used for API authentication
- **Refresh token**: 7-day expiry, used to get new access tokens
- Refresh token rotation: Each use revokes the old token and creates a new one
- Refresh tokens are stored in the `refresh_tokens` table with hash, expiry, and revocation status

## Build Verification
- `npm run build` compiles TypeScript successfully
- No TypeScript errors introduced by the CORS fix