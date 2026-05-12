import React from 'react';
import { useLanguage } from '@/components/ui/LanguageContext';
import { MessageSquare, UserPlus, GitBranch, Mail, Phone } from 'lucide-react';
import moment from 'moment';

const activityIcons = {
  lead_created: UserPlus,
  message_sent: MessageSquare,
  message_received: Mail,
  workflow_started: GitBranch,
  lead_stage_changed: Phone,
};

const activityColors = {
  lead_created: 'text-green-400 bg-green-500/10',
  message_sent: 'text-[#38b6ff] bg-[#38b6ff]/10',
  message_received: 'text-[#cb6ce6] bg-[#cb6ce6]/10',
  workflow_started: 'text-[#00e7ff] bg-[#00e7ff]/10',
  lead_stage_changed: 'text-yellow-400 bg-yellow-500/10',
};

export default function ActivityFeed({ activities }) {
  const { t } = useLanguage();

  if (!activities || activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 bg-white/5">
          <MessageSquare size={28} className="text-gray-500" />
        </div>
        <p className="font-medium text-gray-400">{t('noRecentActivity')}</p>
        <p className="text-sm mt-1 text-gray-500">{t('startByAdding')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
      {activities.map((activity) => {
        const Icon = activityIcons[activity.type] || MessageSquare;
        const colorClass = activityColors[activity.type] || 'text-gray-400 bg-gray-400/10';
        
        return (
          <div 
            key={activity.id} 
            className="flex items-start gap-3 p-3 rounded-xl transition-colors duration-200 cursor-pointer bg-white/5 hover:bg-white/10"
          >
            <div className={`p-2 rounded-lg ${colorClass} flex-shrink-0`}>
              <Icon size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-white">{activity.title}</p>
              <p className="text-xs mt-0.5 text-gray-500">{activity.description}</p>
            </div>
            <span className="text-xs whitespace-nowrap text-gray-500">
              {moment(activity.created_date).fromNow()}
            </span>
          </div>
        );
      })}
    </div>
  );
}