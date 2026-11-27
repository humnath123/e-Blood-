const https = require('https');

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'e-blood-magw.onrender.com',
      port: 443,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body: data });
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function testHealth() {
  const result = await request('GET', '/api/v1/health');
  console.log('HEALTH:', result.statusCode, result.body.substring(0, 200));
}

async function testRegister() {
  const result = await request('POST', '/api/v1/auth/register', {
    identifier: '9896543210',
    email: 'test@ex.com',
    username: 'testuser',
    password: 'password123',
    bloodGroup: 'A+',
    role: 'patient'
  });
  console.log('REGISTER:', result.statusCode, result.body.substring(0, 200));
}

async function testLogin() {
  const result = await request('POST', '/api/v1/auth/login', {
    identifier: '9896543210',
    password: 'password123'
  });
  console.log('LOGIN:', result.statusCode, result.body.substring(0, 200));
}

async function testSearch() {
  const result = await request('POST', '/api/v1/search', {
    bloodGroup: 'A+',
    units: 1
  });
  console.log('SEARCH:', result.statusCode, result.body.substring(0, 200));
}

async function main() {
  try {
    await testHealth();
    await testRegister();
    await testLogin();
    await testSearch();
  } catch (e) {
    console.error('Error:', e.message);
  }
}

main();