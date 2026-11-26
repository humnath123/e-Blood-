const oracledb = require("oracledb");

async function main() {
  let connection;
  
  try {
    connection = await oracledb.getConnection({
      user: "EBLOOD_APP",
      password: "Eblood2026Secure",
      connectString: "localhost:1521/EBLOODPDB"
    });
    console.log("Connection obtained successfully");
    
    // Check if donations table has rows
    const result = await connection.execute("SELECT donation_id, status FROM donations");
    
    console.log("All donations:");
    console.log("-----------------------");
    console.log("Rows:", result.rows.length);
    result.rows.forEach(row => {
      console.log("donation_id:", row[0], "| status:", row[1]);
    });
    
    // Find completed donations
    const completed = result.rows.filter(r => r[1] === "COMPLETED");
    console.log("\nCompleted donations:");
    if (completed.length > 0) {
      completed.forEach(d => console.log("donation_id:", d[0]));
    } else {
      console.log("None found with status 'COMPLETED'");
    }
    
    // Check sequence for next ID
    const seqResult = await connection.execute("SELECT donation_id_seq FROM dual");
    console.log("\nSequence next ID:", seqResult.rows);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    if (connection) {
      try {
        await connection.close();
        console.log("Connection closed");
      } catch (err) {
        console.error("Error closing connection:", err);
      }
    }
  }
}

main();