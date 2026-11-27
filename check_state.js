require('oracledb').getConnection({
  user: 'GODAVID914_SCHEMA_KR9JF',
  password: 'KBBF4T1J41KGZ7P73YTY$P2YK3e34I',
  connectString: 'tcps://db.freesql.com:2484/26ai_un3c1'
}).then(async conn => {
  const r = await conn.execute("SELECT table_name FROM user_tables ORDER BY table_name");
  console.log('Tables:', r.rows.map(r => r.TABLE_NAME).join(', '));
  const s = await conn.execute("SELECT sequence_name FROM user_sequences ORDER BY sequence_name");
  console.log('Sequences:', s.rows.map(r => r.SEQUENCE_NAME).join(', '));
  await conn.close();
}).catch(e => console.error('Error:', e.message));