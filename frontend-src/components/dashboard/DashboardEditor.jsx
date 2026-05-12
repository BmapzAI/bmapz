import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Plus, Trash2, GripVertical, Settings, BarChart3, 
  PieChart, LineChart, Table, TrendingUp, Target,
  Users, MessageSquare, X
} from 'lucide-react';

const WIDGET_TYPES = [
  { id: 'bar_chart', name: 'Bar Chart', icon: BarChart3, color: '#38b6ff' },
  { id: 'pie_chart', name: 'Pie Chart', icon: PieChart, color: '#cb6ce6' },
  { id: 'line_chart', name: 'Line Chart', icon: LineChart, color: '#00e7ff' },
  { id: 'area_chart', name: 'Area Chart', icon: TrendingUp, color: '#22c55e' },
  { id: 'stat_card', name: 'Stat Card', icon: Target, color: '#f59e0b' },
  { id: 'table', name: 'Data Table', icon: Table, color: '#3572b9' },
];

const DATA_SOURCES = [
  { id: 'leads', name: 'Leads', icon: Users },
  { id: 'messages', name: 'Messages', icon: MessageSquare },
  { id: 'funnel', name: 'Funnel Stages', icon: Target },
  { id: 'activities', name: 'Activities', icon: TrendingUp },
];

