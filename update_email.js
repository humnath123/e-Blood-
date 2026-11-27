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
    
    // Update the user's email
    await connection.execute(
      "UPDATE users SET email = :1 WHERE user_id = :2",
      ["godavid914@gmail.com", 1]
    );
    console.log("Updated user email to: godavid914@gmail.com");
    
    // Verify the update
    const user = await connection.execute("SELECT username, email FROM users WHERE user_id = 1");
    console.log("User:", user.rows[0]);
    
    await connection.commit();
    await connection.close();
  } catch (err) {
    console.error("Error:", err);
  }
}

main();