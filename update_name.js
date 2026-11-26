const oracledb = require("oracledb");

async function main() {
  let connection;
  try {
    connection = await oracledb.getConnection({
      user: "EBLOOD_APP",
      password: "Eblood2026Secure",
      connectString: "localhost:1521/EBLOODPDB"
    });
    
    // Update user's first and last name
    await connection.execute(
      "UPDATE users SET first_name = :1, last_name = :2 WHERE user_id = :3",
      ["humnath", "pokharel", 1]
    );
    console.log("Updated user name to: humnath pokharel");
    
    // Verify the update
    const user = await connection.execute("SELECT username, first_name, last_name, email FROM users WHERE user_id = 1");
    console.log("User details:", user.rows[0]);
    
    // Check donation
    const donation = await connection.execute("SELECT donation_id, status FROM donations WHERE donation_id = 1");
    console.log("Donation status:", donation.rows[0][1]);
    
    await connection.commit();
    await connection.close();
  } catch (err) {
    console.error("Error:", err);
  }
}

main();