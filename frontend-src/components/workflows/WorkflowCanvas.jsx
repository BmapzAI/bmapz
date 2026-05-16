import React, { useRef, useState, useEffect } from 'react';
import { X, Copy, Sparkles, Play, Check, Clock, GitBranch, MessageSquare, Calendar, Share2, UserSearch } from 'lucide-react';
import { Zap } from 'lucide-react';

export const NODE_TYPES = {
  trigger:          { name: 'Start',             icon: Play,         color: '#22c55e', category: 'trigger' },
  send_message:     { name: 'Send Message',      icon: MessageSquare,color: '#38b6ff', category: 'action'  },
  social_action:    { name: 'Social Action',     icon: Share2,       color: '#e1306c', category: 'action'  },
  enrich_lead:      { name: 'Enrich Lead',       icon: UserSearch,   color: '#f59e0b', category: 'action'  },
  schedule_meeting: { name: 'Schedule Meeting',  icon: Calendar,     color: '#a78bfa', category: 'action'  },
  wait:             { name: 'Wait',              icon: Clock,        color: '#cb6ce6', category: 'delay'   },
  condition:        { name: 'Condition',         icon: GitBranch,    color: '#00e7ff', category: 'logic'   },
  end_success:      { name: 'End (Success)',     icon: Check,        color: '#22c55e', category: 'end'     },
  end_failed:       { name: 'End (Failed)',      icon: X,            color: '#ef4444', category: 'end'     },
};

export const CONDITION_OPTIONS = [
  // Reply detection
  { value: 'replied',              label: 'Lead Replied (any channel)'        },
  { value: 'no_response',         label: 'No Response (after wait)'           },
  // Sentiment (from AI analysis)
  { value: 'positive_reply',      label: '😊 Positive Reply (AI detected)'    },
  { value: 'negative_reply',      label: '😠 Negative / Disinterested Reply'  },
  { value: 'interested',          label: '🔥 Interested / Meeting Request'    },
  { value: 'not_interested',      label: '❌ Not Interested / Unsubscribe'    },
  { value: 'objection_raised',    label: '⚠️ Objection Raised'                },
  { value: 'question_asked',      label: '❓ Lead Asked a Question'           },
  // Actions
  { value: 'meeting_booked',      label: '📅 Meeting Booked'                  },
  { value: 'meeting_declined',    label: '🚫 Meeting Declined'                },
  { value: 'opened',              label: '📧 Email Opened'                    },
  // Channel-specific
  { value: 'instagram_replied',   label: '📸 Instagram DM Replied'           },
  // Status
  { value: 'qualified',           label: '✅ Lead Qualified'                  },
  { value: 'disqualified',        label: '🚫 Lead Disqualified'               },
  { value: 'connected_linkedin',  label: '💼 LinkedIn Connection Accepted'    },
  { value: 'enriched',            label: '🔍 Lead Data Enriched'              },
];

