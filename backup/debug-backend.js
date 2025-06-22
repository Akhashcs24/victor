const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// Configuration
const API_URL = 'http://localhost:5000';
const TEST_SYMBOL = 'NSE:NIFTY50-INDEX';
const APP_ID = 'MSEL25Z2K9-100'; // Using the provided app ID

// Function to check server health
async function checkServerHealth() {
  console.log('\n=== Checking Server Health ===');
  try {
    const response = await fetch(`${API_URL}/api/health`);
    const data = await response.json();
    
    console.log(`Health check response: ${JSON.stringify(data)}`);
    return response.ok;
  } catch (error) {
    console.error(`Error checking server health: ${error.message}`);
    return false;
  }
}

// Function to check server configuration
function checkServerConfiguration() {
  console.log('\n=== Checking Server Configuration ===');
  
  const serverFiles = [
    { path: path.join(__dirname, 'server', 'index.js'), name: 'Server Index' },
    { path: path.join(__dirname, 'server', 'liveMarketDataService.js'), name: 'Live Market Data Service' },
    { path: path.join(__dirname, 'server', 'authService.js'), name: 'Auth Service' }
  ];
  
  const issues = [];
  
  for (const file of serverFiles) {
    if (!fs.existsSync(file.path)) {
      console.log(`❌ ${file.name} file not found: ${file.path}`);
      issues.push(`${file.name} file not found`);
      continue;
    }
    
    console.log(`✅ Found ${file.name} file`);
    
    const content = fs.readFileSync(file.path, 'utf8');
    
    // Check for common issues
    if (file.name === 'Live Market Data Service') {
      if (!content.includes('https://api-t1.fyers.in/data-rest/v2/quotes')) {
        console.log(`❌ ${file.name} is using an incorrect API endpoint`);
        issues.push(`${file.name} is using an incorrect API endpoint`);
      } else {
        console.log(`✅ ${file.name} is using the correct API endpoint`);
      }
    }
    
    if (file.name === 'Auth Service') {
      if (!content.includes('api-t1.fyers.in')) {
        console.log(`⚠️ ${file.name} might be using an outdated API endpoint`);
        issues.push(`${file.name} might be using an outdated API endpoint`);
      }
    }
  }
  
  return issues.length === 0;
}

// Function to test the backend API
async function testBackendApi(accessToken) {
  console.log('\n=== Testing Backend API ===');
  try {
    console.log(`Fetching data for ${TEST_SYMBOL} from backend API...`);
    
    const response = await fetch(`${API_URL}/api/market-data/quotes?symbols=${TEST_SYMBOL}`, {
      headers: {
        'Authorization': accessToken
      }
    });
    
    console.log(`Response status: ${response.status}`);
    
    const data = await response.json();
    console.log(`Response data: ${JSON.stringify(data, null, 2)}`);
    
    if (data.success && data.data && data.data.length > 0) {
      console.log('\n✅ Backend API test successful!');
      return true;
    } else {
      console.log('\n❌ Backend API test failed!');
      return false;
    }
  } catch (error) {
    console.error(`Error testing backend API: ${error.message}`);
    return false;
  }
}

// Function to check for common issues
function checkForCommonIssues() {
  console.log('\n=== Checking for Common Issues ===');
  
  const issues = [];
  
  // Check if the server is running
  try {
    const serverProcesses = require('child_process').execSync('tasklist | findstr node.exe', { encoding: 'utf8' });
    console.log('Node.js processes running:');
    console.log(serverProcesses);
  } catch (error) {
    console.log('❌ No Node.js processes found running');
    issues.push('Server might not be running');
  }
  
  // Check for network connectivity
  try {
    require('child_process').execSync('ping api-t1.fyers.in -n 1', { encoding: 'utf8' });
    console.log('✅ Network connectivity to Fyers API is good');
  } catch (error) {
    console.log('❌ Cannot reach Fyers API - network connectivity issue');
    issues.push('Network connectivity issue');
  }
  
  return issues;
}

// Main function
async function main() {
  console.log('=== Backend API Debug Tool ===');
  console.log(`App ID: ${APP_ID}`);
  console.log(`Test Symbol: ${TEST_SYMBOL}`);
  
  // Get access token from command line argument
  const accessToken = process.argv[2];
  
  if (!accessToken) {
    console.error('\n❌ No access token provided!');
    console.log('Usage: node debug-backend.js YOUR_ACCESS_TOKEN');
    return;
  }
  
  console.log(`Using access token: ${accessToken.substring(0, 10)}...`);
  
  // Check server health
  const serverHealthy = await checkServerHealth();
  
  // Check server configuration
  const configOk = checkServerConfiguration();
  
  // Test backend API
  const backendApiSuccess = await testBackendApi(accessToken);
  
  // Check for common issues
  const commonIssues = checkForCommonIssues();
  
  // Summary
  console.log('\n=== Debug Summary ===');
  console.log(`Server Health: ${serverHealthy ? '✅ Good' : '❌ Bad'}`);
  console.log(`Server Configuration: ${configOk ? '✅ Good' : '❌ Issues Found'}`);
  console.log(`Backend API: ${backendApiSuccess ? '✅ Working' : '❌ Not Working'}`);
  
  if (!serverHealthy) {
    console.log('\n❌ The server is not healthy or not running.');
    console.log('Please start the server using: node server/index.js');
  } else if (!backendApiSuccess) {
    console.log('\n❌ The backend API is not working correctly.');
    console.log('Possible issues:');
    console.log('1. The access token is invalid or expired');
    console.log('2. The server is not correctly passing the token to Fyers');
    console.log('3. There is an issue with the response parsing in the backend');
    
    console.log('\nRecommended fixes:');
    console.log('1. Check the server logs for specific error messages');
    console.log('2. Restart the server: node restart-servers.bat');
    console.log('3. Generate a fresh access token');
  } else {
    console.log('\n✅ The backend API is working correctly!');
  }
}

main().catch(error => {
  console.error(`Unhandled error: ${error.message}`);
}); 