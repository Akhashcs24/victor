const https = require('https');

const clientUrl = 'https://client-izlts6arf-akhashcs24s-projects.vercel.app';

console.log(`Testing client at: ${clientUrl}`);

// Fetch the client's main.js to check for environment variables
https.get(`${clientUrl}`, (res) => {
  console.log(`Client main page status code: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Client main page loaded successfully');
    
    // Check if the page contains references to the backend URL
    if (data.includes('victor-backend-10z2s7g5y-akhashcs24s-projects.vercel.app')) {
      console.log('✅ Backend URL found in client code');
    } else {
      console.log('❌ Backend URL not found in client code');
    }
    
    // Check for other key components
    if (data.includes('AuthPanel')) {
      console.log('✅ AuthPanel component found');
    } else {
      console.log('❌ AuthPanel component not found');
    }
  });
}).on('error', (err) => {
  console.error('Error fetching client:', err.message);
}); 