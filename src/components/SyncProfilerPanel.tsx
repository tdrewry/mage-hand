import React, { useEffect, useState } from 'react';
import { syncProfiler } from '@/lib/jazz/profiler';
import { Button } from './ui/button';
import { Download, Copy, Check, Play, Server, Zap } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useUiStateStore } from '@/stores/uiStateStore';
import { useMultiplayerStore } from '@/stores/multiplayerStore';
import { useNetworkDiagnosticsStore } from '@/stores/networkDiagnosticsStore';
import { toast } from 'sonner';

export const SyncProfilerPanel: React.FC = () => {
  const [stats, setStats] = useState({ outKb: '0.00', inKb: '0.00', outOps: 0, inOps: 0, activeDOs: 0, streamKb: '0.00' });
  const [active, setActive] = useState(true);
  const [copied, setCopied] = useState(false);
  
  const isProfilerVisible = useUiStateStore(s => s.isProfilerVisible);
  const currentSession = useMultiplayerStore(s => s.currentSession);
  const activeTransport = useMultiplayerStore((s) => s.activeTransport);
  
  // WebRTC Diagnostics
  const peers = useNetworkDiagnosticsStore((s) => s.peers);
  const peerList = Object.values(peers);
  
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
    <div className="fixed bottom-[100px] left-1/2 -translate-x-1/2 z-[9999] bg-slate-900/95 text-xs text-white p-3 rounded-md border border-slate-700 shadow-2xl flex items-stretch space-x-6 backdrop-blur-md">
      {/* SECTION 1: Jazz Network State */}
      <div className="flex flex-col min-w-[240px]">
        <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-800">
          <div className="font-semibold text-slate-300 flex items-center shrink-0">
            <Server className="h-3 w-3 mr-1.5 text-blue-400" /> Jazz Sync Profiler
          </div>
          {sessionId && (
            <div 
              className="flex items-center space-x-1 bg-slate-800 hover:bg-slate-700 cursor-pointer px-1.5 py-0.5 rounded text-[9px] text-slate-300 transition-colors ml-2 shrink-0"
              onClick={handleCopySession}
              title="Click to copy Session Root"
            >
              <span className="truncate max-w-[70px]">{sessionId}</span>
              {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            </div>
          )}
        </div>
        
        <TooltipProvider>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-3 flex-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center space-x-2 cursor-help">
                  <span className="text-yellow-400">↑ OUT</span>
                  <span className="font-mono text-slate-200">{stats.outKb} KB</span>
                  <span className="text-slate-500 text-[10px]">({stats.outOps})</span>
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
                  <span className="font-mono text-slate-200">{stats.inKb} KB</span>
                  <span className="text-slate-500 text-[10px]">({stats.inOps})</span>
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
                  <span className="font-mono text-slate-200">{stats.activeDOs}</span>
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
                  <span className="font-mono text-slate-200">{stats.streamKb} KB</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-slate-800 text-xs border-slate-700 text-slate-200 z-[10000]">
                <p>Streams: Cumulative FileStream bytes downloaded (e.g. textures)</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>

        <div className="flex items-center space-x-2 mt-auto">
          <Button 
            variant={active ? "destructive" : "secondary"} 
            size="sm" 
            className="h-6 text-[10px] flex-1 px-2"
            onClick={() => setActive(!active)}
          >
            {active ? 'Stop Profiler' : 'Start Profiler'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-[10px] flex-1 flex items-center justify-center gap-1 bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700 hover:text-white px-2"
            onClick={() => syncProfiler.downloadCSV()}
            title="Download Profiler Log (CSV)"
          >
            <Download className="h-3 w-3" /> Save CSV
          </Button>
        </div>
      </div>

      {/* Vertical Divider */}
      <div className="w-[1px] bg-slate-800 my-1"></div>

      {/* SECTION 2: WebRTC Ephemeral State */}
      <div className="flex flex-col min-w-[260px]">
        <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-800">
          <div className="font-semibold text-slate-300 flex items-center">
            <Zap className="h-3 w-3 mr-1.5 text-amber-400" /> Ephemeral WebRTC
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-5 text-[9px] px-1.5 py-0 bg-indigo-900/40 hover:bg-indigo-800 text-indigo-300 border-indigo-700/50"
            onClick={() => {
              import('@/lib/net/transports/mockSignalingTest').then((m) => {
                m.runMockSignalingTest();
              });
            }}
          >
            <Play className="h-2.5 w-2.5 mr-1" /> Mock Test
          </Button>
        </div>

        {(!activeTransport || peerList.length === 0) ? (
          <div className="flex-1 flex items-center justify-center text-slate-500 italic text-[10px]">
            No ephemeral peers detected
          </div>
        ) : (
          <div className="flex-1 space-y-2 max-h-[85px] overflow-y-auto pr-1 stylish-scrollbar">
            {peerList.map((peer) => {
               const isStuck = peer.stage !== 'connected' && peer.stage !== 'datachannel_open' && (Date.now() - peer.lastUpdate) > 3000;
               const isError = peer.stage === 'failed';
               
               let colorClass = "text-slate-400";
               if (peer.stage === 'connected' || peer.stage === 'datachannel_open') colorClass = "text-emerald-400";
               else if (isError) colorClass = "text-red-400";
               else if (isStuck) colorClass = "text-yellow-400";

               return (
                 <div key={peer.clientId} className="bg-slate-800/60 rounded border border-slate-700/50 p-1.5 px-2 relative overflow-hidden flex flex-col justify-center">
                   <div className="flex justify-between items-center">
                      <span className="font-mono text-[10px] truncate max-w-[100px] text-slate-300" title={peer.clientId}>
                        {peer.isHost ? "Host: " : "Client: "}
                        <span className="opacity-70">{peer.clientId.substring(0, 8)}...</span>
                      </span>
                      <span className={`font-semibold capitalize text-[9px] ${colorClass}`}>
                        {peer.stage.replace('_', ' ')}
                      </span>
                   </div>
                   <div className="flex justify-between items-center text-[9px] text-slate-400 mt-0.5">
                      <div>ICE: <span className="text-slate-300 font-mono">{peer.iceCandidatesSent}</span> keys</div>
                      {isError && peer.error && <div className="text-red-400 truncate max-w-[80px]" title={peer.error}>{peer.error}</div>}
                   </div>
                 </div>
               );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
