import { AuthConfig, AuthToken, UserProfile } from '../types';

export class AuthService {
  private static accessToken: string | null = null;
  private static refreshToken: string | null = null;
  private static tokenExpiry: number | null = null;
  private static appId: string | null = null;

  // Initialize tokens from localStorage on class load
  static {
    this.loadFromStorage();
  }

  private static loadFromStorage() {
    try {
      const stored = localStorage.getItem('victor_auth');
      if (stored) {
        const auth = JSON.parse(stored);
        this.accessToken = auth.accessToken;
        this.refreshToken = auth.refreshToken;
        this.tokenExpiry = auth.tokenExpiry;
        this.appId = auth.appId;
        
        // Check if token is expired
        if (this.tokenExpiry && Date.now() > this.tokenExpiry) {
          console.log('🔄 Token expired, clearing storage');
          this.logout();
        } else {
          console.log('✅ Tokens loaded from storage');
        }
      }
    } catch (error) {
      console.error('❌ Error loading from storage:', error);
      this.logout();
    }
  }

  private static saveToStorage() {
    try {
      const auth = {
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
        tokenExpiry: this.tokenExpiry,
        appId: this.appId
      };
      localStorage.setItem('victor_auth', JSON.stringify(auth));
      console.log('💾 Tokens saved to storage');
    } catch (error) {
      console.error('❌ Error saving to storage:', error);
    }
  }

  static generateAuthUrl(config: AuthConfig): string {
    console.log('🔗 Generating auth URL...');
    console.log('🆔 App ID:', config.appId);
    console.log('🔗 Redirect URI:', config.redirectUri);
    
    const state = this.generateRandomString(32);
    const nonce = this.generateRandomString(32);
    
    console.log('🎲 Generated state:', state);
    console.log('🎲 Generated nonce:', nonce);
    
    const params = new URLSearchParams({
      client_id: config.appId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      state: state,
      nonce: nonce,
      grant_type: 'authorization_code'
    });

    const authUrl = `https://api-t1.fyers.in/api/v3/generate-authcode?${params.toString()}`;
    console.log('🔗 Generated auth URL:', authUrl);
    
    return authUrl;
  }

