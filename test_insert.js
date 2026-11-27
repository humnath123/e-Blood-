const oracledb = require('oracledb');
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

require('dotenv').config();

async function main() {
    const conn = await oracledb.getConnection({
        user: process.env.ORACLE_USER || 'GODAVID914_SCHEMA_KR9JF',
        password: process.env.ORACLE_PASSWORD || 'KBBF4T1J41KGZ7P73YTY$P2YK3e34I',
        connectString: process.env.ORACLE_CONNECT_STRING || 'tcps://db.freesql.com:2484/26ai_un3c1'
    });

    // Check user_id column info
    const r1 = await conn.execute("SELECT column_id, data_type, nullable FROM user_tab_columns WHERE table_name = 'USERS' AND column_name = 'USER_ID'");
    console.log('USER_ID column info:', r1.rows);

    // Try a simple insert without user_id
    try {
        const result = await conn.execute(
            `INSERT INTO users (username, email, phone, password_hash, role, blood_group) 
             VALUES ('test_user', 'test@test.com', '9123456789', 'hash', 'patient', 'A+')`,
            [], { autoCommit: true }
        );
        console.log('Insert succeeded, rows affected:', result.rowsAffected);
        
        // Try to select the user
        const r2 = await conn.execute("SELECT user_id, username FROM users WHERE username = 'test_user'");
        console.log('Selected user:', r2.rows);
        
        // Clean up
        await conn.execute("DELETE FROM users WHERE username = 'test_user'", {}, { autoCommit: true });
        console.log('Cleanup done');
    } catch (err) {
        console.error('Insert error:', err.message);
    }

    await conn.close();
}
main().catch(e => console.error('Error:', e.message));