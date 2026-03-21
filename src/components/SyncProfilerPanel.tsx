import React, { useEffect, useState } from 'react';
import { syncProfiler } from '@/lib/jazz/profiler';
import { Button } from './ui/button';
import { Download, Copy, Check, Play, Server, Zap, RefreshCw, Link, Share2, AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip as RechartsTooltip, ReferenceLine } from 'recharts';
import { useUiStateStore } from '@/stores/uiStateStore';
import { useMultiplayerStore } from '@/stores/multiplayerStore';
import { useNetworkDiagnosticsStore } from '@/stores/networkDiagnosticsStore';
import { useBottomNavbarVisible } from '@/hooks/useBottomNavbarVisible';
import { toast } from 'sonner';
import { encodeJazzCode } from '@/lib/sessionCodeResolver';
import { useCanvasEditStatusStore } from '@/stores/useCanvasEditStatusStore';

export const SyncProfilerPanel: React.FC = () => {
  const [stats, setStats] = useState({ outKb: '0.00', inKb: '0.00', outOps: 0, inOps: 0, activeDOs: 0, streamKb: '0.00' });
  const [chartData, setChartData] = useState<any[]>([]);
  const [budgetPct, setBudgetPct] = useState(0);
  const [active, setActive] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedRoot, setCopiedRoot] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  
  const isProfilerVisible = useUiStateStore(s => s.isProfilerVisible);
  const currentSession = useMultiplayerStore(s => s.currentSession);
  const currentUsername = useMultiplayerStore(s => s.currentUsername);
  const activeTransport = useMultiplayerStore((s) => s.activeTransport);
  const sessionRoles = useMultiplayerStore((s) => s.roles);
  const isBottomNavbarVisible = useBottomNavbarVisible();
  
  const peers = useNetworkDiagnosticsStore((s) => s.peers);
  const webrtcHistory = useNetworkDiagnosticsStore((s) => s.history);
  const peerList = Object.values(peers);

  const activePeers = peerList.filter(p => p.stage === 'connected' || p.stage === 'datachannel_open').length;
  const currentBandwidth = webrtcHistory.length > 0 
    ? (Number(webrtcHistory[webrtcHistory.length - 1].inKb || 0) + Number(webrtcHistory[webrtcHistory.length - 1].outKb || 0)).toFixed(2)
    : '0.00';
  
  // To ensure the chart renders the same physical box structure even when empty
  const safeWebrtcHistory = webrtcHistory.length > 0 ? webrtcHistory : [{ timestamp: Date.now(), inKb: 0, outKb: 0 }];
  
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
      useNetworkDiagnosticsStore.getState().setIsRecording(false);
      return;
    }
    
    syncProfiler.start();
    useNetworkDiagnosticsStore.getState().setIsRecording(true);

    const unsubscribeAlerts = syncProfiler.onAlert((payload) => {
      if (payload.severity === 'critical') {
        toast.error(payload.message, { id: 'profiler-alert-critical' });
      } else {
        toast.warning(payload.message, { id: 'profiler-alert-warning' });
      }
    });

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

      setChartData([...syncProfiler.rollingWindows]);
      setBudgetPct(syncProfiler.sessionBudgetConsumedPct);
    }, 1000);

    return () => {
      clearInterval(interval);
      unsubscribeAlerts();
      syncProfiler.stop();
    };
  }, [active]);

  useEffect(() => {
    const role = sessionRoles.includes('dm') ? 'host' : 'client';
    syncProfiler.setRole(role);
  }, [sessionRoles]);

  const canvasEditStatus = useCanvasEditStatusStore((s) => s.status);

  if (!isProfilerVisible) return null;


  const sessionCode = currentSession?.sessionCode;
  const sessionRootId = currentSession?.sessionId;

  const maxJazzKb = chartData.length > 0 
    ? Math.max(...chartData.map(d => Math.max(Number(d.inKb) || 0, Number(d.outKb) || 0, 0.1))) 
    : 0.1;
  const maxWebrtcKb = safeWebrtcHistory.length > 0 
    ? Math.max(...safeWebrtcHistory.map(d => Math.max(Number(d.inKb) || 0, Number(d.outKb) || 0, 0.1))) 
    : 0.1;

  return (
    <div 
      className="fixed right-[100px] z-[9999] bg-slate-900/95 text-xs text-white p-3 rounded-md border border-slate-700 shadow-2xl flex flex-col backdrop-blur-md transition-all duration-300 ease-in-out min-w-[550px]"
      style={{ bottom: isBottomNavbarVisible ? '120px' : '56px' }}
    >
      {/* Header Section */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-700">
        <div className="font-bold text-slate-200 text-sm tracking-wide">
          Network Profiler{' '}
          {sessionRoles.length > 0 && (
            <span className={`text-xs font-normal ml-1 px-1.5 py-0.5 rounded ${sessionRoles.includes('dm') ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
              {sessionRoles.includes('dm') ? 'Host' : 'Client'}
            </span>
          )}
        </div>
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

      <div className="grid grid-cols-2 gap-6 items-stretch">
        {/* SECTION 1: Jazz Network State */}
        <div className="flex flex-col min-w-0">
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
          <div className="flex flex-col mb-3 flex-1 gap-2">
            
            {/* Minimal Stat Row */}
            <div className="flex items-center justify-between text-[10px]">
              <div className="flex gap-3">
                <span className="text-yellow-400 font-mono">↑ {stats.outKb} KB</span>
                <span className="text-blue-400 font-mono">↓ {stats.inKb} KB</span>
              </div>
              <div className="flex gap-3 text-slate-400">
                <span className="text-purple-400 font-mono">❖ {stats.activeDOs} DOs</span>
                <span className="text-emerald-400 font-mono">≈ {stats.streamKb} KB</span>
              </div>
            </div>

            {/* Recharts Live Chart */}
            <div className="h-[60px] w-full bg-slate-800/50 rounded border border-slate-700/50 p-1">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} syncId="network-metrics-sync" margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="timestamp" hide />
                  <YAxis 
                    domain={[0, Math.max(Math.ceil(maxJazzKb * 1.2), 10)]} 
                    tickFormatter={(value) => Math.round(value).toString()}
                    tick={{ fontSize: 9, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    width={24}
                  />
                  <ReferenceLine 
                    y={maxJazzKb} 
                    stroke="gray" 
                    strokeDasharray="3 3" 
                    label={{ position: 'insideBottomLeft', value: `Max: ${maxJazzKb.toFixed(1)} KB`, fill: 'gray', fontSize: 10 }} 
                  />
                  <RechartsTooltip 
                    labelFormatter={(label) => label ? new Date(label).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', fontSize: '10px', padding: '4px' }}
                    labelStyle={{ display: 'block', color: '#94a3b8', marginBottom: '2px', fontWeight: 'bold' }}
                  />
                  <Line type="monotone" dataKey="outKb" stroke="#facc15" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="inKb" stroke="#60a5fa" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* DO Budget Progress Bar */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[9px] text-slate-400 font-medium">
                <span>DO Budget</span>
                <span>{budgetPct.toFixed(1)}%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
                <div 
                  className={`h-full transition-all duration-300 ${
                    budgetPct > 80 ? 'bg-red-500' : budgetPct > 50 ? 'bg-yellow-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, budgetPct)}%` }}
                />
              </div>
            </div>

          </div>
        </TooltipProvider>

        <div className="flex items-center space-x-2 mt-auto">
          <Button 
            variant={active ? "destructive" : "secondary"} 
            size="sm" 
            className="h-6 text-[10px] flex-1 px-2"
            onClick={() => setActive(!active)}
          >
            {active ? 'Pause Profiler' : 'Resume Profiler'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-[10px] flex-1 flex items-center justify-center gap-1 bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700 hover:text-white px-2"
            onClick={() => {
              const role = sessionRoles.includes('dm') ? 'host' : 'client';
              const safeName = (currentUsername || 'unknown').replace(/[^a-z0-9]/gi, '_').toLowerCase();
              syncProfiler.downloadCSV(`${role}-${safeName}-sync_profiler_log_${Date.now()}.csv`);
            }}
            title="Download Profiler Log (CSV)"
          >
            <Download className="h-3 w-3" /> Save CSV
          </Button>
        </div>
      </div>

      {/* SECTION 2: WebRTC Ephemeral State */}
      <div className="flex flex-col min-w-0">
        <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-800">
          <div className="font-semibold text-slate-300 flex items-center gap-1.5">
            <Zap className="h-3 w-3 text-amber-400" /> Ephemeral WebRTC
            {canvasEditStatus === 'partial' && (
              <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded bg-rose-900/50 border border-rose-700/50 text-rose-300 font-semibold">
                <AlertTriangle className="h-2.5 w-2.5" /> Partial
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col mb-3 flex-1 gap-2">
          {/* WebRTC Minimal Stat Row */}
          <div className="flex items-center justify-between text-[10px]">
            <div className="flex gap-3">
              <span className="text-purple-400 font-mono">🫂 {activePeers} Peers</span>
              <span className="text-slate-400 font-mono">⚡ - ms</span>
            </div>
            <div className="flex gap-3 text-slate-400">
              <span className="text-emerald-400 font-mono">≈ {currentBandwidth} KB/s</span>
            </div>
          </div>

          {/* Recharts Live Chart */}
          <div className="h-[60px] w-full bg-slate-800/50 rounded border border-slate-700/50 p-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={safeWebrtcHistory} syncId="network-metrics-sync" margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="timestamp" hide />
                <YAxis 
                  domain={[0, Math.max(Math.ceil(maxWebrtcKb * 1.2), 10)]} 
                  tickFormatter={(value) => Math.round(value).toString()}
                  tick={{ fontSize: 9, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  width={24}
                />
                <ReferenceLine 
                  y={maxWebrtcKb} 
                  stroke="gray" 
                  strokeDasharray="3 3" 
                  label={{ position: 'insideBottomLeft', value: `Max: ${maxWebrtcKb.toFixed(1)} KB`, fill: 'gray', fontSize: 10 }} 
                />
                <RechartsTooltip 
                  labelFormatter={(label) => label ? new Date(label).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', fontSize: '10px', padding: '4px' }}
                  labelStyle={{ display: 'block', color: '#94a3b8', marginBottom: '2px', fontWeight: 'bold' }}
                />
                <Line type="monotone" dataKey="outKb" stroke="#facc15" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="inKb" stroke="#60a5fa" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {(!activeTransport || peerList.length === 0) ? (
            <div className="flex-1 flex items-center justify-center text-slate-500 italic text-[10px] min-h-[40px]">
              No ephemeral peers detected
            </div>
          ) : (
            <div className="flex-1 space-y-2 max-h-[60px] overflow-y-auto pr-1 stylish-scrollbar">
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
    </div>
  );
};