function FlowNode({ node, isSelected, onSelect, onShiftSelect, onDelete, onUpdate, onStartConnection, onEndConnection, inConnectionMode }) {
  const config = NODE_TYPES[node.type] || NODE_TYPES.send_message;
  const Icon = config.icon;
  const ref = useRef(null);

  const handleMouseDown = (e) => {
    if (inConnectionMode) return;
    e.stopPropagation();
    const parent = ref.current?.offsetParent;
    if (!parent) return;
    const startX = e.clientX - node.x;
    const startY = e.clientY - node.y;
    const move = (me) => {
      onUpdate(node.id, { x: Math.max(0, me.clientX - startX), y: Math.max(0, me.clientY - startY) });
    };
    const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  };

  return (
    <div
      ref={ref}
      data-flow-node="true"
      className={`absolute select-none group ${inConnectionMode ? 'cursor-crosshair' : 'cursor-move'} ${isSelected ? 'z-20' : 'z-10'}`}
      style={{ left: node.x, top: node.y }}
      onMouseDown={handleMouseDown}
      onClick={(e) => { e.stopPropagation(); if (inConnectionMode) { onEndConnection(node.id); return; } if (e.shiftKey) { onShiftSelect(node.id); } else { onSelect(node.id); } }}
    >
      <div className={`w-44 rounded-xl border-2 overflow-visible transition-all
        ${isSelected ? 'border-[#38b6ff] shadow-lg shadow-[#38b6ff]/30' : 'border-white/20 hover:border-white/50'} bg-[#181818]`}>
        <div className="px-3 py-2 flex items-center gap-2 rounded-t-xl" style={{ backgroundColor: `${config.color}25` }}>
          <Icon size={14} style={{ color: config.color }} />
          <span className="text-white text-xs font-semibold truncate flex-1">{node.name || config.name}</span>
        </div>
        <div className="px-3 py-1.5 text-[11px] text-gray-400 min-h-[24px]">
          {node.type === 'wait' && `Wait ${node.delay_days || 0}d ${node.delay_hours || 0}h`}
          {node.type === 'condition' && (CONDITION_OPTIONS.find(c => c.value === node.condition)?.label || 'Pick condition')}
          {node.type === 'send_message' && (node.channel ? `via ${node.channel === 'instagram' ? 'Instagram DM' : node.channel.charAt(0).toUpperCase() + node.channel.slice(1)}` : '⚠ Pick channel')}
          {node.type === 'trigger' && 'Workflow entry point'}
          {node.type === 'schedule_meeting' && 'Schedule meeting with lead'}
          {node.type === 'social_action' && (node.social_platform ? `${node.social_platform} · ${node.social_action_type || '?'}` : '⚠ Configure action')}
          {node.type === 'enrich_lead' && (node.enrich_provider ? `via ${node.enrich_provider}` : '⚠ Pick provider')}
          {(node.type === 'end_success' || node.type === 'end_failed') && 'End of workflow'}
        </div>
      </div>

      {/* IN port */}
      {node.type !== 'trigger' && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-gray-500 bg-[#181818] hover:border-[#38b6ff] hover:bg-[#38b6ff]/20 cursor-pointer transition-colors z-30"
          onClick={(e) => { e.stopPropagation(); onEndConnection(node.id); }} />
      )}

      {/* OUT ports */}
      {node.type !== 'end_success' && node.type !== 'end_failed' && (
        node.type === 'condition' ? (
          <>
            <div className="absolute -bottom-2 left-[30%] -translate-x-1/2 w-5 h-5 rounded-full border-2 border-green-400 bg-[#181818] cursor-pointer hover:bg-green-400/20 transition-colors flex items-center justify-center text-[8px] text-green-400 z-30"
              onClick={(e) => { e.stopPropagation(); onStartConnection(node.id, 'yes'); }}>Y</div>
            <div className="absolute -bottom-2 left-[70%] -translate-x-1/2 w-5 h-5 rounded-full border-2 border-red-400 bg-[#181818] cursor-pointer hover:bg-red-400/20 transition-colors flex items-center justify-center text-[8px] text-red-400 z-30"
              onClick={(e) => { e.stopPropagation(); onStartConnection(node.id, 'no'); }}>N</div>
          </>
        ) : (
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-gray-500 bg-[#181818] hover:border-[#38b6ff] hover:bg-[#38b6ff]/20 cursor-pointer transition-colors z-30"
            onClick={(e) => { e.stopPropagation(); onStartConnection(node.id, 'default'); }} />
        )
      )}

      {/* Action buttons on select */}
      {isSelected && node.type !== 'trigger' && (
        <div className="absolute -top-3 -right-3 flex gap-1 z-40">
          <button onClick={(e) => { e.stopPropagation(); onUpdate(node.id, { _duplicate: true }); }}
            className="w-6 h-6 rounded-full bg-[#38b6ff] text-white flex items-center justify-center hover:opacity-80">
            <Copy size={10} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
            className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:opacity-80">
            <X size={10} />
          </button>
        </div>
      )}
    </div>
  );
}

function Arrow({ conn, nodes, isSelected, onSelect, onDelete }) {
  const [hovered, setHovered] = useState(false);
  const from = nodes.find(n => n.id === conn.from.nodeId);
  const to = nodes.find(n => n.id === conn.to);
  if (!from || !to) return null;

  const offset = conn.from.port === 'yes' ? -30 : conn.from.port === 'no' ? 30 : 0;
  const x1 = from.x + 88 + offset;
  const y1 = from.y + 68;
  const x2 = to.x + 88;
  const y2 = to.y;
  const my = (y1 + y2) / 2;
  const d = `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`;
  const color = conn.from.port === 'yes' ? '#22c55e' : conn.from.port === 'no' ? '#ef4444' : '#38b6ff';
  const mx = (x1 + x2) / 2;
  const mmy = (y1 + y2) / 2;

  return (
    <g>
      <path d={d} stroke="transparent" strokeWidth={24} fill="none" style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
        onClick={(e) => { e.stopPropagation(); onSelect(conn); }}
        onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} />
      <path d={d} stroke={color} strokeWidth={isSelected ? 3 : hovered ? 2.5 : 1.5} fill="none"
        strokeOpacity={isSelected || hovered ? 1 : 0.6} markerEnd="url(#arrow)" className="pointer-events-none" />
      {(hovered || isSelected) && (
        <g style={{ pointerEvents: 'all', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onDelete(conn); }}>
          <circle cx={mx} cy={mmy} r={10} fill="#ef4444" stroke="white" strokeWidth={1.5} />
          <line x1={mx - 4} y1={mmy} x2={mx + 4} y2={mmy} stroke="white" strokeWidth={2} />
        </g>
      )}
    </g>
  );
}

