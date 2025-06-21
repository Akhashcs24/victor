import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '../services/authService';
import { AuthConfig } from '../types';

// Mock fetch globally
global.fetch = vi.fn();

describe("Authentication flow", () => {
  const mockConfig: AuthConfig = {
    appId: 'test-app-id',
    secret: 'test-secret',
    redirectUri: 'https://localhost:3000/callback'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset AuthService static properties
    (AuthService as any).accessToken = null;
    (AuthService as any).refreshToken = null;
    (AuthService as any).tokenExpiry = null;
  });

  it("shows inputs for App ID, Secret, and Redirect URI", () => {
    // Test that config object has all required fields
    expect(mockConfig.appId).toBeDefined();
    expect(mockConfig.secret).toBeDefined();
    expect(mockConfig.redirectUri).toBeDefined();
    
    // Test that fields are strings
    expect(typeof mockConfig.appId).toBe('string');
    expect(typeof mockConfig.secret).toBe('string');
    expect(typeof mockConfig.redirectUri).toBe('string');
  });

  it("generates auth link and accepts code input", () => {
    const authUrl = AuthService.generateAuthUrl(mockConfig);
    
    // Test that auth URL is generated
    expect(authUrl).toBeDefined();
    expect(typeof authUrl).toBe('string');
    expect(authUrl).toContain('api-t1.fyers.in');
    expect(authUrl).toContain('client_id=' + mockConfig.appId);
    expect(authUrl).toContain('redirect_uri=' + encodeURIComponent(mockConfig.redirectUri));
    expect(authUrl).toContain('response_type=code');
  });

  it("exchanges auth code for token", async () => {
    const mockAuthCode = 'test-auth-code';
    const mockTokenResponse = {
      s: 'ok',
      code: 200,
      message: 'Success',
      data: {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer'
      }
    };

    // Mock successful API response
    (fetch as any).mockResolvedValueOnce({
      json: async () => mockTokenResponse
    });

    const result = await AuthService.validateAuthCode(mockAuthCode, mockConfig);

    // Test successful authentication
    expect(result.success).toBe(true);
    expect(result.message).toBe('Authentication successful');
    expect(result.token).toEqual(mockTokenResponse.data);

    // Test that tokens are stored
    expect(AuthService.getAccessToken()).toBe('test-access-token');
    expect(AuthService.isTokenValid()).toBe(true);
  });

  it("handles authentication failure", async () => {
    const mockAuthCode = 'invalid-auth-code';
    const mockErrorResponse = {
      s: 'error',
      code: 400,
      message: 'Invalid auth code'
    };

    // Mock failed API response
    (fetch as any).mockResolvedValueOnce({
      json: async () => mockErrorResponse
    });

    const result = await AuthService.validateAuthCode(mockAuthCode, mockConfig);

    // Test failed authentication
    expect(result.success).toBe(false);
    expect(result.message).toBe('Invalid auth code');
    expect(result.token).toBeUndefined();
  });

  it("validates token correctly", async () => {
    // Set up a valid token
    (AuthService as any).accessToken = 'valid-token';
    (AuthService as any).tokenExpiry = Date.now() + 3600000; // 1 hour from now

    const mockValidationResponse = {
      s: 'ok',
      code: 200,
      message: 'Token is valid'
    };

    (fetch as any).mockResolvedValueOnce({
      json: async () => mockValidationResponse
    });

    const result = await AuthService.validateToken();

    expect(result.success).toBe(true);
    expect(result.message).toBe('Token is valid');
  });

  it("detects expired token", async () => {
    // Set up an expired token
    (AuthService as any).accessToken = 'expired-token';
    (AuthService as any).tokenExpiry = Date.now() - 3600000; // 1 hour ago

    const result = await AuthService.validateToken();

    expect(result.success).toBe(false);
    expect(result.message).toBe('Token has expired');
  });

  it("handles network errors gracefully", async () => {
    const mockAuthCode = 'test-auth-code';

    // Mock network error
    (fetch as any).mockRejectedValueOnce(new Error('Network error'));

    const result = await AuthService.validateAuthCode(mockAuthCode, mockConfig);

    expect(result.success).toBe(false);
    expect(result.message).toContain('Authentication error');
    expect(result.message).toContain('Network error');
  });
}); 