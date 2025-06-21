const fs = require('fs');
const path = require('path');

class HolidayService {
  constructor() {
    // Indian stock market holidays for 2024-2025
    // Format: YYYY-MM-DD
    this.holidays = new Set([
      // 2024 Holidays
      '2024-01-26', // Republic Day
      '2024-03-08', // Holi
      '2024-03-25', // Holi (Holiday)
      '2024-03-29', // Good Friday
      '2024-04-11', // Id-Ul-Fitr
      '2024-04-14', // Dr. Baba Saheb Ambedkar Jayanti
      '2024-04-17', // Ram Navmi
      '2024-05-01', // Maharashtra Day
      '2024-08-15', // Independence Day
      '2024-08-26', // Janmashtami
      '2024-10-02', // Gandhi Jayanti
      '2024-10-12', // Dussehra
      '2024-11-01', // Diwali Laxmi Puja
      '2024-11-15', // Guru Nanak Jayanti
      '2024-12-25', // Christmas
      
      // 2025 Holidays
      '2025-01-26', // Republic Day
      '2025-02-26', // Holi
      '2025-03-14', // Holi
      '2025-03-31', // Id-Ul-Fitr (Ramadan)
      '2025-04-14', // Dr. Baba Saheb Ambedkar Jayanti
      '2025-04-18', // Good Friday
      '2025-05-01', // Maharashtra Day
      '2025-08-15', // Independence Day
      '2025-08-16', // Janmashtami
      '2025-10-02', // Gandhi Jayanti
      '2025-10-21', // Dussehra
      '2025-11-01', // Diwali Laxmi Puja
      '2025-11-05', // Guru Nanak Jayanti
      '2025-12-25'  // Christmas
    ]);
    
    console.log('🗓️ Holiday Service initialized with market holidays');
  }

  /**
   * Check if a given date is a market holiday
   */
  isHoliday(date) {
    const dateStr = this.formatDateForCheck(date);
    return this.holidays.has(dateStr);
  }

  /**
   * Check if market is open on a given date (not weekend, not holiday)
   */
  isMarketOpen(date) {
    const checkDate = new Date(date);
    const dayOfWeek = checkDate.getDay();
    
    // Check if it's a weekend (Saturday=6, Sunday=0)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false;
    }
    
    // Check if it's a holiday
    if (this.isHoliday(checkDate)) {
      return false;
    }
    
    return true;
  }

  /**
   * Get the next market day (excluding weekends and holidays)
   */
  getNextMarketDay(fromDate = new Date()) {
    const nextDay = new Date(fromDate);
    nextDay.setDate(nextDay.getDate() + 1);
    
    while (!this.isMarketOpen(nextDay)) {
      nextDay.setDate(nextDay.getDate() + 1);
      
      // Safety check - don't go more than 30 days ahead
      const daysDiff = Math.floor((nextDay - fromDate) / (1000 * 60 * 60 * 24));
      if (daysDiff > 30) {
        console.error('⚠️ Could not find next market day within 30 days');
        break;
      }
    }
    
    return nextDay;
  }

  /**
   * Get the previous market day (excluding weekends and holidays)
   */
  getPreviousMarketDay(fromDate = new Date()) {
    const prevDay = new Date(fromDate);
    prevDay.setDate(prevDay.getDate() - 1);
    
    while (!this.isMarketOpen(prevDay)) {
      prevDay.setDate(prevDay.getDate() - 1);
      
      // Safety check - don't go back more than 30 days
      const daysDiff = Math.floor((fromDate - prevDay) / (1000 * 60 * 60 * 24));
      if (daysDiff > 30) {
        console.error('⚠️ Could not find previous market day within 30 days');
        break;
      }
    }
    
    return prevDay;
  }

  /**
   * Get the last trading session date
   * If today is a trading day and market hours are over, return today
   * Otherwise, return the previous trading day
   */
  getLastTradingSessionDate() {
    const now = new Date();
    const timestampService = require('./timestampService');
    
    // Check if today is a trading day
    if (this.isMarketOpen(now)) {
      // If market is currently open, return today
      if (timestampService.isMarketOpen()) {
        return now;
      }
      
      // Market is closed but today is a trading day
      // Check if it's after market hours (after 3:30 PM)
      const istTime = timestampService.getCurrentIST();
      const currentTime = istTime.getHours() * 60 + istTime.getMinutes();
      const marketEndTime = 15 * 60 + 30; // 3:30 PM
      
      if (currentTime > marketEndTime) {
        // After market hours, return today as last trading session
        return now;
      } else {
        // Before market hours, return previous trading day
        return this.getPreviousMarketDay(now);
      }
    } else {
      // Today is not a trading day (weekend/holiday), return previous trading day
      return this.getPreviousMarketDay(now);
    }
  }

  /**
   * Check if cleanup should run today
   * Only run 5 minutes before market open (9:10 AM) on trading days
   */
  shouldRunCleanupToday() {
    const today = new Date();
    return this.isMarketOpen(today);
  }

  /**
   * Get time until next cleanup (in milliseconds)
   * Returns null if cleanup should not run
   */
  getTimeUntilNextCleanup() {
    if (!this.shouldRunCleanupToday()) {
      // Today is not a trading day, find next trading day
      const nextMarketDay = this.getNextMarketDay();
      const cleanupTime = new Date(nextMarketDay);
      cleanupTime.setHours(9, 10, 0, 0); // 9:10 AM
      
      return cleanupTime.getTime() - Date.now();
    } else {
      // Today is a trading day, check if cleanup time has passed
      const today = new Date();
      const cleanupTime = new Date(today);
      cleanupTime.setHours(9, 10, 0, 0); // 9:10 AM
      
      if (Date.now() < cleanupTime.getTime()) {
        // Cleanup time hasn't passed yet today
        return cleanupTime.getTime() - Date.now();
      } else {
        // Cleanup time has passed, schedule for next trading day
        const nextMarketDay = this.getNextMarketDay();
        const nextCleanupTime = new Date(nextMarketDay);
        nextCleanupTime.setHours(9, 10, 0, 0); // 9:10 AM
        
        return nextCleanupTime.getTime() - Date.now();
      }
    }
  }

  /**
   * Format date for holiday checking (YYYY-MM-DD)
   */
  formatDateForCheck(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Get market status information
   */
  getMarketStatus() {
    const now = new Date();
    const timestampService = require('./timestampService');
    const isMarketOpen = timestampService.isMarketOpen();
    const isTradingDay = this.isMarketOpen(now);
    const lastTradingSession = this.getLastTradingSessionDate();
    const nextTradingDay = this.getNextMarketDay();
    
    return {
      isMarketOpen,
      isTradingDay,
      isWeekend: now.getDay() === 0 || now.getDay() === 6,
      isHoliday: this.isHoliday(now),
      lastTradingSession: this.formatDateForCheck(lastTradingSession),
      nextTradingDay: this.formatDateForCheck(nextTradingDay),
      shouldRunCleanup: this.shouldRunCleanupToday(),
      timeUntilNextCleanup: this.getTimeUntilNextCleanup()
    };
  }
}

module.exports = new HolidayService(); 