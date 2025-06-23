// Basic Express server for Victor trading app backend
// This file starts the backend server and sets up basic middleware

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const bodyParser = require('body-parser');

// Import services
const authService = require('./authService');
const marketDataService = require('./marketDataService');
const hmaService = require('./hmaService');
const symbolService = require('./symbolService');
const tradeLogService = require('./tradeLogService');
const tradingStateService = require('./tradingStateService');
const orderService = require('./orderService');
const liveMarketDataService = require('./liveMarketDataService');
const config = require('./config');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());

// Custom CORS middleware
app.use(function(req, res, next) {
  // Allow specific origins or use "*" for any origin
  const allowedOrigins = [
    'https://client-6u4laigih-akhashcs24s-projects.vercel.app', // Latest deployment with enhanced trade tracking
    'https://client-4198m9i51-akhashcs24s-projects.vercel.app', // Previous deployment URL with HMA fix
    'https://client-is7sn29fg-akhashcs24s-projects.vercel.app', // Previous deployment URL
    'https://client-akhashcs24-akhashcs24s-projects.vercel.app', // Current stable project URL
    'https://client-iota-two-14.vercel.app', // Previous stable URL (backup)
    'http://localhost:3000',
    'http://localhost:3001'
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  } else {
    // For development or testing, you can use "*"
    res.header("Access-Control-Allow-Origin", "*");
  }
  
  // Allow specific headers and methods
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Credentials", "true");
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

app.use(bodyParser.json());

// Only serve static files if client/dist exists (for development)
const clientDistPath = path.join(__dirname, '../client/dist');
const fs = require('fs');
if (fs.existsSync(clientDistPath)) {
  console.log('📁 Serving static files from client/dist');
  app.use(express.static(clientDistPath));
} else {
  console.log('📁 Client dist directory not found - running as API-only backend');
}

// Simple in-memory cache for market data
const marketDataCache = {
  quotes: new Map(),
  depth: new Map(),
  historical: new Map(),
  
  // Method to clear all caches
  clearAll() {
    this.quotes.clear();
    this.depth.clear();
    this.historical.clear();
    console.log('🧹 All market data caches cleared');
  },
  
  // Method to clear specific cache
  clear(cacheType) {
    if (this[cacheType]) {
      this[cacheType].clear();
      console.log(`🧹 ${cacheType} cache cleared`);
      return true;
    }
    return false;
  },
  
  // Method to get cache stats
  getStats() {
    return {
      quotes: this.quotes.size,
      depth: this.depth.size,
      historical: this.historical.size
    };
  }
};

// Cache TTL in milliseconds (30 seconds)
const CACHE_TTL = 30 * 1000;

// Rate limiting - only apply in production
const apiLimiter = rateLimit({
  windowMs: config.apiRateLimit.windowMs,
  max: config.apiRateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

// Apply rate limiting to all API routes only in production
if (process.env.NODE_ENV === 'production') {
  console.log('🔒 Applying rate limiting in production mode');
  app.use('/api', apiLimiter);
} else {
  console.log('⚠️ Rate limiting disabled in development mode');
}

// Authentication middleware
const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization;
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication token is required' });
    }
    
    // For now, we'll just pass the token through
    // In a production app, you'd validate the token here
    req.accessToken = token;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
};

// Example route to test if server is running
app.get('/api/health', (req, res) => {
  res.json({ status: 'Backend server is running!' });
});

// Route: Generate Fyers OAuth URL (POST, accepts credentials from frontend)
app.post('/api/login', async (req, res) => {
  try {
    const { appId, secret, redirectUri } = req.body;
    
    if (!appId || !secret || !redirectUri) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    console.log('Login request received:', { appId, redirectUri });
    const authUrl = authService.generateAuthUrl(appId, secret, redirectUri);
    res.json({ url: authUrl });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route: Fyers OAuth callback (POST, accepts credentials and code from frontend)
app.post('/api/fyers-callback', async (req, res) => {
  try {
    const { code, appId, secret, redirectUri } = req.body;
    
    if (!code || !appId || !secret) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    console.log('Callback request received:', { code, appId });
    const tokenData = await authService.validateAuthCode(code, appId, secret);
    
    if (tokenData.access_token) {
      res.json(tokenData);
    } else {
      res.status(400).json({ error: tokenData.message || 'Authentication failed' });
    }
  } catch (error) {
    console.error('Auth callback error:', error);
    res.status(500).json({ error: error.message || 'Authentication failed' });
  }
});

app.get('/api/fyers-callback', async (req, res) => {
  try {
    const { code } = req.query;
    
    if (!code) {
      return res.status(400).json({ error: 'Auth code is required' });
    }
    
    const result = await authService.validateAuthCode(code);
    
    if (result.access_token) {
      res.json(result);
    } else {
      res.status(400).json({ error: result.message || 'Authentication failed' });
    }
  } catch (error) {
    console.error('Auth callback error:', error);
    res.status(500).json({ error: error.message || 'Authentication failed' });
  }
});

// Route: Get Fyers user profile (requires access token)
app.get('/api/profile', authenticate, async (req, res) => {
  try {
    const profile = await authService.getProfile(req.accessToken);
    res.json(profile);
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route: Fetch historical market data from Fyers
app.get('/api/market-data/historical', authenticate, async (req, res) => {
  try {
    const { symbol, resolution, from, to } = req.query;
    
    if (!symbol || !resolution) {
      return res.status(400).json({ error: 'Symbol and resolution are required' });
    }
    
    console.log(`📈 Historical data request for ${symbol}, resolution: ${resolution}`);
    
    // Check cache first
    const cacheKey = `${symbol}:${resolution}:${from || ''}:${to || ''}`;
    const cachedData = marketDataCache.historical.get(cacheKey);
    
    if (cachedData && (Date.now() - cachedData.timestamp < CACHE_TTL)) {
      console.log(`🔄 Returning cached historical data for ${symbol} (age: ${Math.round((Date.now() - cachedData.timestamp) / 1000)}s)`);
      return res.json({
        ...cachedData.data,
        cached: true
      });
    }
    
    console.log(`📈 Fetching fresh historical data for ${symbol}`);
    const data = await marketDataService.getHistoricalData({
      symbol,
      resolution,
      rangeFrom: from,
      rangeTo: to,
      accessToken: req.accessToken
    });
    
    let responseData;
    
    // Format the response to match what the client expects
    responseData = {
      success: true,
      candles: data.candles || []
    };
    
    // Store in cache
    marketDataCache.historical.set(cacheKey, {
      timestamp: Date.now(),
      data: responseData
    });
    
    res.json(responseData);
  } catch (error) {
    console.error('❌ Historical data error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to fetch historical data' 
    });
  }
});

// Market data routes with caching
app.get('/api/market-data/quotes', authenticate, async (req, res) => {
  try {
    const { symbols } = req.query;
    
    if (!symbols) {
      return res.status(400).json({ error: 'Symbols parameter is required' });
    }
    
    console.log(`📊 Received request for quotes: ${symbols}`);
    
    // Format the access token correctly for the Fyers API
    // If the token doesn't include the appId, add it
    let accessToken = req.accessToken;
    if (!accessToken.includes(':')) {
      // Extract appId from the token if possible, or use default
      const appId = process.env.FYERS_APP_ID || 'MSEL25Z2K9-100';
      accessToken = `${appId}:${accessToken}`;
      console.log(`Reformatted token to include appId: ${accessToken.substring(0, 20)}...`);
    }
    
    const symbolsArray = symbols.split(',');
    
    if (symbolsArray.length === 1) {
      // Single symbol
      const quoteData = await liveMarketDataService.fetchMarketData(symbols, accessToken);
      res.json({ success: true, data: quoteData });
    } else {
      // Multiple symbols
      const quotesData = await liveMarketDataService.fetchMultipleMarketData(symbolsArray, accessToken);
      res.json({ success: true, data: quotesData });
    }
  } catch (error) {
    console.error('Market data error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/market-data/depth', authenticate, async (req, res) => {
  try {
    const { symbol } = req.query;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol parameter is required' });
    }
    
    // Check cache first
    const cacheKey = symbol;
    const cachedData = marketDataCache.depth.get(cacheKey);
    
    if (cachedData && (Date.now() - cachedData.timestamp < CACHE_TTL)) {
      console.log(`🔄 Returning cached market depth for ${symbol} (age: ${Math.round((Date.now() - cachedData.timestamp) / 1000)}s)`);
      return res.json({
        ...cachedData.data,
        cached: true
      });
    }
    
    console.log(`📊 Fetching fresh market depth for ${symbol}`);
    const data = await liveMarketDataService.getMarketDepth(symbol, req.accessToken);
    
    // Store in cache
    marketDataCache.depth.set(cacheKey, {
      timestamp: Date.now(),
      data: data
    });
    
    res.json(data);
  } catch (error) {
    console.error('❌ Market depth error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch market depth' });
  }
});

// HMA routes
app.get('/api/hma-calc', authenticate, async (req, res) => {
  try {
    const { symbol } = req.query;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol parameter is required' });
    }
    
    const data = await hmaService.fetchAndCalculateHMA(symbol, req.accessToken);
    res.json(data);
  } catch (error) {
    console.error('HMA calculation error:', error);
    res.status(500).json({ error: error.message || 'Failed to calculate HMA' });
  }
});

app.get('/api/hma-cache-stats', (req, res) => {
  try {
    const stats = hmaService.getCacheStats();
    res.json(stats);
  } catch (error) {
    console.error('HMA cache stats error:', error);
    res.status(500).json({ error: error.message || 'Failed to get HMA cache stats' });
  }
});

app.post('/api/hma-cache/clear', authenticate, (req, res) => {
  try {
    const { symbol } = req.body;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol parameter is required' });
    }
    
    const result = hmaService.clearCache(symbol);
    res.json({ success: result });
  } catch (error) {
    console.error('HMA cache clear error:', error);
    res.status(500).json({ error: error.message || 'Failed to clear HMA cache' });
  }
});

// Symbol routes
app.get('/api/symbols/index-config', (req, res) => {
  try {
    const { index } = req.query;
    
    if (index) {
      const config = symbolService.getIndexConfig(index);
      if (!config) {
        return res.status(404).json({ error: `Index configuration not found for: ${index}` });
      }
      res.json(config);
    } else {
      const configs = symbolService.getAllIndexConfigs();
      res.json(configs);
    }
  } catch (error) {
    console.error('Index config error:', error);
    res.status(500).json({ error: error.message || 'Failed to get index configuration' });
  }
});

app.get('/api/symbols/strike-symbols', (req, res) => {
  try {
    const { indexType, openPrice, expiryDate } = req.query;
    
    if (!indexType || !openPrice) {
      return res.status(400).json({ error: 'Index type and open price are required' });
    }
    
    const symbols = symbolService.generateStrikeSymbols(
      indexType,
      parseFloat(openPrice),
      expiryDate
    );
    
    res.json(symbols);
  } catch (error) {
    console.error('Strike symbols error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate strike symbols' });
  }
});

app.get('/api/symbols/expiry-dates', (req, res) => {
  try {
    const { indexType } = req.query;
    
    if (indexType) {
      const dates = symbolService.getAvailableExpiryDates(indexType);
      res.json(dates);
    } else {
      const dates = symbolService.getExpiryDates();
      res.json(dates);
    }
  } catch (error) {
    console.error('Expiry dates error:', error);
    res.status(500).json({ error: error.message || 'Failed to get expiry dates' });
  }
});

// Trade log routes
app.get('/api/trade-logs', async (req, res) => {
  try {
    const logs = await tradeLogService.getTodayTradeLogs();
    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error('Trade logs error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to get trade logs' 
    });
  }
});

app.get('/api/trade-logs/today', async (req, res) => {
  try {
    const logs = await tradeLogService.getTodayTradeLogs();
    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error('Trade logs error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to get trade logs' 
    });
  }
});

app.get('/api/trade-logs/historical', async (req, res) => {
  try {
    const logs = await tradeLogService.getHistoricalTradeLogs();
    res.json(logs);
  } catch (error) {
    console.error('Historical trade logs error:', error);
    res.status(500).json({ error: error.message || 'Failed to get historical trade logs' });
  }
});

app.get('/api/trade-logs/date/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const logs = await tradeLogService.getTradeLogsByDate(date);
    res.json(logs);
  } catch (error) {
    console.error('Trade logs by date error:', error);
    res.status(500).json({ error: error.message || 'Failed to get trade logs by date' });
  }
});

app.get('/api/trade-logs/stats', async (req, res) => {
  try {
    const stats = await tradeLogService.getTradeStats();
    res.json(stats);
  } catch (error) {
    console.error('Trade stats error:', error);
    res.status(500).json({ error: error.message || 'Failed to get trade stats' });
  }
});

app.post('/api/trade-logs', authenticate, async (req, res) => {
  try {
    const tradeLog = req.body;
    
    if (!tradeLog.symbol || !tradeLog.action || !tradeLog.quantity) {
      return res.status(400).json({ error: 'Missing required trade log parameters' });
    }
    
    const result = await tradeLogService.addTradeLog(tradeLog);
    res.json(result);
  } catch (error) {
    console.error('Add trade log error:', error);
    res.status(500).json({ error: error.message || 'Failed to add trade log' });
  }
});

app.post('/api/trade-logs/export', async (req, res) => {
  try {
    const exportData = await tradeLogService.exportLogs();
    res.json({ data: exportData });
  } catch (error) {
    console.error('Export trade logs error:', error);
    res.status(500).json({ error: error.message || 'Failed to export trade logs' });
  }
});

app.post('/api/trade-logs/import', async (req, res) => {
  try {
    const { data } = req.body;
    
    if (!data) {
      return res.status(400).json({ error: 'Import data is required' });
    }
    
    const result = await tradeLogService.importLogs(data);
    res.json({ success: result });
  } catch (error) {
    console.error('Import trade logs error:', error);
    res.status(500).json({ error: error.message || 'Failed to import trade logs' });
  }
});

// Trading state routes
app.get('/api/trading-state', authenticate, async (req, res) => {
  try {
    const userId = req.query.userId || 'default';
    const state = await tradingStateService.loadTradingState(userId);
    res.json(state || { exists: false });
  } catch (error) {
    console.error('Trading state load error:', error);
    res.status(500).json({ error: error.message || 'Failed to load trading state' });
  }
});

app.post('/api/trading-state', authenticate, async (req, res) => {
  try {
    const { state } = req.body;
    const userId = req.body.userId || 'default';
    
    if (!state) {
      console.log('❌ Trading state is missing in request body:', req.body);
      return res.status(400).json({ error: 'Trading state is required' });
    }
    
    console.log(`📝 Saving trading state for user ${userId}`);
    const result = await tradingStateService.saveTradingState(state, userId);
    res.json({ success: result });
  } catch (error) {
    console.error('Trading state save error:', error);
    res.status(500).json({ error: error.message || 'Failed to save trading state' });
  }
});

app.delete('/api/trading-state', authenticate, async (req, res) => {
  try {
    const userId = req.query.userId || 'default';
    const result = await tradingStateService.clearTradingState(userId);
    res.json({ success: result });
  } catch (error) {
    console.error('Trading state clear error:', error);
    res.status(500).json({ error: error.message || 'Failed to clear trading state' });
  }
});

// Order routes
app.post('/api/orders', authenticate, async (req, res) => {
  try {
    const orderParams = req.body;
    
    if (!orderParams.symbol || orderParams.qty === undefined) {
      return res.status(400).json({ error: 'Missing required order parameters' });
    }
    
    const result = await orderService.placeOrder(orderParams, req.accessToken);
    res.json(result);
  } catch (error) {
    console.error('Place order error:', error);
    res.status(500).json({ error: error.message || 'Failed to place order' });
  }
});

app.post('/api/paper-orders', async (req, res) => {
  try {
    const orderParams = req.body;
    
    if (!orderParams.symbol || orderParams.qty === undefined) {
      return res.status(400).json({ error: 'Missing required order parameters' });
    }
    
    const result = await orderService.placePaperTrade(orderParams);
    res.json(result);
  } catch (error) {
    console.error('Place paper order error:', error);
    res.status(500).json({ error: error.message || 'Failed to place paper order' });
  }
});

app.get('/api/orders/:orderId', authenticate, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }
    
    const result = await orderService.getOrderStatus(orderId, req.accessToken);
    res.json(result);
  } catch (error) {
    console.error('Order status error:', error);
    res.status(500).json({ error: error.message || 'Failed to get order status' });
  }
});

