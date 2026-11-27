require('dotenv').config();
const oracledb = require('oracledb');

async function test() {
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING
    });
    
    // Try all_tables
    try {
      const result = await conn.execute("SELECT owner, table_name FROM all_tables WHERE table_name = 'USERS'", [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
      console.log('Users tables (all_tables):', JSON.stringify(result.rows));
    } catch (err) {
      console.error('all_tables error:', err.message);
    }
    
    // Try user_tables with current user
    try {
      const result = await conn.execute("SELECT table_name FROM user_tables", [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
      console.log('Tables (user_tables):', JSON.stringify(result.rows));
    } catch (err) {
      console.error('user_tables error:', err.message);
    }
    
  } catch (err) {
    console.error('Connection error:', err);
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch (err) {
        console.error('Close error:', err);
      }
    }
  }
}

test();