const INDEX_CONFIGS = {
  'NIFTY': {
    name: 'Nifty 50',
    symbol: 'NSE:NIFTY',
    lotSize: 75,
    tickSize: 0.05,
    strikeInterval: 50
  },
  'BANKNIFTY': {
    name: 'Bank Nifty',
    symbol: 'NSE:NIFTYBANK',
    lotSize: 30,
    tickSize: 0.05,
    strikeInterval: 100
  },
  'NIFTYMIDCAPSELECT': {
    name: 'Nifty Midcap Select',
    symbol: 'NSE:NIFTYMIDCPSELECT',
    lotSize: 120,
    tickSize: 0.05,
    strikeInterval: 25
  },
  'NIFTYFINSERVICE': {
    name: 'Nifty Financial Services',
    symbol: 'NSE:NIFTYFINSERVICE',
    lotSize: 65,
    tickSize: 0.05,
    strikeInterval: 50
  },
  'NIFTYNEXT50': {
    name: 'Nifty Next 50',
    symbol: 'NSE:NIFTYNEXT50',
    lotSize: 25,
    tickSize: 0.05,
    strikeInterval: 25
  },
  'SENSEX': {
    name: 'BSE Sensex',
    symbol: 'BSE:SENSEX',
    lotSize: 20,
    tickSize: 0.01,
    strikeInterval: 100
  },
  'BANKEX': {
    name: 'BSE Bankex',
    symbol: 'BSE:BANKEX',
    lotSize: 30,
    tickSize: 0.01,
    strikeInterval: 100
  },
  'SENSEX50': {
    name: 'BSE Sensex 50',
    symbol: 'BSE:SENSEX50',
    lotSize: 60,
    tickSize: 0.01,
    strikeInterval: 50
  }
};

// Strike intervals for different indices
const STRIKE_INTERVALS = {
  'NIFTY': 50,
  'BANKNIFTY': 100,
  'SENSEX': 100,
  'FINNIFTY': 50,
  'MIDCPNIFTY': 25
};

// Expiry types
const EXPIRY_TYPES = {
  'NIFTY': 'weekly',      // Weekly expiry (Thursday)
  'BANKNIFTY': 'monthly', // Monthly expiry (last Thursday)  
  'SENSEX': 'weekly',     // Weekly expiry (Tuesday)
  'FINNIFTY': 'monthly',  // Monthly expiry (last Thursday)
  'MIDCPNIFTY': 'monthly' // Monthly expiry (last Thursday)
};

// Exchange prefixes
const EXCHANGES = {
  'NIFTY': 'NSE',
  'BANKNIFTY': 'NSE',
  'SENSEX': 'BSE',
  'FINNIFTY': 'NSE',
  'MIDCPNIFTY': 'NSE'
};

// Base symbols for options
const BASE_SYMBOLS = {
  'NIFTY': 'NIFTY',
  'BANKNIFTY': 'BANKNIFTY',
  'SENSEX': 'SENSEX',
  'FINNIFTY': 'FINNIFTY',
  'MIDCPNIFTY': 'MIDCPNIFTY'
};

// Predefined holidays for 2025
const HOLIDAYS_2025 = [
  '2025-02-26', '2025-03-14', '2025-03-31', '2025-04-10', 
  '2025-04-14', '2025-04-18', '2025-05-01', '2025-08-15', 
  '2025-08-27', '2025-10-02', '2025-10-21', '2025-10-22', 
  '2025-11-05', '2025-12-25'
];

/**
 * Map index name for symbol (NIFTYBANK -> BANKNIFTY)
 */
function mapIndexNameForSymbol(indexName) {
  if (indexName === 'NIFTYBANK') return 'BANKNIFTY';
  return indexName;
}

/**
 * Check if a date is a holiday (weekend or predefined holiday)
 */
