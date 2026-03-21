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