export default function WorkflowCanvas({ nodes, connections, onNodesChange, onConnectionsChange, onNodeSelect, selectedNodeId }) {
  const [connMode, setConnMode] = useState(null);
  const [selectedConn, setSelectedConn] = useState(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState(new Set());
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [dragType, setDragType] = useState(null);
  const [selectionRect, setSelectionRect] = useState(null); // {startX, startY, endX, endY}
  const [isSelecting, setIsSelecting] = useState(false);
  const selectionStartRef = useRef(null);
  const canvasRef = useRef(null);

  const updateNode = (id, updates) => {
    if (updates._duplicate) {
      const src = nodes.find(n => n.id === id);
      if (src && src.type !== 'trigger') {
        const dup = { ...src, id: `node_${Date.now()}`, name: `${src.name} (Copy)`, x: src.x + 60, y: src.y + 60 };
        onNodesChange([...nodes, dup]);
      }
      return;
    }
    onNodesChange(nodes.map(n => n.id === id ? { ...n, ...updates } : n));
  };

  const deleteNode = (id) => {
    onNodesChange(nodes.filter(n => n.id !== id));
    onConnectionsChange(connections.filter(c => c.from.nodeId !== id && c.to !== id));
    onNodeSelect(null);
  };

  const startConn = (nodeId, port) => setConnMode({ nodeId, port });

  const endConn = (targetId) => {
    if (connMode && connMode.nodeId !== targetId) {
      // Always add a new connection — allow multiple connections from same port
      // (deduplication only if exact same from+port+to already exists)
      const duplicate = connections.find(c =>
        c.from.nodeId === connMode.nodeId && c.from.port === connMode.port && c.to === targetId
      );
      if (!duplicate) {
        onConnectionsChange([...connections, { from: connMode, to: targetId }]);
      }
    }
    setConnMode(null);
  };

  const deleteConn = (conn) => {
    onConnectionsChange(connections.filter(c => !(c.from.nodeId === conn.from.nodeId && c.from.port === conn.from.port && c.to === conn.to)));
    setSelectedConn(null);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeId) {
        const n = nodes.find(x => x.id === selectedNodeId);
        if (n?.type !== 'trigger') deleteNode(selectedNodeId);
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedConn) deleteConn(selectedConn);
      if (e.key === 'Escape') {
        if (connMode) { setConnMode(null); return; }
        // If something is selected (including multi-select), only deselect — don't close builder
        if (selectedConn || selectedNodeId || selectedNodeIds.size > 0) {
          setSelectedConn(null);
          setSelectedNodeIds(new Set());
          onNodeSelect(null);
          return;
        }
        // Nothing selected — let parent handle close (WorkflowBuilderModal listens for this)
        window.dispatchEvent(new CustomEvent('workflow-esc-close'));
      }
      if (e.ctrlKey && e.key === 'd' && selectedNodeId) { e.preventDefault(); updateNode(selectedNodeId, { _duplicate: true }); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedNodeId, selectedConn, nodes, connections, connMode, selectedNodeIds]);

  // Scroll-wheel zoom
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    setZoom(z => Math.min(2, Math.max(0.3, z + delta)));
  };

  const getNormalizedRect = (rect) => {
    if (!rect) return null;
    return {
      x: Math.min(rect.startX, rect.endX),
      y: Math.min(rect.startY, rect.endY),
      w: Math.abs(rect.endX - rect.startX),
      h: Math.abs(rect.endY - rect.startY),
    };
  };

  const handleCanvasMouseDown = (e) => {
    // Right-click or middle-click = pan
    if (e.button === 2 || e.button === 1) {
      e.preventDefault();
      setPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }
    // Left-click on empty canvas = start selection rectangle (unless in connection mode)
    if (e.button === 0 && !e.target.closest('[data-flow-node]') && !connMode) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const cx = (e.clientX - rect.left - pan.x) / zoom;
        const cy = (e.clientY - rect.top - pan.y) / zoom;
        selectionStartRef.current = { cx, cy, clientX: e.clientX, clientY: e.clientY };
        setIsSelecting(true);
        setSelectionRect({ startX: cx, startY: cy, endX: cx, endY: cy });
      }
    }
  };

  const handleCanvasMouseMove = (e) => {
    if (panning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
    if (isSelecting && selectionStartRef.current && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const cx = (e.clientX - rect.left - pan.x) / zoom;
      const cy = (e.clientY - rect.top - pan.y) / zoom;
      setSelectionRect(prev => prev ? { ...prev, endX: cx, endY: cy } : null);
    }
  };

  const handleCanvasMouseUp = (e) => {
    if (panning) { setPanning(false); return; }
    if (isSelecting && selectionRect) {
      const norm = getNormalizedRect(selectionRect);
      // Only apply selection if we actually dragged (not just a click)
      const dragged = norm && (norm.w > 5 || norm.h > 5);
      if (dragged) {
        const selected = new Set(
          nodes.filter(n => {
            const nx = n.x + 88; // center-ish
            const ny = n.y + 35;
            return nx >= norm.x && nx <= norm.x + norm.w && ny >= norm.y && ny <= norm.y + norm.h;
          }).map(n => n.id)
        );
        setSelectedNodeIds(selected);
        if (selected.size === 1) onNodeSelect([...selected][0]);
        else onNodeSelect(null);
      }
      setIsSelecting(false);
      setSelectionRect(null);
      selectionStartRef.current = null;
    }
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0a0a0a]"
      style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)', backgroundSize: '24px 24px', cursor: panning ? 'grabbing' : 'default' }}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleCanvasMouseMove}
      onMouseUp={handleCanvasMouseUp}
      onMouseLeave={() => { setPanning(false); setIsSelecting(false); setSelectionRect(null); }}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
      onDrop={(e) => {
        e.preventDefault();
        if (dragType && canvasRef.current) {
          const rect = canvasRef.current.getBoundingClientRect();
          const x = (e.clientX - rect.left - pan.x) / zoom - 88;
          const y = (e.clientY - rect.top - pan.y) / zoom - 35;
          const newNode = {
            id: `node_${Date.now()}`, type: dragType, name: NODE_TYPES[dragType]?.name || 'Node',
            x: Math.max(0, x), y: Math.max(0, y),
            delay_days: dragType === 'wait' ? 1 : 0, delay_hours: 0,
            channel: dragType === 'send_message' ? 'email' : null,
            ...(dragType === 'social_action' ? { social_platform: 'linkedin', timing_mode: 'business_hours', skip_if_done: true, retry_on_failure: true } : {}),
            ...(dragType === 'enrich_lead'   ? { enrich_provider: 'apollo', enrich_fields: ['email', 'linkedin_profile'], enrich_fallback: 'continue' } : {}),
          };
          onNodesChange([...nodes, newNode]);
          setDragType(null);
        }
      }}
      onClick={() => { setSelectedConn(null); onNodeSelect(null); }}
      ref={canvasRef}
    >
      {/* Zoom controls */}
      <div className="absolute top-3 right-3 flex items-center gap-1 z-30 bg-black/60 border border-white/10 rounded-lg p-1">
        <button onClick={() => setZoom(z => Math.max(0.4, z - 0.1))} className="w-7 h-7 flex items-center justify-center text-white hover:bg-white/10 rounded text-lg">−</button>
        <span className="text-white text-xs w-10 text-center">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="w-7 h-7 flex items-center justify-center text-white hover:bg-white/10 rounded text-lg">+</button>
      </div>

      {/* Shortcuts hint */}
      <div className="absolute top-3 left-3 z-30 bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-[10px] text-gray-400">
        <div className="font-semibold text-gray-300 mb-0.5">Shortcuts</div>
        <div>Del — delete • Ctrl+D — duplicate • Esc — deselect</div>
        <div>Drag ports to connect • Click connection to delete</div>
        <div>Scroll — zoom • Right-drag — pan • Shift+click / drag — multi-select</div>
      </div>

      {connMode && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 rounded-full bg-[#38b6ff]/20 border border-[#38b6ff]/50 text-[#38b6ff] text-sm animate-pulse">
          Click a node to connect
        </div>
      )}

      <svg className="absolute inset-0 w-full h-full z-0" style={{ pointerEvents: 'none' }}>
        <defs>
          <marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#38b6ff" />
          </marker>
        </defs>
        <g style={{ pointerEvents: 'all' }} transform={`scale(${zoom}) translate(${pan.x / zoom}, ${pan.y / zoom})`}>
          {connections.map((c, i) => (
            <Arrow key={i} conn={c} nodes={nodes}
              isSelected={selectedConn && selectedConn.from.nodeId === c.from.nodeId && selectedConn.from.port === c.from.port && selectedConn.to === c.to}
              onSelect={setSelectedConn} onDelete={deleteConn} />
          ))}
          {/* Selection rectangle */}
          {isSelecting && selectionRect && (() => {
            const n = getNormalizedRect(selectionRect);
            return n ? <rect x={n.x} y={n.y} width={n.w} height={n.h} fill="rgba(56,182,255,0.08)" stroke="#38b6ff" strokeWidth={1 / zoom} strokeDasharray={`${4 / zoom},${3 / zoom}`} /> : null;
          })()}
        </g>
      </svg>

      <div className="absolute inset-0" style={{ transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`, transformOrigin: 'top left' }}>
        {nodes.map(node => (
          <FlowNode key={node.id} node={node}
            isSelected={selectedNodeId === node.id || selectedNodeIds.has(node.id)}
            onSelect={(id) => { setSelectedNodeIds(new Set()); onNodeSelect(id); }}
            onShiftSelect={(id) => {
              setSelectedNodeIds(prev => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id); else next.add(id);
                return next;
              });
              onNodeSelect(null);
            }}
            onDelete={deleteNode}
            onUpdate={updateNode}
            onStartConnection={startConn}
            onEndConnection={endConn}
            inConnectionMode={!!connMode}
          />
        ))}
      </div>
    </div>
  );
}