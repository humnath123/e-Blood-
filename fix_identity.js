const oracledb = require('oracledb');
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

async function main() {
    const conn = await oracledb.getConnection({
        user: process.env.ORACLE_USER || 'GODAVID914_SCHEMA_KR9JF',
        password: process.env.ORACLE_PASSWORD || 'KBBF4T1J41KGZ7P73YTY$P2YK3e34I',
        connectString: process.env.ORACLE_CONNECT_STRING || 'tcps://db.freesql.com:2484/26ai_un3c1'
    });

    try {
        // Try to alter the table to add IDENTITY property
        // First, let's check if there are any rows that would block this
        const countR = await conn.execute("SELECT COUNT(*) FROM users");
        console.log('Current user count:', countR.rows[0][0]);
        
        // Try altering - for Oracle 12c+ GENERATED ALWAYS AS IDENTITY
        // We need to disable referential constraints first potentially
        // Let's try the ALTER TABLE approach
        await conn.execute("ALTER TABLE users MODIFY (user_id GENERATED ALWAYS AS IDENTITY)");
        console.log('Successfully altered table to add IDENTITY property');
        
        // Verify
        const verify = await conn.execute("SELECT column_id, data_type, nullable FROM user_tab_columns WHERE table_name = 'USERS' AND column_name = 'USER_ID'");
        console.log('USER_ID after alter:', verify.rows[0]);
    } catch (err) {
        console.error('Error altering table:', err.message);
    }

    await conn.close();
}

main().catch(e => console.error('Fatal error:', e.message));