// Route: Get Fyers user profile (requires access token)
app.get('/api/profile', authenticate, async (req, res) => {
  try {
    const profile = await authService.getProfile(req.accessToken);
    res.json(profile);
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch profile' });
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
    
    const data = await marketDataService.getHistoricalData({
      symbol,
      resolution,
      rangeFrom: from,
      rangeTo: to,
      accessToken: req.accessToken
    });
    
    // Format the response to match what the client expects
    if (data && data.s === 'ok' && data.candles) {
      res.json({
        success: true,
        candles: data.candles
      });
    } else if (data && data.s === 'no_data') {
      res.json({
        success: true,
        status: 'no_data',
        candles: []
      });
    } else {
      throw new Error(data.message || 'Invalid response from Fyers API');
    }
  } catch (error) {
    console.error('❌ Historical data error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to fetch historical data' 
    });
  }
});

// Market data routes
app.get('/api/market-data/quotes', authenticate, async (req, res) => {
  try {
    const { symbols } = req.query;
    
    if (!symbols) {
      return res.status(400).json({ error: 'Symbols parameter is required' });
    }
    
    const symbolsArray = symbols.split(',');
    const data = await liveMarketDataService.fetchMultipleMarketData(symbolsArray, req.accessToken);
    
    // Convert Map to Array for JSON response
    const result = Array.from(data.entries()).map(([symbol, data]) => ({
      symbol,
      ...data
    }));
    
    // Format response to match what the client expects
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Market data error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to fetch market data' 
    });
  }
});

app.get('/api/market-data/depth', authenticate, async (req, res) => {
  try {
    const { symbol } = req.query;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol parameter is required' });
    }
    
    const data = await liveMarketDataService.getMarketDepth(symbol, req.accessToken);
    res.json(data);
  } catch (error) {
    console.error('Market depth error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch market depth' });
  }
}); 