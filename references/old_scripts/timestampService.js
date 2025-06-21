const fs = require('fs');
const path = require('path');

class TimestampService {
  constructor() {
    this.marketStartHour = 9;
    this.marketStartMinute = 15;
    this.marketEndHour = 15;
    this.marketEndMinute = 30;
  }

  // Get current time in IST
  getCurrentIST() {
    const now = new Date();
    
    // Check if we're already in IST timezone (UTC+05:30)
    const localOffset = now.getTimezoneOffset(); // offset in minutes
    const istOffset = -330; // IST is UTC+05:30, which is -330 minutes from UTC
    
    if (Math.abs(localOffset - istOffset) < 30) {
      // We're already in IST timezone (or very close), return local time
      return now;
    } else {
      // Convert to IST from current timezone
      const istOffsetMs = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      return new Date(utc + istOffsetMs);
    }
  }

  // Check if market is currently open
  isMarketOpen() {
    const istTime = this.getCurrentIST();
    const currentTime = istTime.getHours() * 60 + istTime.getMinutes();
    const dayOfWeek = istTime.getDay();
    
    const marketStart = this.marketStartHour * 60 + this.marketStartMinute;
    const marketEnd = this.marketEndHour * 60 + this.marketEndMinute;
    
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    const isMarketHours = currentTime >= marketStart && currentTime <= marketEnd;
    
    return isWeekday && isMarketHours;
  }

  // Get the next valid market timestamp based on current context
  getNextMarketTimestamp(indexSymbol, lastKnownTimestamp = null) {
    const istTime = this.getCurrentIST();
    const isMarketCurrentlyOpen = this.isMarketOpen();

    if (!isMarketCurrentlyOpen) {
      // Market is closed - should not generate new timestamps for real-time data
      console.log(`⚠️ Market closed - not generating real-time timestamps`);
      return null;
    }

    // Market is open - generate appropriate timestamp
    if (lastKnownTimestamp) {
      // Continue from where we left off, but within market hours
      return this.getNextSequentialMarketTimestamp(lastKnownTimestamp);
    } else {
      // Start from current market time or market open (whichever is appropriate)
      return this.getCurrentMarketTimestamp();
    }
  }

  // Get current market timestamp (only during market hours)
  getCurrentMarketTimestamp() {
    const istTime = this.getCurrentIST();
    
    if (!this.isMarketOpen()) {
      return null;
    }

    // Round to nearest minute for consistency
    istTime.setSeconds(0);
    istTime.setMilliseconds(0);
    
    return istTime;
  }

  // Get next sequential market timestamp (1 minute intervals)
  getNextSequentialMarketTimestamp(lastTimestamp) {
    const nextTimestamp = new Date(lastTimestamp);
    nextTimestamp.setMinutes(nextTimestamp.getMinutes() + 1);
    
    // Check if still within market hours
    const nextTime = nextTimestamp.getHours() * 60 + nextTimestamp.getMinutes();
    const marketEnd = this.marketEndHour * 60 + this.marketEndMinute;
    
    if (nextTime > marketEnd) {
      // Beyond market hours
      console.log(`⚠️ Next timestamp would be beyond market hours`);
      return null;
    }
    
    return nextTimestamp;
  }

  // Get market start timestamp for a given date
  getMarketStartTimestamp(date = null) {
    const targetDate = date || this.getCurrentIST();
    const marketStart = new Date(targetDate);
    marketStart.setHours(this.marketStartHour, this.marketStartMinute, 0, 0);
    return marketStart;
  }

  // Get market end timestamp for a given date
  getMarketEndTimestamp(date = null) {
    const targetDate = date || this.getCurrentIST();
    const marketEnd = new Date(targetDate);
    marketEnd.setHours(this.marketEndHour, this.marketEndMinute, 0, 0);
    return marketEnd;
  }

  // Generate all market timestamps for a given date
  generateMarketTimestampsForDate(date) {
    const timestamps = [];
    const startTime = this.getMarketStartTimestamp(date);
    const endTime = this.getMarketEndTimestamp(date);
    
    const current = new Date(startTime);
    while (current <= endTime) {
      timestamps.push(new Date(current));
      current.setMinutes(current.getMinutes() + 1);
    }
    
    return timestamps;
  }

