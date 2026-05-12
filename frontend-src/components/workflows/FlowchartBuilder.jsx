import React, { useState, useRef, useEffect } from 'react';

import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from 'sonner';
import { 
  Plus, Trash2, GripVertical, Mail, MessageSquare, Clock, 
  Linkedin, GitBranch, Zap, Play, X, Check, ArrowRight,
  MousePointer2, Move, ZoomIn, ZoomOut, Calendar, Copy,
  Sparkles, Layout, Search
} from 'lucide-react';
import AIOptimizationPanel from './AIOptimizationPanel';
import { InvokeLLM, UploadFile } from '@/api/integrations';

const NODE_TYPES = {
  trigger: { name: 'Start', icon: Play, color: '#22c55e', category: 'trigger' },
  send_message: { name: 'Send Message', icon: MessageSquare, color: '#38b6ff', category: 'action' },
  wait: { name: 'Wait', icon: Clock, color: '#cb6ce6', category: 'delay' },
  condition: { name: 'Condition', icon: GitBranch, color: '#00e7ff', category: 'logic' },
  schedule_meeting: { name: 'Schedule Meeting', icon: Calendar, color: '#f59e0b', category: 'action' },
  end_success: { name: 'End (Success)', icon: Check, color: '#22c55e', category: 'end' },
  end_failed: { name: 'End (Failed)', icon: X, color: '#ef4444', category: 'end' },
};

const CONDITION_OPTIONS = [
  { value: 'replied', label: 'Lead Replied' },
  { value: 'opened', label: 'Email Opened' },
  { value: 'clicked', label: 'Link Clicked' },
  { value: 'no_response', label: 'No Response (after X days)' },
  { value: 'meeting_booked', label: 'Meeting Booked' },
  { value: 'meeting_declined', label: 'Meeting Declined' },
];

const CONNECTION_STYLES = {
  curved: { 
    name: 'Curved', 
    icon: '⤴',
    description: 'Smooth curved line',
  },
  straight: { 
    name: 'Straight', 
    icon: '→',
    description: 'Direct straight line',
  },
  angled: { 
    name: 'Angled', 
    icon: '⌞',
    description: 'Right-angled connector',
  },
  bidirectional: { 
    name: 'Bidirectional', 
    icon: '⇄',
    description: 'Two-way connection',
  },
};

const WORKFLOW_TEMPLATES = {
  'email_sequence': {
    name: 'Email Outreach Sequence',
    nodes: [
      { id: 'trigger', type: 'trigger', name: 'Start', x: 400, y: 50 },
      { id: 'email1', type: 'send_message', name: 'Initial Email', x: 400, y: 170, channel: 'email' },
      { id: 'wait1', type: 'wait', name: 'Wait 3 days', x: 400, y: 290, delay_days: 3 },
      { id: 'email2', type: 'send_message', name: 'Follow-up Email', x: 400, y: 410, channel: 'email' },
      { id: 'wait2', type: 'wait', name: 'Wait 5 days', x: 400, y: 530, delay_days: 5 },
      { id: 'email3', type: 'send_message', name: 'Final Follow-up', x: 400, y: 650, channel: 'email' },
      { id: 'success', type: 'end_success', name: 'Success', x: 400, y: 770 },
    ],
    connections: [
      { from: { nodeId: 'trigger', port: 'default' }, to: 'email1' },
      { from: { nodeId: 'email1', port: 'default' }, to: 'wait1' },
      { from: { nodeId: 'wait1', port: 'default' }, to: 'email2' },
      { from: { nodeId: 'email2', port: 'default' }, to: 'wait2' },
      { from: { nodeId: 'wait2', port: 'default' }, to: 'email3' },
      { from: { nodeId: 'email3', port: 'default' }, to: 'success' },
    ]
  },
  'multi_channel': {
    name: 'Multi-Channel Outreach',
    nodes: [
      { id: 'trigger', type: 'trigger', name: 'Start', x: 400, y: 50 },
      { id: 'email1', type: 'send_message', name: 'Initial Email', x: 400, y: 170, channel: 'email' },
      { id: 'wait1', type: 'wait', name: 'Wait 2 days', x: 400, y: 290, delay_days: 2 },
      { id: 'condition1', type: 'condition', name: 'Email Opened?', x: 400, y: 410, condition: 'opened' },
      { id: 'linkedin1', type: 'send_message', name: 'LinkedIn Message', x: 220, y: 530, channel: 'linkedin' },
      { id: 'whatsapp1', type: 'send_message', name: 'WhatsApp Follow-up', x: 580, y: 530, channel: 'whatsapp' },
      { id: 'success', type: 'end_success', name: 'Success', x: 400, y: 650 },
    ],
    connections: [
      { from: { nodeId: 'trigger', port: 'default' }, to: 'email1' },
      { from: { nodeId: 'email1', port: 'default' }, to: 'wait1' },
      { from: { nodeId: 'wait1', port: 'default' }, to: 'condition1' },
      { from: { nodeId: 'condition1', port: 'yes' }, to: 'linkedin1' },
      { from: { nodeId: 'condition1', port: 'no' }, to: 'whatsapp1' },
      { from: { nodeId: 'linkedin1', port: 'default' }, to: 'success' },
      { from: { nodeId: 'whatsapp1', port: 'default' }, to: 'success' },
    ]
  },
  'meeting_scheduler': {
    name: 'Meeting Scheduler',
    nodes: [
      { id: 'trigger', type: 'trigger', name: 'Start', x: 400, y: 50 },
      { id: 'email1', type: 'send_message', name: 'Meeting Invite', x: 400, y: 170, channel: 'email' },
      { id: 'wait1', type: 'wait', name: 'Wait 3 days', x: 400, y: 290, delay_days: 3 },
      { id: 'condition1', type: 'condition', name: 'Meeting Booked?', x: 400, y: 410, condition: 'meeting_booked' },
      { id: 'schedule', type: 'schedule_meeting', name: 'Schedule Meeting', x: 220, y: 530 },
      { id: 'reminder', type: 'send_message', name: 'Send Reminder', x: 580, y: 530, channel: 'email' },
      { id: 'success', type: 'end_success', name: 'Success', x: 220, y: 650 },
      { id: 'failed', type: 'end_failed', name: 'No Show', x: 580, y: 650 },
    ],
    connections: [
      { from: { nodeId: 'trigger', port: 'default' }, to: 'email1' },
      { from: { nodeId: 'email1', port: 'default' }, to: 'wait1' },
      { from: { nodeId: 'wait1', port: 'default' }, to: 'condition1' },
      { from: { nodeId: 'condition1', port: 'yes' }, to: 'schedule' },
      { from: { nodeId: 'condition1', port: 'no' }, to: 'reminder' },
      { from: { nodeId: 'schedule', port: 'default' }, to: 'success' },
      { from: { nodeId: 'reminder', port: 'default' }, to: 'failed' },
    ]
  },
  'lead_nurturing': {
    name: 'Lead Nurturing Campaign',
    nodes: [
      { id: 'trigger', type: 'trigger', name: 'Start', x: 400, y: 50 },
      { id: 'email1', type: 'send_message', name: 'Welcome Email', x: 400, y: 170, channel: 'email' },
      { id: 'wait1', type: 'wait', name: 'Wait 2 days', x: 400, y: 290, delay_days: 2 },
      { id: 'email2', type: 'send_message', name: 'Educational Content', x: 400, y: 410, channel: 'email' },
      { id: 'wait2', type: 'wait', name: 'Wait 4 days', x: 400, y: 530, delay_days: 4 },
      { id: 'condition1', type: 'condition', name: 'Engaged?', x: 400, y: 650, condition: 'clicked' },
      { id: 'email3', type: 'send_message', name: 'Case Study', x: 220, y: 770, channel: 'email' },
      { id: 'whatsapp1', type: 'send_message', name: 'Personal Follow-up', x: 580, y: 770, channel: 'whatsapp' },
      { id: 'success', type: 'end_success', name: 'Success', x: 400, y: 890 },
    ],
    connections: [
      { from: { nodeId: 'trigger', port: 'default' }, to: 'email1' },
      { from: { nodeId: 'email1', port: 'default' }, to: 'wait1' },
      { from: { nodeId: 'wait1', port: 'default' }, to: 'email2' },
      { from: { nodeId: 'email2', port: 'default' }, to: 'wait2' },
      { from: { nodeId: 'wait2', port: 'default' }, to: 'condition1' },
      { from: { nodeId: 'condition1', port: 'yes' }, to: 'email3' },
      { from: { nodeId: 'condition1', port: 'no' }, to: 'whatsapp1' },
      { from: { nodeId: 'email3', port: 'default' }, to: 'success' },
      { from: { nodeId: 'whatsapp1', port: 'default' }, to: 'success' },
    ]
  },
  'cold_outreach': {
    name: 'Cold Outreach Sequence',
    nodes: [
      { id: 'trigger', type: 'trigger', name: 'Start', x: 400, y: 50 },
      { id: 'linkedin1', type: 'send_message', name: 'LinkedIn Connection', x: 400, y: 170, channel: 'linkedin' },
      { id: 'wait1', type: 'wait', name: 'Wait 1 day', x: 400, y: 290, delay_days: 1 },
      { id: 'linkedin2', type: 'send_message', name: 'LinkedIn Message', x: 400, y: 410, channel: 'linkedin' },
      { id: 'wait2', type: 'wait', name: 'Wait 3 days', x: 400, y: 530, delay_days: 3 },
      { id: 'email1', type: 'send_message', name: 'Email Introduction', x: 400, y: 650, channel: 'email' },
      { id: 'wait3', type: 'wait', name: 'Wait 5 days', x: 400, y: 770, delay_days: 5 },
      { id: 'whatsapp1', type: 'send_message', name: 'WhatsApp Follow-up', x: 400, y: 890, channel: 'whatsapp' },
      { id: 'success', type: 'end_success', name: 'Success', x: 400, y: 1010 },
    ],
    connections: [
      { from: { nodeId: 'trigger', port: 'default' }, to: 'linkedin1' },
      { from: { nodeId: 'linkedin1', port: 'default' }, to: 'wait1' },
      { from: { nodeId: 'wait1', port: 'default' }, to: 'linkedin2' },
      { from: { nodeId: 'linkedin2', port: 'default' }, to: 'wait2' },
      { from: { nodeId: 'wait2', port: 'default' }, to: 'email1' },
      { from: { nodeId: 'email1', port: 'default' }, to: 'wait3' },
      { from: { nodeId: 'wait3', port: 'default' }, to: 'whatsapp1' },
      { from: { nodeId: 'whatsapp1', port: 'default' }, to: 'success' },
    ]
  },
  'reengagement': {
    name: 'Re-engagement Campaign',
    nodes: [
      { id: 'trigger', type: 'trigger', name: 'Start', x: 400, y: 50 },
      { id: 'email1', type: 'send_message', name: 'We Miss You', x: 400, y: 170, channel: 'email' },
      { id: 'wait1', type: 'wait', name: 'Wait 4 days', x: 400, y: 290, delay_days: 4 },
      { id: 'condition1', type: 'condition', name: 'Opened Email?', x: 400, y: 410, condition: 'opened' },
      { id: 'email2', type: 'send_message', name: 'Special Offer', x: 220, y: 530, channel: 'email' },
      { id: 'end1', type: 'end_failed', name: 'No Response', x: 580, y: 530 },
      { id: 'wait2', type: 'wait', name: 'Wait 2 days', x: 220, y: 650, delay_days: 2 },
      { id: 'whatsapp1', type: 'send_message', name: 'Personal Touch', x: 220, y: 770, channel: 'whatsapp' },
      { id: 'success', type: 'end_success', name: 'Success', x: 220, y: 890 },
    ],
    connections: [
      { from: { nodeId: 'trigger', port: 'default' }, to: 'email1' },
      { from: { nodeId: 'email1', port: 'default' }, to: 'wait1' },
      { from: { nodeId: 'wait1', port: 'default' }, to: 'condition1' },
      { from: { nodeId: 'condition1', port: 'yes' }, to: 'email2' },
      { from: { nodeId: 'condition1', port: 'no' }, to: 'end1' },
      { from: { nodeId: 'email2', port: 'default' }, to: 'wait2' },
      { from: { nodeId: 'wait2', port: 'default' }, to: 'whatsapp1' },
      { from: { nodeId: 'whatsapp1', port: 'default' }, to: 'success' },
    ]
  }
};

