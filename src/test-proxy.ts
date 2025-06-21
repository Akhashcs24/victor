// Simple test to verify proxy configuration
async function testProxy() {
  try {
    console.log('🧪 Testing proxy configuration...');
    
    // Test the proxy endpoint
    const response = await fetch('/api/fyers/data/quotes?symbols=NSE:NIFTY50-INDEX', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📥 Proxy test response status:', response.status);
    console.log('📥 Proxy test response headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Proxy is working correctly!');
      console.log('📊 Response data:', data);
    } else {
      console.log('❌ Proxy test failed with status:', response.status);
    }
  } catch (error) {
    console.error('❌ Proxy test error:', error);
  }
}

// Test new symbol format
function testSymbolFormat() {
  try {
    console.log('🧪 Testing new symbol format...');
    
    // Import the FixedSymbolService
    import('./services/fixedSymbolService').then(({ FixedSymbolService }) => {
      // Test with different indices
      const testCases = [
        { index: 'NIFTY', openPrice: 24800 },
        { index: 'BANKNIFTY', openPrice: 55600 },
        { index: 'SENSEX', openPrice: 81400 }
      ];
      
      testCases.forEach(({ index, openPrice }) => {
        console.log(`\n📊 Testing ${index} with open price ${openPrice}:`);
        const result = FixedSymbolService.fixedSymbolService(index, openPrice);
        
        console.log(`ATM Strike: ${result.atmStrike}`);
        console.log(`Sample CE symbols:`, result.ce.slice(0, 3).map(s => s.symbol));
        console.log(`Sample PE symbols:`, result.pe.slice(0, 3).map(s => s.symbol));
      });
    });
  } catch (error) {
    console.error('❌ Symbol format test error:', error);
  }
}

// Export for use in browser console
(window as any).testProxy = testProxy;
(window as any).testSymbolFormat = testSymbolFormat; 