// Background Service to help maintain activity when tab is backgrounded
export class BackgroundService {
  private static wakeLock: any = null;
  private static heartbeatInterval: NodeJS.Timeout | null = null;
  private static audioContext: AudioContext | null = null;
  
  /**
   * Initialize background persistence techniques
   */
  static async initialize(): Promise<void> {
    try {
      // 1. Request wake lock to prevent screen sleep
      await this.requestWakeLock();
      
      // 2. Create silent audio context to keep tab active
      this.createSilentAudio();
      
      // 3. Start heartbeat to maintain activity
      this.startHeartbeat();
      
      // 4. Add visibility change listener
      this.addVisibilityListener();
      
      console.log('🔄 Background service initialized');
    } catch (error) {
      console.warn('⚠️ Some background features may not be available:', error);
    }
  }
  
  /**
   * Request screen wake lock to prevent device sleep
   */
  private static async requestWakeLock(): Promise<void> {
    if ('wakeLock' in navigator) {
      try {
        this.wakeLock = await (navigator as any).wakeLock.request('screen');
        console.log('🔒 Screen wake lock acquired');
        
        this.wakeLock.addEventListener('release', () => {
          console.log('🔓 Screen wake lock released');
        });
      } catch (error) {
        console.warn('⚠️ Wake lock not available:', error);
      }
    }
  }
  
  /**
   * Create silent audio to keep browser active
   */
  private static createSilentAudio(): void {
    try {
      // Create audio context that plays silent sound
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Create silent oscillator
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      // Set to silent
      gainNode.gain.value = 0.001; // Very low volume
      oscillator.frequency.value = 20000; // Ultrasonic frequency
      
      oscillator.start();
      console.log('🔊 Silent audio context created');
    } catch (error) {
      console.warn('⚠️ Audio context not available:', error);
    }
  }
  
  /**
   * Start heartbeat to maintain activity
   */
  private static startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      // Perform minimal activity to keep tab alive
      const now = Date.now();
      localStorage.setItem('victor_heartbeat', now.toString());
      
      // Log every 5 minutes to show activity
      if (now % 300000 < 1000) {
        console.log('💓 Background heartbeat active');
      }
    }, 1000); // Every second
  }
  
  /**
   * Add visibility change listener
   */
  private static addVisibilityListener(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        console.log('👁️ Tab hidden - maintaining background activity');
        // Re-acquire wake lock if lost
        this.requestWakeLock();
      } else {
        console.log('👁️ Tab visible - normal operation');
      }
    });
  }
  
  /**
   * Add warning about background limitations
   */
  static showBackgroundWarning(): void {
    const warning = `
⚠️ BACKGROUND TRADING LIMITATIONS:

• Browser tabs may slow down when backgrounded
• Mobile browsers pause inactive tabs completely  
• Computer sleep/hibernation stops all activity
• Browser crashes lose all monitoring state

RECOMMENDATIONS:
✅ Keep browser tab active and visible
✅ Disable computer sleep/hibernation
✅ Use dedicated trading computer/tablet
✅ Consider server hosting for 24/7 trading

For truly reliable 24/7 trading, consider upgrading to server hosting.
    `;
    
    console.warn(warning);
    
    // Show user-friendly notification
    if (Notification.permission === 'granted') {
      new Notification('Victor 2.0 - Background Trading', {
        body: 'Keep this tab active for continuous monitoring. Check console for details.',
        icon: '/favicon.ico'
      });
    }
  }
  
  /**
   * Request notification permission
   */
  static async requestNotificationPermission(): Promise<void> {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        console.log('🔔 Notification permission granted');
      }
    }
  }
  
  /**
   * Cleanup background services
   */
  static cleanup(): void {
    if (this.wakeLock) {
      this.wakeLock.release();
      this.wakeLock = null;
    }
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    console.log('🧹 Background service cleaned up');
  }
}

// Auto-initialize when module loads
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    BackgroundService.initialize();
    BackgroundService.requestNotificationPermission();
    BackgroundService.showBackgroundWarning();
  });
  
  window.addEventListener('beforeunload', () => {
    BackgroundService.cleanup();
  });
} 