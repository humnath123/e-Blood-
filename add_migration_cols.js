const oracledb = require("oracledb");

async function main() {
  let connection;
  try {
    connection = await oracledb.getConnection({
      user: "EBLOOD_APP",
      password: "Eblood2026Secure",
      connectString: "localhost:1521/EBLOODPDB"
    });
    
    // Check current donations table columns
    const cols = await connection.execute("SELECT COLUMN_NAME FROM USER_TAB_COLS WHERE TABLE_NAME = 'DONATIONS' ORDER BY COLUMN_ID");
    console.log("Current donations columns:");
    cols.rows.forEach(r => console.log("  -", r[1]));
    
    // Add missing columns from migration 007
    // Column 1: certificate_delivery_status VARCHAR2(20) DEFAULT 'pending' NOT NULL
    try {
      await connection.execute("ALTER TABLE donations ADD certificate_delivery_status VARCHAR2(20) DEFAULT 'pending' NOT NULL");
      console.log("\nAdded: certificate_delivery_status");
    } catch (err) {
      console.log("\nError adding certificate_delivery_status:", err.message);
    }
    
    // Column 2: certificate_delivery_attempted_at TIMESTAMP
    try {
      await connection.execute("ALTER TABLE donations ADD certificate_delivery_attempted_at TIMESTAMP");
      console.log("Added: certificate_delivery_attempted_at");
    } catch (err) {
      console.log("Error adding certificate_delivery_attempted_at:", err.message);
    }
    
    // Column 3: Constraint CK_DONATIONS_CERT_DELIVERY
    try {
      await connection.execute("ALTER TABLE donations ADD CONSTRAINT ck_donations_cert_delivery CHECK (certificate_delivery_status IN ('pending', 'sending', 'sent', 'failed'))");
      console.log("Added: ck_donations_cert_delivery constraint");
    } catch (err) {
      console.log("Error adding constraint:", err.message);
    }
    
    // Verify the changes
    const cols2 = await connection.execute("SELECT COLUMN_NAME FROM USER_TAB_COLS WHERE TABLE_NAME = 'DONATIONS' ORDER BY COLUMN_ID");
    console.log("\nNew donations columns:");
    cols2.rows.forEach(r => console.log("  -", r[1]));
    
    // Update the existing donation with the new column
    try {
      await connection.execute("UPDATE donations SET certificate_delivery_status = 'pending' WHERE donation_id = 1");
      console.log("\nUpdated donation ID=1 with certificate_delivery_status = pending");
    } catch (err) {
      console.log("Error updating donation:", err.message);
    }
    
    await connection.commit();
    await connection.close();
  } catch (err) {
    console.error("Error:", err);
  }
}

main();