import React, { useEffect, useState } from 'react';
import { syncProfiler } from '@/lib/jazz/profiler';
import { Button } from './ui/button';
import { Download, Copy, Check, Play, Server, Zap, RefreshCw, Link, Share2, AlertTriangle } from 'lucide-react';
import { Tooltip as RadixTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip as RechartsTooltip, ReferenceLine } from 'recharts';
import { useUiStateStore } from '@/stores/uiStateStore';
import { useMultiplayerStore, useActiveRoster } from '@/stores/multiplayerStore';
import { useNetworkDiagnosticsStore } from '@/stores/networkDiagnosticsStore';
import { useBottomNavbarVisible } from '@/hooks/useBottomNavbarVisible';
import { toast } from 'sonner';
import { encodeJazzCode } from '@/lib/sessionCodeResolver';
import { useCanvasEditStatusStore } from '@/stores/useCanvasEditStatusStore';
import { getHistoricalSessionsSummary, SessionSummary, metricsDb, NetworkWindowLog } from '@/lib/db/metricsDb';
import { TelemetrySettingsPanel } from './TelemetrySettingsPanel';

export const SyncProfilerPanel: React.FC = () => {
  const [stats, setStats] = useState({ outKb: '0.00', inKb: '0.00', outOps: 0, inOps: 0, activeDOs: 0, streamKb: '0.00' });
  const [chartData, setChartData] = useState<any[]>([]);
  const [budgetPct, setBudgetPct] = useState(0);
  const [active, setActive] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedRoot, setCopiedRoot] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  
  const [viewMode, setViewMode] = useState<'live' | 'history' | 'settings'>('live');
  const [historySummaries, setHistorySummaries] = useState<SessionSummary[]>([]);
  const [selectedHistorySession, setSelectedHistorySession] = useState<string | null>(null);
  const [historyLogs, setHistoryLogs] = useState<NetworkWindowLog[]>([]);
  const [timeBracket, setTimeBracket] = useState<'full' | '30m' | '1h'>('full');

  const isProfilerVisible = useUiStateStore(s => s.isProfilerVisible);
  const currentSession = useMultiplayerStore(s => s.currentSession);
  const currentUsername = useMultiplayerStore(s => s.currentUsername);
  const activeTransport = useMultiplayerStore((s) => s.activeTransport);
  const sessionRoles = useMultiplayerStore((s) => s.roles);
  const isBottomNavbarVisible = useBottomNavbarVisible();
  
  const peers = useNetworkDiagnosticsStore((s) => s.peers);
  const webrtcHistory = useNetworkDiagnosticsStore((s) => s.history);
  const peerList = Object.values(peers);
  const activeRoster = useActiveRoster();

  const activePeers = activeRoster.length;
  const currentBandwidth = webrtcHistory.length > 0 
    ? (Number(webrtcHistory[webrtcHistory.length - 1].inKb || 0) + Number(webrtcHistory[webrtcHistory.length - 1].outKb || 0)).toFixed(2)
    : '0.00';
  
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
      const jCode = encodeJazzCode(sessionId);
      const shareUrl = `${window.location.origin}/?session=${jCode}`;
      navigator.clipboard.writeText(shareUrl);
      setCopiedUrl(true);
      toast.success('Direct URL copied (J-Code based)');
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  useEffect(() => {
    if (viewMode === 'history') {
      getHistoricalSessionsSummary().then(setHistorySummaries).catch(console.error);
    }
  }, [viewMode]);

  useEffect(() => {
    if (viewMode === 'history' && selectedHistorySession) {
      metricsDb.profiler_logs.where('sessionId').equals(selectedHistorySession).toArray()
      .then(logs => {
         if (logs.length > 0) {
           logs.sort((a, b) => a.timestamp - b.timestamp);
           const lastLogTime = logs[logs.length - 1].timestamp;
           let filteredLogs = logs;
           if (timeBracket === '30m') {
             filteredLogs = logs.filter(l => l.timestamp >= lastLogTime - 30 * 60 * 1000);
           } else if (timeBracket === '1h') {
             filteredLogs = logs.filter(l => l.timestamp >= lastLogTime - 60 * 60 * 1000);
           }
           setHistoryLogs(filteredLogs);
         } else {
           setHistoryLogs([]);
         }
      })
      .catch(console.error);
    }
  }, [viewMode, selectedHistorySession, timeBracket]);

  const getHotnessColor = (maxOutOps: number) => {
    if (maxOutOps < 50) return 'border-blue-500 bg-blue-500/10 text-blue-400';
    if (maxOutOps < 120) return 'border-yellow-500 bg-yellow-500/10 text-yellow-400';
    return 'border-red-500 bg-red-500/10 text-red-400';
  };

  useEffect(() => {
    if (!active || viewMode === 'history') {
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
  }, [active, viewMode]);

  useEffect(() => {
    const role = sessionRoles.includes('dm') ? 'host' : 'client';
    syncProfiler.setRole(role);
  }, [sessionRoles]);

  const canvasEditStatus = useCanvasEditStatusStore((s) => s.status);

  if (!isProfilerVisible) return null;

  const sessionCode = currentSession?.sessionCode;
  const sessionRootId = currentSession?.sessionId;

  const isHistoryMode = viewMode === 'history';
  const isSettingsMode = viewMode === 'settings';

  // Derived Values for Display
  const displayStats = (!isHistoryMode || historyLogs.length === 0) ? stats : (function() {
    const last = historyLogs[historyLogs.length - 1];
    const totalStreamKb = historyLogs.reduce((acc, l) => acc + (l.streamOutKb || 0) + (l.streamInKb || 0), 0);
    return {
      outKb: Number(last.outKb || 0).toFixed(2),
      inKb: Number(last.inKb || 0).toFixed(2),
      outOps: last.outOps || 0,
      inOps: last.inOps || 0,
      activeDOs: last.activeDOs || 0,
      streamKb: totalStreamKb.toFixed(2),
    };
  })();

  const displayChartDataJazz = (!isHistoryMode || historyLogs.length === 0) ? chartData : historyLogs;
  const displayChartDataWebrtc = (!isHistoryMode || historyLogs.length === 0) ? safeWebrtcHistory : historyLogs;

  const maxJazzKbList = displayChartDataJazz.map(d => Math.max(Number(d.inKb) || 0, Number(d.outKb) || 0, 0.1));
  const maxJazzKb = maxJazzKbList.length > 0 ? Math.max(...maxJazzKbList) : 0.1;

  const maxWebrtcKbList = (!isHistoryMode || historyLogs.length === 0)
    ? displayChartDataWebrtc.map(d => Math.max(Number(d.inKb) || 0, Number(d.outKb) || 0, 0.1))
    : displayChartDataWebrtc.map(d => Math.max(Number(d.streamInKb) || 0, Number(d.streamOutKb) || 0, 0.1));
  const maxWebrtcKb = maxWebrtcKbList.length > 0 ? Math.max(...maxWebrtcKbList) : 0.1;

  const displayBudgetPct = isHistoryMode ? 0 : budgetPct;
  const displayActivePeers = isHistoryMode ? '-' : activePeers;
  const displayBandwidth = isHistoryMode ? '-' : currentBandwidth;

  const webRtcDataKeyOut = isHistoryMode ? "streamOutKb" : "outKb";
  const webRtcDataKeyIn = isHistoryMode ? "streamInKb" : "inKb";

  return (
    <div 
      className="fixed right-[100px] z-[9999] flex flex-col gap-2 transition-all duration-300 ease-in-out w-[550px]"
      style={{ bottom: isBottomNavbarVisible ? '120px' : '56px' }}
    >
      {/* HISTORY BROWSER (Top Float) */}
      {isHistoryMode && (
        <div className="bg-slate-900/95 text-xs text-white p-3 rounded-md border border-slate-700 shadow-2xl backdrop-blur-md flex flex-col gap-3">
          <div className="font-semibold text-slate-300 flex items-center justify-between text-[11px]">
            <span>Historical Sessions</span>
          </div>
          <div className="flex bg-slate-800 rounded border border-slate-700/50 p-1">
             <input type="text" placeholder="Filter sessions..." className="bg-transparent w-full outline-none text-[10px] px-2 text-slate-300 placeholder-slate-500" />
          </div>
          <div className="flex flex-col gap-2 overflow-y-auto pr-2 stylish-scrollbar max-h-[160px]">
            {historySummaries.map(s => {
              const isSelected = selectedHistorySession === s.sessionId;
              const durationMins = Math.round((s.endTime - s.startTime) / 60000);
              return (
                <div 
                  key={s.sessionId}
                  onClick={() => setSelectedHistorySession(s.sessionId)}
                  className={`w-full cursor-pointer rounded border p-2 flex flex-col gap-1 transition-all ${
                    isSelected ? 'ring-2 ring-slate-400 shadow-lg' : 'opacity-70 hover:opacity-100'
                  } ${getHotnessColor(s.maxOutOps)}`}
                >
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-mono truncate max-w-[200px]" title={s.sessionId}>{s.sessionId}</span>
                    <span className="capitalize font-semibold">{s.role}</span>
                  </div>
                  <div className="flex justify-between items-end mt-1">
                    <div className="text-[9px] text-slate-300">
                      {new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({durationMins}m)
                    </div>
                    <div className="flex gap-4 text-[9px] font-mono">
                      <span>Peak Op: {s.maxOutOps}</span>
                      <span>{s.maxOutKb.toFixed(1)}k</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {historySummaries.length === 0 && (
              <div className="text-slate-500 text-xs italic flex items-center justify-center p-4 w-full">No historical sessions found in local database.</div>
            )}
          </div>
        </div>
      )}

      {/* MAIN PROFILER BOX */}
      <div className="bg-slate-900/95 text-xs text-white p-3 rounded-md border border-slate-700 shadow-2xl flex flex-col backdrop-blur-md w-full">
        
        {/* Header Section */}
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-700">
          <div className="flex items-center gap-4">
            <div className="font-bold text-slate-200 text-sm tracking-wide">
              Network Profiler{' '}
              {sessionRoles.length > 0 && (
                <span className={`text-xs font-normal ml-1 px-1.5 py-0.5 rounded ${sessionRoles.includes('dm') ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
                  {sessionRoles.includes('dm') ? 'Host' : 'Client'}
                </span>
              )}
            </div>
          </div>
          
          {sessionCode && (
            <div className="flex items-center space-x-2">
              <RadixTooltip>
                <TooltipTrigger asChild>
                  <div 
                    className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 cursor-pointer px-2 py-1 rounded text-[10px] text-slate-300 transition-colors shrink-0 border border-slate-700/50"
                    onClick={handleCopyUrl}
                  >
                    <span className="font-mono text-slate-400">Share URL</span>
                    {copiedUrl ? <Check className="h-3 w-3 text-emerald-400" /> : <Link className="h-3 w-3" />}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top">Click to copy direct join URL (J-Code, works without registry)</TooltipContent>
              </RadixTooltip>
              <RadixTooltip>
                <TooltipTrigger asChild>
                  <div 
                    className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 cursor-pointer px-2 py-1 rounded text-[10px] text-slate-300 transition-colors shrink-0 border border-slate-700/50"
                    onClick={handleCopyLink}
                  >
                    <span className="font-mono text-slate-400">J-Code</span>
                    {copiedLink ? <Check className="h-3 w-3 text-emerald-400" /> : <Share2 className="h-3 w-3" />}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top">Click to copy J-Code (paste into Join Session)</TooltipContent>
              </RadixTooltip>
              <RadixTooltip>
                <TooltipTrigger asChild>
                  <div 
                    className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 cursor-pointer px-2 py-1 rounded text-[10px] text-slate-300 transition-colors shrink-0 border border-slate-700/50"
                    onClick={handleCopySessionCode}
                  >
                    <span className="font-mono text-slate-400">Code:</span>
                    <span className="font-mono text-emerald-400">{sessionCode}</span>
                    {copiedCode ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top">Click to copy short code (requires registry to join)</TooltipContent>
              </RadixTooltip>
            </div>
          )}
        </div>

        {isSettingsMode ? (
          <div className="flex flex-col min-h-[300px] max-h-[500px] overflow-y-auto pr-2 stylish-scrollbar">
            <TelemetrySettingsPanel />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6 items-stretch">
          
          {/* SECTION 1: Jazz Network State */}
          <div className="flex flex-col min-w-0">
            <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-800">
              <div className="font-semibold text-slate-300 flex items-center shrink-0">
                <Server className="h-3 w-3 mr-1.5 text-blue-400" /> Durable Objects (Jazz)
              </div>
              {sessionRootId && (
                <RadixTooltip>
                  <TooltipTrigger asChild>
                    <div 
                      className="flex items-center space-x-1 bg-slate-800 hover:bg-slate-700 cursor-pointer px-1.5 py-0.5 rounded text-[9px] text-slate-300 transition-colors ml-2 shrink-0"
                      onClick={handleCopySessionRoot}
                    >
                      <span className="truncate max-w-[70px]">{sessionRootId}</span>
                      {copiedRoot ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top">Click to copy Session Root ID</TooltipContent>
                </RadixTooltip>
              )}
            </div>
          
            <TooltipProvider>
              <div className="flex flex-col mb-3 flex-1 gap-2">
                
                {/* Minimal Stat Row */}
                <div className="flex items-center justify-between text-[10px]">
                  <div className="flex gap-3">
                    <span className="text-yellow-400 font-mono">↑ {displayStats.outKb} KB</span>
                    <span className="text-blue-400 font-mono">↓ {displayStats.inKb} KB</span>
                  </div>
                  <div className="flex gap-3 text-slate-400">
                    <span className="text-purple-400 font-mono">❖ {displayStats.activeDOs} DOs</span>
                    <span className="text-emerald-400 font-mono">≈ {displayStats.streamKb} KB</span>
                  </div>
                </div>

                {/* Recharts Chart */}
                <div className="h-[60px] w-full bg-slate-800/50 rounded border border-slate-700/50 p-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={displayChartDataJazz} syncId="network-metrics-sync" margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
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
                    <span>{displayBudgetPct.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
                    <div 
                      className={`h-full transition-all duration-300 ${
                        displayBudgetPct > 80 ? 'bg-red-500' : displayBudgetPct > 50 ? 'bg-yellow-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, displayBudgetPct)}%` }}
                    />
                  </div>
                </div>

              </div>
            </TooltipProvider>

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
                  <span className="text-purple-400 font-mono">🫂 {displayActivePeers} Peers</span>
                  <span className="text-slate-400 font-mono">⚡ - ms</span>
                </div>
                <div className="flex gap-3 text-slate-400">
                  <span className="text-emerald-400 font-mono">≈ {displayBandwidth} KB/s</span>
                </div>
              </div>

              {/* Recharts Chart */}
              <div className="h-[60px] w-full bg-slate-800/50 rounded border border-slate-700/50 p-1">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={displayChartDataWebrtc} syncId="network-metrics-sync" margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
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
                    <Line type="monotone" dataKey={webRtcDataKeyOut} stroke="#facc15" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey={webRtcDataKeyIn} stroke="#60a5fa" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {isHistoryMode ? (
                <div className="flex-1 flex items-center justify-center text-slate-500 italic text-[10px] min-h-[40px]">
                  Peer details not saved in session history
                </div>
              ) : (
                (!activeTransport || peerList.length === 0) ? (
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
                            <RadixTooltip>
                              <TooltipTrigger asChild>
                                <span className="font-mono text-[10px] truncate max-w-[100px] text-slate-300">
                                  {peer.isHost ? "Host: " : "Client: "}
                                  <span className="opacity-70">{peer.clientId.substring(0, 8)}...</span>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top">{peer.clientId}</TooltipContent>
                            </RadixTooltip>
                            <span className={`font-semibold capitalize text-[9px] ${colorClass}`}>
                              {peer.stage.replace('_', ' ')}
                            </span>
                         </div>
                         <div className="flex justify-between items-center text-[9px] text-slate-400 mt-0.5">
                            <div>ICE: <span className="text-slate-300 font-mono">{peer.iceState || 'unknown'}</span></div>
                            {isError && peer.error && (
                              <RadixTooltip>
                                <TooltipTrigger asChild>
                                  <div className="text-red-400 truncate max-w-[80px]">{peer.error}</div>
                                </TooltipTrigger>
                                <TooltipContent side="top">{peer.error}</TooltipContent>
                              </RadixTooltip>
                            )}
                         </div>
                       </div>
                     );
                  })}
                  </div>
                )
              )}

            </div>
          </div>

        </div>
        )}

        {/* Unified Bottom Controls */}
        <div className="mt-4 pt-3 border-t border-slate-700/50 flex justify-between items-center gap-6">
          <div className="flex-1">
            {isHistoryMode ? (
              <div className="flex w-full items-center justify-between space-x-2 bg-slate-800 rounded p-0.5 border border-slate-700">
                <button className={`flex-1 px-2 py-1 text-[10px] rounded transition-colors ${timeBracket === 'full' ? 'bg-slate-600 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'}`} onClick={() => setTimeBracket('full')}>Full</button>
                <button className={`flex-1 px-2 py-1 text-[10px] rounded transition-colors ${timeBracket === '30m' ? 'bg-slate-600 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'}`} onClick={() => setTimeBracket('30m')}>30m</button>
                <button className={`flex-1 px-2 py-1 text-[10px] rounded transition-colors ${timeBracket === '1h' ? 'bg-slate-600 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'}`} onClick={() => setTimeBracket('1h')}>1hr</button>
              </div>
            ) : (
              <div className="flex space-x-2 w-full">
                <Button 
                  variant={active ? "destructive" : "secondary"} 
                  size="sm" 
                  className="h-6 text-[10px] flex-1 px-2"
                  onClick={() => setActive(!active)}
                >
                  {active ? 'Pause Profiler' : 'Resume Profiler'}
                </Button>
                <RadixTooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-[10px] flex-1 flex items-center justify-center gap-1 bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700 hover:text-white px-2"
                      onClick={() => {
                        const role = sessionRoles.includes('dm') ? 'host' : 'client';
                        const safeName = (currentUsername || 'unknown').replace(/[^a-z0-9]/gi, '_').toLowerCase();
                        syncProfiler.downloadCSV(`${role}-${safeName}-sync_profiler_log_${Date.now()}.csv`);
                      }}
                    >
                      <Download className="h-3 w-3 mr-1" /> Save CSV
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Download Profiler Log (CSV)</TooltipContent>
                </RadixTooltip>
              </div>
            )}
          </div>

          <div className="flex-1 flex justify-end">
            <div className="flex bg-slate-800 rounded p-0.5 w-full">
              <button
                className={`flex-1 px-2 py-1 text-[10px] rounded transition-colors ${viewMode === 'live' ? 'bg-slate-600 text-white font-semibold shadow' : 'text-slate-400 hover:text-slate-200'}`}
                onClick={() => setViewMode('live')}
              >
                Live
              </button>
              <button
                className={`flex-1 px-2 py-1 text-[10px] rounded transition-colors ${viewMode === 'history' ? 'bg-slate-600 text-white font-semibold shadow' : 'text-slate-400 hover:text-slate-200'}`}
                onClick={() => setViewMode('history')}
              >
                History
              </button>
              <button
                className={`flex-1 px-2 py-1 text-[10px] rounded transition-colors ${viewMode === 'settings' ? 'bg-slate-600 text-white font-semibold shadow' : 'text-slate-400 hover:text-slate-200'}`}
                onClick={() => setViewMode('settings')}
              >
                Settings
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