function isHoliday(date) {
  const dayOfWeek = date.getDay();
  
  // Check if weekend
  if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday = 0, Saturday = 6
    return true;
  }
  
  // Check predefined holidays
  const dateStr = formatDate(date);
  return HOLIDAYS_2025.includes(dateStr);
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Adjust expiry date to previous working day if it's a holiday
 */
function adjustForHoliday(originalDate) {
  let adjustedDate = new Date(originalDate);
  
  while (isHoliday(adjustedDate)) {
    adjustedDate.setDate(adjustedDate.getDate() - 1);
  }
  
  return adjustedDate;
}

/**
 * Get last weekday of month
 */
function getLastWeekdayInMonth(year, month, weekday) {
  // Create last day of the month
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  const lastDay = new Date(nextYear, nextMonth, 0); // Last day of current month
  const lastDayOfWeek = lastDay.getDay();
  
  // Calculate offset to get to the desired weekday
  const offset = lastDayOfWeek >= weekday ? lastDayOfWeek - weekday : lastDayOfWeek + 7 - weekday;
  const lastWeekday = new Date(lastDay);
  lastWeekday.setDate(lastDay.getDate() - offset);
  
  return lastWeekday;
}

/**
 * Get next weekday for weekly expiry
 */
function getNextWeekday(currentDate, weekday) {
  const currentDayOfWeek = currentDate.getDay();
  const offset = weekday >= currentDayOfWeek ? weekday - currentDayOfWeek : 7 - (currentDayOfWeek - weekday);
  const nextWeekday = new Date(currentDate);
  nextWeekday.setDate(currentDate.getDate() + offset);
  return nextWeekday;
}

/**
 * Get next weekly expiry (Thursday for NIFTY, Tuesday for SENSEX)
 */
function getNextWeeklyExpiry(currentDate, indexName) {
  const weekday = indexName === 'SENSEX' ? 2 : 4; // Tuesday = 2, Thursday = 4
  let nextExpiry = getNextWeekday(currentDate, weekday);
  
  // If today is the expiry day and market has closed (after 3:30 PM), move to next week
  if (currentDate.getDay() === weekday && currentDate.getHours() >= 15 && currentDate.getMinutes() >= 30) {
    nextExpiry.setDate(nextExpiry.getDate() + 7);
  }
  
  // Adjust for holidays
  return adjustForHoliday(nextExpiry);
}

/**
 * Get next monthly expiry (last Thursday for NSE, last Tuesday for BSE)
 */
function getNextMonthlyExpiry(currentDate, indexName) {
  const weekday = indexName === 'SENSEX' ? 2 : 4; // Tuesday = 2, Thursday = 4
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  // Get this month's expiry
  let thisMonthExpiry = getLastWeekdayInMonth(year, month, weekday);
  thisMonthExpiry = adjustForHoliday(thisMonthExpiry);
  
  // If current date is before this month's expiry, use it
  if (currentDate < thisMonthExpiry || 
      (currentDate.getTime() === thisMonthExpiry.getTime() && currentDate.getHours() < 15)) {
    return thisMonthExpiry;
  }
  
  // Otherwise, get next month's expiry
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  
  let nextMonthExpiry = getLastWeekdayInMonth(nextYear, nextMonth, weekday);
  return adjustForHoliday(nextMonthExpiry);
}

/**
 * Calculate next expiry date based on expiry type
 */
function getNextExpiryDate(indexName, currentDate = new Date()) {
  const mappedIndex = mapIndexNameForSymbol(indexName);
  const expiryType = EXPIRY_TYPES[mappedIndex] || 'weekly';

  if (expiryType === 'weekly') {
    return getNextWeeklyExpiry(currentDate, mappedIndex);
  } else {
    return getNextMonthlyExpiry(currentDate, mappedIndex);
  }
}

/**
 * Format expiry date for symbol
 */
