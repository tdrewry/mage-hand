import React, { useEffect, useState } from 'react';
import { syncProfiler } from '@/lib/jazz/profiler';
import { Button } from './ui/button';
import { Download, Copy, Check, Play, Server, Zap, RefreshCw, Link, Share2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useUiStateStore } from '@/stores/uiStateStore';
import { useMultiplayerStore } from '@/stores/multiplayerStore';
import { useNetworkDiagnosticsStore } from '@/stores/networkDiagnosticsStore';
import { useBottomNavbarVisible } from '@/hooks/useBottomNavbarVisible';
import { toast } from 'sonner';
import { encodeJazzCode } from '@/lib/sessionCodeResolver';

export const SyncProfilerPanel: React.FC = () => {
  const [stats, setStats] = useState({ outKb: '0.00', inKb: '0.00', outOps: 0, inOps: 0, activeDOs: 0, streamKb: '0.00' });
  const [active, setActive] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedRoot, setCopiedRoot] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  
  const isProfilerVisible = useUiStateStore(s => s.isProfilerVisible);
  const currentSession = useMultiplayerStore(s => s.currentSession);
  const activeTransport = useMultiplayerStore((s) => s.activeTransport);
  const isBottomNavbarVisible = useBottomNavbarVisible();
  
  // WebRTC Diagnostics
  const peers = useNetworkDiagnosticsStore((s) => s.peers);
  const peerList = Object.values(peers);
  
  const handleCopySessionCode = () => {
    const sessionCode = currentSession?.sessionCode;
    if (sessionCode) {
      navigator.clipboard.writeText(sessionCode);
      setCopiedCode(true);
      toast.success('Join Code copied');
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleCopySessionRoot = () => {
    const sessionId = currentSession?.sessionId;
    if (sessionId) {
      navigator.clipboard.writeText(sessionId);
      setCopiedRoot(true);
      toast.success('Session root ID copied');
      setTimeout(() => setCopiedRoot(false), 2000);
    }
  };

  const handleCopyLink = () => {
    const sessionId = currentSession?.sessionId;
    if (sessionId) {
      const shareUrl = encodeJazzCode(sessionId);
      navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      toast.success('J-Code link copied');
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleCopyUrl = () => {
    const sessionId = currentSession?.sessionId;
    if (sessionId) {
      // Use J-code in the URL so it works without the registry (local/self-hosted)
      const jCode = encodeJazzCode(sessionId);
      const shareUrl = `${window.location.origin}/?session=${jCode}`;
      navigator.clipboard.writeText(shareUrl);
      setCopiedUrl(true);
      toast.success('Direct URL copied (J-Code based)');
      setTimeout(() => setCopiedUrl(false), 2000);
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

  const sessionCode = currentSession?.sessionCode;
  const sessionRootId = currentSession?.sessionId;

  return (
    <div 
      className="fixed right-[100px] z-[9999] bg-slate-900/95 text-xs text-white p-3 rounded-md border border-slate-700 shadow-2xl flex flex-col backdrop-blur-md transition-all duration-300 ease-in-out min-w-[550px]"
      style={{ bottom: isBottomNavbarVisible ? '120px' : '56px' }}
    >
      {/* Header Section */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-700">
        <div className="font-bold text-slate-200 text-sm tracking-wide">Network Profiler</div>
        {sessionCode && (
          <div className="flex items-center space-x-2">
            <div 
              className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 cursor-pointer px-2 py-1 rounded text-[10px] text-slate-300 transition-colors shrink-0 border border-slate-700/50"
              onClick={handleCopyUrl}
              title="Click to copy direct join URL (J-Code, works without registry)"
            >
              <span className="font-mono text-slate-400">Share URL</span>
              {copiedUrl ? <Check className="h-3 w-3 text-emerald-400" /> : <Link className="h-3 w-3" />}
            </div>
            <div 
              className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 cursor-pointer px-2 py-1 rounded text-[10px] text-slate-300 transition-colors shrink-0 border border-slate-700/50"
              onClick={handleCopyLink}
              title="Click to copy J-Code (paste into Join Session)"
            >
              <span className="font-mono text-slate-400">J-Code</span>
              {copiedLink ? <Check className="h-3 w-3 text-emerald-400" /> : <Share2 className="h-3 w-3" />}
            </div>
            <div 
              className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 cursor-pointer px-2 py-1 rounded text-[10px] text-slate-300 transition-colors shrink-0 border border-slate-700/50"
              onClick={handleCopySessionCode}
              title="Click to copy short code (requires registry to join)"
            >
              <span className="font-mono text-slate-400">Code:</span>
              <span className="font-mono text-emerald-400">{sessionCode}</span>
              {copiedCode ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-stretch space-x-6">
        {/* SECTION 1: Jazz Network State */}
        <div className="flex flex-col min-w-[240px] flex-1">
          <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-800">
            <div className="font-semibold text-slate-300 flex items-center shrink-0">
              <Server className="h-3 w-3 mr-1.5 text-blue-400" /> Durable Objects (Jazz)
            </div>
            {sessionRootId && (
              <div 
                className="flex items-center space-x-1 bg-slate-800 hover:bg-slate-700 cursor-pointer px-1.5 py-0.5 rounded text-[9px] text-slate-300 transition-colors ml-2 shrink-0"
                onClick={handleCopySessionRoot}
                title="Click to copy Session Root ID"
              >
                <span className="truncate max-w-[70px]">{sessionRootId}</span>
                {copiedRoot ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
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
            className="h-6 text-[10px] flex-1 flex items-center justify-center gap-1 bg-amber-900/20 text-amber-400 border-amber-900/50 hover:bg-amber-900/40"
            onClick={() => (window as any).HARD_RESET?.(false)}
            title="Clean Burn: Clear session, disconnect, and start fresh (HARD RESET)"
          >
            <RefreshCw className="h-3 w-3" /> New Test
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-[10px] flex-1 flex items-center justify-center gap-1 bg-emerald-900/20 text-emerald-400 border-emerald-900/50 hover:bg-emerald-900/40"
            onClick={() => (window as any).HARD_RESET?.(true)}
            title="Sandbox Burn: Clear session, disconnect, and start DEV_LOCAL session"
          >
            <RefreshCw className="h-3 w-3" /> Sandbox
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
                      <div>ICE: <span className="text-slate-300 font-mono">{peer.iceState || 'unknown'}</span></div>
                      {isError && peer.error && <div className="text-red-400 truncate max-w-[80px]" title={peer.error}>{peer.error}</div>}
                   </div>
                 </div>
               );
            })}
          </div>
        )}
      </div>
      </div>
    </div>
  );
};
