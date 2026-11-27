require('dotenv').config();
const oracledb = require('oracledb');

async function test() {
  let pool;
  try {
    pool = await oracledb.createPool({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
      poolMin: 0,
      poolMax: 4,
      poolIncrement: 1
    });
    const conn = await pool.getConnection();
    try {
      const result = await conn.execute('SELECT COUNT(*) AS cnt FROM users');
      console.log('Users count:', result.rows[0].CNT);
      // Try inserting a test user
      const insertResult = await conn.execute(
        `INSERT INTO users (username, email, phone, password_hash, role, blood_group)
         VALUES (:1, :2, :3, :4, :5, :6)`,
        ['testuser', 'test@test.com', '9896543210', 'hash123', 'patient', 'A+'],
        { autoCommit: true, outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      console.log('Insert result:', insertResult);
      // Rollback since we just want to test
      await conn.rollback();
      console.log('Test completed successfully');
    } catch (err) {
      console.error('Query error:', err);
    } finally {
      await conn.close();
    }
  } catch (err) {
    console.error('Pool error:', err);
  } finally {
    if (pool) {
      try {
        await pool.close(0);
      } catch (err) {
        console.error('Pool close error:', err);
      }
    }
  }
}

test();