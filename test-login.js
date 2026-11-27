const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/v1/auth/login',
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

// Valid Nepali phone starting with 98, 9 digits after = 10 digits total
const body = JSON.stringify({
  identifier: '9876543210',  // 10 digits starting with 98
  password: 'password123'
});

req.write(body);
req.end();