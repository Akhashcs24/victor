export class MarketService {
  /**
   * Check if the market is currently open
   * NSE/BSE market hours: 9:15 AM to 3:30 PM IST (Monday to Friday)
   */
  static isMarketOpen(): boolean {
    const now = new Date();
    
    // Convert to IST (UTC+5:30)
    const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    
    // Check if it's a weekday (Monday = 1, Friday = 5)
    const dayOfWeek = istTime.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false; // Weekend
    }
    
    // Check market hours (9:15 AM to 3:30 PM IST)
    const hours = istTime.getHours();
    const minutes = istTime.getMinutes();
    const currentTime = hours * 60 + minutes; // Convert to minutes since midnight
    
    const marketOpen = 9 * 60 + 15;  // 9:15 AM
    const marketClose = 15 * 60 + 30; // 3:30 PM
    
    return currentTime >= marketOpen && currentTime <= marketClose;
  }
  
  /**
   * Get the appropriate data fetch interval based on market status
   */
  static getDataFetchInterval(): number {
    return this.isMarketOpen() ? 5000 : 0; // 5 seconds if open, 0 if closed (no interval)
  }
  
  /**
   * Get market status information
   */
  static getMarketStatus(): {
    isOpen: boolean;
    status: 'OPEN' | 'CLOSED' | 'PRE_MARKET' | 'POST_MARKET';
    nextOpenTime?: Date;
    timeToOpen?: string;
  } {
    const now = new Date();
    const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    const dayOfWeek = istTime.getDay();
    const hours = istTime.getHours();
    const minutes = istTime.getMinutes();
    const currentTime = hours * 60 + minutes;
    
    const marketOpen = 9 * 60 + 15;  // 9:15 AM
    const marketClose = 15 * 60 + 30; // 3:30 PM
    
    let status: 'OPEN' | 'CLOSED' | 'PRE_MARKET' | 'POST_MARKET';
    let nextOpenTime: Date | undefined;
    
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      // Weekend
      status = 'CLOSED';
      nextOpenTime = this.getNextMarketOpenTime(istTime);
    } else if (currentTime < marketOpen) {
      // Pre-market
      status = 'PRE_MARKET';
      nextOpenTime = new Date(istTime);
      nextOpenTime.setHours(9, 15, 0, 0);
    } else if (currentTime >= marketOpen && currentTime <= marketClose) {
      // Market open
      status = 'OPEN';
    } else {
      // Post-market
      status = 'POST_MARKET';
      nextOpenTime = this.getNextMarketOpenTime(istTime);
    }
    
    const isOpen = status === 'OPEN';
    const timeToOpen = nextOpenTime ? this.formatTimeToOpen(nextOpenTime, istTime) : undefined;
    
    return {
      isOpen,
      status,
      nextOpenTime,
      timeToOpen
    };
  }
  
  /**
   * Get the next market open time
   */
  private static getNextMarketOpenTime(currentTime: Date): Date {
    const nextOpen = new Date(currentTime);
    
    // If it's Friday after market hours, next open is Monday
    if (currentTime.getDay() === 5 && currentTime.getHours() >= 15) {
      nextOpen.setDate(currentTime.getDate() + 3); // Add 3 days to get to Monday
    }
    // If it's Saturday, next open is Monday
    else if (currentTime.getDay() === 6) {
      nextOpen.setDate(currentTime.getDate() + 2); // Add 2 days to get to Monday
    }
    // If it's Sunday, next open is Monday
    else if (currentTime.getDay() === 0) {
      nextOpen.setDate(currentTime.getDate() + 1); // Add 1 day to get to Monday
    }
    // Otherwise, next open is tomorrow (or today if before market hours)
    else {
      if (currentTime.getHours() >= 15) {
        nextOpen.setDate(currentTime.getDate() + 1);
      }
    }
    
    nextOpen.setHours(9, 15, 0, 0);
    return nextOpen;
  }
  
  /**
   * Format time remaining until market opens
   */
  private static formatTimeToOpen(nextOpenTime: Date, currentTime: Date): string {
    const diff = nextOpenTime.getTime() - currentTime.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      return `${days}d ${remainingHours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }
  
  /**
   * Check if it's a trading holiday (basic implementation)
   * In a real application, you'd maintain a list of market holidays
   */
  static isTradingHoliday(): boolean {
    // This is a basic implementation
    // You should maintain a proper holiday calendar
    const today = new Date();
    const istTime = new Date(today.getTime() + (5.5 * 60 * 60 * 1000));
    
    // Add specific holiday dates here
    const holidays = [
      '2024-01-26', // Republic Day
      '2024-03-08', // Holi
      '2024-03-29', // Good Friday
      '2024-08-15', // Independence Day
      '2024-10-02', // Gandhi Jayanti
      // Add more holidays as needed
    ];
    
    const dateStr = istTime.toISOString().split('T')[0];
    return holidays.includes(dateStr);
  }
} 