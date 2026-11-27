require('dotenv').config();
const oracledb = require('oracledb');

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

async function initDb() {
  const required = ['DB_USER', 'DB_PASSWORD', 'DB_CONNECT_STRING'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
  await oracledb.createPool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectString: process.env.DB_CONNECT_STRING,
    poolMin: 0,
    poolMax: 4,
    poolIncrement: 1
  });
  await query('SELECT 1 FROM dual');
}

async function query(sql, binds = {}, options = {}) {
  let connection;
  try {
    connection = await oracledb.getConnection();
    return await connection.execute(sql, binds, { autoCommit: true, ...options });
  } finally {
    if (connection) await connection.close();
  }
}

module.exports = { initDb, query };