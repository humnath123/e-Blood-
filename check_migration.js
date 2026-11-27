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
    
    // Check current state of donations table - only select existing columns
    const donation = await connection.execute("SELECT donation_id, certificate_id FROM donations WHERE donation_id = 1");
    console.log("Donation record (ID=1):");
    donation.rows.forEach(r => {
      console.log("  donation_id:", r[0]);
      console.log("  certificate_id:", r[1]);
    });
    
    // Check what columns actually exist
    const allCols = await connection.execute("SELECT COLUMN_NAME FROM USER_TAB_COLS WHERE TABLE_NAME = 'DONATIONS'");
    console.log("\nAll columns in donations table:");
    allCols.rows.forEach(r => console.log("  -", r[1]));
    
    await connection.close();
  } catch (err) {
    console.error("Error:", err);
  }
}

main();