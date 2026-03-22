/**
 * Sync Profiler
 * 
 * Monitors the size of outbound and inbound Jazz/Zustand payloads to estimate
 * bandwidth usage for cost-analysis and optimization.
 */

import { metricsDb } from '@/lib/db/metricsDb';
import { useNetworkDiagnosticsStore } from '@/stores/networkDiagnosticsStore';
import { useTelemetryStore } from '@/stores/telemetryStore';
import jsonLogic from 'json-logic-js';

export type ProfilerSeverity = 'warning' | 'critical';

export interface ProfilerAlert {
  severity: ProfilerSeverity;
  message: string;
}

export type AlertCallback = (payload: ProfilerAlert) => void;

class SyncProfiler {
  private outKb = 0;
  private inKb = 0;
  private outOps = 0;
  private inOps = 0;

  public sessionId: string = typeof crypto !== 'undefined' && crypto.randomUUID 
    ? crypto.randomUUID() 
    : Date.now().toString(36);
  public role: 'host' | 'client' = 'client';

  public setRole(role: 'host' | 'client') {
    this.role = role;
  }
  
  // Budget Tracking
  public sessionBudgetMax = 100000;
  public totalOutOps = 0;

  public get sessionBudgetConsumedPct(): number {
    return (this.totalOutOps / this.sessionBudgetMax) * 100;
  }

  // Event Emitter for Alerts
  private alertListeners: AlertCallback[] = [];

  public onAlert(callback: AlertCallback) {
    this.alertListeners.push(callback);
    return () => {
      this.alertListeners = this.alertListeners.filter(cb => cb !== callback);
    };
  }

  private fireAlert(alert: ProfilerAlert) {
    this.alertListeners.forEach(cb => cb(alert));
  }
  
  // Jazz Billing Metrics
  public activeDOs = 0;      // Roughly correlates to unique CoValues modified/watched
  public streamOutBytes = 0; // FileStream outbound bytes in current window
  public streamInBytes = 0;  // FileStream inbound bytes in current window
  public totalStreamBytes = 0; // Cumulative FileStream bytes across session
  private _trackedDOs = new Set<string>();

  private sampleIntervalMs = 10000; // 10 seconds
  private intervalId: NodeJS.Timeout | null = null;
  
  // Store historical data for export
  public history: { timestamp: string, outKb: string, inKb: string, outOps: number, inOps: number, activeDOs: number, streamOutKb: string, streamInKb: string }[] = [];
  
  // Keep rolling array of last 6 windows (60 seconds) for UI polling
  public rollingWindows: { timestamp: string, outKb: string, inKb: string, outOps: number, inOps: number, activeDOs: number, streamOutKb: string, streamInKb: string }[] = [];

  public isRecording: boolean = true;

  start() {
    this.isRecording = true;
    if (this.intervalId) return;
    this.reset();
    
    this.intervalId = setInterval(() => {
      this.report();
      this.reset();
    }, this.sampleIntervalMs);
    
    console.log(`[SyncProfiler] Started bandwidth tracking (${this.sampleIntervalMs / 1000}s rolling window)`);
  }

  stop() {
    this.isRecording = false;
  }

  /**
   * Called right before a local mutation is mapped to a CoValue
   */
  measureOutbound(patch: any, channel: string) {
    try {
      const size = this.approximateSize(patch);
      this.outKb += size / 1024;
      this.outOps++;
      this.totalOutOps++;
      
      // Track DO allocations (roughly counting unique entities)
      if (patch && patch.id && !this._trackedDOs.has(patch.id)) {
        this._trackedDOs.add(patch.id);
        this.activeDOs++;
      }
    } catch (e) {
      // Ignore errors
    }
  }

