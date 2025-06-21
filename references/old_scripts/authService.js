const fyersModel = require('fyers-api-v3').fyersModel;

class AuthService {
  constructor() {
    this.fyersInstances = new Map(); // Store multiple fyers instances
    this.lastAuthentication = null; // Store last successful authentication
  }

  /**
   * Generate Fyers authentication URL
   * @param {string} appId - Fyers App ID
   * @param {string} redirectUri - Redirect URI
   * @returns {string} - Authentication URL
   */
  async generateAuthUrl(appId, redirectUri) {
    try {
      // Encode the redirect URI
      const encodedRedirectUri = encodeURIComponent(redirectUri);
      
      // Generate the proper Fyers API v3 auth URL
      const authUrl = `https://api-t1.fyers.in/api/v3/generate-authcode?client_id=${appId}&redirect_uri=${encodedRedirectUri}&response_type=code&state=sample_state&nonce=sample_nonce`;
      
      console.log('Generated auth URL for app:', appId);
      console.log('Auth URL:', authUrl);
      
      return authUrl;
    } catch (error) {
      console.error('Error generating auth URL:', error);
      throw new Error('Failed to generate authentication URL');
    }
  }

  /**
   * Validate auth code and get access token
   * @param {string} appId - Fyers App ID
   * @param {string} secretKey - Fyers Secret Key
   * @param {string} authCode - Authorization code from Fyers
   * @returns {Object} - Validation result with access token
   */
  async validateAuthCode(appId, secretKey, authCode) {
    try {
      const fyers = new fyersModel();
      fyers.setAppId(appId);
      fyers.setRedirectUrl("https://trade.fyers.in/api-login/redirect-uri/index.html");
      
      const response = await fyers.generate_access_token({
        client_id: appId,
        secret_key: secretKey,
        auth_code: authCode
      });

      console.log('Token validation response:', response);

      if (response && response.access_token) {
        // Store the fyers instance for this user
        fyers.setAccessToken(response.access_token);
        this.fyersInstances.set(appId, fyers);
        
        // Store the last successful authentication
        this.lastAuthentication = {
          appId: appId,
          accessToken: response.access_token,
          timestamp: new Date()
        };
        
        console.log(`🔐 Stored authentication for appId: ${appId.substring(0, 8)}...`);
        
        return {
          success: true,
          accessToken: response.access_token,
          message: 'Authentication successful'
        };
      } else {
        return {
          success: false,
          error: response?.message || 'Token validation failed'
        };
      }
    } catch (error) {
      console.error('Token validation error:', error);
      return {
        success: false,
        error: error.message || 'Authentication failed'
      };
    }
  }

  /**
   * Get the last successful authentication
   * @returns {Object|null} - Last authentication data or null
   */
  getLastAuthentication() {
    return this.lastAuthentication;
  }

  /**
   * Set authentication manually (for API calls that provide credentials)
   * @param {string} appId - Fyers App ID
   * @param {string} accessToken - Access token
   */
  setAuthentication(appId, accessToken) {
    this.lastAuthentication = {
      appId: appId,
      accessToken: accessToken,
      timestamp: new Date()
    };
    console.log(`🔐 Manually set authentication for appId: ${appId.substring(0, 8)}...`);
  }

  /**
   * Get user profile information
   * @param {string} appId - Fyers App ID
   * @param {string} accessToken - Access token
   * @returns {Object} - User profile data
   */
  async getUserProfile(appId, accessToken) {
    try {
      let fyers = this.fyersInstances.get(appId);
      
      if (!fyers) {
        fyers = new fyersModel();
        fyers.setAppId(appId);
        fyers.setAccessToken(accessToken);
        this.fyersInstances.set(appId, fyers);
      }

      const response = await fyers.get_profile();
      console.log('Profile response:', response);

      return response;
    } catch (error) {
      console.error('Profile fetch error:', error);
      throw new Error('Failed to fetch user profile');
    }
  }

  /**
   * Get Fyers instance for a user
   * @param {string} appId - Fyers App ID
   * @param {string} accessToken - Access token
   * @returns {Object} - Fyers instance
   */
  getFyersInstance(appId, accessToken) {
    if (!appId || !accessToken) {
      throw new Error('AppId and AccessToken are required for Fyers API');
    }
    
    let fyers = this.fyersInstances.get(appId);
    
    if (!fyers) {
      console.log(`🔑 Creating new Fyers instance for appId: ${appId.substring(0, 8)}...`);
      fyers = new fyersModel();
      
      // Ensure proper initialization order
      fyers.setAppId(appId);
      fyers.setAccessToken(accessToken);
      
      this.fyersInstances.set(appId, fyers);
      console.log(`✅ Fyers instance created and configured for appId: ${appId.substring(0, 8)}...`);
    } else {
      // Ensure the existing instance has the latest token
      fyers.setAccessToken(accessToken);
    }
    
    return fyers;
  }

  /**
   * Verify if access token is valid
   * @param {string} appId - Fyers App ID
   * @param {string} accessToken - Access token
   * @returns {boolean} - Token validity
   */
  async verifyToken(appId, accessToken) {
    try {
      const fyers = this.getFyersInstance(appId, accessToken);
      const response = await fyers.get_profile();
      return response && response.s === 'ok';
    } catch (error) {
      console.error('Token verification error:', error);
      return false;
    }
  }
}

module.exports = new AuthService(); 