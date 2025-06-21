const moment = require('moment-timezone');

class SymbolCreatorService {
  constructor() {
    // Strike intervals for different indices (based on symbol_samples.md)
    this.strikeIntervals = {
      'NIFTY': 50,
      'BANKNIFTY': 100,
      'SENSEX': 100,
      'FINNIFTY': 50,
      'MIDCPNIFTY': 25
    };

    // Expiry types (based on Pine script)
    this.expiryTypes = {
      'NIFTY': 'weekly',      // Weekly expiry (Thursday)
      'BANKNIFTY': 'monthly', // Monthly expiry (last Thursday)  
      'SENSEX': 'weekly',     // Weekly expiry (Tuesday)
      'FINNIFTY': 'monthly',  // Monthly expiry (last Thursday)
      'MIDCPNIFTY': 'monthly' // Monthly expiry (last Thursday)
    };

    // Exchange prefixes
    this.exchanges = {
      'NIFTY': 'NSE',
      'BANKNIFTY': 'NSE',
      'SENSEX': 'BSE',
      'FINNIFTY': 'NSE',
      'MIDCPNIFTY': 'NSE'
    };
  }

  mapIndexNameForSymbol(indexName) {
    if (indexName === 'NIFTYBANK') return 'BANKNIFTY';
    return indexName;
  }

  /**
   * Get the nearest strike price based on the current price and strike interval
   */
  getNearestStrike(currentPrice, strikeInterval) {
    return Math.round(currentPrice / strikeInterval) * strikeInterval;
  }

  /**
   * Get ATM (At The Money) strike based on market open price
   */
  getATMStrike(indexName, openPrice) {
    const mappedIndex = this.mapIndexNameForSymbol(indexName);
    const interval = this.strikeIntervals[mappedIndex] || 50;
    
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
      return this.getNearestStrike(fallbackPrice, interval);
    }
    
