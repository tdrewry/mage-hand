import React, { useEffect, useState } from 'react';
import { syncProfiler } from '@/lib/jazz/profiler';
import { Button } from './ui/button';

export const SyncProfilerPanel: React.FC = () => {
  const [stats, setStats] = useState({ outKb: '0.00', inKb: '0.00', outOps: 0, inOps: 0 });
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!active) return;
    
    syncProfiler.start();
    const interval = setInterval(() => {
      // Overriding profiler interval for smooth UI polling
      const outKb = (syncProfiler['bytesSent'] / 1024).toFixed(2);
      const inKb = (syncProfiler['bytesReceived'] / 1024).toFixed(2);
      setStats({
        outKb,
        inKb,
        outOps: syncProfiler['opCountOut'],
        inOps: syncProfiler['opCountIn'],
      });
    }, 1000);

    return () => {
      clearInterval(interval);
      syncProfiler.stop();
    };
  }, [active]);

  if (!import.meta.env.DEV) return null;

  return (
    <div className="fixed top-20 right-4 z-[9999] bg-slate-900/90 text-xs text-white p-3 rounded-md border border-slate-700 shadow-xl flex items-center space-x-4">
      <div>
        <div className="font-semibold text-slate-300 mb-1">Jazz Network Profiler</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <div className="flex items-center space-x-2">
            <span className="text-yellow-400">↑ OUT</span>
            <span className="font-mono">{stats.outKb} KB</span>
            <span className="text-slate-400">({stats.outOps})</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-blue-400">↓ IN</span>
            <span className="font-mono">{stats.inKb} KB</span>
            <span className="text-slate-400">({stats.inOps})</span>
          </div>
        </div>
      </div>
      <div className="border-l border-slate-700 pl-4 h-full flex flex-col justify-center">
        <Button 
          variant={active ? "destructive" : "secondary"} 
          size="sm" 
          className="h-7 text-xs"
          onClick={() => setActive(!active)}
        >
          {active ? 'Stop Profiler' : 'Start Profiler'}
        </Button>
      </div>
    </div>
  );
};
