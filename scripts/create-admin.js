// Create (or promote) an admin user in the eBlood database.
// Idempotent: safe to run repeatedly. Uses the same users/seq_users/bcrypt
// conventions as the /auth/register route.
//
// Env (all optional, sensible defaults shown):
//   ADMIN_USERNAME=admin
//   ADMIN_EMAIL=admin@eblood.local
//   ADMIN_PHONE=            (leave blank to skip phone)
//   ADMIN_PASSWORD=Admin@12345
//
// Usage:  npm run db:admin
//     or: ADMIN_PASSWORD=... node scripts/create-admin.js

require("dotenv/config");
const oracledb = require("oracledb");
const bcrypt = require("bcrypt");

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

const USERNAME = process.env.ADMIN_USERNAME || "admin";
const EMAIL = process.env.ADMIN_EMAIL || "admin@eblood.local";
const PHONE = process.env.ADMIN_PHONE && process.env.ADMIN_PHONE.trim() !== "" ? process.env.ADMIN_PHONE.trim() : null;
const PASSWORD = process.env.ADMIN_PASSWORD || "Admin@12345";

async function main() {
  const required = ["DB_USER", "DB_PASSWORD", "DB_CONNECT_STRING"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  const conn = await oracledb.getConnection({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectString: process.env.DB_CONNECT_STRING,
  });

  try {
    // Look for an existing account by username or email (or phone if provided).
    const existing = await conn.execute(
      `SELECT user_id, role FROM users
       WHERE username = :username OR email = :email` +
        (PHONE ? ` OR phone = :phone` : ``),
      PHONE
        ? { username: USERNAME, email: EMAIL, phone: PHONE }
        : { username: USERNAME, email: EMAIL }
    );

    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      const userId = row.USER_ID;
      if (row.ROLE !== "admin") {
        await conn.execute(
          `UPDATE users SET role = 'admin', is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = :id`,
          { id: userId }
        );
        await conn.commit();
        console.log(`Promoted existing user ${userId} (${USERNAME}) to admin.`);
      } else {
        console.log(`Admin already exists: user_id=${userId} username=${USERNAME}`);
      }
      console.log(`Login with: identifier=${EMAIL}  password=${PASSWORD}`);
      return;
    }

    const insert = await conn.execute(
      `INSERT INTO users (user_id, username, email, phone, password_hash, role, blood_group, is_active)
       VALUES (seq_users.NEXTVAL, :username, :email, :phone, :password_hash, 'admin', NULL, 1)
       RETURNING user_id INTO :user_id`,
      {
        username: USERNAME,
        email: EMAIL,
        phone: PHONE,
        password_hash: passwordHash,
        user_id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      }
    );
    await conn.commit();
    const userId = insert.outBinds.user_id[0];
    console.log(`Created admin: user_id=${userId} username=${USERNAME} email=${EMAIL}`);
    console.log(`Login with: identifier=${EMAIL}  password=${PASSWORD}`);
  } catch (err) {
    try { await conn.rollback(); } catch { /* ignore */ }
    throw err;
  } finally {
    await conn.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Failed to create admin:", err.message || err);
    process.exit(1);
  });