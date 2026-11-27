require('oracledb').getConnection({
  user: 'GODAVID914_SCHEMA_KR9JF',
  password: 'KBBF4T1J41KGZ7P73YTY$P2YK3e34I',
  connectString: 'tcps://db.freesql.com:2484/26ai_un3c1'
}).then(async conn => {
  // Read and execute the seed file
  const fs = require('fs');
  const seed = fs.readFileSync('db\\\\migrations\\\\002_seed.sql', 'utf8');
  const statements = seed.split(';');
  let ok = 0, skip = 0;
  for (const stmt of statements) {
    const s = stmt.trim();
    if (s.length > 0 && !s.startsWith('--')) {
      try {
        await conn.execute(s);
        ok++;
        // console.log('OK executed');
      } catch (e) {
        skip++;
        // console.log('SKIP:', e.message.substring(0, 50));
      }
    }
  }
  console.log(`Executed: ${ok}, Skipped: ${skip}`);
  await conn.close();
}).catch(e => console.error('Error:', e.message));