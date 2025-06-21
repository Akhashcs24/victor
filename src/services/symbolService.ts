export interface StrikeSymbol {
  label: string;
  symbol: string;
  strike: number;
  type: 'ITM' | 'ATM' | 'OTM';
  level: number; // 1-5 for ITM/OTM, 0 for ATM
}

export interface StrikeSymbolsResult {
  ce: StrikeSymbol[];
  pe: StrikeSymbol[];
  atmStrike: number;
  openPrice: number;
}

export interface ExpiryDates {
  nifty: string;      // Weekly expiry (Thursday)
  banknifty: string;  // Monthly expiry (Last Thursday)
  sensex: string;     // Weekly expiry (Tuesday)
}

export class SymbolService {
  // Strike intervals for different indices (based on symbol_samples.md)
  private static readonly STRIKE_INTERVALS = {
    'NIFTY': 50,
    'BANKNIFTY': 100,
    'SENSEX': 100,
    'FINNIFTY': 50,
    'MIDCPNIFTY': 25
  };

  // Expiry types (based on Pine script and symbol_samples.md)
  private static readonly EXPIRY_TYPES = {
    'NIFTY': 'weekly',      // Weekly expiry (Thursday)
    'BANKNIFTY': 'monthly', // Monthly expiry (last Thursday)  
    'SENSEX': 'weekly',     // Weekly expiry (Tuesday)
    'FINNIFTY': 'monthly',  // Monthly expiry (last Thursday)
    'MIDCPNIFTY': 'monthly' // Monthly expiry (last Thursday)
  };

  // Exchange prefixes
  private static readonly EXCHANGES = {
    'NIFTY': 'NSE',
    'BANKNIFTY': 'NSE',
    'SENSEX': 'BSE',
    'FINNIFTY': 'NSE',
    'MIDCPNIFTY': 'NSE'
  };

  // Base symbols for options (different from index symbols)
  private static readonly BASE_SYMBOLS = {
    'NIFTY': 'NIFTY',
    'BANKNIFTY': 'BANKNIFTY', // Fixed: Use BANKNIFTY not NIFTYBANK
    'SENSEX': 'SENSEX',
    'FINNIFTY': 'FINNIFTY',
    'MIDCPNIFTY': 'MIDCPNIFTY'
  };

  // Predefined holidays for 2025 (from Pine script)
  private static readonly HOLIDAYS_2025 = [
    '2025-02-26', '2025-03-14', '2025-03-31', '2025-04-10', 
    '2025-04-14', '2025-04-18', '2025-05-01', '2025-08-15', 
    '2025-08-27', '2025-10-02', '2025-10-21', '2025-10-22', 
    '2025-11-05', '2025-12-25'
  ];

  /**
   * Map index name for symbol (NIFTYBANK -> BANKNIFTY)
   */
  private static mapIndexNameForSymbol(indexName: string): string {
    if (indexName === 'NIFTYBANK') return 'BANKNIFTY';
    return indexName;
  }

  /**
   * Check if a date is a holiday (weekend or predefined holiday)
   */
  private static isHoliday(date: Date): boolean {
    const dayOfWeek = date.getDay();
    
    // Check if weekend
    if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday = 0, Saturday = 6
      return true;
    }
    
