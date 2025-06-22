// AuthService for backend (Express)
// Handles Fyers OAuth, token validation, and profile fetching
const crypto = require('crypto');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const SHA256 = require('crypto-js/sha256');

class AuthService {
  // Generate the Fyers OAuth URL
  static generateAuthUrl(appId, secret, redirectUri) {
    // Generate random state and nonce for security
    const state = AuthService.generateRandomString(16);
    const nonce = AuthService.generateRandomString(16);
    
    // Create URL parameters according to Fyers API documentation
    const params = new URLSearchParams({
      client_id: `${appId}`,
      redirect_uri: redirectUri,
      response_type: 'code',
      state: state,
      nonce: nonce
    });
    
    // Build the complete auth URL
    const authUrl = `https://api-t1.fyers.in/api/v3/generate-authcode?${params.toString()}`;
    console.log('Generated Auth URL:', authUrl);
    
    return authUrl;
  }

  // Validate the auth code and get tokens from Fyers
  static async validateAuthCode(authCode, appId, secret, redirectUri) {
    try {
      // Generate appIdHash as per Fyers API requirements
      const appIdHash = AuthService.generateAppIdHash(appId, secret, redirectUri);
      
      // Debug logs for troubleshooting
      console.log('DEBUG: appId:', appId);
      console.log('DEBUG: secret:', secret);
      console.log('DEBUG: redirectUri:', redirectUri);
      console.log('DEBUG: appIdHash:', appIdHash);
      console.log('DEBUG: authCode:', authCode);
      
      const requestBody = {
        grant_type: 'authorization_code',
        appIdHash,
        code: authCode
      };
      
      console.log('Request body:', JSON.stringify(requestBody));
      
      const response = await fetch('https://api-t1.fyers.in/api/v3/validate-authcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      
      const data = await response.json();
      console.log('Fyers API Response:', data);
      
      return data;
    } catch (error) {
      console.error('Error validating auth code:', error);
      throw error;
    }
  }

  // Fetch user profile from Fyers
  static async getProfile(accessToken) {
    try {
      // Extract appId from the token format (appId:token)
      const [appId, token] = accessToken.split(':');
      
      const response = await fetch('https://api-t1.fyers.in/api/v3/profile', {
        method: 'GET',
        headers: {
          'Authorization': `${appId}:${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching profile:', error);
      throw error;
    }
  }

  // Generate a random string (for state/nonce)
  static generateRandomString(length) {
    return crypto.randomBytes(length).toString('hex').slice(0, length);
  }

  // Generate appIdHash as SHA-256 of appId + ":" + appSecret (per Fyers documentation)
  static generateAppIdHash(appId, appSecret, redirectUri) {
    return SHA256(`${appId}:${appSecret}`).toString();
  }
}

module.exports = AuthService; 