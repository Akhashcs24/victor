import { fyersModel } from 'fyers-api-v3';
import { AuthCredentials, AuthStatus, ApiResponse } from '../types';

export class AuthService {
  private static instance: AuthService;
  private fyersInstances: Map<string, any> = new Map();
  private lastAuthentication: any = null;

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  async generateAuthUrl(appId: string, redirectUri: string): Promise<string> {
    try {
      const encodedRedirectUri = encodeURIComponent(redirectUri);
      const authUrl = `https://api-t1.fyers.in/api/v3/generate-authcode?client_id=${appId}&redirect_uri=${encodedRedirectUri}&response_type=code&state=sample_state&nonce=sample_nonce`;
      
      console.log('Generated auth URL for app:', appId);
      return authUrl;
    } catch (error) {
      console.error('Error generating auth URL:', error);
      throw new Error('Failed to generate authentication URL');
    }
  }

  async validateAuthCode(
    appId: string, 
    secretKey: string, 
    authCode: string
  ): Promise<ApiResponse<{ accessToken: string }>> {
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
        fyers.setAccessToken(response.access_token);
        this.fyersInstances.set(appId, fyers);
        
        this.lastAuthentication = {
          appId: appId,
          accessToken: response.access_token,
          timestamp: new Date()
        };
        
        console.log(`🔐 Stored authentication for appId: ${appId.substring(0, 8)}...`);
        
        return {
          success: true,
          data: { accessToken: response.access_token },
          message: 'Authentication successful'
        };
      } else {
        return {
          success: false,
          error: response?.message || 'Token validation failed'
        };
      }
    } catch (error: any) {
      console.error('Token validation error:', error);
      return {
        success: false,
        error: error.message || 'Authentication failed'
      };
    }
  }

  getLastAuthentication(): any {
    return this.lastAuthentication;
  }

  setAuthentication(appId: string, accessToken: string): void {
    this.lastAuthentication = {
      appId: appId,
      accessToken: accessToken,
      timestamp: new Date()
    };
    console.log(`🔐 Manually set authentication for appId: ${appId.substring(0, 8)}...`);
  }

  async getUserProfile(appId: string, accessToken: string): Promise<any> {
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

  getFyersInstance(appId: string, accessToken: string): any {
    if (!appId || !accessToken) {
      throw new Error('AppId and AccessToken are required for Fyers API');
    }
    
    let fyers = this.fyersInstances.get(appId);
    
    if (!fyers) {
      console.log(`🔑 Creating new Fyers instance for appId: ${appId.substring(0, 8)}...`);
      fyers = new fyersModel();
      
      fyers.setAppId(appId);
      fyers.setAccessToken(accessToken);
      
      this.fyersInstances.set(appId, fyers);
      console.log(`✅ Fyers instance created and configured for appId: ${appId.substring(0, 8)}...`);
    } else {
      fyers.setAccessToken(accessToken);
    }
    
    return fyers;
  }

  async verifyToken(appId: string, accessToken: string): Promise<boolean> {
    try {
      const fyers = this.getFyersInstance(appId, accessToken);
      const response = await fyers.get_profile();
      return response && response.s === 'ok';
    } catch (error) {
      console.error('Token verification error:', error);
      return false;
    }
  }

  getAuthStatus(): AuthStatus {
    if (!this.lastAuthentication) {
      return {
        isAuthenticated: false,
        isValid: false
      };
    }

    return {
      isAuthenticated: true,
      accessToken: this.lastAuthentication.accessToken,
      isValid: true, // This should be verified periodically
      lastChecked: this.lastAuthentication.timestamp
    };
  }
} 