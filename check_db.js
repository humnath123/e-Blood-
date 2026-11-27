const oracledb = require('oracledb');
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

async function main() {
    const conn = await oracledb.getConnection({
        user: process.env.ORACLE_USER,
        password: process.env.ORACLE_PASSWORD,
        connectString: process.env.ORACLE_CONNECT_STRING
    });
    const r = await conn.execute("DESCRIBE users");
    console.log('Users columns:');
    r.rows.forEach(c => console.log('  ', c.COLUMN_NAME, '-', c.DATA_TYPE, c.NULLABLE, c.COLUMN_DEFAULT));
    await conn.close();
}
main().then(() => console.log('Done')).catch(e => console.error('Error:', e.message));