// Standalone smoke test for the eBlood Express app wiring.
// Runs the REAL compiled app (dist/app.js) via supertest WITHOUT an Oracle DB.
// DB-dependent routes will 500 (no DB) — that still proves routing + validation + auth wiring.
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "smoke_test_access_secret_0123456789abcdef";
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "smoke_test_refresh_secret_0123456789abcdef";
process.env.JWT_ACCESS_EXPIRES = "15m";
process.env.JWT_REFRESH_EXPIRES = "7d";
process.env.CORS_ORIGINS = "*";
process.env.PORT = "3999";

const path = require("path");
const request = require("supertest");
const { app } = require(path.resolve("dist/app.js"));

let pass = 0, fail = 0;
const results = [];
function check(name, cond, detail) {
  if (cond) { pass++; results.push(`PASS  ${name}`); }
  else { fail++; results.push(`FAIL  ${name}  ${detail || ""}`); }
}

(async () => {
  // 1. Swagger UI — the user's reported bug
  const docsSlash = await request(app).get("/docs/").redirects(0);
  check("GET /docs/ not 404 (Cannot GET)", docsSlash.status === 200, `status=${docsSlash.status}`);
  check("GET /docs/ is HTML swagger", /swagger/i.test(docsSlash.headers["content-type"] || "") || /swagger/i.test(docsSlash.text || ""), `ct=${docsSlash.headers["content-type"]}`);

  const docs = await request(app).get("/docs").redirects(1);
  check("GET /docs resolves 200 (via /docs/ redirect)", docs.status === 200, `status=${docs.status}`);

  const apiDocs = await request(app).get("/api-docs/");
  check("GET /api-docs/ 200", apiDocs.status === 200, `status=${apiDocs.status}`);

  const json = await request(app).get("/api-docs.json");
  check("GET /api-docs.json 200 json", json.status === 200 && (json.headers["content-type"] || "").includes("json"), `status=${json.status}`);
  check("openapi has paths", json.body && json.body.openapi && json.body.paths, "no openapi/paths");

  // 2. Root + health (health hits DB -> 500 acceptable, but must NOT be 404)
  const root = await request(app).get("/");
  check("GET / 200", root.status === 200 && root.body.success === true, `status=${root.status}`);

  const health = await request(app).get("/api/v1/health");
  check("GET /api/v1/health reachable (not 404)", health.status !== 404, `status=${health.status}`);

  // 3. Register validation (runs before DB)
  const regEmpty = await request(app).post("/api/v1/auth/register").send({});
  check("register {} -> 400 VALIDATION_ERROR", regEmpty.status === 400 && regEmpty.body?.error?.code === "VALIDATION_ERROR", `status=${regEmpty.status} body=${JSON.stringify(regEmpty.body)}`);

  const regBlank = await request(app).post("/api/v1/auth/register").send({ email: "", username: "u", phone: "9812345678", password: "secret123", role: "donor", bloodGroup: "A+" });
  check("register blank-email + phone -> NOT 400 (validation passes)", regBlank.status !== 400, `status=${regBlank.status} body=${JSON.stringify(regBlank.body)}`);

  const regBadRole = await request(app).post("/api/v1/auth/register").send({ identifier: "test@example.com", password: "secret123", role: "wizard" });
  check("register bad role -> 400", regBadRole.status === 400, `status=${regBadRole.status}`);

  // form-encoded body sent as JSON (Swagger-style) must not 400 entity.parse
  const regForm = await request(app).post("/api/v1/auth/register").set("Content-Type", "application/json").send("identifier=test@example.com&password=secret123&role=donor&username=tester");
  check("register form-encoded-as-json not entity.parse 400", !(regForm.status === 400 && /entity|JSON|token/i.test(JSON.stringify(regForm.body))), `status=${regForm.status} body=${JSON.stringify(regForm.body)}`);

  // 4. Login validation
  const loginBad = await request(app).post("/api/v1/auth/login").send({ identifier: "notvalid", password: "secret123" });
  check("login bad identifier -> 400", loginBad.status === 400, `status=${loginBad.status}`);

  const loginOk = await request(app).post("/api/v1/auth/login").send({ identifier: "9812345678", password: "secret123" });
  check("login valid-format reaches DB (not 400/404)", loginOk.status !== 400 && loginOk.status !== 404, `status=${loginOk.status}`);

  // 5. Auth guard on protected route (no token -> 401 before DB)
  const reqNoAuth = await request(app).get("/api/v1/requests");
  check("GET /requests no token -> 401", reqNoAuth.status === 401 && reqNoAuth.body?.error?.code === "NOT_AUTHENTICATED", `status=${reqNoAuth.status}`);

  const meNoAuth = await request(app).get("/api/v1/me");
  check("GET /me no token -> 401", meNoAuth.status === 401, `status=${meNoAuth.status}`);

  // 6. Forgot password (no DB needed for missing identifier -> 400)
  const forgotMissing = await request(app).post("/api/v1/auth/forgot-password").send({});
  check("forgot-password missing id -> 400", forgotMissing.status === 400, `status=${forgotMissing.status}`);

  // 7. Unknown API route -> structured 404
  const notFound = await request(app).get("/api/v1/does-not-exist");
  check("unknown /api/v1 -> 404 NOT_FOUND", notFound.status === 404 && notFound.body?.error?.code === "NOT_FOUND", `status=${notFound.status}`);

  // 8. Method safety: GET on POST-only auth route should 404 (not crash)
  const getOnPost = await request(app).get("/api/v1/auth/register");
  check("GET /auth/register -> 404 (method guard)", getOnPost.status === 404, `status=${getOnPost.status}`);

  console.log("\n" + results.join("\n"));
  console.log(`\nTOTAL: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error("HARNESS ERROR:", e); process.exit(2); });