function FlowchartNode({ node, isSelected, onSelect, onDelete, onUpdate, onStartConnection, onEndConnection, connectionMode }) {
  const config = NODE_TYPES[node.type];
  const Icon = config?.icon || Zap;
  const nodeRef = React.useRef(null);

  return (
    <div
      ref={nodeRef}
      className={`flowchart-node absolute cursor-move transition-all duration-150 group
        ${isSelected ? 'z-20' : 'z-10'}
        ${connectionMode ? 'cursor-crosshair' : ''}
      `}
      style={{ left: node.x, top: node.y }}
      onClick={(e) => {
        e.stopPropagation();
        connectionMode ? onEndConnection(node.id) : onSelect(node.id);
      }}
      onMouseDown={(e) => {
        if (!connectionMode && nodeRef.current?.parentElement) {
          const parentRect = nodeRef.current.parentElement.getBoundingClientRect();
          const startX = e.clientX;
          const startY = e.clientY;
          let hasMoved = false;
          
          const onMouseMove = (moveEvent) => {
            const deltaX = Math.abs(moveEvent.clientX - startX);
            const deltaY = Math.abs(moveEvent.clientY - startY);
            if (deltaX > 3 || deltaY > 3) hasMoved = true;
            
            const x = moveEvent.clientX - parentRect.left - 80;
            const y = moveEvent.clientY - parentRect.top - 30;
            onUpdate(node.id, { x: Math.max(0, x), y: Math.max(0, y) });
          };
          const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
          };
          document.addEventListener('mousemove', onMouseMove);
          document.addEventListener('mouseup', onMouseUp);
        }
      }}
    >
      <div 
        className={`w-40 rounded-xl border-2 transition-all duration-200 overflow-hidden
          ${isSelected 
            ? 'border-[#38b6ff] shadow-lg shadow-[#38b6ff]/20' 
            : 'border-white/20 hover:border-white/40'
          }
          bg-[#1a1a1a]
        `}
      >
        {/* Header */}
        <div 
          className="px-3 py-2 flex items-center gap-2"
          style={{ backgroundColor: `${config?.color}20` }}
        >
          <Icon size={16} style={{ color: config?.color }} />
          <span className="text-white text-xs font-medium truncate">{node.name || config?.name}</span>
        </div>
        
        {/* Content */}
        <div className="p-2">
          {node.type === 'wait' && (
            <div className="text-xs text-gray-400">
              Wait {node.delay_days || 0}d {node.delay_hours || 0}h
            </div>
          )}
          {node.type === 'condition' && (
            <div className="text-xs text-gray-400">
              {CONDITION_OPTIONS.find(c => c.value === node.condition)?.label || 'Select condition'}
            </div>
          )}
          {node.type === 'send_message' && (
            <div className="text-xs text-gray-400">
              {node.channel ? `via ${node.channel.charAt(0).toUpperCase() + node.channel.slice(1)}` : '⚠ Select channel'}
            </div>
          )}
        </div>

        {/* Connection Points */}
        {node.type !== 'trigger' && (
          <div 
            className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-white/30 
              bg-[#1a1a1a] cursor-pointer hover:border-[#38b6ff] hover:bg-[#38b6ff]/20 transition-colors"
            onClick={(e) => { e.stopPropagation(); onEndConnection(node.id); }}
          />
        )}
        
        {node.type !== 'end_success' && node.type !== 'end_failed' && (
          <>
            {node.type === 'condition' ? (
              <>
                <div 
                  className="absolute -bottom-2 left-1/4 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-green-400/50 
                    bg-[#1a1a1a] cursor-pointer hover:border-green-400 hover:bg-green-400/20 transition-colors
                    flex items-center justify-center text-[8px] text-green-400"
                  onClick={(e) => { e.stopPropagation(); onStartConnection(node.id, 'yes'); }}
                >
                  Y
                </div>
                <div 
                  className="absolute -bottom-2 left-3/4 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-red-400/50 
                    bg-[#1a1a1a] cursor-pointer hover:border-red-400 hover:bg-red-400/20 transition-colors
                    flex items-center justify-center text-[8px] text-red-400"
                  onClick={(e) => { e.stopPropagation(); onStartConnection(node.id, 'no'); }}
                >
                  N
                </div>
              </>
            ) : (
              <div 
                className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-white/30 
                  bg-[#1a1a1a] cursor-pointer hover:border-[#38b6ff] hover:bg-[#38b6ff]/20 transition-colors"
                onClick={(e) => { e.stopPropagation(); onStartConnection(node.id, 'default'); }}
              />
            )}
          </>
        )}
      </div>

      {/* Action buttons */}
      {isSelected && node.type !== 'trigger' && (
        <div className="absolute -top-2 -right-2 flex gap-1">
          <button 
            onClick={(e) => { e.stopPropagation(); onUpdate(node.id, { _saveTemplate: true }); }}
            className="w-6 h-6 rounded-full bg-[#cb6ce6] text-white 
              flex items-center justify-center hover:bg-[#cb6ce6]/80 transition-colors"
            title="Save as Template"
          >
            <Sparkles size={12} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onUpdate(node.id, { _duplicate: true }); }}
            className="w-6 h-6 rounded-full bg-[#38b6ff] text-white 
              flex items-center justify-center hover:bg-[#38b6ff]/80 transition-colors"
            title="Duplicate (Ctrl+D)"
          >
            <Copy size={12} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
            className="w-6 h-6 rounded-full bg-red-500 text-white 
              flex items-center justify-center hover:bg-red-600 transition-colors"
            title="Delete (Del)"
          >
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

function ConnectionLine({ from, to, nodes, type, onDelete, isSelected, onSelect, onReconnect, style = 'curved' }) {
  const [isHovered, setIsHovered] = React.useState(false);
  const fromNode = nodes.find(n => n.id === from.nodeId);
  const toNode = nodes.find(n => n.id === to);
  
  if (!fromNode || !toNode) return null;

  const fromX = fromNode.x + 80;
  const fromY = fromNode.y + 60;
  const toX = toNode.x + 80;
  const toY = toNode.y;

  const offsetX = from.port === 'yes' ? -40 : from.port === 'no' ? 40 : 0;
  const startX = fromX + offsetX;

  const color = from.port === 'yes' ? '#22c55e' : from.port === 'no' ? '#ef4444' : '#38b6ff';

  // Generate path based on style
  let path, midX, midY;
  
  switch (style) {
    case 'straight':
      path = `M ${startX} ${fromY} L ${toX} ${toY}`;
      midX = (startX + toX) / 2;
      midY = (fromY + toY) / 2;
      break;
      
    case 'angled':
      const cornerX = startX;
      const cornerY = toY;
      path = `M ${startX} ${fromY} L ${cornerX} ${cornerY} L ${toX} ${toY}`;
      midX = startX;
      midY = (fromY + toY) / 2;
      break;
      
    case 'bidirectional':
      midY = (fromY + toY) / 2;
      path = `M ${startX} ${fromY} C ${startX} ${midY}, ${toX} ${midY}, ${toX} ${toY}`;
      midX = (startX + toX) / 2;
      break;
      
    case 'curved':
    default:
      midY = (fromY + toY) / 2;
      path = `M ${startX} ${fromY} C ${startX} ${midY}, ${toX} ${midY}, ${toX} ${toY}`;
      midX = (startX + toX) / 2;
      break;
  }

  return (
    <g className="group">
      {/* Invisible wider path for easier clicking */}
      <path
        d={path}
        stroke="transparent"
        strokeWidth="32"
        fill="none"
        className="cursor-pointer hover:stroke-[#38b6ff]/20"
        style={{ pointerEvents: 'stroke' }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(from, to);
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />
      {/* Visible path */}
      <path
        d={path}
        stroke={color}
        strokeWidth={isSelected ? "5" : isHovered ? "3" : "2"}
        fill="none"
        strokeOpacity={isSelected ? "1" : isHovered ? "0.9" : "0.6"}
        markerEnd={style === 'bidirectional' ? "url(#arrowhead)" : "url(#arrowhead)"}
        markerStart={style === 'bidirectional' ? "url(#arrowhead-reverse)" : undefined}
        className="pointer-events-none transition-all duration-200"
        style={{ 
          filter: isSelected ? 'drop-shadow(0 0 10px currentColor)' : isHovered ? 'drop-shadow(0 0 6px currentColor)' : 'none',
          strokeDasharray: style === 'bidirectional' ? 'none' : undefined,
        }}
      />
      
      {/* Start endpoint handle (draggable) */}
      {isSelected && (
        <>
          <circle
            cx={startX}
            cy={fromY}
            r="6"
            fill={color}
            stroke="white"
            strokeWidth="2"
            className="cursor-move"
            style={{ pointerEvents: 'all' }}
            onMouseDown={(e) => {
              e.stopPropagation();
              onReconnect({ connection: { from, to }, end: 'start' });
            }}
          />
          {/* End endpoint handle (draggable) */}
          <circle
            cx={toX}
            cy={toY}
            r="6"
            fill={color}
            stroke="white"
            strokeWidth="2"
            className="cursor-move"
            style={{ pointerEvents: 'all' }}
            onMouseDown={(e) => {
              e.stopPropagation();
              onReconnect({ connection: { from, to }, end: 'end' });
            }}
          />
        </>
      )}
      
      {/* Connection indicator - always visible on hover or selection */}
      {(isHovered || isSelected) && (
        <circle
          cx={midX}
          cy={midY}
          r="12"
          fill={color}
          fillOpacity="0.3"
          stroke={color}
          strokeWidth="2"
          className="animate-pulse"
          style={{ pointerEvents: 'none' }}
        />
      )}
      
      {/* Delete button on hover or when selected */}
      <g 
        className={`cursor-pointer transition-opacity ${isSelected ? 'opacity-100' : isHovered ? 'opacity-100' : 'opacity-0'}`}
        onClick={(e) => {
          e.stopPropagation();
          onDelete(from.nodeId, from.port, to);
        }}
        style={{ pointerEvents: 'all' }}
      >
        <circle
          cx={midX}
          cy={midY}
          r="12"
          fill="#ef4444"
          stroke="white"
          strokeWidth="2"
        />
        <line
          x1={midX - 5}
          y1={midY}
          x2={midX + 5}
          y2={midY}
          stroke="white"
          strokeWidth="2"
        />
      </g>
    </g>
  );
}

export default function FlowchartBuilder({ workflow, onClose }) {
  const queryClient = useQueryClient();
  const canvasRef = useRef(null);
  
  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => Company.list(),
  });

  const company = companies[0];

  const { data: nodeTemplates = [] } = useQuery({
    queryKey: ['nodeTemplates', company?.id],
    queryFn: () => company?.id ? NodeTemplate.filter({ company_id: company.id }) : [],
    enabled: !!company?.id,
  });

  const [formData, setFormData] = useState({
    name: workflow?.name || '',
    description: workflow?.description || '',
    type: workflow?.type || 'sales_outreach',
  });

const [nodes, setNodes] = useState(workflow?.nodes || [
    { id: 'trigger', type: 'trigger', name: 'Start', x: 400, y: 50 }
  ]);

const [connections, setConnections] = useState(workflow?.connections || []);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [connectionMode, setConnectionMode] = useState(null);
const [zoom, setZoom] = useState(1);
const [showTemplates, setShowTemplates] = useState(false);
const [searchQuery, setSearchQuery] = useState('');
const [activeConnectionStyle, setActiveConnectionStyle] = useState('curved');
const [isPanning, setIsPanning] = useState(false);
const [panStart, setPanStart] = useState({ x: 0, y: 0 });
const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
const [draggedNodeType, setDraggedNodeType] = useState(null);
const [aiPrompt, setAiPrompt] = useState('');
const [isAIGenerating, setIsAIGenerating] = useState(false);
const [uploadedFiles, setUploadedFiles] = useState([]);
const [isUploading, setIsUploading] = useState(false);
const [showTemplateManager, setShowTemplateManager] = useState(false);
const [customTemplates, setCustomTemplates] = useState([]);
const [selectedTemplateNode, setSelectedTemplateNode] = useState(null);
const [isGeneratingContent, setIsGeneratingContent] = useState(false);
const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const createMutation = useMutation({
    mutationFn: (data) => Workflow.create({
      ...data,
      company_id: company?.id,
      status: 'draft',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast.success('Workflow created');
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data) => Workflow.update(workflow.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast.success('Workflow saved!');
      setHasUnsavedChanges(false);
      onClose();
    },
  });

  const autoSaveMutation = useMutation({
    mutationFn: (data) => workflow ? Workflow.update(workflow.id, data) : Promise.resolve(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      setHasUnsavedChanges(false);
    },
  });

  const validateWorkflow = () => {
    const unconnectedNodes = nodes.filter(node => {
      if (node.type === 'trigger') return false;
      const hasIncoming = connections.some(c => c.to === node.id);
      return !hasIncoming;
    });
    
    return { isValid: unconnectedNodes.length === 0, unconnectedNodes };
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error('Workflow name is required');
      return;
    }
    
    const validation = validateWorkflow();
    if (!validation.isValid) {
      const nodeNames = validation.unconnectedNodes.map(n => n.name).join(', ');
      toast.warning(`Some nodes are not connected: ${nodeNames}. Saving anyway.`, { duration: 5000 });
    }
    
    const workflowData = {
      ...formData,
      nodes,
      connections,
      steps: nodes.filter(n => n.type !== 'trigger' && !n.type.startsWith('end')).map((n) => ({
        id: n.id,
        type: n.type,
        name: n.name,
        channel: n.channel || null,
        delay_days: n.delay_days || 0,
        delay_hours: n.delay_hours || 0,
        template_id: n.template_id,
        conditions: n.condition ? { type: n.condition } : null,
        auto_send: n.auto_send || false,
      })),
    };
    
    if (workflow) {
      updateMutation.mutate(workflowData);
    } else {
      createMutation.mutate(workflowData);
    }
  };

const addNode = (type, position) => {
    const lastNode = nodes[nodes.length - 1];
    const newNode = {
      id: `node_${Date.now()}`,
      type,
      name: NODE_TYPES[type]?.name || 'New Node',
      x: position?.x || (lastNode ? lastNode.x : 400),
      y: position?.y || (lastNode ? lastNode.y + 120 : 150),
      delay_days: type === 'wait' ? 1 : 0,
      delay_hours: 0,
      channel: type === 'send_message' ? 'email' : null,
    };
    setNodes([...nodes, newNode]);
    setSelectedNode(newNode.id);
    setHasUnsavedChanges(true);
    
    // Auto-connect to last non-end node
    if (lastNode && !lastNode.type.startsWith('end') && !position) {
      const port = lastNode.type === 'condition' ? 'yes' : 'default';
      setConnections([...connections, { 
        from: { nodeId: lastNode.id, port }, 
        to: newNode.id 
      }]);
    }
    
    return newNode.id;
  };

  const duplicateNode = (nodeId) => {
    const nodeToDuplicate = nodes.find(n => n.id === nodeId);
    if (!nodeToDuplicate || nodeToDuplicate.type === 'trigger') return;
    
    const newNode = {
      ...nodeToDuplicate,
      id: `node_${Date.now()}`,
      name: `${nodeToDuplicate.name} (Copy)`,
      x: nodeToDuplicate.x + 50,
      y: nodeToDuplicate.y + 50,
    };
    setNodes([...nodes, newNode]);
    setSelectedNode(newNode.id);
  };

  const loadTemplate = (templateKey) => {
    const template = WORKFLOW_TEMPLATES[templateKey];
    if (template) {
      setNodes(template.nodes);
      setConnections(template.connections);
      toast.success(`Template "${template.name}" loaded`);
      setShowTemplates(false);
    }
  };

  const autoLayout = () => {
    const trigger = nodes.find(n => n.type === 'trigger');
    if (!trigger) return;

    const visited = new Set();
    const levels = {};
    const levelWidths = {};

    const buildLevels = (nodeId, level = 0) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      
      if (!levels[level]) levels[level] = [];
      levels[level].push(nodeId);
      levelWidths[level] = (levelWidths[level] || 0) + 1;

      const outgoing = connections.filter(c => c.from.nodeId === nodeId);
      outgoing.forEach(conn => buildLevels(conn.to, level + 1));
    };

    buildLevels(trigger.id);

    const newNodes = nodes.map(node => {
      const level = Object.keys(levels).find(l => levels[l].includes(node.id));
      if (level === undefined) return node;
      
      const levelIndex = levels[level].indexOf(node.id);
      const totalInLevel = levels[level].length;
      const spacing = 200;
      const startX = 400 - ((totalInLevel - 1) * spacing) / 2;
      
      return {
        ...node,
        x: startX + levelIndex * spacing,
        y: 50 + parseInt(level) * 120,
      };
    });

    setNodes(newNodes);
    toast.success('Layout optimized');
  };

const updateNode = (nodeId, updates) => {
    if (updates._duplicate) {
      duplicateNode(nodeId);
      return;
    }
    if (updates._saveTemplate) {
      saveAsTemplate(nodeId);
      return;
    }
    setNodes(nodes.map(n => n.id === nodeId ? { ...n, ...updates } : n));
    setHasUnsavedChanges(true);
  };

// Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      if ((e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        if (selectedNode) {
          const node = nodes.find(n => n.id === selectedNode);
          if (node?.type !== 'trigger') deleteNode(selectedNode);
        } else if (selectedConnection) {
          deleteSelectedConnection();
        }
      }
      
      if (selectedNode && e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        duplicateNode(selectedNode);
      }
      
      if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        autoLayout();
      }

      if (e.key === 'Escape') {
        setSelectedNode(null);
        setSelectedConnection(null);
        setConnectionMode(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNode, selectedConnection, nodes, connections]);

const deleteNode = (nodeId) => {
    setNodes(nodes.filter(n => n.id !== nodeId));
    setConnections(connections.filter(c => c.from.nodeId !== nodeId && c.to !== nodeId));
    setSelectedNode(null);
    setHasUnsavedChanges(true);
  };

const deleteConnection = (fromNodeId, fromPort, toNodeId) => {
    setConnections(connections.filter(c => 
      !(c.from.nodeId === fromNodeId && c.from.port === fromPort && c.to === toNodeId)
    ));
    setSelectedConnection(null);
    setHasUnsavedChanges(true);
  };

  const deleteSelectedConnection = () => {
    if (selectedConnection) {
      deleteConnection(selectedConnection.from.nodeId, selectedConnection.from.port, selectedConnection.to);
    }
  };

  const startConnection = (nodeId, port) => {
    setConnectionMode({ nodeId, port });
  };

const endConnection = (nodeId) => {
    if (connectionMode && connectionMode.nodeId !== nodeId) {
      // Check if we're reconnecting an existing connection
      if (connectionMode.reconnecting) {
        const { connection, end } = connectionMode.reconnecting;
        
        // Remove old connection
        const filteredConnections = connections.filter(c => 
          !(c.from.nodeId === connection.from.nodeId && 
            c.from.port === connection.from.port && 
            c.to === connection.to)
        );
        
        // Add new connection
        let newConnection;
        if (end === 'start') {
          // Reconnecting start point - change the 'from'
          newConnection = { 
            from: { nodeId, port: 'default' }, 
            to: connection.to 
          };
        } else {
          // Reconnecting end point - change the 'to'
          newConnection = { 
            from: connection.from, 
            to: nodeId 
          };
        }
        
        setConnections([...filteredConnections, newConnection]);
        setSelectedConnection(null);
        setHasUnsavedChanges(true);
      } else {
        // Creating new connection
        const existingIndex = connections.findIndex(
          c => c.from.nodeId === connectionMode.nodeId && c.from.port === connectionMode.port
        );
        
        const newConnection = { from: connectionMode, to: nodeId };
        
        if (existingIndex >= 0) {
          const newConnections = [...connections];
          newConnections[existingIndex] = newConnection;
          setConnections(newConnections);
} else {
          setConnections([...connections, { ...newConnection, style: activeConnectionStyle }]);
        }
        setHasUnsavedChanges(true);
      }
    }
    setConnectionMode(null);
  };

  const updateConnectionStyle = (from, to, newStyle) => {
    setConnections(connections.map(c => 
      c.from.nodeId === from.nodeId && 
      c.from.port === from.port && 
      c.to === to 
        ? { ...c, style: newStyle } 
        : c
    ));
  };

  const startReconnection = (reconnectData) => {
    setConnectionMode({
      nodeId: null,
      port: null,
      reconnecting: reconnectData,
    });
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    setIsUploading(true);
    try {
      const uploadPromises = files.map(file => UploadFile({ file }));
      const results = await Promise.all(uploadPromises);
      const newFiles = results.map((result, index) => ({
        url: result.file_url,
        name: files[index].name,
        type: files[index].type
      }));
      setUploadedFiles([...uploadedFiles, ...newFiles]);
      toast.success(`${files.length} file(s) uploaded`);
    } catch (error) {
      toast.error('Failed to upload files');
    } finally {
      setIsUploading(false);
    }
  };

  const removeFile = (index) => {
    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
  };

  const saveAsTemplate = async (nodeId) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node || node.type === 'trigger' || node.type.startsWith('end')) {
      toast.error('Cannot save this node type as template');
      return;
    }

    const templateName = prompt('Enter a name for this template:', node.name);
    if (!templateName) return;

    try {
      await NodeTemplate.create({
        company_id: company.id,
        name: templateName,
        description: `Custom ${NODE_TYPES[node.type]?.name} template`,
        node_type: node.type,
        settings: {
          delay_days: node.delay_days,
          delay_hours: node.delay_hours,
          condition: node.condition,
          template_id: node.template_id,
          auto_send: node.auto_send,
          content: node.content,
          subject: node.subject,
        },
        is_ai_generated: false,
      });
      queryClient.invalidateQueries({ queryKey: ['nodeTemplates'] });
      toast.success('Template saved!');
    } catch (error) {
      toast.error('Failed to save template');
    }
  };

  const applyTemplate = (templateId) => {
    const template = nodeTemplates.find(t => t.id === templateId);
    if (!template || !selectedNode) return;

    const node = nodes.find(n => n.id === selectedNode);
    if (node.type !== template.node_type) {
      toast.error('Template type does not match node type');
      return;
    }

    updateNode(selectedNode, { ...template.settings });
    
    // Update usage count
    NodeTemplate.update(templateId, {
      usage_count: (template.usage_count || 0) + 1
    });
    queryClient.invalidateQueries({ queryKey: ['nodeTemplates'] });
    toast.success('Template applied!');
  };

  const generateContentWithAI = async (nodeType) => {
    if (!selectedNodeData) return;
    
    setIsGeneratingContent(true);
    try {
      const prompt = nodeType === 'email' 
        ? `Generate a professional sales outreach email. Return JSON with "subject" and "content" fields.`
        : nodeType === 'whatsapp'
        ? `Generate a brief, friendly WhatsApp message for sales outreach. Return JSON with "content" field.`
        : `Generate a professional LinkedIn message for sales outreach. Return JSON with "content" field.`;

      const response = await InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            subject: { type: "string" },
            content: { type: "string" }
          }
        }
      });

      if (response) {
        updateNode(selectedNode, {
          subject: response.subject,
          content: response.content,
        });
        toast.success('AI content generated!');
      }
    } catch (error) {
      toast.error('Failed to generate content');
    } finally {
      setIsGeneratingContent(false);
    }
  };

  const generateWorkflowWithAI = async () => {
    if (!aiPrompt.trim() && uploadedFiles.length === 0) return;
    
    setIsAIGenerating(true);
    try {
      const fileUrls = uploadedFiles.map(f => f.url);
      const response = await InvokeLLM({
        prompt: `You are a workflow automation expert. Based on this description${uploadedFiles.length > 0 ? ' and the attached files' : ''}, create a workflow structure: "${aiPrompt}"
        
        Return a JSON object with this structure:
        {
          "name": "Workflow name",
          "description": "Brief description",
          "type": "sales_outreach|follow_up|nurturing|custom",
          "nodes": [
            {"id": "unique_id", "type": "trigger|email|whatsapp|linkedin|wait|condition|end_success", "name": "Node name", "x": 400, "y": 50}
          ],
          "connections": [
            {"from": {"nodeId": "id", "port": "default|yes|no"}, "to": "target_id"}
          ]
        }
        
        Available node types: trigger, email, whatsapp, linkedin, wait, condition, schedule_meeting, end_success, end_failed
        Position nodes vertically with 120px spacing and horizontally spread for branches.`,
        response_json_schema: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            type: { type: "string" },
            nodes: { 
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  type: { type: "string" },
                  name: { type: "string" },
                  x: { type: "number" },
                  y: { type: "number" }
                }
              }
            },
            connections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  from: {
                    type: "object",
                    properties: {
                      nodeId: { type: "string" },
                      port: { type: "string" }
                    }
                  },
                  to: { type: "string" }
                }
              }
            }
          }
        },
        file_urls: fileUrls.length > 0 ? fileUrls : undefined,
        add_context_from_internet: false
      });
      
      if (response) {
        setFormData(prev => ({
          ...prev,
          name: response.name || prev.name,
          description: response.description || prev.description,
          type: response.type || prev.type
        }));
        // Normalize legacy channel node types to send_message
        const normalizedNodes = (response.nodes || [{ id: 'trigger', type: 'trigger', name: 'Start', x: 400, y: 50 }]).map(n => {
          if (['email', 'whatsapp', 'linkedin'].includes(n.type)) {
            return { ...n, channel: n.type, type: 'send_message' };
          }
          return n;
        });
        setNodes(normalizedNodes);
        setConnections(response.connections || []);
        setAiPrompt('');
        setHasUnsavedChanges(true);
        toast.success('Workflow generated with AI!');
      }
    } catch (error) {
      toast.error('Failed to generate workflow');
    } finally {
      setIsAIGenerating(false);
    }
  };

  // Auto-save effect with debounce (1.5s after last change)
  useEffect(() => {
    if (!hasUnsavedChanges || !workflow) return;
    const timer = setTimeout(() => {
      const workflowData = {
        ...formData,
        nodes,
        connections,
        steps: nodes.filter(n => n.type !== 'trigger' && !n.type.startsWith('end')).map((n) => ({
          id: n.id,
          type: n.type,
          name: n.name,
          channel: n.channel || null,
          delay_days: n.delay_days || 0,
          delay_hours: n.delay_hours || 0,
          template_id: n.template_id,
          conditions: n.condition ? { type: n.condition } : null,
          auto_send: n.auto_send || false,
        })),
      };
      autoSaveMutation.mutate(workflowData);
    }, 1500);
    return () => clearTimeout(timer);
  }, [hasUnsavedChanges, nodes, connections, formData]);

  // Warn before closing with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleClose = () => {
    if (hasUnsavedChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to close?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const selectedNodeData = nodes.find(n => n.id === selectedNode);

  return (
    <div className="flex flex-col h-[90vh] max-h-[90vh] resize overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-4">
          <Input
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className="bg-black/30 border-white/10 text-white text-lg font-semibold w-64"
            placeholder="Workflow name..."
          />
          <Select 
            value={formData.type} 
            onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
          >
            <SelectTrigger className="w-[160px] bg-black/30 border-white/10 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a1a] border-white/10">
              <SelectItem value="sales_outreach" className="text-white">Sales Outreach</SelectItem>
              <SelectItem value="follow_up" className="text-white">Follow Up</SelectItem>
              <SelectItem value="nurturing" className="text-white">Nurturing</SelectItem>
              <SelectItem value="custom" className="text-white">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>

<div className="flex items-center gap-2">
          <Popover open={showTemplates} onOpenChange={setShowTemplates}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="border-white/10 text-white hover:bg-white/5 gap-2">
                <Sparkles size={16} />
                Templates
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 bg-[#1a1a1a] border-white/10 p-3">
              <h4 className="text-white font-semibold mb-3">Quick Start Templates</h4>
              <div className="space-y-2">
                {Object.entries(WORKFLOW_TEMPLATES).map(([key, template]) => (
                  <button
                    key={key}
                    onClick={() => loadTemplate(key)}
                    className="w-full text-left p-3 rounded-lg bg-white/5 hover:bg-white/10 
                      border border-white/10 hover:border-[#38b6ff]/30 transition-all"
                  >
                    <div className="text-white font-medium text-sm">{template.name}</div>
                    <div className="text-gray-400 text-xs mt-1">
                      {template.nodes.length} steps
                    </div>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Button 
            variant="outline" 
            onClick={autoLayout}
            className="border-white/10 text-white hover:bg-white/5 gap-2"
            title="Auto-layout (Ctrl+L)"
          >
            <Layout size={16} />
            Auto-Layout
          </Button>

          {hasUnsavedChanges && (
            <span className="text-xs text-yellow-400 mr-2">● Unsaved changes (auto-saving...)</span>
          )}
          <Button variant="outline" onClick={handleClose} className="border-white/10 text-white hover:bg-white/5">
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={createMutation.isPending || updateMutation.isPending}
            className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff]"
          >
            {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save Workflow'}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Toolbox */}
        <div className="w-56 border-r border-white/10 p-4 overflow-y-auto">
          <div className="mb-4">
            <div className="relative">
              <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search nodes..."
                className="pl-7 h-8 text-sm bg-black/30 border-white/10 text-white"
              />
            </div>
          </div>

          {/* Connection Styles */}
          <div className="mb-6 p-3 rounded-lg bg-white/5 border border-white/10">
            <h3 className="text-xs font-semibold text-gray-400 mb-2">CONNECTION STYLE</h3>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(CONNECTION_STYLES).map(([key, config]) => (
                <button
                  key={key}
                  onClick={() => setActiveConnectionStyle(key)}
                  className={`p-2 rounded-lg border transition-all text-center
                    ${activeConnectionStyle === key 
                      ? 'border-[#38b6ff] bg-[#38b6ff]/20 text-[#38b6ff]' 
                      : 'border-white/10 hover:border-white/20 text-gray-400 hover:text-white'
                    }`}
                  title={config.description}
                >
                  <div className="text-xl mb-1">{config.icon}</div>
                  <div className="text-[10px] font-medium">{config.name}</div>
                </button>
              ))}
            </div>
          </div>

          <h3 className="text-sm font-semibold text-gray-400 mb-3">ACTIONS</h3>
<div className="space-y-2 mb-6">
            {Object.entries(NODE_TYPES)
              .filter(([_, v]) => v.category === 'action')
              .filter(([key, config]) => !searchQuery || config.name.toLowerCase().includes(searchQuery.toLowerCase()))
              .map(([key, config]) => {
                const Icon = config.icon;
                return (
                  <button
                    key={key}
                    draggable
                    onDragStart={(e) => {
                      setDraggedNodeType(key);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    onDragEnd={() => setDraggedNodeType(null)}
                    onClick={() => addNode(key)}
                    className="w-full flex items-center gap-2 p-2 rounded-lg border border-white/10 
                      hover:bg-white/5 hover:border-white/20 transition-colors text-left cursor-move"
                    title="Click to add or drag to canvas"
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" 
                      style={{ backgroundColor: `${config.color}20` }}>
                      <Icon size={16} style={{ color: config.color }} />
                    </div>
                    <span className="text-white text-sm">{config.name}</span>
                  </button>
                );
              })}
          </div>

          <h3 className="text-sm font-semibold text-gray-400 mb-3">LOGIC</h3>
          <div className="space-y-2 mb-6">
            {Object.entries(NODE_TYPES)
              .filter(([_, v]) => v.category === 'delay' || v.category === 'logic')
              .filter(([key, config]) => !searchQuery || config.name.toLowerCase().includes(searchQuery.toLowerCase()))
              .map(([key, config]) => {
                const Icon = config.icon;
                return (
                  <button
                    key={key}
                    draggable
                    onDragStart={(e) => {
                      setDraggedNodeType(key);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    onDragEnd={() => setDraggedNodeType(null)}
                    onClick={() => addNode(key)}
                    className="w-full flex items-center gap-2 p-2 rounded-lg border border-white/10 
                      hover:bg-white/5 hover:border-white/20 transition-colors text-left cursor-move"
                    title="Click to add or drag to canvas"
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" 
                      style={{ backgroundColor: `${config.color}20` }}>
                      <Icon size={16} style={{ color: config.color }} />
                    </div>
                    <span className="text-white text-sm">{config.name}</span>
                  </button>
                  );
                  })}
                  </div>

                  <h3 className="text-sm font-semibold text-gray-400 mb-3">END</h3>
          <div className="space-y-2">
            {Object.entries(NODE_TYPES)
              .filter(([_, v]) => v.category === 'end')
              .filter(([key, config]) => !searchQuery || config.name.toLowerCase().includes(searchQuery.toLowerCase()))
              .map(([key, config]) => {
                const Icon = config.icon;
                return (
                  <button
                    key={key}
                    draggable
                    onDragStart={(e) => {
                      setDraggedNodeType(key);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    onDragEnd={() => setDraggedNodeType(null)}
                    onClick={() => addNode(key)}
                    className="w-full flex items-center gap-2 p-2 rounded-lg border border-white/10 
                      hover:bg-white/5 hover:border-white/20 transition-colors text-left cursor-move"
                    title="Click to add or drag to canvas"
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" 
                      style={{ backgroundColor: `${config.color}20` }}>
                      <Icon size={16} style={{ color: config.color }} />
                    </div>
                    <span className="text-white text-sm">{config.name}</span>
                  </button>
                );
              })}
          </div>

          {/* AI Assistant Section */}
          <div className="mt-6 pt-4 border-t border-white/10">
            <h3 className="text-xs font-semibold text-gray-400 mb-2">AI ASSISTANT</h3>
            
            <Textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Describe your workflow and AI will build it..."
              className="min-h-[80px] text-sm bg-black/30 border-white/10 text-white mb-2"
            />

            {/* File Upload Section */}
            <div className="mb-2">
              <input
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.txt"
                onChange={handleFileUpload}
                className="hidden"
                id="workflow-file-upload"
                disabled={isUploading}
              />
              <label
                htmlFor="workflow-file-upload"
                className={`flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg border border-white/10 
                  bg-white/5 hover:bg-white/10 transition-colors cursor-pointer text-xs text-gray-300
                  ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Plus size={14} />
                {isUploading ? 'Uploading...' : 'Add Images/Documents'}
              </label>
            </div>

            {/* Uploaded Files List */}
            {uploadedFiles.length > 0 && (
              <div className="mb-2 space-y-1 max-h-32 overflow-y-auto">
                {uploadedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between gap-2 px-2 py-1.5 
                    rounded bg-white/5 border border-white/10 text-xs">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {file.type.startsWith('image/') ? (
                        <img src={file.url} alt={file.name} className="w-6 h-6 rounded object-cover" />
                      ) : (
                        <div className="w-6 h-6 rounded bg-[#38b6ff]/20 flex items-center justify-center">
                          📄
                        </div>
                      )}
                      <span className="text-gray-300 truncate">{file.name}</span>
                    </div>
                    <button
                      onClick={() => removeFile(index)}
                      className="text-gray-400 hover:text-red-400 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <Button
              onClick={generateWorkflowWithAI}
              disabled={(!aiPrompt.trim() && uploadedFiles.length === 0) || isAIGenerating}
              className="w-full bg-gradient-to-r from-[#cb6ce6] to-[#38b6ff] gap-2"
            >
              {isAIGenerating ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Generate with AI
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 relative overflow-hidden bg-[#0a0a0a]">
          {/* Grid */}
          <div 
            className="absolute inset-0"
            style={{
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          />

          {/* Zoom Controls */}
          <div className="absolute top-4 right-4 flex items-center gap-2 z-30">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
              className="border-white/10 text-white hover:bg-white/5"
            >
              <ZoomOut size={16} />
            </Button>
            <span className="text-white text-sm w-12 text-center">{Math.round(zoom * 100)}%</span>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => setZoom(Math.min(2, zoom + 0.1))}
              className="border-white/10 text-white hover:bg-white/5"
            >
              <ZoomIn size={16} />
            </Button>
          </div>

{/* Info Banner */}
          <div className="absolute top-4 left-4 px-3 py-2 rounded-lg 
            bg-black/60 border border-white/10 text-gray-300 text-xs z-30 backdrop-blur-sm">
            <div className="font-semibold mb-1">Shortcuts:</div>
            <div>Del - Delete node/connection</div>
            <div>Ctrl+D - Duplicate node</div>
            <div>Ctrl+L - Auto-layout</div>
            <div>Esc - Clear selection</div>
          </div>

{/* Connection Mode Indicator */}
          {connectionMode && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full 
              bg-[#38b6ff]/20 border border-[#38b6ff]/50 text-[#38b6ff] text-sm z-30 animate-pulse">
              {connectionMode.reconnecting 
                ? `Click on a node to reconnect ${connectionMode.reconnecting.end === 'start' ? 'start' : 'end'} point`
                : 'Click on a node to connect'
              }
            </div>
          )}

          {/* Selection Info */}
          {selectedConnection && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg 
              bg-black/80 border border-white/10 text-white text-sm z-30 backdrop-blur-sm">
              Connection selected • Del to delete • Drag endpoints to reconnect
            </div>
          )}

{/* SVG for connections */}
<svg className="absolute inset-0 w-full h-full z-0" style={{ pointerEvents: 'none' }}>
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#38b6ff" />
              </marker>
              <marker
                id="arrowhead-reverse"
                markerWidth="10"
                markerHeight="7"
                refX="1"
                refY="3.5"
                orient="auto"
              >
                <polygon points="10 0, 0 3.5, 10 7" fill="#38b6ff" />
              </marker>
            </defs>
            <g 
              style={{ pointerEvents: 'all' }}
              transform={`scale(${zoom}) translate(${canvasOffset.x / zoom}, ${canvasOffset.y / zoom})`}
            >
{connections.map((conn, i) => {
              const isSelected = selectedConnection && 
                selectedConnection.from.nodeId === conn.from.nodeId &&
                selectedConnection.from.port === conn.from.port &&
                selectedConnection.to === conn.to;
              return (
                <ConnectionLine 
                  key={i} 
                  from={conn.from} 
                  to={conn.to} 
                  nodes={nodes}
                  type={conn.from.port}
                  style={conn.style || 'curved'}
                  onDelete={deleteConnection}
                  isSelected={isSelected}
                  onSelect={(from, to) => {
                    setSelectedConnection({ from, to });
                    setSelectedNode(null);
                  }}
                  onReconnect={startReconnection}
                />
              );
            })}
            </g>
          </svg>

          {/* Nodes */}
          <div 
            ref={canvasRef}
            className="absolute inset-0 overflow-hidden"
            style={{ 
              cursor: isPanning ? 'grabbing' : draggedNodeType ? 'copy' : 'default',
            }}
            onMouseDown={(e) => {
              if (e.button === 0 && !e.target.closest('.flowchart-node') && !connectionMode) {
                setIsPanning(true);
                setPanStart({ x: e.clientX - canvasOffset.x, y: e.clientY - canvasOffset.y });
              }
            }}
            onMouseMove={(e) => {
              if (isPanning) {
                setCanvasOffset({
                  x: e.clientX - panStart.x,
                  y: e.clientY - panStart.y
                });
              }
            }}
            onMouseUp={() => setIsPanning(false)}
            onMouseLeave={() => setIsPanning(false)}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (draggedNodeType && canvasRef.current) {
                const rect = canvasRef.current.getBoundingClientRect();
                const x = (e.clientX - rect.left - canvasOffset.x) / zoom - 80;
                const y = (e.clientY - rect.top - canvasOffset.y) / zoom - 30;
                addNode(draggedNodeType, { x: Math.max(0, x), y: Math.max(0, y) });
                setDraggedNodeType(null);
              }
            }}
            onClick={() => { setSelectedNode(null); setSelectedConnection(null); setConnectionMode(null); }}
          >
            <div style={{ 
              transform: `scale(${zoom}) translate(${canvasOffset.x / zoom}px, ${canvasOffset.y / zoom}px)`,
              transformOrigin: 'top left',
              width: '100%',
              height: '100%'
            }}>
              {nodes.map(node => (
                <FlowchartNode
                  key={node.id}
                  node={node}
                  isSelected={selectedNode === node.id}
                  onSelect={setSelectedNode}
                  onDelete={deleteNode}
                  onUpdate={updateNode}
                  onStartConnection={startConnection}
                  onEndConnection={endConnection}
                  connectionMode={!!connectionMode}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel - Properties or AI Optimization */}
        <div className="w-80 border-l border-white/10 overflow-hidden flex flex-col">
          {/* AI Optimization Panel */}
          <div className="flex-1 overflow-y-auto p-4">
            <AIOptimizationPanel 
              workflow={workflow}
              nodes={nodes}
              connections={connections}
              onApplyOptimization={(suggestion) => {
                const targets = suggestion.target_nodes || [];
                let changed = false;

                if (suggestion.type === 'timing') {
                  const daysMatch = suggestion.implementation?.match(/(\d+)\s*day/i);
                  const hoursMatch = suggestion.implementation?.match(/(\d+)\s*hour/i);
                  const waitNodes = targets.length > 0 
                    ? targets.map(id => nodes.find(n => n.id === id)).filter(n => n?.type === 'wait')
                    : nodes.filter(n => n.type === 'wait');
                  waitNodes.forEach(node => {
                    if (node) {
                      updateNode(node.id, {
                        ...(daysMatch ? { delay_days: parseInt(daysMatch[1]) } : {}),
                        ...(hoursMatch ? { delay_hours: parseInt(hoursMatch[1]) } : {}),
                      });
                      changed = true;
                    }
                  });
                } else if (suggestion.type === 'logic') {
                  const targetNode = targets.length > 0 
                    ? nodes.find(n => n.id === targets[0])
                    : nodes.find(n => n.type === 'send_message');
                  if (targetNode) {
                    addNode('condition', { x: targetNode.x, y: targetNode.y + 150 });
                    changed = true;
                  }
                } else if (suggestion.type === 'sequence' && targets.length >= 2) {
                  const n1 = nodes.find(n => n.id === targets[0]);
                  const n2 = nodes.find(n => n.id === targets[1]);
                  if (n1 && n2) {
                    const tempY = n1.y;
                    updateNode(n1.id, { y: n2.y });
                    updateNode(n2.id, { y: tempY });
                    changed = true;
                  }
                } else if (suggestion.type === 'optimization') {
                  const optTargets = targets.length > 0 ? targets : nodes.filter(n => n.type === 'send_message').map(n => n.id);
                  optTargets.forEach(nodeId => {
                    if (nodes.find(n => n.id === nodeId)) {
                      updateNode(nodeId, { ai_optimized: true });
                      changed = true;
                    }
                  });
                }

                if (!changed) {
                  toast.info('This suggestion requires manual implementation. See the instructions below.');
                }
              }}
            />
          </div>

          {/* Properties Panel */}
          {(selectedNodeData || selectedConnection) && (
            <div className="border-t border-white/10 p-4 overflow-y-auto max-h-[50vh]">
            <h3 className="text-lg font-semibold text-white mb-4">
              {selectedNodeData ? 'Node Properties' : 'Connection Properties'}
            </h3>
            
            {selectedConnection && (
              <div className="space-y-4 mb-6">
                <div>
                  <Label className="text-gray-400 mb-2 block">Connection Style</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(CONNECTION_STYLES).map(([key, config]) => (
                      <button
                        key={key}
                        onClick={() => {
                          updateConnectionStyle(selectedConnection.from, selectedConnection.to, key);
                          setSelectedConnection({ ...selectedConnection });
                        }}
                        className={`p-3 rounded-lg border transition-all
                          ${connections.find(c => 
                              c.from.nodeId === selectedConnection.from.nodeId && 
                              c.from.port === selectedConnection.from.port && 
                              c.to === selectedConnection.to
                            )?.style === key || (!connections.find(c => 
                              c.from.nodeId === selectedConnection.from.nodeId && 
                              c.from.port === selectedConnection.from.port && 
                              c.to === selectedConnection.to
                            )?.style && key === 'curved')
                            ? 'border-[#38b6ff] bg-[#38b6ff]/20 text-[#38b6ff]' 
                            : 'border-white/10 hover:border-white/20 text-gray-400 hover:text-white'
                          }`}
                      >
                        <div className="text-2xl mb-1 text-center">{config.icon}</div>
                        <div className="text-xs text-center font-medium">{config.name}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <Button
                  onClick={deleteSelectedConnection}
                  variant="outline"
                  className="w-full border-red-500/50 text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 size={16} className="mr-2" />
                  Delete Connection
                </Button>
              </div>
            )}
            
            {selectedNodeData && (
            <div className="space-y-4">
              {/* Custom Templates Section */}
              {nodeTemplates.filter(t => t.node_type === selectedNodeData.type).length > 0 && (
                <div>
                  <Label className="text-gray-400 mb-2 block">Quick Templates</Label>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {nodeTemplates
                      .filter(t => t.node_type === selectedNodeData.type)
                      .map(template => (
                        <button
                          key={template.id}
                          onClick={() => applyTemplate(template.id)}
                          className="w-full text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 
                            border border-white/10 hover:border-[#cb6ce6]/50 transition-all group"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-white text-sm">{template.name}</span>
                            {template.is_ai_generated && (
                              <Sparkles size={12} className="text-[#cb6ce6]" />
                            )}
                          </div>
                          {template.description && (
                            <div className="text-xs text-gray-400 mt-0.5">{template.description}</div>
                          )}
                        </button>
                      ))}
                  </div>
                </div>
              )}

              <div>
                <Label className="text-gray-400">Name</Label>
                <Input
                  value={selectedNodeData.name}
                  onChange={(e) => updateNode(selectedNode, { name: e.target.value })}
                  className="mt-1.5 bg-black/30 border-white/10 text-white"
                />
              </div>

              {selectedNodeData.type === 'wait' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-gray-400">Days</Label>
                    <Input
                      type="number"
                      min="0"
                      value={selectedNodeData.delay_days || 0}
                      onChange={(e) => updateNode(selectedNode, { delay_days: parseInt(e.target.value) })}
                      className="mt-1.5 bg-black/30 border-white/10 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-400">Hours</Label>
                    <Input
                      type="number"
                      min="0"
                      max="23"
                      value={selectedNodeData.delay_hours || 0}
                      onChange={(e) => updateNode(selectedNode, { delay_hours: parseInt(e.target.value) })}
                      className="mt-1.5 bg-black/30 border-white/10 text-white"
                    />
                  </div>
                </div>
              )}

              {selectedNodeData.type === 'condition' && (
                <div>
                  <Label className="text-gray-400">Condition</Label>
                  <Select 
                    value={selectedNodeData.condition || ''} 
                    onValueChange={(val) => updateNode(selectedNode, { condition: val })}
                  >
                    <SelectTrigger className="mt-1.5 bg-black/30 border-white/10 text-white">
                      <SelectValue placeholder="Select condition" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1a1a] border-white/10">
                      {CONDITION_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value} className="text-white">
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

{selectedNodeData.type === 'send_message' && (
                <>
                  <div>
                    <Label className="text-gray-400">Channel</Label>
                    <Select 
                      value={selectedNodeData.channel || 'email'} 
                      onValueChange={(val) => updateNode(selectedNode, { channel: val })}
                    >
                      <SelectTrigger className="mt-1.5 bg-black/30 border-white/10 text-white">
                        <SelectValue placeholder="Select channel" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1a1a] border-white/10">
                        <SelectItem value="email" className="text-white">Email</SelectItem>
                        <SelectItem value="whatsapp" className="text-white">WhatsApp</SelectItem>
                        <SelectItem value="linkedin" className="text-white">LinkedIn</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <Label className="text-gray-400">Content</Label>
                      <Button
                        size="sm"
                        onClick={() => generateContentWithAI(selectedNodeData.channel || 'email')}
                        disabled={isGeneratingContent}
                        className="h-6 px-2 text-xs bg-gradient-to-r from-[#cb6ce6] to-[#38b6ff]"
                      >
                        {isGeneratingContent ? (
                          <div className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                        ) : (
                          <>
                            <Sparkles size={12} className="mr-1" />
                            AI Generate
                          </>
                        )}
                      </Button>
                    </div>
                    {selectedNodeData.channel === 'email' && (
                      <Input
                        value={selectedNodeData.subject || ''}
                        onChange={(e) => updateNode(selectedNode, { subject: e.target.value })}
                        placeholder="Email subject..."
                        className="mb-2 bg-black/30 border-white/10 text-white"
                      />
                    )}
                    <Textarea
                      value={selectedNodeData.content || ''}
                      onChange={(e) => updateNode(selectedNode, { content: e.target.value })}
                      placeholder="Message content..."
                      className="min-h-[100px] bg-black/30 border-white/10 text-white"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-gray-400">Auto-send</Label>
                    <input
                      type="checkbox"
                      checked={selectedNodeData.auto_send || false}
                      onChange={(e) => updateNode(selectedNode, { auto_send: e.target.checked })}
                      className="w-4 h-4 rounded border-white/20 bg-black/30"
                    />
                  </div>
                </>
              )}
            </div>
            )}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}