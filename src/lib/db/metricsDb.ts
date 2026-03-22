import Dexie, { type EntityTable } from 'dexie';

export interface NetworkWindowLog {
  id?: number;
  sessionId: string;
  role: 'host' | 'client';
  timestamp: number;
  outKb: number;
  inKb: number;
  outOps: number;
  inOps: number;
  activeDOs: number;
  streamOutKb: number;
  streamInKb: number;
}

const db = new Dexie('MageHandMetricsDB') as Dexie & {
  profiler_logs: EntityTable<
    NetworkWindowLog,
    'id'
  >;
};

db.version(1).stores({
  profiler_logs: '++id, sessionId, timestamp'
});

export const metricsDb = db;

export interface SessionSummary {
  sessionId: string;
  role: 'host' | 'client';
  startTime: number;
  endTime: number;
  maxOutOps: number;
  maxOutKb: number;
}

export async function getHistoricalSessionsSummary(): Promise<SessionSummary[]> {
  const logs = await metricsDb.profiler_logs.toArray();
  const summaryMap = new Map<string, SessionSummary>();

  for (const log of logs) {
    let summary = summaryMap.get(log.sessionId);
    if (!summary) {
      summary = {
        sessionId: log.sessionId,
        role: log.role,
        startTime: log.timestamp,
        endTime: log.timestamp,
        maxOutOps: log.outOps || 0,
        maxOutKb: log.outKb || 0,
      };
      summaryMap.set(log.sessionId, summary);
    } else {
      summary.startTime = Math.min(summary.startTime, log.timestamp);
      summary.endTime = Math.max(summary.endTime, log.timestamp);
      summary.maxOutOps = Math.max(summary.maxOutOps, log.outOps || 0);
      summary.maxOutKb = Math.max(summary.maxOutKb, log.outKb || 0);
    }
  }

  return Array.from(summaryMap.values()).sort((a, b) => b.endTime - a.endTime);
}