  static async validateAuthCode(
    authCode: string,
    config: AuthConfig
  ): Promise<{ success: boolean; message: string; token?: AuthToken }> {
    try {
      console.log('🔐 Starting auth code validation...');
      console.log('📝 Auth code:', authCode.substring(0, 20) + '...');
      console.log('🆔 App ID:', config.appId);
      
      // Generate appIdHash as SHA-256 of api_id + app_secret
      const appIdHash = await this.generateAppIdHash(config.appId, config.secret);
      console.log('🔑 Generated appIdHash:', appIdHash.substring(0, 20) + '...');
      
      const requestBody = {
        grant_type: 'authorization_code',
        appIdHash: appIdHash,
        code: authCode,
        state: 'sample_state'
      };
      
      console.log('📤 Request body:', JSON.stringify(requestBody, null, 2));
      console.log('�� Making request to: /api/fyers/api/v3/validate-authcode');
      
      const response = await fetch('/api/fyers/api/v3/validate-authcode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      console.log('📥 Response status:', response.status);
      console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));

      const data = await response.json();
      console.log('📥 Response data:', JSON.stringify(data, null, 2));

      if (data.s === 'ok' && data.access_token) {
        console.log('✅ Authentication successful!');
        this.accessToken = data.access_token;
        this.refreshToken = data.refresh_token;
        this.tokenExpiry = Date.now() + (24 * 60 * 60 * 1000); // 24 hours default
        this.appId = config.appId;
        
        this.saveToStorage();
        
        return {
          success: true,
          message: 'Authentication successful',
          token: {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_in: 24 * 60 * 60, // 24 hours in seconds
            token_type: 'Bearer'
          }
        };
      } else {
        console.log('❌ Authentication failed:', data.message || 'Unknown error');
        return {
          success: false,
          message: data.message || 'Authentication failed'
        };
      }
    } catch (error) {
      console.error('💥 Authentication error:', error);
      return {
        success: false,
        message: `Authentication error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  static async getUserProfile(): Promise<{ success: boolean; message: string; profile?: UserProfile }> {
    if (!this.accessToken || !this.appId) {
      return {
        success: false,
        message: 'No access token available'
      };
    }

    try {
      console.log('👤 Fetching user profile...');
      console.log('🆔 App ID:', this.appId);
      console.log('🔑 Access Token:', this.accessToken.substring(0, 20) + '...');
      
      const response = await fetch('/api/fyers/api/v3/profile', {
        method: 'GET',
        headers: {
          'Authorization': `${this.appId}:${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📥 Profile response status:', response.status);
      
      if (!response.ok) {
        console.log('❌ Profile fetch failed with status:', response.status);
        return {
          success: false,
          message: `Profile fetch failed with status: ${response.status}`
        };
      }

      const data = await response.json();
      console.log('📥 Profile response data:', JSON.stringify(data, null, 2));

      if (data.s === 'ok' && data.data) {
        console.log('✅ Profile fetched successfully:', data.data.name || data.data.display_name);
        return {
          success: true,
          message: 'Profile fetched successfully',
          profile: data.data
        };
      } else {
        console.log('❌ Profile fetch failed:', data.message || 'Unknown error');
        return {
          success: false,
          message: data.message || 'Failed to fetch profile'
        };
      }
    } catch (error) {
      console.error('💥 Profile fetch error:', error);
      return {
        success: false,
        message: `Profile fetch error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  static async validateToken(): Promise<{ success: boolean; message: string }> {
    if (!this.accessToken || !this.appId) {
      return {
        success: false,
        message: 'No access token available'
      };
    }

    try {
      console.log('🔍 Validating access token...');
      console.log('🆔 App ID:', this.appId);
      console.log('🔑 Access Token:', this.accessToken.substring(0, 20) + '...');
      
      const response = await fetch('/api/fyers/api/v3/profile', {
        method: 'GET',
        headers: {
          'Authorization': `${this.appId}:${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📥 Token validation response status:', response.status);
      
      if (response.status === 401) {
        console.log('❌ Token is invalid (401 Unauthorized)');
        return {
          success: false,
          message: 'Token is invalid or expired'
        };
      }

      if (!response.ok) {
        console.log('❌ Token validation failed with status:', response.status);
        return {
          success: false,
          message: `Token validation failed with status: ${response.status}`
        };
      }

      const data = await response.json();
      console.log('📥 Token validation response data:', JSON.stringify(data, null, 2));

      if (data.s === 'ok') {
        console.log('✅ Token is valid');
        return {
          success: true,
          message: 'Token is valid'
        };
      } else {
        console.log('❌ Token validation failed:', data.message || 'Unknown error');
        return {
          success: false,
          message: data.message || 'Token validation failed'
        };
      }
    } catch (error) {
      console.error('💥 Token validation error:', error);
      return {
        success: false,
        message: `Token validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  static async refreshAccessToken(): Promise<{ success: boolean; message: string; token?: AuthToken }> {
    if (!this.refreshToken || !this.appId) {
      return {
        success: false,
        message: 'No refresh token available'
      };
    }

    try {
      const response = await fetch('/api/fyers/api/v3/refresh-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken
        })
      });

      const data = await response.json();

      if (data.s === 'ok' && data.data) {
        this.accessToken = data.data.access_token;
        this.refreshToken = data.data.refresh_token;
        this.tokenExpiry = Date.now() + (data.data.expires_in * 1000);
        
        this.saveToStorage();
        
        return {
          success: true,
          message: 'Token refreshed successfully',
          token: data.data
        };
      } else {
        return {
          success: false,
          message: data.message || 'Token refresh failed'
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Token refresh error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  static getAccessToken(): string | null {
    // Check if token is close to expiring (within 5 minutes) and refresh if needed
    if (this.tokenExpiry && this.tokenExpiry - Date.now() < 5 * 60 * 1000) {
      console.log('🔄 Token expiring soon, attempting refresh...');
      this.refreshAccessToken().then(result => {
        if (result.success) {
          console.log('✅ Token refreshed automatically');
        } else {
          console.log('❌ Auto-refresh failed:', result.message);
        }
      });
    }
    return this.accessToken;
  }

  static getAppId(): string | null {
    return this.appId;
  }

  static getRefreshToken(): string | null {
    return this.refreshToken;
  }

  static getTokenExpiry(): number | null {
    return this.tokenExpiry;
  }

  static isTokenValid(): boolean {
    // Check if token exists and is not expired (with 5-minute buffer)
    return this.accessToken !== null && 
           this.tokenExpiry !== null && 
           (this.tokenExpiry - Date.now()) > 5 * 60 * 1000; // 5 minutes buffer
  }

  /**
   * Get a valid access token, refreshing if necessary
   */
  static async getValidAccessToken(): Promise<string | null> {
    if (!this.accessToken) {
      return null;
    }

    // If token is expired or close to expiring, refresh it
    if (this.tokenExpiry && (this.tokenExpiry - Date.now()) < 5 * 60 * 1000) {
      console.log('🔄 Token needs refresh, attempting...');
      const refreshResult = await this.refreshAccessToken();
      if (refreshResult.success) {
        console.log('✅ Token refreshed successfully');
        return this.accessToken;
      } else {
        console.log('❌ Token refresh failed:', refreshResult.message);
        return null;
      }
    }

    return this.accessToken;
  }

  static logout(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
    this.appId = null;
    
    // Clear from localStorage
    try {
      localStorage.removeItem('victor_auth');
      console.log('🗑️ Auth data cleared from storage');
    } catch (error) {
      console.error('❌ Error clearing storage:', error);
    }
  }

  private static generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private static async generateAppIdHash(appId: string, appSecret: string): Promise<string> {
    // Create SHA-256 hash of app_id:app_secret (with colon separator)
    const text = appId + ':' + appSecret;
    console.log('🔑 Creating hash from:', appId + ':' + appSecret.substring(0, 4) + '...');
    
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    console.log('🔑 Generated hash:', hashHex.substring(0, 20) + '...');
    return hashHex;
  }

  /**
   * Check if fresh authentication is required (after 8 AM IST)
   * Fyers requires fresh login every day after 8 AM IST
   */
  static isFreshAuthRequired(): boolean {
    try {
      // Get current time in IST
      const now = new Date();
      const istTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      
      // Check if it's after 8 AM IST
      const hours = istTime.getHours();
      const minutes = istTime.getMinutes();
      const timeInMinutes = hours * 60 + minutes;
      const eightAMInMinutes = 8 * 60; // 8:00 AM
      
      const isAfter8AM = timeInMinutes >= eightAMInMinutes;
      
      // If it's before 8 AM, no fresh auth required
      if (!isAfter8AM) {
        return false;
      }
      
      // Check if we have a token and when it was last used
      if (this.accessToken && this.tokenExpiry) {
        const lastTokenTime = new Date(this.tokenExpiry - (24 * 60 * 60 * 1000)); // When token was created
        const lastTokenIST = new Date(lastTokenTime.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        
        // Check if token was created before today's 8 AM
        const tokenDate = lastTokenIST.toDateString();
        const todayDate = istTime.toDateString();
        
        const isTokenFromPreviousDay = tokenDate !== todayDate;
        const isTokenFromBefore8AM = lastTokenIST.getHours() < 8;
        
        if (isTokenFromPreviousDay || isTokenFromBefore8AM) {
          console.log('🔄 Fresh authentication required: After 8 AM IST and token is from previous day/before 8 AM');
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('❌ Error checking fresh auth requirement:', error);
      return true; // Default to requiring fresh auth on error
    }
  }

  /**
   * Comprehensive authentication check that considers Fyers' daily re-auth requirement
   */
  static async checkAuthenticationStatus(): Promise<{
    isAuthenticated: boolean;
    requiresFreshAuth: boolean;
    message: string;
  }> {
    try {
      // First check if fresh auth is required
      const requiresFreshAuth = this.isFreshAuthRequired();
      
      if (requiresFreshAuth) {
        console.log('🔄 Fresh authentication required due to Fyers daily re-auth policy');
        this.logout(); // Clear any existing tokens
        return {
          isAuthenticated: false,
          requiresFreshAuth: true,
          message: 'Fresh authentication required after 8 AM IST'
        };
      }

      // Check if we have tokens
      if (!this.accessToken || !this.appId) {
        return {
          isAuthenticated: false,
          requiresFreshAuth: false,
          message: 'No authentication tokens found'
        };
      }

      // Validate the token
      const validation = await this.validateToken();
      
      if (validation.success) {
        return {
          isAuthenticated: true,
          requiresFreshAuth: false,
          message: 'Authentication is valid'
        };
      } else {
        // Token is invalid, clear it
        this.logout();
        return {
          isAuthenticated: false,
          requiresFreshAuth: false,
          message: validation.message
        };
      }
    } catch (error) {
      console.error('❌ Error checking authentication status:', error);
      return {
        isAuthenticated: false,
        requiresFreshAuth: false,
        message: `Authentication check error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  static isAuthenticated(): boolean {
    return !!this.accessToken && !this.isTokenExpired();
  }

  static getProfile(): { name?: string } | null {
    const profileStr = localStorage.getItem('user_profile');
    if (profileStr) {
      try {
        const profileData = JSON.parse(profileStr);
        return { name: profileData.name };
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  /**
   * Check if the access token is expired
   */
  static isTokenExpired(): boolean {
    if (!this.tokenExpiry) return true;
    return Date.now() > this.tokenExpiry;
  }
} 