    // Check predefined holidays
    const dateStr = this.formatDate(date);
    return this.HOLIDAYS_2025.includes(dateStr);
  }

  /**
   * Format date as YYYY-MM-DD
   */
  private static formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Adjust expiry date to previous working day if it's a holiday
   */
  private static adjustForHoliday(originalDate: Date): Date {
    let adjustedDate = new Date(originalDate);
    
    while (this.isHoliday(adjustedDate)) {
      adjustedDate.setDate(adjustedDate.getDate() - 1);
    }
    
    return adjustedDate;
  }

  /**
   * Get last weekday of month (based on Pine script logic)
   */
  private static getLastWeekdayInMonth(year: number, month: number, weekday: number): Date {
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
   * Get next weekday for weekly expiry (based on Pine script logic)
   */
  private static getNextWeekday(currentDate: Date, weekday: number): Date {
    const currentDayOfWeek = currentDate.getDay();
    const offset = weekday >= currentDayOfWeek ? weekday - currentDayOfWeek : 7 - (currentDayOfWeek - weekday);
    const nextWeekday = new Date(currentDate);
    nextWeekday.setDate(currentDate.getDate() + offset);
    return nextWeekday;
  }

  /**
   * Get next weekly expiry (Thursday for NIFTY, Tuesday for SENSEX)
   */
  private static getNextWeeklyExpiry(currentDate: Date, indexName: string): Date {
    const weekday = indexName === 'SENSEX' ? 2 : 4; // Tuesday = 2, Thursday = 4
    let nextExpiry = this.getNextWeekday(currentDate, weekday);
    
    // If today is the expiry day and market has closed (after 3:30 PM), move to next week
    if (currentDate.getDay() === weekday && currentDate.getHours() >= 15 && currentDate.getMinutes() >= 30) {
      nextExpiry.setDate(nextExpiry.getDate() + 7);
    }
    
    // Adjust for holidays
    return this.adjustForHoliday(nextExpiry);
  }

  /**
   * Get next monthly expiry (last Thursday for NSE, last Tuesday for BSE)
   */
  private static getNextMonthlyExpiry(currentDate: Date, indexName: string): Date {
    const weekday = indexName === 'SENSEX' ? 2 : 4; // Tuesday = 2, Thursday = 4
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Get this month's expiry
    let thisMonthExpiry = this.getLastWeekdayInMonth(year, month, weekday);
    thisMonthExpiry = this.adjustForHoliday(thisMonthExpiry);
    
    // If current date is before this month's expiry, use it
    if (currentDate < thisMonthExpiry || 
        (currentDate.getTime() === thisMonthExpiry.getTime() && currentDate.getHours() < 15)) {
      return thisMonthExpiry;
    }
    
    // Otherwise, get next month's expiry
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    
    let nextMonthExpiry = this.getLastWeekdayInMonth(nextYear, nextMonth, weekday);
    return this.adjustForHoliday(nextMonthExpiry);
  }

  /**
   * Calculate next expiry date based on expiry type
   */
  private static getNextExpiryDate(indexName: string, currentDate: Date = new Date()): Date {
    const mappedIndex = this.mapIndexNameForSymbol(indexName);
    const expiryType = this.EXPIRY_TYPES[mappedIndex as keyof typeof this.EXPIRY_TYPES] || 'weekly';

    if (expiryType === 'weekly') {
      return this.getNextWeeklyExpiry(currentDate, mappedIndex);
    } else {
      return this.getNextMonthlyExpiry(currentDate, mappedIndex);
    }
  }

  /**
   * Format expiry date for symbol
   */
  private static formatExpiryForSymbol(expiryDate: Date, expiryType: string, indexName: string = ''): string {
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
  private static getNearestStrike(currentPrice: number, strikeInterval: number): number {
    return Math.round(currentPrice / strikeInterval) * strikeInterval;
  }

  /**
   * Get ATM (At The Money) strike based on market open price
   */
  private static getATMStrike(indexName: string, openPrice: number): number {
    const mappedIndex = this.mapIndexNameForSymbol(indexName);
    const interval = this.STRIKE_INTERVALS[mappedIndex as keyof typeof this.STRIKE_INTERVALS] || 50;
    
    // Handle null/undefined openPrice with fallback values
    if (!openPrice || isNaN(openPrice)) {
      console.log(`⚠️ Invalid openPrice (${openPrice}) for ${mappedIndex}, using fallback strike`);
      const fallbackStrikes = {
        'NIFTY': 24800,
        'BANKNIFTY': 55600,
        'SENSEX': 81400
      };
      const fallbackPrice = fallbackStrikes[mappedIndex as keyof typeof fallbackStrikes] || 25000;
      console.log(`📊 Using fallback open price ${fallbackPrice} for ${mappedIndex}`);
      return this.getNearestStrike(fallbackPrice, interval);
    }
    
    return this.getNearestStrike(openPrice, interval);
  }

  /**
   * Create option symbol
   */
  private static createOptionSymbol(
    indexName: string, 
    strike: number, 
    optionType: 'CE' | 'PE', 
    openPrice: number | null = null, 
    currentDate: Date = new Date()
  ): { symbol: string; strike: number; expiry: string; expiryDisplay: string; optionType: string; indexName: string; exchange: string } | null {
    try {
      const mappedIndex = this.mapIndexNameForSymbol(indexName);
      const exchange = this.EXCHANGES[mappedIndex as keyof typeof this.EXCHANGES] || 'NSE';
      const expiryType = this.EXPIRY_TYPES[mappedIndex as keyof typeof this.EXPIRY_TYPES] || 'weekly';
      
      // Calculate expiry
      const expiryDate = this.getNextExpiryDate(mappedIndex, currentDate);
      const expiryString = this.formatExpiryForSymbol(expiryDate, expiryType, mappedIndex);
      
      // Determine strike price
      let strikePrice: number;
      if (strike === 0 && openPrice) {
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
        strikePrice = defaultStrikes[mappedIndex as keyof typeof defaultStrikes] || 25000;
      }
      
      const baseSymbol = this.BASE_SYMBOLS[mappedIndex as keyof typeof this.BASE_SYMBOLS] || 'NIFTY';
      
      // Create symbol: EXCHANGE:INDEX + EXPIRY + STRIKE + CE/PE
      const symbol = `${exchange}:${baseSymbol}${expiryString}${strikePrice}${optionType}`;
      
      console.log(`📋 Created option symbol: ${symbol} (Index: ${mappedIndex}, Strike: ${strikePrice}, Expiry: ${this.formatDate(expiryDate)})`);
      
      return {
        symbol,
        strike: strikePrice,
        expiry: this.formatDate(expiryDate),
        expiryDisplay: expiryDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        optionType,
        indexName: mappedIndex,
        exchange
      };
      
    } catch (error) {
      console.error(`❌ Error creating option symbol for ${indexName}:`, error);
      return null;
    }
  }

  /**
   * Generate strike symbols for CE and PE options
   */
  static fixedSymbolService (
    indexType: string,
    openPrice: number,
    expiryDate?: string
  ): StrikeSymbolsResult {
    const mappedIndex = this.mapIndexNameForSymbol(indexType);
    const atmStrike = this.getATMStrike(mappedIndex, openPrice);
    const interval = this.STRIKE_INTERVALS[mappedIndex as keyof typeof this.STRIKE_INTERVALS] || 50;
    
    // Use provided expiry date or calculate next expiry
    const currentDate = expiryDate ? new Date(expiryDate) : new Date();
    const expiryDateObj = expiryDate ? new Date(expiryDate) : this.getNextExpiryDate(mappedIndex, currentDate);
    const expiryType = this.EXPIRY_TYPES[mappedIndex as keyof typeof this.EXPIRY_TYPES] || 'weekly';
    const expiryString = this.formatExpiryForSymbol(expiryDateObj, expiryType, mappedIndex);
    
    const exchange = this.EXCHANGES[mappedIndex as keyof typeof this.EXCHANGES] || 'NSE';
    const baseSymbol = this.BASE_SYMBOLS[mappedIndex as keyof typeof this.BASE_SYMBOLS] || 'NIFTY';

    const ce: StrikeSymbol[] = [];
    const pe: StrikeSymbol[] = [];

    // Generate 5 ITM strikes (lower strikes for CE)
    for (let i = 5; i >= 1; i--) {
      const strike = atmStrike - (i * interval);
      const ceSymbol = `${exchange}:${baseSymbol}${expiryString}${strike}CE`;
      const peSymbol = `${exchange}:${baseSymbol}${expiryString}${strike}PE`;

      ce.push({
        label: `ITM ${i} - ${ceSymbol}`,
        symbol: ceSymbol,
        strike,
        type: 'ITM',
        level: i
      });

      pe.push({
        label: `OTM ${i} - ${peSymbol}`,
        symbol: peSymbol,
        strike,
        type: 'OTM',
        level: i
      });
    }

    // Add ATM strike
    const atmCeSymbol = `${exchange}:${baseSymbol}${expiryString}${atmStrike}CE`;
    const atmPeSymbol = `${exchange}:${baseSymbol}${expiryString}${atmStrike}PE`;

    ce.push({
      label: `ATM - ${atmCeSymbol}`,
      symbol: atmCeSymbol,
      strike: atmStrike,
      type: 'ATM',
      level: 0
    });

    pe.push({
      label: `ATM - ${atmPeSymbol}`,
      symbol: atmPeSymbol,
      strike: atmStrike,
      type: 'ATM',
      level: 0
    });

    // Generate 5 OTM strikes (higher strikes for CE)
    for (let i = 1; i <= 5; i++) {
      const strike = atmStrike + (i * interval);
      const ceSymbol = `${exchange}:${baseSymbol}${expiryString}${strike}CE`;
      const peSymbol = `${exchange}:${baseSymbol}${expiryString}${strike}PE`;

      ce.push({
        label: `OTM ${i} - ${ceSymbol}`,
        symbol: ceSymbol,
        strike,
        type: 'OTM',
        level: i
      });

      pe.push({
        label: `ITM ${i} - ${peSymbol}`,
        symbol: peSymbol,
        strike,
        type: 'ITM',
        level: i
      });
    }

    return {
      ce,
      pe,
      atmStrike,
      openPrice
    };
  }

  /**
   * Get available expiry dates based on index type
   */
  static getAvailableExpiryDates(indexType: string): string[] {
    const today = new Date();
    const mappedIndex = this.mapIndexNameForSymbol(indexType);
    const expiryType = this.EXPIRY_TYPES[mappedIndex as keyof typeof this.EXPIRY_TYPES] || 'weekly';
    
    if (expiryType === 'weekly') {
      // For weekly expiry (NIFTY, SENSEX), return current expiry and next few weekly expiries
      const expiries: string[] = [];
      
      // Get current expiry
      const currentExpiry = this.getNextExpiryDate(mappedIndex, today);
      expiries.push(this.formatDate(currentExpiry));
      
      // Add next 3 weekly expiries
      let nextDate = new Date(currentExpiry);
      for (let i = 0; i < 3; i++) {
        nextDate.setDate(nextDate.getDate() + 7); // Add 7 days
        expiries.push(this.formatDate(nextDate));
      }
      
      return expiries;
    } else {
      // For monthly expiry (BANKNIFTY, FINNIFTY, MIDCPNIFTY), return current expiry
      const currentExpiry = this.getNextExpiryDate(mappedIndex, today);
      return [this.formatDate(currentExpiry)];
    }
  }

  /**
   * Check if expiry selection should be shown for the given index
   */
  static shouldShowExpirySelection(indexType: string): boolean {
    const mappedIndex = this.mapIndexNameForSymbol(indexType);
    const expiryType = this.EXPIRY_TYPES[mappedIndex as keyof typeof this.EXPIRY_TYPES] || 'weekly';
    
    // Show expiry selection for weekly expiry indices (NIFTY, SENSEX)
    return expiryType === 'weekly';
  }

  /**
   * Get expiry dates for all indices
   */
  static getExpiryDates(): ExpiryDates {
    const today = new Date();
    
    return {
      nifty: this.formatDate(this.getNextExpiryDate('NIFTY', today)),
      banknifty: this.formatDate(this.getNextExpiryDate('BANKNIFTY', today)),
      sensex: this.formatDate(this.getNextExpiryDate('SENSEX', today))
    };
  }

  /**
   * Get expiry date for a specific index
   */
  static getExpiryForIndex(index: 'NIFTY' | 'BANKNIFTY' | 'SENSEX'): string {
    const today = new Date();
    const expiryDate = this.getNextExpiryDate(index, today);
    return this.formatDate(expiryDate);
  }
} 