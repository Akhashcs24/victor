class RateLimiter {
  constructor() {
    this.apiCalls = new Map(); // Track API calls per minute
    this.lastResetTime = new Date();
    
    // Define limits for different API types
    this.limits = {
      default: 100,     // Default limit per minute
      historical: 50,   // Historical data API limit
      option: 30,       // Option data API limit
      market: 20        // Market data API limit
    };
    
    // Track consecutive rate limit errors
    this.consecutiveErrors = 0;
    this.backoffTime = 1000; // Start with 1 second backoff
    
    console.log('⚡ Rate Limiter initialized with limits:', this.limits);
  }

  // Check if we can make an API call
  canMakeCall(apiType = 'default') {
    const now = new Date();
    const currentMinute = Math.floor(now.getTime() / 60000);
    const lastResetMinute = Math.floor(this.lastResetTime.getTime() / 60000);

    // Reset counters every minute
    if (currentMinute > lastResetMinute) {
      this.apiCalls.clear();
      this.lastResetTime = now;
      this.consecutiveErrors = 0;
      this.backoffTime = 1000;
    }

    // Get the limit for this API type
    const limit = this.limits[apiType] || this.limits.default;
    
    // Get current count for this API type
    const currentCount = this.apiCalls.get(apiType) || 0;
    
    if (currentCount >= limit) {
      this.consecutiveErrors++;
      console.log(`⚠️ Rate limit reached for ${apiType}: ${currentCount}/${limit} calls per minute`);
      
      // Implement exponential backoff
      if (this.consecutiveErrors > 3) {
        this.backoffTime = Math.min(this.backoffTime * 2, 30000); // Max 30 seconds
        console.log(`⏱️ Backing off for ${this.backoffTime}ms due to ${this.consecutiveErrors} consecutive rate limit errors`);
        setTimeout(() => {
          this.consecutiveErrors = Math.max(0, this.consecutiveErrors - 1);
        }, this.backoffTime);
      }
      
      return false;
    }

    return true;
  }

  // Record an API call
  recordCall(apiType = 'default') {
    const currentCount = this.apiCalls.get(apiType) || 0;
    this.apiCalls.set(apiType, currentCount + 1);
    
    // Calculate total calls for this API type
    const limit = this.limits[apiType] || this.limits.default;
    const remaining = limit - (currentCount + 1);
    
    console.log(`📊 API Call recorded for ${apiType}: ${currentCount + 1}/${limit} calls this minute (${remaining} remaining)`);
  }

  // Get current usage stats
  getUsageStats() {
    const stats = {};
    for (const [apiType, count] of this.apiCalls.entries()) {
      const limit = this.limits[apiType] || this.limits.default;
      stats[apiType] = {
        used: count,
        limit: limit,
        remaining: limit - count,
        resetIn: this.getTimeUntilReset()
      };
    }
    return stats;
  }

  // Get time until rate limit reset (in seconds)
  getTimeUntilReset() {
    const now = new Date();
    const currentMinute = Math.floor(now.getTime() / 60000);
    const nextResetTime = (currentMinute + 1) * 60000;
    return Math.ceil((nextResetTime - now.getTime()) / 1000);
  }
  
  // Handle rate limit error
  handleRateLimitError(apiType = 'default') {
    this.consecutiveErrors++;
    
    // Temporarily reduce the limit for this API type
    const currentLimit = this.limits[apiType] || this.limits.default;
    this.limits[apiType] = Math.max(5, Math.floor(currentLimit * 0.8)); // Reduce by 20%, minimum 5
    
    console.log(`⚠️ Rate limit error for ${apiType}, reducing limit to ${this.limits[apiType]} calls per minute`);
    
    // Schedule limit restoration after 5 minutes
    setTimeout(() => {
      this.restoreLimit(apiType);
    }, 5 * 60 * 1000);
    
    return this.backoffTime;
  }
  
  // Restore limit for API type
  restoreLimit(apiType) {
    const defaultLimits = {
      default: 100,
      historical: 50,
      option: 30,
      market: 20
    };
    
    this.limits[apiType] = defaultLimits[apiType] || defaultLimits.default;
    console.log(`✅ Restored rate limit for ${apiType} to ${this.limits[apiType]} calls per minute`);
  }
}

module.exports = new RateLimiter(); 