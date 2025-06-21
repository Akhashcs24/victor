import React, { useState, useEffect } from 'react';
import { Key, User, Globe, Clipboard } from 'lucide-react';
import { AuthService } from '../services/authService';
import { AuthConfig } from '../types';

interface AuthPanelProps {
  onAuthSuccess: () => void;
}

export const AuthPanel: React.FC<AuthPanelProps> = ({ onAuthSuccess }) => {
  const [config, setConfig] = useState<AuthConfig>({
    appId: 'MSEL25Z2K9-100',
    secret: '0O9FRN8DY0',
    redirectUri: 'https://trade.fyers.in/api-login/redirect-uri/index.html'
  });
  const [authCode, setAuthCode] = useState(() => {
    // Auto-extract auth code from URL if present
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('auth_code') || '';
  });
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);


  // Check if auth code was auto-extracted from URL (keep for backward compatibility)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('auth_code')) {
      const code = urlParams.get('auth_code');
      if (code) {
        setAuthCode(code);
        setMessage({ type: 'success', text: 'Auth code detected from URL! Click "Validate Auth Code" to continue.' });
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
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
      
      // Open popup window for authentication
      const popup = window.open(
        url,
        'fyersAuth',
        'width=600,height=700,scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no,directories=no,status=no'
      );

      if (!popup) {
        setMessage({ type: 'error', text: 'Popup blocked. Please allow popups for this site.' });
        return;
      }

      setMessage({ type: 'success', text: 'Authentication popup opened. Complete login to continue.' });

      // Monitor popup for completion and auto-extract auth code
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          setMessage({ type: 'success', text: 'Popup closed. Please paste the auth code if not automatically detected.' });
        }
        
        // Try to extract auth code from popup URL
        try {
          const popupUrl = popup.location.href;
          console.log('🔍 Checking popup URL:', popupUrl);
          
          if (popupUrl && popupUrl.includes('trade.fyers.in/api-login/redirect-uri')) {
            console.log('✅ Popup reached redirect page');
            
            // Extract auth code from URL
            const urlParams = new URLSearchParams(new URL(popupUrl).search);
            const authCodeFromUrl = urlParams.get('auth_code');
            
            console.log('🔑 Auth code from URL:', authCodeFromUrl?.substring(0, 20) + '...');
            
            if (authCodeFromUrl && authCodeFromUrl !== authCode) {
              setAuthCode(authCodeFromUrl);
              popup.close();
              clearInterval(checkClosed);
              setMessage({ type: 'success', text: 'Auth code detected automatically! Validating...' });
              
              // Auto-validate the auth code
              setTimeout(async () => {
                setIsLoading(true);
                try {
                  const result = await AuthService.validateAuthCode(authCodeFromUrl, config);
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
          }
        } catch (e) {
          console.log('❌ Cross-origin access blocked for URL detection:', e.message);
        }
        
        // Alternative: Try to read from popup document (if same-origin)
        try {
          if (popup.document && popup.document.body) {
            const bodyText = popup.document.body.innerText || popup.document.body.textContent;
            if (bodyText && bodyText.includes('authorization code')) {
              // Look for the auth code pattern in the page text
              const authCodeMatch = bodyText.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
              if (authCodeMatch && authCodeMatch[0] !== authCode) {
                const extractedCode = authCodeMatch[0];
                setAuthCode(extractedCode);
                popup.close();
                clearInterval(checkClosed);
                setMessage({ type: 'success', text: 'Auth code extracted from page! Validating...' });
                
                // Auto-validate
                setTimeout(async () => {
                  setIsLoading(true);
                  try {
                    const result = await AuthService.validateAuthCode(extractedCode, config);
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
            }
          }
        } catch (e) {
          // Cross-origin or other access issues
        }
      }, 500); // Check more frequently (every 500ms instead of 1000ms)

      // Cleanup after 5 minutes
      setTimeout(() => {
        clearInterval(checkClosed);
        if (!popup.closed) {
          popup.close();
        }
      }, 5 * 60 * 1000);

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

  const handlePasteAuthCode = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setAuthCode(text.trim());
        setMessage({ type: 'success', text: 'Auth code pasted successfully!' });
      } else {
        setMessage({ type: 'error', text: 'No text found in clipboard' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to read from clipboard. Please paste manually.' });
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
            <div className="relative">
              <input
                type="text"
                value={authCode}
                onChange={(e) => setAuthCode(e.target.value)}
                className="input-field pr-10"
                placeholder="Paste the auth code from the redirect URL"
              />
              <button
                type="button"
                onClick={handlePasteAuthCode}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                title="Paste from clipboard"
              >
                <Clipboard className="w-5 h-5" />
              </button>
            </div>
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
            <li>2. Click "Login with Fyers" to open authentication popup</li>
            <li>3. Complete login in the popup window</li>
            <li>4. Auth code will be detected automatically from popup</li>
            <li>5. If auto-detection fails, use the paste button 📋 to paste manually</li>
          </ol>
        </div>
      </div>
    </div>
  );
}; 