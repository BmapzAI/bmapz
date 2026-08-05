import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function StatsCard({ title, value, icon: Icon, trend, trendLabel, color = 'blue', onClick, hint }) {
  const colorClasses = {
    blue: 'from-[#3572b9]/20 to-[#38b6ff]/10 border-[#38b6ff]/20',
    cyan: 'from-[#00e7ff]/20 to-[#38b6ff]/10 border-[#00e7ff]/20',
    magenta: 'from-[#cb6ce6]/20 to-[#38b6ff]/10 border-[#cb6ce6]/20',
    green: 'from-green-500/20 to-green-400/10 border-green-500/20',
  };

  const iconColors = {
    blue: 'text-[#38b6ff]',
    cyan: 'text-[#00e7ff]',
    magenta: 'text-[#cb6ce6]',
    green: 'text-green-400',
  };

  const glowColors = {
    blue: 'bg-[#38b6ff]',
    cyan: 'bg-[#00e7ff]',
    magenta: 'bg-[#cb6ce6]',
    green: 'bg-green-400',
  };

  const isPositive = trend > 0;
  // Clickable cards open a drill-down listing the records behind the number.
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      {...(onClick ? { onClick, type: 'button', title: hint || 'Click to see the records behind this number' } : {})}
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br border backdrop-blur-sm p-5
      transition-all duration-300 hover:scale-[1.02] hover:shadow-lg group w-full text-left
      ${onClick ? 'cursor-pointer' : ''}
      ${colorClasses[color]}`}>

      <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-20 
        ${glowColors[color]} group-hover:opacity-40 transition-opacity duration-500`} />
      
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm font-medium mb-1 text-gray-400">{title}</p>
            <h3 className="text-2xl font-bold text-white">{value}</h3>
          </div>
          {Icon && (
            <div className={`p-2.5 rounded-xl bg-black/30 ${iconColors[color]}`}>
              <Icon size={22} />
            </div>
          )}
        </div>
        
        {trend !== undefined && (
          <div className="flex items-center gap-1.5">
            {isPositive ? (
              <TrendingUp size={14} className="text-green-400" />
            ) : (
              <TrendingDown size={14} className="text-red-400" />
            )}
            <span className={`text-sm font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
              {isPositive ? '+' : ''}{trend}%
            </span>
            <span className="text-sm text-gray-500">{trendLabel}</span>
          </div>
        )}
      </div>
    </Tag>
  );
}