app.delete('/api/orders/:orderId', authenticate, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }
    
    const result = await orderService.cancelOrder(orderId, req.accessToken);
    res.json(result);
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({ error: error.message || 'Failed to cancel order' });
  }
});

app.get('/api/orders', authenticate, async (req, res) => {
  try {
    const result = await orderService.getOrderHistory(req.accessToken);
    res.json(result);
  } catch (error) {
    console.error('Order history error:', error);
    res.status(500).json({ error: error.message || 'Failed to get order history' });
  }
});

// Cache management endpoint
app.get('/api/cache/stats', (req, res) => {
  try {
    const stats = marketDataCache.getStats();
    res.json({
      success: true,
      stats,
      ttl: CACHE_TTL / 1000 // in seconds
    });
  } catch (error) {
    console.error('❌ Cache stats error:', error);
    res.status(500).json({ error: error.message || 'Failed to get cache stats' });
  }
});

app.post('/api/cache/clear', authenticate, (req, res) => {
  try {
    const { type } = req.body;
    
    if (type && type !== 'all') {
      const result = marketDataCache.clear(type);
      if (!result) {
        return res.status(400).json({ error: `Invalid cache type: ${type}` });
      }
    } else {
      marketDataCache.clearAll();
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Cache clear error:', error);
    res.status(500).json({ error: error.message || 'Failed to clear cache' });
  }
});

// Symbol validation endpoint for testing
app.get('/api/symbols/validate', (req, res) => {
  try {
    const { symbol } = req.query;
    
    if (!symbol) {
      return res.status(400).json({ 
        success: false,
        error: 'Symbol parameter is required' 
      });
    }
    
    const isValid = liveMarketDataService.isValidSymbol(symbol);
    
    res.json({
      success: true,
      symbol,
      isValid,
      validationPattern: isValid ? 
        (liveMarketDataService.VALID_INDEX_SYMBOLS.includes(symbol) ? 'KNOWN_INDEX' : 'REGEX_MATCH') : 
        'INVALID'
    });
  } catch (error) {
    console.error('Symbol validation error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to validate symbol' 
    });
  }
});

