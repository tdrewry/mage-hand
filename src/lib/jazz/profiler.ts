/**
 * Sync Profiler
 * 
 * Monitors the size of outbound and inbound Jazz/Zustand payloads to estimate
 * bandwidth usage for cost-analysis and optimization.
 */

class SyncProfiler {
  private bytesSent = 0;
  private bytesReceived = 0;
  private opCountOut = 0;
  private opCountIn = 0;

  private sampleIntervalMs = 10000; // 10 seconds
  private intervalId: NodeJS.Timeout | null = null;

  start() {
    if (this.intervalId) return;
    this.reset();
    
    this.intervalId = setInterval(() => {
      this.report();
      this.reset();
    }, this.sampleIntervalMs);
    
    console.log(`[SyncProfiler] Started bandwidth tracking (${this.sampleIntervalMs / 1000}s rolling window)`);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[SyncProfiler] Stopped');
    }
  }

  /**
   * Called right before a local mutation is mapped to a CoValue
   */
  measureOutbound(patch: any, channel: string) {
    // Rough estimate: stringify the JS object
    // Note: CoJSON actually binary-encodes this, so JSON stringify is an UPPER BOUND estimate.
    try {
      const size = new Blob([JSON.stringify(patch)]).size;
      this.bytesSent += size;
      this.opCountOut++;
    } catch (e) {
      // Ignore cyclic structure errors or massive blobs for now
    }
  }

  /**
   * Called right after a CoValue subscription fires with remote changes
   */
  measureInbound(patch: any, channel: string) {
    try {
      const size = new Blob([JSON.stringify(patch)]).size;
      this.bytesReceived += size;
      this.opCountIn++;
    } catch (e) {}
  }

  private reset() {
    this.bytesSent = 0;
    this.bytesReceived = 0;
    this.opCountOut = 0;
    this.opCountIn = 0;
  }

  private report() {
    if (this.opCountIn === 0 && this.opCountOut === 0) return;

    const outKb = (this.bytesSent / 1024).toFixed(2);
    const inKb = (this.bytesReceived / 1024).toFixed(2);
    
    console.log(
      `%c[SyncProfiler] 10s Window: %cOut %c${outKb} KB%c (${this.opCountOut} ops) | %cIn %c${inKb} KB%c (${this.opCountIn} ops)`,
      'color: #888',
      'color: #eab308; font-weight: bold', // Yellow for out
      'color: #fff',
      'color: #888',
      'color: #3b82f6; font-weight: bold', // Blue for in
      'color: #fff',
      'color: #888'
    );
  }
}

export const syncProfiler = new SyncProfiler();
