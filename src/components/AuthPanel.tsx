import React, { useState } from 'react';
import { ExternalLink, Key, User, Globe } from 'lucide-react';
import { AuthService } from '../services/authService';
import { AuthConfig } from '../types';

interface AuthPanelProps {
  onAuthSuccess: () => void;
}

export const AuthPanel: React.FC<AuthPanelProps> = ({ onAuthSuccess }) => {
  const [config, setConfig] = useState<AuthConfig>({
    appId: 'MSEL25Z2K9-100',
    secret: '0O9FRN8DY0',
    redirectUri: window.location.origin
  });
  const [authCode, setAuthCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleInputChange = (field: keyof AuthConfig, value: string) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const generateAuthUrl = () => {
    if (!config.appId || !config.secret || !config.redirectUri) {
      setMessage({ type: 'error', text: 'Please fill in all fields' });
      return;
    }

    try {
      const authUrl = AuthService.generateAuthUrl(config);
      window.open(authUrl, '_blank');
      setMessage({ type: 'success', text: 'Auth URL opened in new tab. Please login and copy the auth code.' });
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to generate auth URL: ${error instanceof Error ? error.message : 'Unknown error'}` });
    }
  };

  const validateAuthCode = async () => {
    if (!authCode.trim()) {
      setMessage({ type: 'error', text: 'Please enter the auth code' });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const result = await AuthService.validateAuthCode(authCode, config);
      
      if (result.success) {
        setMessage({ type: 'success', text: 'Authentication successful!' });
        onAuthSuccess();
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}` });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="card">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Authentication</h2>
          <p className="text-gray-600">Enter your Fyers API credentials to continue</p>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-lg ${
            message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {message.text}
          </div>
        )}

        <div className="space-y-4">
          {/* App ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <User className="w-4 h-4 inline mr-1" />
              App ID
            </label>
            <input
              type="text"
              value={config.appId}
              onChange={(e) => handleInputChange('appId', e.target.value)}
              className="input-field"
              placeholder="Enter your Fyers App ID"
            />
          </div>

          {/* Secret */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Key className="w-4 h-4 inline mr-1" />
              Secret
            </label>
            <input
              type="password"
              value={config.secret}
              onChange={(e) => handleInputChange('secret', e.target.value)}
              className="input-field"
              placeholder="Enter your Fyers Secret"
            />
          </div>

          {/* Redirect URI */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Globe className="w-4 h-4 inline mr-1" />
              Redirect URI
            </label>
            <input
              type="text"
              value={config.redirectUri}
              onChange={(e) => handleInputChange('redirectUri', e.target.value)}
              className="input-field"
              placeholder="https://your-redirect-uri.com"
            />
          </div>

          {/* Generate Auth URL Button */}
          <button
            onClick={generateAuthUrl}
            className="btn-primary w-full flex items-center justify-center"
            disabled={!config.appId || !config.secret || !config.redirectUri}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Generate Auth URL
          </button>

          {/* Auth Code Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Auth Code
            </label>
            <input
              type="text"
              value={authCode}
              onChange={(e) => setAuthCode(e.target.value)}
              className="input-field"
              placeholder="Paste the auth code from the redirect URL"
            />
          </div>

          {/* Validate Auth Code Button */}
          <button
            onClick={validateAuthCode}
            className="btn-success w-full flex items-center justify-center"
            disabled={!authCode.trim() || isLoading}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Validating...
              </>
            ) : (
              <>
                <Key className="w-4 h-4 mr-2" />
                Validate Auth Code
              </>
            )}
          </button>
        </div>

                  <div className="mt-6 p-4 bg-slate-50 rounded-lg">
          <h3 className="text-sm font-medium text-gray-900 mb-2">Instructions:</h3>
          <ol className="text-sm text-gray-600 space-y-1">
            <li>1. Enter your Fyers API credentials</li>
            <li>2. Click "Generate Auth URL" to open login page</li>
            <li>3. Login with your Fyers credentials</li>
            <li>4. Copy the auth code from the redirect URL</li>
            <li>5. Paste the code and click "Validate Auth Code"</li>
          </ol>
        </div>
      </div>
    </div>
  );
}; 