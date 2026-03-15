import React, { useEffect, useState } from 'react';
import { syncProfiler } from '@/lib/jazz/profiler';
import { Button } from './ui/button';
import { Download, Copy, Check } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useUiStateStore } from '@/stores/uiStateStore';
import { useMultiplayerStore } from '@/stores/multiplayerStore';
import { toast } from 'sonner';

export const SyncProfilerPanel: React.FC = () => {
  const [stats, setStats] = useState({ outKb: '0.00', inKb: '0.00', outOps: 0, inOps: 0, activeDOs: 0, streamKb: '0.00' });
  const [active, setActive] = useState(true);
  const [copied, setCopied] = useState(false);
  
  const isProfilerVisible = useUiStateStore(s => s.isProfilerVisible);
  const currentSession = useMultiplayerStore(s => s.currentSession);
  
  const handleCopySession = () => {
    const sessionId = currentSession?.sessionId || currentSession?.sessionCode;
    if (sessionId) {
      navigator.clipboard.writeText(sessionId);
      setCopied(true);
      toast.success('Session root ID copied');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  useEffect(() => {
    if (!active) {
      syncProfiler.stop();
      return;
    }
    
    syncProfiler.start();
    const interval = setInterval(() => {
      // Overriding profiler interval for smooth UI polling
      // Read the raw values directly since the UI polls faster than the 10s console report
      const outKb = Number(syncProfiler['outKb'] || 0).toFixed(2);
      const inKb = Number(syncProfiler['inKb'] || 0).toFixed(2);
      const streamKb = (Number(syncProfiler['totalStreamBytes'] || 0) / 1024).toFixed(2);
      
      setStats({
        outKb,
        inKb,
        outOps: Number(syncProfiler['outOps'] || 0),
        inOps: Number(syncProfiler['inOps'] || 0),
        activeDOs: Number(syncProfiler['activeDOs'] || 0),
        streamKb,
      });
    }, 1000);

    return () => {
      clearInterval(interval);
      syncProfiler.stop();
    };
  }, [active]);

  if (!isProfilerVisible) return null;

  const sessionId = currentSession?.sessionId || currentSession?.sessionCode;

  return (
    <div className="fixed bottom-[100px] left-1/2 -translate-x-1/2 z-[9999] bg-slate-900/90 text-xs text-white p-3 rounded-md border border-slate-700 shadow-xl flex items-center space-x-4">
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="font-semibold text-slate-300">Jazz Network Profiler</div>
          {sessionId && (
            <div 
              className="flex items-center space-x-1 bg-slate-800 hover:bg-slate-700 cursor-pointer px-1.5 py-0.5 rounded text-[10px] text-slate-300 transition-colors"
              onClick={handleCopySession}
              title="Click to copy Session Root"
            >
              <span className="truncate max-w-[100px]">{sessionId}</span>
              {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            </div>
          )}
        </div>
        <TooltipProvider>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center space-x-2 cursor-help">
                  <span className="text-yellow-400">↑ OUT</span>
                  <span className="font-mono">{stats.outKb} KB</span>
                  <span className="text-slate-400">({stats.outOps})</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-slate-800 text-xs border-slate-700 text-slate-200 z-[10000]">
                <p>Outbound network traffic (KB sent) and total operations (Ops)</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center space-x-2 cursor-help">
                  <span className="text-blue-400">↓ IN</span>
                  <span className="font-mono">{stats.inKb} KB</span>
                  <span className="text-slate-400">({stats.inOps})</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-slate-800 text-xs border-slate-700 text-slate-200 z-[10000]">
                <p>Inbound network traffic (KB received) and total operations (Ops)</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center space-x-2 cursor-help">
                  <span className="text-purple-400">❖ DOs</span>
                  <span className="font-mono">{stats.activeDOs}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-slate-800 text-xs border-slate-700 text-slate-200 z-[10000]">
                <p>Durable Objects: Unique CoValues modified or watched</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center space-x-2 cursor-help">
                  <span className="text-emerald-400">≈ STR</span>
                  <span className="font-mono">{stats.streamKb} KB</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-slate-800 text-xs border-slate-700 text-slate-200 z-[10000]">
                <p>Streams: Cumulative FileStream bytes downloaded (e.g. textures)</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>
      <div className="border-l border-slate-700 pl-4 h-full flex flex-col justify-center space-y-2">
        <Button 
          variant={active ? "destructive" : "secondary"} 
          size="sm" 
          className="h-7 text-xs w-full"
          onClick={() => setActive(!active)}
        >
          {active ? 'Stop Profiler' : 'Start Profiler'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs w-full flex items-center justify-center gap-1 bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700 hover:text-white"
          onClick={() => syncProfiler.downloadCSV()}
          title="Download Profiler Log (CSV)"
        >
          <Download className="h-3 w-3" /> CSV
        </Button>
      </div>
    </div>
  );
};
