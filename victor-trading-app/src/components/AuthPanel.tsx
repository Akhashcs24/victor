import React, { useState } from 'react';
import { ExternalLink, Key, Eye, EyeOff } from 'lucide-react';
import { AuthService } from '../services/authService';
import { AuthStatus } from '../types';

interface AuthPanelProps {
  onAuthSuccess: (authStatus: AuthStatus) => void;
}

export const AuthPanel: React.FC<AuthPanelProps> = ({ onAuthSuccess }) => {
  const [credentials, setCredentials] = useState({
    appId: '',
    secretKey: '',
    redirectUri: ''
  });
  const [authCode, setAuthCode] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [authUrl, setAuthUrl] = useState('');

  const handleInputChange = (field: keyof typeof credentials) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setCredentials(prev => ({
      ...prev,
      [field]: e.target.value
    }));
    setError(''); // Clear error when user types
  };

  const handleGenerateAuthUrl = async () => {
    if (!credentials.appId || !credentials.redirectUri) {
      setError('Please enter App ID and Redirect URI');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const authService = AuthService.getInstance();
      const url = await authService.generateAuthUrl(credentials.appId, credentials.redirectUri);
      setAuthUrl(url);
      
      // Open the auth URL in a new tab
      window.open(url, '_blank');
    } catch (err: any) {
      setError(err.message || 'Failed to generate auth URL');
    } finally {
      setIsLoading(false);
    }
  };

  const handleValidateAuthCode = async () => {
    if (!credentials.appId || !credentials.secretKey || !authCode) {
      setError('Please enter all required fields');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const authService = AuthService.getInstance();
      const result = await authService.validateAuthCode(
        credentials.appId,
        credentials.secretKey,
        authCode
      );

      if (result.success && result.data) {
        const authStatus: AuthStatus = {
          isAuthenticated: true,
          accessToken: result.data.accessToken,
          isValid: true,
          lastChecked: new Date()
        };
        onAuthSuccess(authStatus);
      } else {
        setError(result.error || 'Authentication failed');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="card">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Victor 2.0 Authentication</h2>
          <p className="text-gray-600">Connect to Fyers API to start trading</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-danger-50 border border-danger-200 rounded-md">
            <p className="text-danger-700 text-sm">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          {/* App ID */}
          <div>
            <label htmlFor="appId" className="block text-sm font-medium text-gray-700 mb-1">
              App ID
            </label>
            <input
              id="appId"
              type="text"
              value={credentials.appId}
              onChange={handleInputChange('appId')}
              className="input-field"
              placeholder="Enter your Fyers App ID"
            />
          </div>

          {/* Secret Key */}
          <div>
            <label htmlFor="secretKey" className="block text-sm font-medium text-gray-700 mb-1">
              Secret Key
            </label>
            <div className="relative">
              <input
                id="secretKey"
                type={showSecret ? 'text' : 'password'}
                value={credentials.secretKey}
                onChange={handleInputChange('secretKey')}
                className="input-field pr-10"
                placeholder="Enter your Fyers Secret Key"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Redirect URI */}
          <div>
            <label htmlFor="redirectUri" className="block text-sm font-medium text-gray-700 mb-1">
              Redirect URI
            </label>
            <input
              id="redirectUri"
              type="text"
              value={credentials.redirectUri}
              onChange={handleInputChange('redirectUri')}
              className="input-field"
              placeholder="https://trade.fyers.in/api-login/redirect-uri/index.html"
            />
          </div>

          {/* Generate Auth URL Button */}
          <button
            onClick={handleGenerateAuthUrl}
            disabled={isLoading || !credentials.appId || !credentials.redirectUri}
            className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Generate Auth Link</span>
          </button>

          {authUrl && (
            <div className="p-3 bg-primary-50 border border-primary-200 rounded-md">
              <p className="text-sm text-primary-700 mb-2">
                Auth URL generated! Check the new tab for login.
              </p>
              <p className="text-xs text-primary-600 break-all">
                {authUrl}
              </p>
            </div>
          )}

          {/* Auth Code Input */}
          <div>
            <label htmlFor="authCode" className="block text-sm font-medium text-gray-700 mb-1">
              Auth Code
            </label>
            <input
              id="authCode"
              type="text"
              value={authCode}
              onChange={(e) => setAuthCode(e.target.value)}
              className="input-field"
              placeholder="Enter the auth code from the login page"
            />
          </div>

          {/* Validate Auth Code Button */}
          <button
            onClick={handleValidateAuthCode}
            disabled={isLoading || !credentials.appId || !credentials.secretKey || !authCode}
            className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            <Key className="w-4 h-4" />
            <span>{isLoading ? 'Validating...' : 'Validate & Connect'}</span>
          </button>
        </div>

        <div className="mt-6 p-4 bg-gray-50 rounded-md">
          <h3 className="text-sm font-medium text-gray-900 mb-2">Instructions:</h3>
          <ol className="text-sm text-gray-600 space-y-1">
            <li>1. Enter your Fyers App ID and Secret Key</li>
            <li>2. Click "Generate Auth Link" to open login page</li>
            <li>3. Complete login in the new tab</li>
            <li>4. Copy the auth code and paste it here</li>
            <li>5. Click "Validate & Connect" to complete setup</li>
          </ol>
        </div>
      </div>
    </div>
  );
}; 