function formatExpiryForSymbol(expiryDate, expiryType, indexName = '') {
  const year = expiryDate.getFullYear().toString().slice(-2);
  
  if (indexName === 'BANKNIFTY') {
    // BANKNIFTY: YYMMM (no day)
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const month = monthNames[expiryDate.getMonth()];
    return `${year}${month}`;
  }
  
  if (expiryType === 'weekly') {
    // Weekly: YYMDD (25619 for 19th June 2025)
    const month = (expiryDate.getMonth() + 1).toString();
    const day = expiryDate.getDate().toString().padStart(2, '0');
    return `${year}${month}${day}`;
  } else {
    // Monthly: YYMMMDD (25JUN19 for 19th June 2025)
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const month = monthNames[expiryDate.getMonth()];
    const day = expiryDate.getDate().toString().padStart(2, '0');
    return `${year}${month}${day}`;
  }
}

/**
 * Get the nearest strike price based on the current price and strike interval
 */
function getNearestStrike(currentPrice, strikeInterval) {
  return Math.round(currentPrice / strikeInterval) * strikeInterval;
}

/**
 * Get ATM (At The Money) strike based on market open price
 */
function getATMStrike(indexName, openPrice) {
  const mappedIndex = mapIndexNameForSymbol(indexName);
  const interval = STRIKE_INTERVALS[mappedIndex] || 50;
  
  // Handle null/undefined openPrice with fallback values
  if (!openPrice || isNaN(openPrice)) {
    console.log(`⚠️ Invalid openPrice (${openPrice}) for ${mappedIndex}, using fallback strike`);
    const fallbackStrikes = {
      'NIFTY': 24800,
      'BANKNIFTY': 55600,
      'SENSEX': 81400
    };
    const fallbackPrice = fallbackStrikes[mappedIndex] || 25000;
    console.log(`📊 Using fallback open price ${fallbackPrice} for ${mappedIndex}`);
    return getNearestStrike(fallbackPrice, interval);
  }
  
  return getNearestStrike(openPrice, interval);
}

/**
 * Create option symbol
 */
function createOptionSymbol(indexName, strike, optionType, openPrice = null, currentDate = new Date()) {
  try {
    const mappedIndex = mapIndexNameForSymbol(indexName);
    const exchange = EXCHANGES[mappedIndex] || 'NSE';
    const baseSymbol = BASE_SYMBOLS[mappedIndex] || mappedIndex;
    
    // Get expiry type and date
    const expiryType = EXPIRY_TYPES[mappedIndex] || 'weekly';
    const expiryDate = getNextExpiryDate(mappedIndex, currentDate);
    const expiryStr = formatExpiryForSymbol(expiryDate, expiryType, mappedIndex);
    const expiryDisplay = formatDate(expiryDate);
    
    // Format: NSE:NIFTY25619PE24500
    const symbol = `${exchange}:${baseSymbol}${expiryStr}${optionType}${strike}`;
    
    return {
      symbol,
      strike,
      expiry: expiryStr,
      expiryDisplay,
      optionType,
      indexName: mappedIndex,
      exchange
    };
  } catch (error) {
    console.error(`Error creating option symbol for ${indexName}:`, error);
    return null;
  }
}

/**
 * Generate strike symbols for CE and PE options
 */
