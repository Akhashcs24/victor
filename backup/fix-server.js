const fs = require('fs');
const path = require('path');

console.log('=== Server Fix Script ===');
console.log('This script will fix issues with the market data service in the server');

// Paths to the files we need to check/fix
const serverIndexPath = path.join(__dirname, 'server', 'index.js');
const liveMarketDataServicePath = path.join(__dirname, 'server', 'liveMarketDataService.js');

// Check if the files exist
if (!fs.existsSync(serverIndexPath)) {
  console.error(`❌ Server index file not found: ${serverIndexPath}`);
  process.exit(1);
}

if (!fs.existsSync(liveMarketDataServicePath)) {
  console.error(`❌ Live market data service file not found: ${liveMarketDataServicePath}`);
  process.exit(1);
}

console.log('✅ Found all required files');

// Function to check and fix the liveMarketDataService.js file
function fixLiveMarketDataService() {
  console.log('\n=== Checking liveMarketDataService.js ===');
  
  let content = fs.readFileSync(liveMarketDataServicePath, 'utf8');
  let fixed = false;
  
  // Check if the file has the correct API endpoint
  if (content.includes('https://api.fyers.in/data/v2/quotes')) {
    console.log('❌ Found outdated API endpoint: https://api.fyers.in/data/v2/quotes');
    content = content.replace(
      'https://api.fyers.in/data/v2/quotes',
      'https://api-t1.fyers.in/data-rest/v2/quotes'
    );
    fixed = true;
    console.log('✅ Updated API endpoint to: https://api-t1.fyers.in/data-rest/v2/quotes');
  } else if (content.includes('https://api-t1.fyers.in/data-rest/v2/quotes')) {
    console.log('✅ API endpoint is correct: https://api-t1.fyers.in/data-rest/v2/quotes');
  } else {
    console.log('⚠️ Could not find API endpoint in the file');
  }
  
  // Check if the file has the correct response parsing
  if (content.includes('if (response.data.s !== \'ok\' || !response.data.d || !response.data.d.length)')) {
    console.log('✅ Response parsing looks correct');
  } else {
    console.log('⚠️ Response parsing may need to be updated');
  }
  
  // Check for proper error handling
  if (!content.includes('console.error(`❌ Error fetching market data for ${symbol}:')) {
    console.log('⚠️ Error handling could be improved');
    
    // Add better error handling
    content = content.replace(
      'catch (error) {\n    console.error(`❌ Error fetching multiple market data:',
      'catch (error) {\n    console.error(`❌ Error fetching multiple market data:`, error.message);\n    if (error.response) {\n      console.error(`Response status: ${error.response.status}`);\n      console.error(`Response data:`, error.response.data);\n    }'
    );
    
    fixed = true;
    console.log('✅ Added better error handling');
  }
  
  // Add symbol validation if needed
  if (!content.includes('function isValidSymbol')) {
    console.log('⚠️ Symbol validation function not found, adding it');
    
    const validationCode = `
// Valid index symbols that are always allowed
const VALID_INDEX_SYMBOLS = [
  'NSE:NIFTY50-INDEX',
  'NSE:NIFTYBANK-INDEX',
  'BSE:SENSEX-INDEX'
];

// Symbol validation regex
const VALID_SYMBOL_REGEX = {
  INDEX: /^(NSE|BSE):[A-Z0-9]+-INDEX$/,
  OPTION: /^(NSE|BSE):[A-Z0-9]+[0-9]{2}[A-Z]{3}[0-9]{2}[0-9]+(?:CE|PE)$/
};

/**
 * Validate if a symbol is properly formatted
 */
function isValidSymbol(symbol) {
  if (VALID_INDEX_SYMBOLS.includes(symbol)) {
    return true;
  }
  
  return Object.values(VALID_SYMBOL_REGEX).some(regex => regex.test(symbol));
}`;
    
    // Insert after the requires
    content = content.replace(
      'const config = require(\'./config\');\n',
      'const config = require(\'./config\');\n' + validationCode + '\n'
    );
    
    // Update the exports
    content = content.replace(
      'module.exports = {',
      'module.exports = {\n  isValidSymbol,\n  VALID_INDEX_SYMBOLS,'
    );
    
    fixed = true;
    console.log('✅ Added symbol validation function');
  }
  
  // Save the changes if needed
  if (fixed) {
    fs.writeFileSync(liveMarketDataServicePath, content);
    console.log('✅ Saved changes to liveMarketDataService.js');
  } else {
    console.log('ℹ️ No changes needed for liveMarketDataService.js');
  }
  
  return fixed;
}

