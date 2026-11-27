require('dotenv').config();
const oracledb = require('oracledb');

async function main() {
  let connection;
  try {
    connection = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING
    });
    
    // Insert donation without RETURNING first to see if it works
    // Using named binds properly
    const result = await connection.execute(
      "INSERT INTO donations (user_id, bank_id, collected_at, components, units) VALUES (:userId, :bankId, CURRENT_TIMESTAMP, :components, :units)",
      [1, 1, "whole_blood", 1],
      { autoCommit: true }
    );
    console.log("Insert executed, rows affected:", result.rowsAffected);
    
    // Then select the last inserted
    const donations = await connection.execute("SELECT donation_id FROM donations ORDER BY donation_id DESC");
    console.log("Donations inserted:", donations.rows.length);
    donations.rows.forEach(r => console.log("  - donation_id:", r[0]));
    
    // Show all donations
    const all = await connection.execute("SELECT donation_id FROM donations");
    console.log("\nAll donations in table:", all.rows.length);
    all.rows.forEach(r => console.log("  - donation_id:", r[0]));
    
  } catch (err) {
    console.error("Error:", err);
  } finally {
    if (connection) { await connection.close(); }
  }
}

main();