// Monitoring API Routes
app.get('/api/monitoring/status', (req, res) => {
  try {
    // This endpoint would typically check if monitoring is active
    // For now, we'll just return a simple status
    res.json({ 
      active: true, 
      allowOptionSymbols: true
    });
  } catch (error) {
    console.error('Monitoring status error:', error);
    res.status(500).json({ error: error.message || 'Failed to get monitoring status' });
  }
});

app.get('/api/monitoring/list', (req, res) => {
  try {
    // This would typically fetch the list of monitored symbols from the service
    // For now, we'll return a mock list
    res.json([
      {
        id: 'mock_ce_1',
        symbol: 'NSE:NIFTY24JUN25000CE',
        type: 'CE',
        currentLTP: 120.5,
        hmaValue: 115.2,
        triggerStatus: 'WAITING',
        lots: 1,
        targetPoints: 50,
        stopLossPoints: 30,
        entryMethod: 'MARKET',
        lastUpdate: new Date()
      }
    ]);
  } catch (error) {
    console.error('Monitoring list error:', error);
    res.status(500).json({ error: error.message || 'Failed to get monitoring list' });
  }
});

app.post('/api/monitoring/add', (req, res) => {
  try {
    const { symbol, type, lots, targetPoints, stopLossPoints, entryMethod } = req.body;
    
    if (!symbol || !type) {
      return res.status(400).json({ error: 'Symbol and type are required' });
    }
    
    // This would typically add the symbol to monitoring
    // For now, we'll just return success
    console.log(`📊 Adding ${symbol} (${type}) to monitoring`);
    
    res.json({ 
      success: true, 
      message: `Added ${symbol} to monitoring`,
      id: `mock_${type.toLowerCase()}_${Date.now()}`
    });
  } catch (error) {
    console.error('Add to monitoring error:', error);
    res.status(500).json({ error: error.message || 'Failed to add to monitoring' });
  }
});

app.delete('/api/monitoring/remove/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: 'Symbol ID is required' });
    }
    
    // This would typically remove the symbol from monitoring
    // For now, we'll just return success
    console.log(`🛑 Removing symbol with ID ${id} from monitoring`);
    
    res.json({ 
      success: true, 
      message: `Removed symbol with ID ${id} from monitoring`
    });
  } catch (error) {
    console.error('Remove from monitoring error:', error);
    res.status(500).json({ error: error.message || 'Failed to remove from monitoring' });
  }
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API URL: http://localhost:${PORT}/api`);
});

// Add your API routes (e.g., /api/login, /api/fyers-callback) here in the future 