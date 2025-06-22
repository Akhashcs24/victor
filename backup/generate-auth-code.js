const fs = require('fs');
const readline = require('readline');
const crypto = require('crypto');

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('=== Fyers Auth URL Generator ===');
console.log('This script will generate a Fyers authorization URL');

// Function to get app credentials
function getCredentials() {
  return new Promise((resolve) => {
    // Check if we have stored credentials
    if (fs.existsSync('fyers-config.json')) {
      try {
        const config = JSON.parse(fs.readFileSync('fyers-config.json', 'utf8'));
        if (config.appId && config.secretKey && config.redirectUri) {
          rl.question('Use saved credentials? (y/n): ', (answer) => {
            if (answer.toLowerCase() === 'y') {
              resolve(config);
              return;
            }
            promptForCredentials(resolve);
          });
          return;
        }
      } catch (error) {
        console.log('Error reading saved credentials:', error.message);
      }
    }
    
    promptForCredentials(resolve);
  });
}

// Function to prompt for credentials
function promptForCredentials(resolve) {
  rl.question('Enter your Fyers App ID: ', (appId) => {
    rl.question('Enter your Fyers Secret Key: ', (secretKey) => {
      rl.question('Enter your Redirect URI: ', (redirectUri) => {
        const config = {
          appId: appId.trim(),
          secretKey: secretKey.trim(),
          redirectUri: redirectUri.trim()
        };
        
        // Save credentials for future use
        fs.writeFileSync('fyers-config.json', JSON.stringify(config, null, 2));
        console.log('Credentials saved to fyers-config.json');
        
        resolve(config);
      });
    });
  });
}

// Function to generate auth URL
function generateAuthUrl(config) {
  // Generate a random state
  const state = crypto.randomBytes(16).toString('hex');
  
  // Generate app hash (using the new colon format)
  const appIdHash = `${config.appId}:${config.secretKey}`;
  const sha256Hash = crypto.createHash('sha256').update(appIdHash).digest('hex');
  
  // Construct auth URL
  const baseUrl = "https://api-t1.fyers.in/api/v3/generate-authcode";
  const clientId = config.appId;
  const redirectUri = encodeURIComponent(config.redirectUri);
  const responseType = "code";
  const scope = encodeURIComponent("openid");
  const nonce = crypto.randomBytes(8).toString('hex');
  
  return {
    url: `${baseUrl}?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=${responseType}&state=${state}&scope=${scope}&nonce=${nonce}`,
    state: state,
    appIdHash: sha256Hash
  };
}

// Main function
async function main() {
  try {
    const credentials = await getCredentials();
    const authData = generateAuthUrl(credentials);
    
    console.log('\n=== Fyers Authorization URL ===');
    console.log(authData.url);
    
    console.log('\n=== App ID Hash (for token generation) ===');
    console.log(authData.appIdHash);
    
    console.log('\n=== State (for verification) ===');
    console.log(authData.state);
    
    console.log('\nInstructions:');
    console.log('1. Copy and paste the URL into your browser');
    console.log('2. Complete the authentication process');
    console.log('3. You will be redirected to your redirect URI with an auth code');
    console.log('4. Extract the "code" parameter from the URL');
    
    rl.question('\nDid you get the auth code? (y/n): ', (answer) => {
      if (answer.toLowerCase() === 'y') {
        rl.question('Enter the auth code: ', (code) => {
          // Save the auth code
          fs.writeFileSync('auth-code.json', JSON.stringify({
            auth_code: code.trim(),
            app_id_hash: authData.appIdHash,
            timestamp: new Date().toISOString()
          }, null, 2));
          
          console.log('\n✅ Auth code saved to auth-code.json');
          console.log('\nNext steps to get access token:');
          console.log('1. Run: node generate-token.js');
          
          rl.close();
        });
      } else {
        console.log('Please try again when you have the auth code.');
        rl.close();
      }
    });
  } catch (error) {
    console.error('Error:', error.message);
    rl.close();
  }
}

main(); 