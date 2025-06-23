const https = require('https');

const backendUrl = 'https://victor-backend-10z2s7g5y-akhashcs24s-projects.vercel.app';

console.log(`Testing connection to: ${backendUrl}`);

// Test the health endpoint
const healthRequest = https.get(`${backendUrl}/api/health`, (res) => {
  console.log(`Health endpoint status code: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Health endpoint response:', data);
  });
}).on('error', (err) => {
  console.error('Health endpoint error:', err.message);
});

// Test the auth endpoint
const authRequest = https.get(`${backendUrl}/api/auth/generate-auth-url`, (res) => {
  console.log(`Auth endpoint status code: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Auth endpoint response:', data);
  });
}).on('error', (err) => {
  console.error('Auth endpoint error:', err.message);
}); 