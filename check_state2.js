require('oracledb').getConnection({
  user: 'GODAVID914_SCHEMA_KR9JF',
  password: 'KBBF4T1J41KGZ7P73YTY$P2YK3e34I',
  connectString: 'tcps://db.freesql.com:2484/26ai_un3c1'
}).then(async conn => {
  // Get tables
  let r;
  try {
    r = await conn.execute("SELECT table_name, num_rows FROM user_tables ORDER BY table_name");
    console.log('Tables count:', r.rows.length);
    console.log('First 5 tables:', r.rows.slice(0, 5).map(r => r.TABLE_NAME).join(', '));
  } catch(e) { console.error('Tables error:', e.message); }
  
  // Get sequences
  try {
    r = await conn.execute("SELECT sequence_name FROM user_sequences ORDER BY sequence_name");
    console.log('Sequences count:', r.rows.length);
    console.log('First 5 sequences:', r.rows.slice(0, 5).map(r => r.SEQUENCE_NAME).join(', '));
  } catch(e) { console.error('Sequences error:', e.message); }
  
  // Try to describe a table
  try {
    r = await conn.execute("DESCRIBE users");
    console.log('Users table columns available');
  } catch(e) { console.error('Users describe error:', e.message); }
  
  await conn.close();
}).catch(e => console.error('Error:', e.message));