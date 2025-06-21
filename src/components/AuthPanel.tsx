import React, { useState, useEffect } from 'react';
import { ExternalLink, Key, User, Globe, X } from 'lucide-react';
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
  const [authCode, setAuthCode] = useState(() => {
    // Auto-extract auth code from URL if present
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('auth_code') || '';
  });
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authUrl, setAuthUrl] = useState('');

  // Check if auth code was auto-extracted from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('auth_code')) {
      setMessage({ type: 'success', text: 'Auth code detected! Validating automatically...' });
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      // Close modal if it was open
      setShowAuthModal(false);
      // Auto-validate the auth code
      const code = urlParams.get('auth_code');
      if (code) {
        setAuthCode(code);
        // Auto-validate after a short delay
        setTimeout(async () => {
          if (code) {
            setIsLoading(true);
            try {
              const result = await AuthService.validateAuthCode(code, config);
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
          }
        }, 1000);
      }
    }
  }, []);

  // Listen for messages from the iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Only accept messages from Fyers domain
      if (event.origin !== 'https://api-t1.fyers.in' && event.origin !== 'https://api.fyers.in') {
        return;
      }
      
      if (event.data && event.data.auth_code) {
        setAuthCode(event.data.auth_code);
        setShowAuthModal(false);
        setMessage({ type: 'success', text: 'Auth code received! Validating...' });
        // Auto-validate
        setTimeout(async () => {
          setIsLoading(true);
          try {
            const result = await AuthService.validateAuthCode(event.data.auth_code, config);
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
        }, 500);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleInputChange = (field: keyof AuthConfig, value: string) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const generateAuthUrl = () => {
    if (!config.appId || !config.secret || !config.redirectUri) {
      setMessage({ type: 'error', text: 'Please fill in all fields' });
      return;
    }

    try {
      const url = AuthService.generateAuthUrl(config);
      setAuthUrl(url);
      setShowAuthModal(true);
      setMessage({ type: 'success', text: 'Login modal opened. Please complete authentication.' });
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
            <Key className="w-4 h-4 mr-2" />
            Login with Fyers
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
            <li>2. Click "Login with Fyers" to open authentication modal</li>
            <li>3. Complete login in the modal window</li>
            <li>4. Modal will close automatically after successful login</li>
            <li>5. Authentication will be validated automatically</li>
          </ol>
        </div>
      </div>

      {/* Authentication Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-5/6 relative">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Fyers Authentication</h3>
              <button
                onClick={() => setShowAuthModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {/* Modal Content */}
            <div className="p-4 h-full">
              <iframe
                src={authUrl}
                className="w-full h-full border-0 rounded"
                title="Fyers Authentication"
                sandbox="allow-same-origin allow-scripts allow-forms allow-top-navigation"
              />
            </div>
            
            {/* Modal Footer */}
            <div className="p-4 border-t bg-gray-50 rounded-b-lg">
              <p className="text-sm text-gray-600">
                🔐 Complete your login in the frame above. The modal will close automatically after successful authentication.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 