export default function DashboardEditor({ widgets, onWidgetsChange, isEditing, onToggleEdit }) {
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [editingWidget, setEditingWidget] = useState(null);
  const [newWidget, setNewWidget] = useState({
    type: 'bar_chart',
    title: '',
    dataSource: 'leads',
    size: 'medium',
  });

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    
    const items = Array.from(widgets);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    onWidgetsChange(items);
  };

  const addWidget = () => {
    if (!newWidget.title) return;
    
    const widget = {
      id: `widget_${Date.now()}`,
      ...newWidget,
    };
    
    onWidgetsChange([...widgets, widget]);
    setShowAddWidget(false);
    setNewWidget({ type: 'bar_chart', title: '', dataSource: 'leads', size: 'medium' });
  };

  const removeWidget = (widgetId) => {
    onWidgetsChange(widgets.filter(w => w.id !== widgetId));
  };

  const updateWidget = (widgetId, updates) => {
    onWidgetsChange(widgets.map(w => w.id === widgetId ? { ...w, ...updates } : w));
    setEditingWidget(null);
  };

  const getSizeClass = (size) => {
    switch (size) {
      case 'small': return 'col-span-1';
      case 'large': return 'col-span-2 lg:col-span-3';
      default: return 'col-span-1 lg:col-span-2';
    }
  };

  return (
    <div>
      {/* Edit Mode Toggle */}
      <div className="flex items-center justify-end gap-2 mb-4">
        {isEditing && (
          <Button
            onClick={() => setShowAddWidget(true)}
            className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2"
          >
            <Plus size={18} />
            Add Widget
          </Button>
        )}
        <Button
          variant="outline"
          onClick={onToggleEdit}
          className={`border-white/10 gap-2 ${isEditing ? 'bg-[#38b6ff]/20 text-[#38b6ff] border-[#38b6ff]/50' : 'text-white hover:bg-white/5'}`}
        >
          <Settings size={18} />
          {isEditing ? 'Done Editing' : 'Edit Dashboard'}
        </Button>
      </div>

      {/* Widgets Grid */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="widgets" direction="horizontal">
          {(provided) => (
            <div 
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {widgets.map((widget, index) => {
                const config = WIDGET_TYPES.find(t => t.id === widget.type);
                const Icon = config?.icon || BarChart3;
                
                return (
                  <Draggable 
                    key={widget.id} 
                    draggableId={widget.id} 
                    index={index}
                    isDragDisabled={!isEditing}
                  >
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`${getSizeClass(widget.size)} rounded-2xl bg-white/5 border border-white/10 
                          overflow-hidden transition-all duration-200
                          ${snapshot.isDragging ? 'shadow-xl shadow-[#38b6ff]/20 border-[#38b6ff]/50' : ''}
                          ${isEditing ? 'hover:border-[#38b6ff]/30' : ''}`}
                      >
                        {/* Widget Header */}
                        <div className="flex items-center justify-between p-4 border-b border-white/10">
                          <div className="flex items-center gap-3">
                            {isEditing && (
                              <div {...provided.dragHandleProps} className="cursor-grab text-gray-400">
                                <GripVertical size={18} />
                              </div>
                            )}
                            <Icon size={18} style={{ color: config?.color }} />
                            <h3 className="font-semibold text-white">{widget.title}</h3>
                          </div>
                          
                          {isEditing && (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditingWidget(widget)}
                                className="h-8 w-8 text-gray-400 hover:text-white"
                              >
                                <Settings size={14} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeWidget(widget.id)}
                                className="h-8 w-8 text-gray-400 hover:text-red-400"
                              >
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Widget Content Placeholder */}
                        <div className="p-4 h-48 flex items-center justify-center">
                          <div className="text-center text-gray-400">
                            <Icon size={40} className="mx-auto mb-2 opacity-30" />
                            <p className="text-sm">{config?.name}</p>
                            <p className="text-xs mt-1">Data: {widget.dataSource}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Add Widget Dialog */}
      <Dialog open={showAddWidget} onOpenChange={setShowAddWidget}>
        <DialogContent className="bg-[#1a1a1a] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Add Widget</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">Widget Title</label>
              <Input
                value={newWidget.title}
                onChange={(e) => setNewWidget({ ...newWidget, title: e.target.value })}
                placeholder="Enter widget title..."
                className="bg-black/30 border-white/10 text-white"
              />
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">Widget Type</label>
              <div className="grid grid-cols-3 gap-2">
                {WIDGET_TYPES.map(type => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.id}
                      onClick={() => setNewWidget({ ...newWidget, type: type.id })}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all
                        ${newWidget.type === type.id 
                          ? 'border-[#38b6ff] bg-[#38b6ff]/10' 
                          : 'border-white/10 hover:border-white/20 bg-white/5'
                        }`}
                    >
                      <Icon size={24} style={{ color: type.color }} />
                      <span className="text-xs text-white">{type.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">Data Source</label>
              <Select 
                value={newWidget.dataSource} 
                onValueChange={(val) => setNewWidget({ ...newWidget, dataSource: val })}
              >
                <SelectTrigger className="bg-black/30 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-white/10">
                  {DATA_SOURCES.map(ds => (
                    <SelectItem key={ds.id} value={ds.id} className="text-white">
                      <div className="flex items-center gap-2">
                        <ds.icon size={14} />
                        {ds.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">Widget Size</label>
              <Select 
                value={newWidget.size} 
                onValueChange={(val) => setNewWidget({ ...newWidget, size: val })}
              >
                <SelectTrigger className="bg-black/30 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-white/10">
                  <SelectItem value="small" className="text-white">Small (1 column)</SelectItem>
                  <SelectItem value="medium" className="text-white">Medium (2 columns)</SelectItem>
                  <SelectItem value="large" className="text-white">Large (3 columns)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowAddWidget(false)}
              className="border-white/10 text-white hover:bg-white/5"
            >
              Cancel
            </Button>
            <Button
              onClick={addWidget}
              disabled={!newWidget.title}
              className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff]"
            >
              Add Widget
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Widget Dialog */}
      <Dialog open={!!editingWidget} onOpenChange={() => setEditingWidget(null)}>
        <DialogContent className="bg-[#1a1a1a] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Edit Widget</DialogTitle>
          </DialogHeader>
          
          {editingWidget && (
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm text-gray-400 mb-1.5 block">Widget Title</label>
                <Input
                  value={editingWidget.title}
                  onChange={(e) => setEditingWidget({ ...editingWidget, title: e.target.value })}
                  className="bg-black/30 border-white/10 text-white"
                />
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-1.5 block">Widget Size</label>
                <Select 
                  value={editingWidget.size} 
                  onValueChange={(val) => setEditingWidget({ ...editingWidget, size: val })}
                >
                  <SelectTrigger className="bg-black/30 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-white/10">
                    <SelectItem value="small" className="text-white">Small</SelectItem>
                    <SelectItem value="medium" className="text-white">Medium</SelectItem>
                    <SelectItem value="large" className="text-white">Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setEditingWidget(null)}
              className="border-white/10 text-white hover:bg-white/5"
            >
              Cancel
            </Button>
            <Button
              onClick={() => updateWidget(editingWidget.id, editingWidget)}
              className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff]"
            >
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}