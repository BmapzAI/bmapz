import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/components/ui/LanguageContext';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Building2, User, Mail, Globe, MoreVertical, Crown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createPageUrl } from '@/utils';

export default function LeadKanban({ leads, stages, onStageChange, onDisqualify }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const handleDragEnd = (result) => {
    if (!result.destination) return;
    
    const { draggableId, destination } = result;
    const newStage = destination.droppableId;
    
    onStageChange(draggableId, newStage);
  };

  const getLeadsForStage = (stageId) => {
    return leads.filter(lead => lead.funnel_stage === stageId);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => {
          const stageLeads = getLeadsForStage(stage.id);
          
          return (
            <div key={stage.id} className="flex-shrink-0 w-80">
              {/* Column Header */}
              <div 
                className="flex items-center justify-between p-3 rounded-t-xl mb-2"
                style={{ backgroundColor: `${stage.color}20` }}
              >
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: stage.color }}
                  />
                  <span className="font-semibold text-white">{stage.name}</span>
                </div>
                <span className="text-sm text-gray-400 px-2 py-0.5 rounded-full bg-white/10">
                  {stageLeads.length}
                </span>
              </div>

              {/* Cards Container */}
              <Droppable droppableId={stage.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`min-h-[400px] space-y-3 p-2 rounded-xl transition-colors duration-200
                      ${snapshot.isDraggingOver ? 'bg-[#38b6ff]/10' : 'bg-white/5'}`}
                  >
                    {stageLeads.map((lead, index) => (
                      <Draggable key={lead.id} draggableId={lead.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            onDoubleClick={() => navigate(`/LeadDetails?id=${lead.id}`)}
                            className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer
                              ${snapshot.isDragging 
                                ? 'bg-[#1a1a1a] border-[#38b6ff]/50 shadow-xl shadow-[#38b6ff]/20' 
                                : 'bg-[#1a1a1a] border-white/10 hover:border-[#38b6ff]/30'
                              }`}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3572b9] to-[#38b6ff] 
                                  flex items-center justify-center text-white font-bold text-sm">
                                  {lead.lead_company_name?.[0]?.toUpperCase() || 'L'}
                                </div>
                                <div>
                                  <h3 className="font-semibold text-white text-sm">{lead.lead_company_name}</h3>
                                  {lead.lead_name && (
                                    <p className="text-gray-400 text-xs flex items-center gap-1">
                                      <User size={10} />
                                      {lead.lead_name}
                                      {lead.is_decision_maker && (
                                        <Crown size={10} className="text-yellow-400 ml-1" />
                                      )}
                                    </p>
                                  )}
                                </div>
                              </div>
                              
                              <DropdownMenu>
                                <DropdownMenuTrigger className="p-1 rounded hover:bg-white/10 text-gray-400">
                                  <MoreVertical size={16} />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="bg-[#1a1a1a] border-white/10">
                                  <DropdownMenuItem
                                    className="text-white hover:bg-white/10"
                                    onClick={() => navigate(`/LeadDetails?id=${lead.id}`)}
                                    >
                                      {t('viewDetails')}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="text-white hover:bg-white/10">
                                    {t('sendMessage')}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-red-400 hover:bg-red-500/10"
                                    onClick={() => onDisqualify && onDisqualify(lead.id)}
                                  >
                                    {t('disqualify')}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>

                            <div className="space-y-1.5 text-xs text-gray-400">
                              {lead.email && (
                                <div className="flex items-center gap-2">
                                  <Mail size={12} className="text-[#38b6ff]" />
                                  <span className="truncate">{lead.email}</span>
                                </div>
                              )}
                              {lead.company_website && (
                                <div className="flex items-center gap-2">
                                  <Globe size={12} className="text-[#00e7ff]" />
                                  <span className="truncate">{lead.company_website}</span>
                                </div>
                              )}
                            </div>

                            {lead.icp_score && (
                              <div className="mt-3 pt-3 border-t border-white/5">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-gray-400">{t('icpScore')}</span>
                                  <span className={`font-medium ${
                                    lead.icp_score >= 70 ? 'text-green-400' :
                                    lead.icp_score >= 40 ? 'text-yellow-400' : 'text-red-400'
                                  }`}>
                                    {lead.icp_score}%
                                  </span>
                                </div>
                                <div className="mt-1 h-1 rounded-full bg-white/10 overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full ${
                                      lead.icp_score >= 70 ? 'bg-green-400' :
                                      lead.icp_score >= 40 ? 'bg-yellow-400' : 'bg-red-400'
                                    }`}
                                    style={{ width: `${lead.icp_score}%` }}
                                  />
                                </div>
                              </div>
                            )}

                            {lead.estimated_value && (
                              <div className="mt-2 text-xs text-[#cb6ce6] font-medium">
                                ${lead.estimated_value.toLocaleString()}
                              </div>
                            )}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}