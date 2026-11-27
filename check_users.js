const oracledb = require('oracledb');
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

async function main() {
    const conn = await oracledb.getConnection({
        user: process.env.ORACLE_USER || 'GODAVID914_SCHEMA_KR9JF',
        password: process.env.ORACLE_PASSWORD || 'KBBF4T1J41KGZ7P73YTY$P2YK3e34I',
        connectString: process.env.ORACLE_CONNECT_STRING || 'tcps://db.freesql.com:2484/26ai_un3c1'
    });

    try {
        // Check count
        const countR = await conn.execute("SELECT COUNT(*) FROM users");
        console.log('User count:', countR.rows[0][0]);
        
        // Check if any rows
        const allR = await conn.execute("SELECT user_id, username FROM users");
        console.log('All users:', allR.rows);
    } catch (err) {
        console.error('Error:', err.message);
    }

    await conn.close();
}

main().catch(e => console.error('Fatal:', e.message));