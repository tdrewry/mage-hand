/**
 * GenericFlowCanvas — visual node-based flow graph editor.
 * Uses Magehand's existing UI components instead of bundled primitives.
 */

import { useRef, useState, useCallback, useMemo } from 'react';
import { BaseFlowNode, BaseNodeData, FlowNodePosition } from '../types/base';
import { CampaignEditorAdapter } from '../types/adapter';
import { cn } from '@/lib/utils';
import { Flag, ZoomIn, ZoomOut, Maximize, LayoutGrid, Swords, ScrollText, MessageSquare, Tent, Circle, Calculator, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getBezierPath, getDragBezierPath } from '../utils/geometry';

const NODE_WIDTH = 180;
const NODE_HEIGHT = 80;

interface DragConnection {
  sourceId: string;
  type: 'success' | 'failure';
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export interface FlowCanvasViewState {
  scale: number;
  offset: { x: number; y: number };
  containerWidth: number;
  containerHeight: number;
}

interface GenericFlowCanvasProps<TNodeData extends BaseNodeData = BaseNodeData, TNode extends BaseFlowNode<TNodeData> = BaseFlowNode<TNodeData>> {
  nodes: TNode[];
  positions: Record<string, FlowNodePosition>;
  selectedNodeId: string | null;
  startNodeId: string;
  adapter: CampaignEditorAdapter<any, any, TNodeData, TNode, any>;
  onNodeSelect: (nodeId: string) => void;
  onNodeMove: (nodeId: string, position: FlowNodePosition) => void;
  onConnectionCreate?: (sourceId: string, targetId: string, type: 'success' | 'failure') => void;
  onConnectionDelete?: (sourceId: string, targetId: string, type: 'success' | 'failure') => void;
  viewStateRef?: React.MutableRefObject<FlowCanvasViewState | null>;
}

export function GenericFlowCanvas<TNodeData extends BaseNodeData = BaseNodeData, TNode extends BaseFlowNode<TNodeData> = BaseFlowNode<TNodeData>>({
  nodes,
  positions,
  selectedNodeId,
  startNodeId,
  adapter,
  onNodeSelect,
  onNodeMove,
  onConnectionCreate,
  onConnectionDelete,
  viewStateRef,
}: GenericFlowCanvasProps<TNodeData, TNode>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 50, y: 50 });

  // Keep viewStateRef in sync so parent can read current view center
  if (viewStateRef) {
    const rect = containerRef.current?.getBoundingClientRect();
    viewStateRef.current = {
      scale,
      offset,
      containerWidth: rect?.width ?? 800,
      containerHeight: rect?.height ?? 600,
    };
  }
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragConnection, setDragConnection] = useState<DragConnection | null>(null);
  const [hoverNodeId, setHoverNodeId] = useState<string | null>(null);
  const [hoveredConnection, setHoveredConnection] = useState<string | null>(null);

  const contentBounds = useMemo(() => {
    let maxX = 0, maxY = 0;
    Object.values(positions).forEach(pos => {
      maxX = Math.max(maxX, pos.x + NODE_WIDTH + 100);
      maxY = Math.max(maxY, pos.y + NODE_HEIGHT + 100);
    });
    return { width: Math.max(800, maxX), height: Math.max(600, maxY) };
  }, [positions]);

  const zoomIn = () => setScale(s => Math.min(2, s * 1.2));
  const zoomOut = () => setScale(s => Math.max(0.3, s / 1.2));
  const fitToView = useCallback(() => {
    if (!containerRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    const scaleX = (width - 100) / contentBounds.width;
    const scaleY = (height - 100) / contentBounds.height;
    setScale(Math.min(scaleX, scaleY, 1));
    setOffset({ x: 50, y: 50 });
  }, [contentBounds]);

  /** Topological auto-layout: arranges nodes in columns by graph depth. */
  const autoLayout = useCallback(() => {
    if (nodes.length === 0) return;

    // Build adjacency
    const successors = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    nodes.forEach(n => {
      successors.set(n.id, [...n.nextOnSuccess, ...(n.nextOnFailure && n.nextOnFailure !== 'end' ? [n.nextOnFailure] : [])]);
      if (!inDegree.has(n.id)) inDegree.set(n.id, 0);
    });
    nodes.forEach(n => {
      (successors.get(n.id) || []).forEach(t => {
        inDegree.set(t, (inDegree.get(t) || 0) + 1);
      });
    });

    // BFS from start node (or roots) to assign depth
    const depth = new Map<string, number>();
    const queue: string[] = [];

    // Start with the designated start node first, then any zero-indegree roots
    if (startNodeId) { depth.set(startNodeId, 0); queue.push(startNodeId); }
    nodes.forEach(n => {
      if (!depth.has(n.id) && (inDegree.get(n.id) || 0) === 0) {
        depth.set(n.id, 0);
        queue.push(n.id);
      }
    });

    while (queue.length > 0) {
      const current = queue.shift()!;
      const d = depth.get(current) || 0;
      (successors.get(current) || []).forEach(t => {
        // Only visit unvisited nodes — skip back-edges to avoid infinite loops in cyclic graphs
        if (!depth.has(t)) {
          depth.set(t, d + 1);
          queue.push(t);
        }
      });
    }

    // Any unreachable nodes get max depth + 1
    const maxDepth = Math.max(0, ...Array.from(depth.values()));
    nodes.forEach(n => { if (!depth.has(n.id)) depth.set(n.id, maxDepth + 1); });

    // Group by depth column
    const columns = new Map<number, string[]>();
    depth.forEach((d, id) => {
      if (!columns.has(d)) columns.set(d, []);
      columns.get(d)!.push(id);
    });

    const H_SPACING = NODE_WIDTH + 60;
    const V_SPACING = NODE_HEIGHT + 40;

    columns.forEach((ids, col) => {
      ids.forEach((id, row) => {
        const totalHeight = ids.length * V_SPACING;
        onNodeMove(id, {
          x: 40 + col * H_SPACING,
          y: 40 + row * V_SPACING + (300 - totalHeight) / 2, // Center vertically
        });
      });
    });
  }, [nodes, startNodeId, onNodeMove]);

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (e.target === containerRef.current || target.classList.contains('canvas-bg')) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }
  };

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) setOffset({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    if (draggingNode && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - offset.x) / scale - dragOffset.x;
      const y = (e.clientY - rect.top - offset.y) / scale - dragOffset.y;
      onNodeMove(draggingNode, { x, y });
    }
    if (dragConnection && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDragConnection(prev => prev ? {
        ...prev,
        currentX: (e.clientX - rect.left - offset.x) / scale,
        currentY: (e.clientY - rect.top - offset.y) / scale,
      } : null);
    }
  }, [isPanning, panStart, draggingNode, offset, scale, dragOffset, onNodeMove, dragConnection]);

  const handleCanvasMouseUp = useCallback(() => {
    if (dragConnection && hoverNodeId && hoverNodeId !== dragConnection.sourceId) {
      onConnectionCreate?.(dragConnection.sourceId, hoverNodeId, dragConnection.type);
    }
    setIsPanning(false);
    setDraggingNode(null);
    setDragConnection(null);
    setHoverNodeId(null);
  }, [dragConnection, hoverNodeId, onConnectionCreate]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(s => Math.min(2, Math.max(0.3, s * delta)));
  }, []);

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    const pos = positions[nodeId] || { x: 0, y: 0 };
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left - offset.x) / scale;
      const mouseY = (e.clientY - rect.top - offset.y) / scale;
      setDragOffset({ x: mouseX - pos.x, y: mouseY - pos.y });
    }
    setDraggingNode(nodeId);
    onNodeSelect(nodeId);
  };

  const handleConnectionDragStart = (e: React.MouseEvent, nodeId: string, type: 'success' | 'failure') => {
    e.stopPropagation();
    e.preventDefault();
    const pos = positions[nodeId];
    if (!pos || !containerRef.current) return;
    const startX = pos.x + NODE_WIDTH;
    const startY = pos.y + NODE_HEIGHT / 2 + (type === 'failure' ? 12 : -12);
    const rect = containerRef.current.getBoundingClientRect();
    setDragConnection({
      sourceId: nodeId, type, startX, startY,
      currentX: (e.clientX - rect.left - offset.x) / scale,
      currentY: (e.clientY - rect.top - offset.y) / scale,
    });
  };

  const getConnectionPath = (from: FlowNodePosition, to: FlowNodePosition): string => {
    return getBezierPath(
      { x: from.x, y: from.y, width: NODE_WIDTH, height: NODE_HEIGHT },
      { x: to.x, y: to.y, width: NODE_WIDTH, height: NODE_HEIGHT }
    );
  };

  const getDragConnectionPath = (): string => {
    if (!dragConnection) return '';
    const { startX, startY, currentX, currentY } = dragConnection;
    // We already calculated the drag connection source node when dragging started.
    // So we can still use the geometry fn by tracking the source BoundingBox or just using its position.
    // Note: dragConnection has startX, startY based on the hardcoded dot previously.
    // We will update handleConnectionDragStart to only store sourceId, or we look it up here.
    const sourcePos = positions[dragConnection.sourceId];
    if (!sourcePos) return '';
    return getDragBezierPath(
      { x: sourcePos.x, y: sourcePos.y, width: NODE_WIDTH, height: NODE_HEIGHT },
      { x: currentX, y: currentY }
    );
  };

  const connections: Array<{ id: string; sourceId: string; targetId: string; type: 'success' | 'failure' }> = [];
  nodes.forEach(node => {
    const sourcePos = positions[node.id];
    if (!sourcePos) return;
    node.nextOnSuccess.forEach((targetId, idx) => {
      if (positions[targetId]) connections.push({ id: `${node.id}-success-${idx}`, sourceId: node.id, targetId, type: 'success' });
    });
    if (node.nextOnFailure && typeof node.nextOnFailure === 'string' && node.nextOnFailure !== 'retry' && node.nextOnFailure !== 'end') {
      if (positions[node.nextOnFailure]) connections.push({ id: `${node.id}-failure`, sourceId: node.id, targetId: node.nextOnFailure, type: 'failure' });
    }
  });

  const NODE_TYPE_ICONS: Record<string, React.ReactNode> = {
    encounter: <Swords className="w-3.5 h-3.5" />,
    narrative: <ScrollText className="w-3.5 h-3.5" />,
    dialog: <MessageSquare className="w-3.5 h-3.5" />,
    rest: <Tent className="w-3.5 h-3.5" />,
    rule: <Shield className="w-3.5 h-3.5" />,
    function_node: <Calculator className="w-3.5 h-3.5" />,
  };

  const getNodeIcon = (node: TNode) => {
    const typeIcon = NODE_TYPE_ICONS[node.nodeType || 'encounter'] || <Circle className="w-3.5 h-3.5" />;
    const isStart = node.id === startNodeId || node.isStartNode;
    if (isStart) {
      return (
        <span className="flex items-center gap-1">
          {typeIcon}
          <Flag className="w-3 h-3 text-primary" />
        </span>
      );
    }
    return typeIcon;
  };

  const nodeLabel = adapter.labels?.node || 'Node';

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-background/50 cursor-grab active:cursor-grabbing touch-none"
      style={{ overflow: 'hidden' }}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleCanvasMouseMove}
      onMouseUp={handleCanvasMouseUp}
      onMouseLeave={() => { setIsPanning(false); setDraggingNode(null); }}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Zoom controls */}
      <div className="absolute top-2 right-2 z-10 flex gap-1">
        <Button variant="secondary" size="sm" className="h-7 w-7 p-0" onClick={zoomOut}><ZoomOut className="w-3 h-3" /></Button>
        <Button variant="secondary" size="sm" className="h-7 px-2 text-xs">{Math.round(scale * 100)}%</Button>
        <Button variant="secondary" size="sm" className="h-7 w-7 p-0" onClick={zoomIn}><ZoomIn className="w-3 h-3" /></Button>
        <Button variant="secondary" size="sm" className="h-7 w-7 p-0" onClick={fitToView}><Maximize className="w-3 h-3" /></Button>
        <Button variant="secondary" size="sm" className="h-7 w-7 p-0" onClick={autoLayout} title="Auto Layout"><LayoutGrid className="w-3 h-3" /></Button>
      </div>

      {/* Grid background */}
      <div
        className="canvas-bg absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(hsl(var(--border) / 0.3) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border) / 0.3) 1px, transparent 1px)`,
          backgroundSize: `${30 * scale}px ${30 * scale}px`,
          backgroundPosition: `${offset.x}px ${offset.y}px`,
        }}
      />

      {/* SVG layer for connections */}
      <svg
        className="absolute inset-0 pointer-events-none overflow-visible"
        width="100%"
        height="100%"
        style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, transformOrigin: '0 0' }}
      >
        <defs>
          <marker id="arrowhead-success" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="hsl(142 71% 45%)" />
          </marker>
          <marker id="arrowhead-failure" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--destructive))" />
          </marker>
        </defs>

        {connections.map(conn => {
          const from = positions[conn.sourceId];
          const to = positions[conn.targetId];
          if (!from || !to) return null;
          const isHovered = hoveredConnection === conn.id;
          return (
            <g key={conn.id}>
              <path d={getConnectionPath(from, to)} fill="none" stroke="transparent" strokeWidth={16}
                className="cursor-pointer pointer-events-auto"
                onMouseEnter={() => setHoveredConnection(conn.id)}
                onMouseLeave={() => setHoveredConnection(null)}
                onClick={(e) => { e.stopPropagation(); onConnectionDelete?.(conn.sourceId, conn.targetId, conn.type); }}
              />
              <path d={getConnectionPath(from, to)} fill="none"
                stroke={conn.type === 'success' ? 'hsl(142 71% 45%)' : 'hsl(var(--destructive))'}
                strokeWidth={isHovered ? 4 : 2}
                strokeDasharray={conn.type === 'failure' ? '5,5' : undefined}
                markerEnd={`url(#arrowhead-${conn.type})`}
                className="pointer-events-none"
                opacity={isHovered ? 1 : 0.7}
              />
            </g>
          );
        })}

        {dragConnection && (
          <path d={getDragConnectionPath()} fill="none"
            stroke={dragConnection.type === 'success' ? 'hsl(142 71% 45%)' : 'hsl(var(--destructive))'}
            strokeWidth={2} strokeDasharray="5,5" opacity={0.6}
          />
        )}
      </svg>

      {/* Nodes layer */}
      <div className="absolute" style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, transformOrigin: '0 0' }}>
        {nodes.map(node => {
          const pos = positions[node.id] || { x: 0, y: 0 };
          const isSelected = selectedNodeId === node.id;
          const isStart = node.id === startNodeId;
          const isHover = hoverNodeId === node.id && dragConnection !== null;
          const isFunctionNode = node.nodeType === 'function_node';

          return (
            <div
              key={node.id}
              className={cn(
                "absolute rounded-lg border-2 bg-card shadow-md cursor-pointer transition-shadow",
                isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                isStart && !isFunctionNode && "border-primary",
                isStart && isFunctionNode && "border-primary bg-purple-500/5",
                !isStart && !isFunctionNode && "border-border",
                isFunctionNode && !isStart && "border-purple-500/50 bg-purple-500/5",
                isHover && "ring-2 ring-green-500",
                draggingNode === node.id && "shadow-lg"
              )}
              style={{ left: pos.x, top: pos.y, width: NODE_WIDTH, height: NODE_HEIGHT }}
              onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
              onMouseEnter={() => dragConnection && setHoverNodeId(node.id)}
              onMouseLeave={() => setHoverNodeId(null)}
            >
              <div className="p-2 h-full flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className={cn(
                     "flex items-center gap-1", 
                     isStart && !isFunctionNode && "text-primary", 
                     isFunctionNode && "text-purple-500",
                     !isStart && !isFunctionNode && "text-muted-foreground"
                  )}>{getNodeIcon(node)}</span>
                  <span className="text-xs font-bold truncate flex-1">{node.nodeData.name || node.id}</span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                  {node.title || node.nodeData.description || `${nodeLabel} ${node.id}`}
                </div>
              </div>

              {/* Connection handles */}
              <div
                className="absolute right-0 top-1/2 -translate-y-3 translate-x-1/2 w-3 h-3 rounded-full bg-green-500 border-2 border-background cursor-crosshair hover:scale-125 transition-transform"
                onMouseDown={(e) => handleConnectionDragStart(e, node.id, 'success')}
              />
              <div
                className="absolute right-0 top-1/2 translate-y-1 translate-x-1/2 w-3 h-3 rounded-full bg-destructive border-2 border-background cursor-crosshair hover:scale-125 transition-transform"
                onMouseDown={(e) => handleConnectionDragStart(e, node.id, 'failure')}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
