const oracledb = require('oracledb');
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

async function main() {
    const conn = await oracledb.getConnection({
        user: process.env.ORACLE_USER || 'GODAVID914_SCHEMA_KR9JF',
        password: process.env.ORACLE_PASSWORD || 'KBBF4T1J41KGZ7P73YTY$P2YK3e34I',
        connectString: process.env.ORACLE_CONNECT_STRING || 'tcps://db.freesql.com:2484/26ai_un3c1'
    });

    try {
        // Drop the existing USERS table
        await conn.execute("DROP TABLE users");
        console.log('Dropped users table');

        // Recreate with IDENTITY
        await conn.execute(`
            CREATE TABLE users (
                user_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                username VARCHAR2(50) NOT NULL UNIQUE,
                email VARCHAR2(100) NOT NULL UNIQUE,
                phone VARCHAR2(20) NOT NULL UNIQUE,
                password_hash VARCHAR2(255) NOT NULL,
                role VARCHAR2(20) NOT NULL CHECK (role IN ('patient', 'donor', 'bloodbank_staff', 'hospital_staff', 'ngo', 'admin')),
                is_active NUMBER(1) DEFAULT 1 CHECK (is_active IN (0, 1)),
                last_donated_at TIMESTAMP,
                latitude NUMBER(10, 6),
                longitude NUMBER(10, 6),
                blood_group VARCHAR2(5) CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
                is_available NUMBER(1) DEFAULT 0 NOT NULL CHECK (is_available IN (0, 1)),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Created users table with IDENTITY');

        // Also recreate the sequence if needed (for identity-independent operations)
        // Oracle automatically creates ISEQ$$_ sequences for identity columns
        
        // Verify
        const verify = await conn.execute("SELECT column_id, data_type, nullable FROM user_tab_columns WHERE table_name = 'USERS' AND column_name = 'USER_ID'");
        console.log('USER_ID column after recreate:', verify.rows[0]);
    } catch (err) {
        console.error('Error:', err.message);
    }

    await conn.close();
    console.log('Done');
}

main().catch(e => console.error('Fatal:', e.message));