  /**
   * Called right after a CoValue subscription fires with remote changes
   */
  measureInbound(patch: any, channel: string) {
    try {
      const size = this.approximateSize(patch);
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
   * Fast, non-blocking heuristic to estimate object byte size without JSON.stringify
   * JSON.stringify on thousands of Jazz CoValues during sync blocks the main thread
   */
  private approximateSize(obj: any): number {
    if (obj === null || obj === undefined) return 0;
    if (typeof obj === 'string') return obj.length * 2; // UTF-16 approx
    if (typeof obj === 'number') return 8;
    if (typeof obj === 'boolean') return 4;
    
    // Quick heuristic for objects/arrays to avoid deep traversal timeout
    // Average 50 bytes per key + string length footprint
    let size = 0;
    try {
      if (Array.isArray(obj)) {
        size += obj.length * 50;
      } else if (typeof obj === 'object') {
        const keys = Object.keys(obj);
        size += keys.length * 50;
        // Sample a few keys if string-heavy (like image hashes)
        if (obj.id) size += 64;
        if (obj.imageHash) size += 64;
      }
    } catch (e) {
      // Catch proxy access errors
      return 100; 
    }
    
    return size || 100; // fallback arbitrary size if estimation fails
  }
  
  /**
   * Track FileStream operations
   */
  measureStreamOut(bytes: number) {
      this.streamOutBytes += bytes;
      this.totalStreamBytes += bytes;
  }

  measureStreamIn(bytes: number) {
      this.streamInBytes += bytes;
      this.totalStreamBytes += bytes;
  }

  private reset() {
    this.outKb = 0;
    this.inKb = 0;
    this.outOps = 0;
    this.inOps = 0;
    // activeDOs and streamBytes stay cumulative for the session or get reset per window depending on reporting needs
    this.streamOutBytes = 0;
    this.streamInBytes = 0; 
  }

  private report() {
    if (this.inOps === 0 && this.outOps === 0 && this.streamOutBytes === 0 && this.streamInBytes === 0) return;

    const outKbs = this.outKb.toFixed(2);
    const inKbs = this.inKb.toFixed(2);
    const streamOutKb = (this.streamOutBytes / 1024).toFixed(2);
    const streamInKb = (this.streamInBytes / 1024).toFixed(2);
    
    // Evaluate thresholds for alerts (10-second window completes)
    if (this.outOps > 150) {
      this.fireAlert({ severity: 'critical', message: `Network Spike Detected: ${this.outOps} ops` });
    } else if (this.outOps > 80 || this.outKb > 10) {
      this.fireAlert({ severity: 'warning', message: `High Network Activity: ${this.outOps} ops, ${outKbs} KB` });
    }

    const tsString = new Date().toISOString();

    // Trigger WebRTC flush immediately so the arrays align on the same heartbeat
    useNetworkDiagnosticsStore.getState().flushWebRTCStats(tsString).catch(e => {
      console.warn('[SyncProfiler] Failed to flush WebRTC stats', e);
    });

    const windowData = {
      timestamp: tsString,
      outKb: outKbs,
      inKb: inKbs,
      outOps: this.outOps,
      inOps: this.inOps,
      activeDOs: this.activeDOs,
      streamOutKb,
      streamInKb
    };

    const metricsForEval = {
      ...windowData,
      outKb: parseFloat(outKbs),
      inKb: parseFloat(inKbs),
      streamOutKb: parseFloat(streamOutKb),
      streamInKb: parseFloat(streamInKb)
    };
    this.evaluateAlertRules(metricsForEval, false);

    // Store in history
    if (this.isRecording) {
      this.history.push(windowData);
    }

    // Maintain 60-second rolling window (last 6 samples)
    this.rollingWindows.push(windowData);
    if (this.rollingWindows.length > 6) {
      this.rollingWindows.shift();
    }
    
    // Save to IndexedDB quietly
    if (this.isRecording) {
      metricsDb.profiler_logs.add({
        sessionId: this.sessionId,
        role: this.role,
        timestamp: Date.now(),
        outKb: parseFloat(outKbs),
        inKb: parseFloat(inKbs),
        outOps: this.outOps,
        inOps: this.inOps,
        activeDOs: this.activeDOs,
        streamOutKb: parseFloat(streamOutKb),
        streamInKb: parseFloat(streamInKb),
      }).catch(e => {
        console.warn('[SyncProfiler] Failed to save telemetry to local DB:', e);
      });
    }

    console.log(
      `%c[SyncProfiler] 10s Window: %cOut %c${outKbs} KB%c (${this.outOps} ops) | %cIn %c${inKbs} KB%c (${this.inOps} ops) | %cDOs %c${this.activeDOs}%c | %cSTR Out %c${streamOutKb} KB%c | %cSTR In %c${streamInKb} KB`,
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
      'color: #eab308; font-weight: bold', // Yellow for out
      'color: #fff',
      'color: #888',
      'color: #3b82f6; font-weight: bold', // Blue for in
      'color: #fff'
    );
  }

  /**
   * Downloads the recorded history as a CSV file and clears the log.
   */
  downloadCSV(filename?: string) {
    if (this.history.length === 0) {
      console.warn("No profiler data to download.");
      return;
    }

    const headers = ["Timestamp", "Out (KB)", "In (KB)", "Out (Ops)", "In (Ops)", "Active DOs", "Stream Out (KB)", "Stream In (KB)"];
    const rows = this.history.map(row => [
      row.timestamp,
      row.outKb,
      row.inKb,
      row.outOps,
      row.inOps,
      row.activeDOs,
      row.streamOutKb,
      row.streamInKb
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(",")]
      .concat(rows.map(e => e.join(",")))
      .join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename || `sync_profiler_log_${new Date().getTime()}.csv`);
    document.body.appendChild(link); // Required for FF
    link.click();
    document.body.removeChild(link);
    
    // Optional: Clear history after download
    // this.history = [];
  }

  public evaluateAlertRules(metrics: any, isTest: boolean = false) {
    try {
      const { rules, webhooks } = useTelemetryStore.getState();
      
      if (rules.length > 0 && webhooks.length > 0) {
        for (const rule of rules) {
          const isTriggered = jsonLogic.apply(rule.logic, metrics);
          if (isTriggered) {
            const testPrefix = isTest ? '[TEST] ' : '';
            const payload = {
              content: `⚠️ **Mage-Hand Alert:** ${testPrefix}${rule.name}\nMetrics: ${metrics.outOps} Ops, ${metrics.outKb} KB`
            };

            for (const url of webhooks) {
              fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              }).catch(e => {
                console.warn(`[SyncProfiler] Failed to send webhook alert to ${url}:`, e);
              });
            }
          }
        }
      }
    } catch (e) {
      console.warn('[SyncProfiler] Error evaluating telemetry rules:', e);
    }
  }
}

export const syncProfiler = new SyncProfiler();
