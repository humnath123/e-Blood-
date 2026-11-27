require('dotenv').config();
const oracledb = require('oracledb');

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

async function testConnection() {
  let connection;
  try {
    connection = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING
    });
    console.log('Connected to Oracle FreeSQL!');
    
    // Test query
    const result = await connection.execute("SELECT 1 AS test FROM dual");
    console.log('Query result:', result.rows);
    
    // Check current user
    const userResult = await connection.execute("SELECT USER FROM dual");
    console.log('Current user:', userResult.rows);
    
    await connection.close();
  } catch (err) {
    console.error('Connection failed:', err.message);
  }
}

testConnection();