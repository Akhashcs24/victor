const fs = require('fs');
const readline = require('readline');

// Create a readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('=== Access Token Extractor ===');
console.log('This script will save your access token to localStorage.json for testing');
console.log('\nPlease follow these steps:');
console.log('1. Open your browser and navigate to the Victor 3.0 app');
console.log('2. Login to the app if not already logged in');
console.log('3. Open browser developer tools (F12 or right-click > Inspect)');
console.log('4. Go to the "Application" tab');
console.log('5. Under "Storage" > "Local Storage", click on your app URL');
console.log('6. Find the "access_token" entry');
console.log('7. Copy the entire value (without quotes)');
console.log('\nPaste the access token below:');

rl.question('> ', (accessToken) => {
  if (!accessToken || accessToken.trim().length === 0) {
    console.log('❌ No token provided. Exiting.');
    rl.close();
    return;
  }
  
  // Save to file
  const data = {
    access_token: accessToken.trim(),
    extracted_at: new Date().toISOString()
  };
  
  fs.writeFileSync('localStorage.json', JSON.stringify(data, null, 2));
  console.log('✅ Access token saved to localStorage.json');
  
  rl.close();
}); 