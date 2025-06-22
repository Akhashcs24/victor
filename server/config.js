require('dotenv').config();
const crypto = require('crypto-js');

// Default values for development
const config = {
  port: process.env.PORT || 5000,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  fyers: {
    appId: process.env.FYERS_APP_ID || 'MSEL25Z2K9-100',
    secret: process.env.FYERS_APP_SECRET || '0O9FRN8DY0',
    redirectUri: process.env.FYERS_REDIRECT_URI || 'https://trade.fyers.in/api-login/redirect-uri/index.html',
  },
  apiRateLimit: {
    windowMs: 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute
  }
};

// Generate app hash for Fyers authentication
config.fyers.appHash = crypto.SHA256(
  `${config.fyers.appId}|${config.fyers.secret}|${config.fyers.redirectUri}`
).toString();

module.exports = config; 