function generateStrikeSymbols(indexType, openPrice, expiryDate) {
  const mappedIndex = mapIndexNameForSymbol(indexType);
  const atmStrike = getATMStrike(mappedIndex, openPrice);
  const interval = STRIKE_INTERVALS[mappedIndex] || 50;
  
  // Generate 5 strikes above and below ATM
  const strikes = [];
  for (let i = -5; i <= 5; i++) {
    strikes.push(atmStrike + (i * interval));
  }
  
  // Generate CE symbols
  const ceSymbols = strikes.map((strike, index) => {
    const type = strike < atmStrike ? 'ITM' : strike > atmStrike ? 'OTM' : 'ATM';
    const level = strike === atmStrike ? 0 : Math.abs(index - 5);
    
    const symbolInfo = createOptionSymbol(
      mappedIndex,
      strike,
      'CE',
      openPrice,
      expiryDate ? new Date(expiryDate) : undefined
    );
    
    if (!symbolInfo) return null;
    
    return {
      label: `${strike} CE (${type})`,
      symbol: symbolInfo.symbol,
      strike,
      type,
      level
    };
  }).filter(Boolean);
  
  // Generate PE symbols
  const peSymbols = strikes.map((strike, index) => {
    const type = strike > atmStrike ? 'ITM' : strike < atmStrike ? 'OTM' : 'ATM';
    const level = strike === atmStrike ? 0 : Math.abs(index - 5);
    
    const symbolInfo = createOptionSymbol(
      mappedIndex,
      strike,
      'PE',
      openPrice,
      expiryDate ? new Date(expiryDate) : undefined
    );
    
    if (!symbolInfo) return null;
    
    return {
      label: `${strike} PE (${type})`,
      symbol: symbolInfo.symbol,
      strike,
      type,
      level
    };
  }).filter(Boolean);
  
  return {
    ce: ceSymbols,
    pe: peSymbols,
    atmStrike,
    openPrice
  };
}

/**
 * Get available expiry dates
 */
function getAvailableExpiryDates(indexType) {
  const mappedIndex = mapIndexNameForSymbol(indexType);
  const now = new Date();
  const dates = [];
  
  // Add weekly expiries for the next 3 weeks
  for (let i = 0; i < 3; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() + (i * 7));
    const expiry = getNextExpiryDate(mappedIndex, date);
    dates.push(formatDate(expiry));
  }
  
  // Add monthly expiry if not already included
  const monthlyExpiry = getNextMonthlyExpiry(now, mappedIndex);
  const monthlyExpiryStr = formatDate(monthlyExpiry);
  
  if (!dates.includes(monthlyExpiryStr)) {
    dates.push(monthlyExpiryStr);
  }
  
  return dates;
}

/**
 * Should show expiry selection
 */
function shouldShowExpirySelection(indexType) {
  // Only show expiry selection for indices that have multiple expiry options
  const mappedIndex = mapIndexNameForSymbol(indexType);
  return ['NIFTY', 'BANKNIFTY', 'SENSEX'].includes(mappedIndex);
}

/**
 * Get expiry dates for all indices
 */
function getExpiryDates() {
  const now = new Date();
  
  return {
    nifty: formatDate(getNextExpiryDate('NIFTY', now)),
    banknifty: formatDate(getNextExpiryDate('BANKNIFTY', now)),
    sensex: formatDate(getNextExpiryDate('SENSEX', now))
  };
}

/**
 * Get expiry for a specific index
 */
function getExpiryForIndex(index) {
  return formatDate(getNextExpiryDate(index));
}

/**
 * Get index config
 */
function getIndexConfig(indexName) {
  return INDEX_CONFIGS[indexName];
}

/**
 * Get all index configs
 */
function getAllIndexConfigs() {
  return Object.values(INDEX_CONFIGS);
}

/**
 * Get index names
 */
function getIndexNames() {
  return Object.keys(INDEX_CONFIGS);
}

/**
 * Calculate quantity from lots
 */
function calculateQuantityFromLots(indexName, lots) {
  const config = getIndexConfig(indexName);
  if (!config) {
    throw new Error(`Index configuration not found for: ${indexName}`);
  }
  return lots * config.lotSize;
}

/**
 * Calculate lots from quantity
 */
function calculateLotsFromQuantity(indexName, quantity) {
  const config = getIndexConfig(indexName);
  if (!config) {
    throw new Error(`Index configuration not found for: ${indexName}`);
  }
  return Math.floor(quantity / config.lotSize);
}

module.exports = {
  getIndexConfig,
  getAllIndexConfigs,
  getIndexNames,
  calculateQuantityFromLots,
  calculateLotsFromQuantity,
  generateStrikeSymbols,
  getAvailableExpiryDates,
  shouldShowExpirySelection,
  getExpiryDates,
  getExpiryForIndex
};
