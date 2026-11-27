const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/v1/auth/register',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', data);
  });
});

req.on('error', (e) => {
  console.error('Request error:', e);
});

// Provide both email and username as required by schema
const body = JSON.stringify({
  identifier: '9896543210',  // phone
  email: 'test5@example.com',
  username: 'testuser5',
  password: 'password123',
  bloodGroup: 'A+',
  role: 'patient'
});

req.write(body);
req.end();