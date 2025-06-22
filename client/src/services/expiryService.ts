export interface ExpiryDates {
  nifty: string;      // Weekly expiry (Thursday)
  banknifty: string;  // Monthly expiry (Last Thursday)
  sensex: string;     // Weekly expiry (Tuesday)
}

export class ExpiryService {
  private holidays = new Set([
    // 2024 Holidays
    '2024-01-26', '2024-03-08', '2024-03-25', '2024-03-29', '2024-04-11',
    '2024-04-14', '2024-04-17', '2024-05-01', '2024-08-15', '2024-08-26',
    '2024-10-02', '2024-10-12', '2024-11-01', '2024-11-15', '2024-12-25',
    
    // 2025 Holidays
    '2025-01-26', '2025-02-26', '2025-03-14', '2025-03-31', '2025-04-14',
    '2025-04-18', '2025-05-01', '2025-08-15', '2025-08-16', '2025-10-02',
    '2025-10-21', '2025-11-01', '2025-11-05', '2025-12-25'
  ]);

  /**
   * Check if a date is a holiday or weekend
   */
  private isHoliday(date: Date): boolean {
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
    
    if (isWeekend) return true;
    
    const dateStr = this.formatDate(date);
    return this.holidays.has(dateStr);
  }

  /**
   * Format date as YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Adjust date to previous working day if it's a holiday
   */
  private adjustForHoliday(date: Date): Date {
    const adjusted = new Date(date);
    while (this.isHoliday(adjusted)) {
      adjusted.setDate(adjusted.getDate() - 1);
    }
    return adjusted;
  }

  /**
   * Get the last weekday of the month
   */
  private getLastWeekdayInMonth(year: number, month: number, weekday: number): Date {
    const lastDay = new Date(year, month + 1, 0); // Last day of month
    const dayOfWeek = lastDay.getDay();
    const offset = dayOfWeek >= weekday ? dayOfWeek - weekday : dayOfWeek + 7 - weekday;
    const last = new Date(lastDay);
    last.setDate(lastDay.getDate() - offset);
    return last;
  }

  /**
   * Get next weekday from a given date
   */
  private getNextWeekday(date: Date, weekday: number): Date {
    const currentDayOfWeek = date.getDay();
    const offset = weekday >= currentDayOfWeek ? weekday - currentDayOfWeek : 7 - (currentDayOfWeek - weekday);
    const next = new Date(date);
    next.setDate(date.getDate() + offset);
    return next;
  }

  /**
   * Get next expiry dates (not current month)
   */
  getExpiryDates(): ExpiryDates {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const today = new Date(year, month, now.getDate());

    // NSE Monthly Expiry (Last Thursday) - for BANKNIFTY
    const nseExpiryThis = this.adjustForHoliday(
      this.getLastWeekdayInMonth(year, month, 4) // Thursday = 4
    );
    const nseExpiryNext = this.adjustForHoliday(
      this.getLastWeekdayInMonth(year + (month === 11 ? 1 : 0), month === 11 ? 0 : month + 1, 4)
    );
    
    // Use current month expiry if it's still in the future, otherwise use next month
    const nseExpiry = nseExpiryThis >= today ? nseExpiryThis : nseExpiryNext;

    // Nifty Weekly Expiry (Next Thursday)
    const niftyWeekly = this.adjustForHoliday(
      this.getNextWeekday(today, 4) // Thursday = 4
    );

    // Sensex Weekly Expiry (Next Tuesday)
    const sensexWeekly = this.adjustForHoliday(
      this.getNextWeekday(today, 2) // Tuesday = 2
    );

    return {
      nifty: this.formatDate(niftyWeekly),
      banknifty: this.formatDate(nseExpiry),
      sensex: this.formatDate(sensexWeekly)
    };
  }

  /**
   * Get expiry date for a specific index
   */
  getExpiryForIndex(index: 'NIFTY' | 'BANKNIFTY' | 'SENSEX'): string {
    const dates = this.getExpiryDates();
    
    switch (index) {
      case 'NIFTY':
        return dates.nifty;
      case 'BANKNIFTY':
        return dates.banknifty;
      case 'SENSEX':
        return dates.sensex;
      default:
        return dates.nifty;
    }
  }
} 