  // Get the last stored timestamp for an index
  async getLastStoredTimestamp(indexSymbol) {
    try {
      const istTime = this.getCurrentIST().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' });
      const today = istTime.split(' ')[0];
      const futuresFile = path.join(__dirname, '../data', `${indexSymbol}_FUTURES_${today}.csv`);
      
      if (!fs.existsSync(futuresFile)) {
        return null;
      }

      const data = fs.readFileSync(futuresFile, 'utf8');
      const lines = data.trim().split('\n');
      
      if (lines.length <= 1) {
        return null; // Only header or empty
      }

      // Get last line and extract timestamp
      const lastLine = lines[lines.length - 1];
      const timestamp = lastLine.split(',')[0].trim();
      
      return new Date(timestamp);
    } catch (error) {
      console.error(`Error getting last timestamp for ${indexSymbol}:`, error);
      return null;
    }
  }

  // Determine what type of timestamp to use based on context
  async getTimestampForDataCollection(indexSymbol, dataSource = 'realtime') {
    const isMarketCurrentlyOpen = this.isMarketOpen();

    switch (dataSource) {
      case 'realtime':
        if (!isMarketCurrentlyOpen) {
          console.log(`⚠️ Cannot collect real-time data - market is closed`);
          return null;
        }
        
        // Get last stored timestamp and generate next one
        const lastTimestamp = await this.getLastStoredTimestamp(indexSymbol);
        return this.getNextMarketTimestamp(indexSymbol, lastTimestamp);

      case 'historical':
        // For historical data, use the timestamp from the API response
        // This method should be called with the actual historical timestamp
        return null; // Historical timestamps come from API

      case 'backfill':
        // For backfilling, generate missing timestamps within market hours
        const today = this.getCurrentIST();
        return this.generateMarketTimestampsForDate(today);

      default:
        console.log(`⚠️ Unknown data source: ${dataSource}`);
        return null;
    }
  }

  // Validate if a timestamp is within market hours
  isTimestampInMarketHours(timestamp) {
    const date = new Date(timestamp);
    const time = date.getHours() * 60 + date.getMinutes();
    const dayOfWeek = date.getDay();
    
    const marketStart = this.marketStartHour * 60 + this.marketStartMinute;
    const marketEnd = this.marketEndHour * 60 + this.marketEndMinute;
    
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    const isMarketHours = time >= marketStart && time <= marketEnd;
    
    return isWeekday && isMarketHours;
  }

  // Format timestamp for CSV storage
  formatTimestampForStorage(timestamp) {
    if (!timestamp) return null;
    
    // Ensure it's a Date object
    const date = new Date(timestamp);
    
    // Format as IST using toLocaleString and then convert to ISO format
    const istTime = date.toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' });
    return istTime.replace(' ', 'T') + '.000+05:30';
  }

  // Get status information
  getStatus() {
    const istTime = this.getCurrentIST();
    const isOpen = this.isMarketOpen();
    const marketStart = this.getMarketStartTimestamp();
    const marketEnd = this.getMarketEndTimestamp();

    return {
      currentTime: this.formatTimestampForStorage(istTime),
      marketOpen: isOpen,
      marketStartToday: this.formatTimestampForStorage(marketStart),
      marketEndToday: this.formatTimestampForStorage(marketEnd),
      message: isOpen ? 'Market is OPEN - Real-time collection enabled' : 'Market is CLOSED - Historical mode only'
    };
  }

  // Get the last market day (excluding weekends and holidays)
  getLastMarketDay() {
    const istTime = this.getCurrentIST();
    const now = new Date(istTime);
    
    // Start with yesterday if today is a market day and market is closed
    // or start with today if today is not a market day
    let checkDate = new Date(now);
    
    if (this.isMarketOpen()) {
      // Market is currently open, so last market day is today
      return checkDate;
    }
    
    // Market is closed, find the last actual market day
    while (true) {
      const dayOfWeek = checkDate.getDay();
      
      // Check if it's a weekday (Monday=1 to Friday=5)
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        // Check if it's not a holiday
        const holidayService = require('./holidayService');
        if (holidayService.isMarketOpen(checkDate)) {
          return checkDate;
        }
      }
      
      // Go to previous day
      checkDate.setDate(checkDate.getDate() - 1);
      
      // Safety check - don't go back more than 10 days
      const daysDiff = Math.floor((now - checkDate) / (1000 * 60 * 60 * 24));
      if (daysDiff > 10) {
        console.log('⚠️ Could not find a market day within 10 days, returning 3 days ago');
        const fallback = new Date(now);
        fallback.setDate(now.getDate() - 3);
        return fallback;
      }
    }
  }
}

module.exports = new TimestampService(); 