    return this.getNearestStrike(openPrice, interval);
  }

  /**
   * Get ITM (In The Money) strikes
   */
  getITMStrikes(indexName, atmStrike, count = 2) {
    const mappedIndex = this.mapIndexNameForSymbol(indexName);
    const interval = this.strikeIntervals[mappedIndex] || 50;
    const strikes = [];
    
    for (let i = 1; i <= count; i++) {
      strikes.push({
        call: atmStrike - (interval * i), // ITM Call (lower strike)
        put: atmStrike + (interval * i)   // ITM Put (higher strike)
      });
    }
    
    return strikes;
  }

  /**
   * Get OTM (Out of The Money) strikes
   */
  getOTMStrikes(indexName, atmStrike, count = 2) {
    const mappedIndex = this.mapIndexNameForSymbol(indexName);
    const interval = this.strikeIntervals[mappedIndex] || 50;
    const strikes = [];
    
    for (let i = 1; i <= count; i++) {
      strikes.push({
        call: atmStrike + (interval * i), // OTM Call (higher strike)
        put: atmStrike - (interval * i)   // OTM Put (lower strike)
      });
    }
    
    return strikes;
  }

  /**
   * Calculate next expiry date based on expiry type
   */
  getNextExpiryDate(indexName, currentDate = null) {
    const mappedIndex = this.mapIndexNameForSymbol(indexName);
    const now = currentDate ? moment(currentDate).tz('Asia/Kolkata') : moment().tz('Asia/Kolkata');
    const expiryType = this.expiryTypes[mappedIndex] || 'weekly';

    if (expiryType === 'weekly') {
      return this.getNextWeeklyExpiry(now, mappedIndex);
    } else {
      return this.getNextMonthlyExpiry(now, mappedIndex);
    }
  }

  /**
   * Check if a date is a holiday (weekend or predefined holiday)
   */
  isHoliday(date) {
    const dayOfWeek = date.day();
    
    // Check if weekend
    if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday = 0, Saturday = 6
      return true;
    }
    
    // Predefined holidays for 2025 (from Pine script)
    const holidays2025 = [
      '2025-02-26', '2025-03-14', '2025-03-31', '2025-04-10', 
      '2025-04-14', '2025-04-18', '2025-05-01', '2025-08-15', 
      '2025-08-27', '2025-10-02', '2025-10-21', '2025-10-22', 
      '2025-11-05', '2025-12-25'
    ];
    
    const dateStr = date.format('YYYY-MM-DD');
    return holidays2025.includes(dateStr);
  }

  /**
   * Adjust expiry date to previous working day if it's a holiday
   */
  adjustForHoliday(originalDate) {
    let adjustedDate = originalDate.clone();
    
    while (this.isHoliday(adjustedDate)) {
      adjustedDate.subtract(1, 'day');
    }
    
    return adjustedDate;
  }

  /**
   * Get last weekday of month (based on Pine script logic)
   */
  getLastWeekdayInMonth(year, month, weekday) {
    // Create last day of the month (month is 0-indexed in moment)
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    const lastDay = moment.tz(`${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-01`, 'Asia/Kolkata').subtract(1, 'day');
    const lastDayOfWeek = lastDay.day();
    
    // Calculate offset to get to the desired weekday
    const offset = lastDayOfWeek >= weekday ? lastDayOfWeek - weekday : lastDayOfWeek + 7 - weekday;
    const lastWeekday = lastDay.clone().subtract(offset, 'days');
    
    return lastWeekday;
  }

  /**
   * Get next weekday for weekly expiry (based on Pine script logic)
   */
  getNextWeekday(currentDate, weekday) {
    const currentDayOfWeek = currentDate.day();
    const offset = weekday >= currentDayOfWeek ? weekday - currentDayOfWeek : 7 - (currentDayOfWeek - weekday);
    return currentDate.clone().add(offset, 'days');
  }

  /**
   * Get next weekly expiry (Thursday for NIFTY, Tuesday for SENSEX)
   */
  getNextWeeklyExpiry(currentDate, indexName) {
    const weekday = indexName === 'SENSEX' ? 2 : 4; // Tuesday = 2, Thursday = 4
    let nextExpiry = this.getNextWeekday(currentDate, weekday);
    
    // If today is the expiry day and market has closed (after 3:30 PM), move to next week
    if (currentDate.day() === weekday && currentDate.hour() >= 15 && currentDate.minute() >= 30) {
      nextExpiry.add(7, 'days');
    }
    
    // Adjust for holidays
    return this.adjustForHoliday(nextExpiry);
  }

  /**
   * Get next monthly expiry (last Thursday for NSE, last Tuesday for BSE)
   */
  getNextMonthlyExpiry(currentDate, indexName) {
    const weekday = indexName === 'SENSEX' ? 2 : 4; // Tuesday = 2, Thursday = 4
    const year = currentDate.year();
    const month = currentDate.month();
    
    // Get this month's expiry
    let thisMonthExpiry = this.getLastWeekdayInMonth(year, month, weekday);
    thisMonthExpiry = this.adjustForHoliday(thisMonthExpiry);
    
    // If current date is before this month's expiry, use it
    if (currentDate.isBefore(thisMonthExpiry) || 
        (currentDate.isSame(thisMonthExpiry, 'day') && currentDate.hour() < 15)) {
      return thisMonthExpiry;
    }
    
    // Otherwise, get next month's expiry
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    
    let nextMonthExpiry = this.getLastWeekdayInMonth(nextYear, nextMonth, weekday);
    return this.adjustForHoliday(nextMonthExpiry);
  }

  /**
   * Format expiry date for symbol
   */
  formatExpiryForSymbol(expiryDate, expiryType, indexName = null) {
    const year = expiryDate.format('YY');
    if (indexName === 'BANKNIFTY') {
      // BANKNIFTY: YYMMM (no day)
      const month = expiryDate.format('MMM').toUpperCase();
      return `${year}${month}`;
    }
    if (expiryType === 'weekly') {
      // Weekly: YYMDD (25619 for 19th June 2025)
      const month = expiryDate.format('M');
      const day = expiryDate.format('DD');
      return `${year}${month}${day}`;
    } else {
      // Monthly: YYMMMDD (25JUN19 for 19th June 2025)
      const month = expiryDate.format('MMM').toUpperCase();
      const day = expiryDate.format('DD');
      return `${year}${month}${day}`;
    }
  }

  /**
   * Create option symbol
   */
  createOptionSymbol(indexName, strike, optionType, openPrice = null, currentDate = null) {
    try {
      const mappedIndex = this.mapIndexNameForSymbol(indexName);
      const exchange = this.exchanges[mappedIndex] || 'NSE';
      const expiryType = this.expiryTypes[mappedIndex] || 'weekly';
      
      // Calculate expiry
      const expiryDate = this.getNextExpiryDate(mappedIndex, currentDate);
      const expiryString = this.formatExpiryForSymbol(expiryDate, expiryType, mappedIndex);
      
      // Determine strike price
      let strikePrice;
      if (strike === 'ATM' && openPrice) {
        strikePrice = this.getATMStrike(mappedIndex, openPrice);
      } else if (typeof strike === 'number') {
        strikePrice = strike;
      } else {
        // Default to a reasonable strike if no open price available
        const defaultStrikes = {
          'NIFTY': 24750,
          'BANKNIFTY': 55500,
          'SENSEX': 81000
        };
        strikePrice = defaultStrikes[mappedIndex] || 25000;
      }
      
      // Create symbol: EXCHANGE:INDEX + EXPIRY + STRIKE + CE/PE
      const symbol = `${exchange}:${mappedIndex}${expiryString}${strikePrice}${optionType}`;
      
      console.log(`📋 Created option symbol: ${symbol} (Index: ${mappedIndex}, Strike: ${strikePrice}, Expiry: ${expiryDate.format('DD-MMM-YYYY')})`);
      
      return {
        symbol,
        strike: strikePrice,
        expiry: expiryDate.format('YYYY-MM-DD'),
        expiryDisplay: expiryDate.format('DD-MMM-YYYY'),
        optionType,
        indexName: mappedIndex,
        exchange
      };
      
    } catch (error) {
      console.error(`❌ Error creating option symbol for ${mappedIndex}:`, error);
      return null;
    }
  }

  /**
   * Create multiple option symbols for different strikes
   */
  createOptionChain(indexName, openPrice, currentDate = null) {
    try {
      const atmStrike = this.getATMStrike(indexName, openPrice);
      const itmStrikes = this.getITMStrikes(indexName, atmStrike, 2);
      const otmStrikes = this.getOTMStrikes(indexName, atmStrike, 2);
      
      const chain = {
        atm: {
          call: this.createOptionSymbol(indexName, atmStrike, 'CE', openPrice, currentDate),
          put: this.createOptionSymbol(indexName, atmStrike, 'PE', openPrice, currentDate)
        },
        itm: [],
        otm: []
      };
      
      // Add ITM strikes
      itmStrikes.forEach((strikes, index) => {
        chain.itm.push({
          level: index + 1,
          call: this.createOptionSymbol(indexName, strikes.call, 'CE', openPrice, currentDate),
          put: this.createOptionSymbol(indexName, strikes.put, 'PE', openPrice, currentDate)
        });
      });
      
      // Add OTM strikes
      otmStrikes.forEach((strikes, index) => {
        chain.otm.push({
          level: index + 1,
          call: this.createOptionSymbol(indexName, strikes.call, 'CE', openPrice, currentDate),
          put: this.createOptionSymbol(indexName, strikes.put, 'PE', openPrice, currentDate)
        });
      });
      
      return chain;
      
    } catch (error) {
      console.error(`❌ Error creating option chain for ${indexName}:`, error);
      return null;
    }
  }

  /**
   * Get symbol for a specific strike type (ATM, ITM1-5, OTM1-5)
   * ITM for CE = lower strikes, OTM for CE = higher strikes
   * ITM for PE = higher strikes, OTM for PE = lower strikes
   */
  getSymbolForStrikeType(indexName, strikeType, openPrice, optionType = 'CE', currentDate = null) {
    try {
      const mappedIndex = this.mapIndexNameForSymbol(indexName);
      const atmStrike = this.getATMStrike(mappedIndex, openPrice);
      const interval = this.strikeIntervals[mappedIndex] || 50;
      
      let targetStrike = atmStrike;
      
      console.log(`🎯 Strike calculation for ${mappedIndex} ${strikeType} ${optionType}: ATM=${atmStrike}, Interval=${interval}`);
      
      switch (strikeType) {
        case 'ATM':
          targetStrike = atmStrike;
          break;
        // ITM strikes
        case 'ITM1':
          targetStrike = optionType === 'CE' ? atmStrike - interval : atmStrike + interval;
          break;
        case 'ITM2':
          targetStrike = optionType === 'CE' ? atmStrike - (interval * 2) : atmStrike + (interval * 2);
          break;
        case 'ITM3':
          targetStrike = optionType === 'CE' ? atmStrike - (interval * 3) : atmStrike + (interval * 3);
          break;
        case 'ITM4':
          targetStrike = optionType === 'CE' ? atmStrike - (interval * 4) : atmStrike + (interval * 4);
          break;
        case 'ITM5':
          targetStrike = optionType === 'CE' ? atmStrike - (interval * 5) : atmStrike + (interval * 5);
          break;
        // OTM strikes
        case 'OTM1':
          targetStrike = optionType === 'CE' ? atmStrike + interval : atmStrike - interval;
          break;
        case 'OTM2':
          targetStrike = optionType === 'CE' ? atmStrike + (interval * 2) : atmStrike - (interval * 2);
          break;
        case 'OTM3':
          targetStrike = optionType === 'CE' ? atmStrike + (interval * 3) : atmStrike - (interval * 3);
          break;
        case 'OTM4':
          targetStrike = optionType === 'CE' ? atmStrike + (interval * 4) : atmStrike - (interval * 4);
          break;
        case 'OTM5':
          targetStrike = optionType === 'CE' ? atmStrike + (interval * 5) : atmStrike - (interval * 5);
          break;
        default:
          targetStrike = atmStrike;
      }
      
      console.log(`✅ Calculated strike for ${strikeType} ${optionType}: ${targetStrike} (ATM: ${atmStrike})`);
      
      return this.createOptionSymbol(mappedIndex, targetStrike, optionType, openPrice, currentDate);
      
    } catch (error) {
      console.error(`❌ Error getting symbol for strike type ${strikeType}:`, error);
      return null;
    }
  }
}

module.exports = new SymbolCreatorService(); 