// Function to check and fix the server/index.js file
function fixServerIndex() {
  console.log('\n=== Checking server/index.js ===');
  
  let content = fs.readFileSync(serverIndexPath, 'utf8');
  let fixed = false;
  
  // Check if the file has proper error handling for market data
  if (!content.includes('console.error(\'❌ Market data error:\', error.message);')) {
    console.log('⚠️ Error handling in market data route could be improved');
    
    // Find the market data route
    const marketDataRouteIndex = content.indexOf('app.get(\'/api/market-data/quotes\'');
    
    if (marketDataRouteIndex !== -1) {
      // Find the catch block
      const catchIndex = content.indexOf('catch (error) {', marketDataRouteIndex);
      
      if (catchIndex !== -1) {
        // Find the end of the catch block
        const catchEndIndex = content.indexOf('});', catchIndex);
        
        if (catchEndIndex !== -1) {
          // Extract the catch block
          const catchBlock = content.substring(catchIndex, catchEndIndex);
          
          // Create an improved catch block
          const improvedCatchBlock = `catch (error) {
    console.error('❌ Market data error:', error.message);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to fetch market data' 
    });
  `;
          
          // Replace the catch block
          content = content.replace(catchBlock, improvedCatchBlock);
          
          fixed = true;
          console.log('✅ Improved error handling in market data route');
        }
      }
    }
  }
  
  // Add symbol validation to the market data route
  if (!content.includes('const validSymbols = symbolsArray.filter(symbol => liveMarketDataService.isValidSymbol(symbol));')) {
    console.log('⚠️ Symbol validation in market data route could be improved');
    
    // Find the market data route
    const marketDataRouteIndex = content.indexOf('app.get(\'/api/market-data/quotes\'');
    
    if (marketDataRouteIndex !== -1) {
      // Find where we process the symbols
      const symbolsIndex = content.indexOf('const symbolsArray = symbols.split(\',\');', marketDataRouteIndex);
      
      if (symbolsIndex !== -1) {
        // Create the improved code
        const originalCode = 'const symbolsArray = symbols.split(\',\');';
        const improvedCode = `const symbolsArray = symbols.split(',');
    const validSymbols = symbolsArray.filter(symbol => liveMarketDataService.isValidSymbol(symbol));
    const invalidSymbols = symbolsArray.filter(symbol => !liveMarketDataService.isValidSymbol(symbol));
    
    // Log warning for invalid symbols
    if (invalidSymbols.length > 0) {
      console.warn(\`⚠️ Client requested \${invalidSymbols.length} invalid symbols: \${invalidSymbols.join(', ')}\`);
    }
    
    // If no valid symbols, return empty result
    if (validSymbols.length === 0) {
      return res.json({
        success: true,
        data: [],
        message: 'No valid symbols to fetch'
      });
    }`;
        
        // Replace the original code
        content = content.replace(originalCode, improvedCode);
        
        // Also update the API call to use validSymbols
        content = content.replace(
          'const data = await liveMarketDataService.fetchMultipleMarketData(symbolsArray, req.accessToken);',
          'const data = await liveMarketDataService.fetchMultipleMarketData(validSymbols, req.accessToken);'
        );
        
        fixed = true;
        console.log('✅ Added symbol validation to market data route');
      }
    }
  }
  
  // Save the changes if needed
  if (fixed) {
    fs.writeFileSync(serverIndexPath, content);
    console.log('✅ Saved changes to server/index.js');
  } else {
    console.log('ℹ️ No changes needed for server/index.js');
  }
  
  return fixed;
}

// Run the fixes
const liveMarketDataServiceFixed = fixLiveMarketDataService();
const serverIndexFixed = fixServerIndex();

console.log('\n=== Fix Summary ===');
console.log(`liveMarketDataService.js: ${liveMarketDataServiceFixed ? '✅ Fixed' : 'ℹ️ No changes needed'}`);
console.log(`server/index.js: ${serverIndexFixed ? '✅ Fixed' : 'ℹ️ No changes needed'}`);

if (liveMarketDataServiceFixed || serverIndexFixed) {
  console.log('\n✅ Fixes applied! Please restart the server to apply the changes.');
  console.log('You can restart the server by running: node restart-servers.bat');
} else {
  console.log('\nℹ️ No fixes were needed. If you are still experiencing issues, please check:');
  console.log('1. Your access token validity');
  console.log('2. Network connectivity to the Fyers API');
  console.log('3. Server logs for other errors');
}

console.log('\nDone!'); 