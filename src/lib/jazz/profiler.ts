/**
 * Sync Profiler
 * 
 * Monitors the size of outbound and inbound Jazz/Zustand payloads to estimate
 * bandwidth usage for cost-analysis and optimization.
 */

class SyncProfiler {
  private outKb = 0;
  private inKb = 0;
  private outOps = 0;
  private inOps = 0;
  
  // Jazz Billing Metrics
  public activeDOs = 0;      // Roughly correlates to unique CoValues modified/watched
  public streamBytes = 0;    // FileStream bytes in current window
  public totalStreamBytes = 0; // Cumulative FileStream bytes across session
  private _trackedDOs = new Set<string>();

  private sampleIntervalMs = 10000; // 10 seconds
  private intervalId: NodeJS.Timeout | null = null;
  
  // Store historical data for export
  public history: { timestamp: string, outKb: string, inKb: string, outOps: number, inOps: number, activeDOs: number, streamKb: string }[] = [];

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
    try {
      const size = new Blob([JSON.stringify(patch)]).size;
      this.outKb += size / 1024;
      this.outOps++;
      
      // Track DO allocations (roughly counting unique entities)
      if (patch && patch.id && !this._trackedDOs.has(patch.id)) {
        this._trackedDOs.add(patch.id);
        this.activeDOs++;
      }
    } catch (e) {
      // Ignore cyclic structure errors
    }
  }

  /**
   * Called right after a CoValue subscription fires with remote changes
   */
  measureInbound(patch: any, channel: string) {
    try {
      const size = new Blob([JSON.stringify(patch)]).size;
      this.inKb += size / 1024;
      this.inOps++;
      
      // Track DO allocations
      if (patch && patch.id && !this._trackedDOs.has(patch.id)) {
        this._trackedDOs.add(patch.id);
        this.activeDOs++;
      }
    } catch (e) {}
  }
  
  /**
   * Track FileStream operations
   */
  measureStream(bytes: number) {
      this.streamBytes += bytes;
      this.totalStreamBytes += bytes;
  }

  private reset() {
    this.outKb = 0;
    this.inKb = 0;
    this.outOps = 0;
    this.inOps = 0;
    // activeDOs and streamBytes stay cumulative for the session or get reset per window depending on reporting needs
    this.streamBytes = 0; 
  }

  private report() {
    if (this.inOps === 0 && this.outOps === 0 && this.streamBytes === 0) return;

    const outKbs = this.outKb.toFixed(2);
    const inKbs = this.inKb.toFixed(2);
    const streamKb = (this.streamBytes / 1024).toFixed(2);
    
    // Store in history
    this.history.push({
      timestamp: new Date().toISOString(),
      outKb: outKbs,
      inKb: inKbs,
      outOps: this.outOps,
      inOps: this.inOps,
      activeDOs: this.activeDOs,
      streamKb
    });
    
    console.log(
      `%c[SyncProfiler] 10s Window: %cOut %c${outKbs} KB%c (${this.outOps} ops) | %cIn %c${inKbs} KB%c (${this.inOps} ops) | %cDOs %c${this.activeDOs}%c | %cStream %c${streamKb} KB`,
      'color: #888',
      'color: #eab308; font-weight: bold', // Yellow for out
      'color: #fff',
      'color: #888',
      'color: #3b82f6; font-weight: bold', // Blue for in
      'color: #fff',
      'color: #888',
      'color: #a855f7; font-weight: bold', // Purple for DOs
      'color: #fff',
      'color: #888',
      'color: #10b981; font-weight: bold', // Green for Streams
      'color: #fff'
    );
  }

  /**
   * Downloads the recorded history as a CSV file and clears the log.
   */
  downloadCSV() {
    if (this.history.length === 0) {
      console.warn("No profiler data to download.");
      return;
    }

    const headers = ["Timestamp", "Out (KB)", "In (KB)", "Out (Ops)", "In (Ops)", "Active DOs", "Stream (KB)"];
    const rows = this.history.map(row => [
      row.timestamp,
      row.outKb,
      row.inKb,
      row.outOps,
      row.inOps,
      row.activeDOs,
      row.streamKb
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(",")]
      .concat(rows.map(e => e.join(",")))
      .join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `sync_profiler_log_${new Date().getTime()}.csv`);
    document.body.appendChild(link); // Required for FF
    link.click();
    document.body.removeChild(link);
    
    // Optional: Clear history after download
    // this.history = [];
  }
}

export const syncProfiler = new SyncProfiler();
