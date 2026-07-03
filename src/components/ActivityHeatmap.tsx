'use client';

import React from 'react';
import { format, subDays, eachDayOfInterval, startOfWeek, endOfWeek } from 'date-fns';

export default function ActivityHeatmap({ activities }: { activities: any[] }) {
  // Generate last 90 days
  const today = new Date();
  const startDate = startOfWeek(subDays(today, 90));
  const endDate = endOfWeek(today);
  
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  
  const activityMap = new Map();
  activities.forEach(a => {
    activityMap.set(a.date, a);
  });

  const weeks: Date[][] = [];
  let currentWeek: Date[] = [];
  
  days.forEach(day => {
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });

  const getIntensityClass = (count: number) => {
    if (count === 0) return 'level-0';
    if (count === 1) return 'level-1';
    if (count <= 3) return 'level-2';
    if (count <= 5) return 'level-3';
    return 'level-4';
  };

  return (
    <div className="heatmap-container glass-panel">
      <style>{`
        .heatmap-container { padding: 1.5rem; overflow-x: auto; }
        .heatmap-grid { display: flex; gap: 4px; }
        .heatmap-col { display: flex; flex-direction: column; gap: 4px; }
        .heatmap-cell {
          width: 14px; height: 14px; border-radius: 3px;
          background: rgba(255, 255, 255, 0.05);
          position: relative; cursor: pointer;
        }
        .level-0 { background: rgba(255, 255, 255, 0.05); }
        .level-1 { background: rgba(59, 130, 246, 0.3); }
        .level-2 { background: rgba(59, 130, 246, 0.6); }
        .level-3 { background: rgba(59, 130, 246, 0.8); }
        .level-4 { background: rgba(59, 130, 246, 1); }
        
        .tooltip {
          position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%);
          background: #000; color: #fff; padding: 4px 8px; border-radius: 4px;
          font-size: 0.75rem; white-space: nowrap; pointer-events: none;
          opacity: 0; transition: opacity 0.2s; z-index: 10; margin-bottom: 4px;
        }
        .heatmap-cell:hover .tooltip { opacity: 1; }
      `}</style>

      <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>Activity (Last 90 Days)</h3>
      <div className="heatmap-grid">
        {weeks.map((week, i) => (
          <div key={i} className="heatmap-col">
            {week.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const activity = activityMap.get(dateStr);
              const count = activity ? activity.count : 0;
              const actions = activity ? activity.actions : 'No activity';
              
              return (
                <div key={dateStr} className={`heatmap-cell ${getIntensityClass(count)}`}>
                  <div className="tooltip">
                    <strong>{format(day, 'MMM d, yyyy')}</strong>
                    <div style={{ color: 'var(--text-secondary)' }}>{actions}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
