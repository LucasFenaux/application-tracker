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
        .heatmap-container { padding: 1.5rem; }
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
          background: #000; color: #fff; padding: 6px 10px; border-radius: 4px;
          font-size: 0.75rem; white-space: nowrap; pointer-events: none;
          opacity: 0; transition: opacity 0.2s; z-index: 10; margin-bottom: 4px;
        }
        .heatmap-cell:hover .tooltip { opacity: 1; }
      `}</style>

      <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>Activity (Last 90 Days)</h3>
      <div style={{ display: 'flex' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '18px', marginRight: '8px', fontSize: '10px', color: 'var(--text-secondary)', flexShrink: 0 }}>
          <div style={{ height: '14px' }}></div>
          <div style={{ height: '14px', lineHeight: '14px' }}>Mon</div>
          <div style={{ height: '14px' }}></div>
          <div style={{ height: '14px', lineHeight: '14px' }}>Wed</div>
          <div style={{ height: '14px' }}></div>
          <div style={{ height: '14px', lineHeight: '14px' }}>Fri</div>
          <div style={{ height: '14px' }}></div>
        </div>
        <div style={{ paddingBottom: '8px' }}>
          <div style={{ display: 'flex', gap: '4px', marginBottom: '4px', fontSize: '10px', color: 'var(--text-secondary)' }}>
            {weeks.map((week, i) => {
              const currentMonth = format(week[0], 'MMM');
              const prevWeek = i > 0 ? weeks[i-1][0] : null;
              const showMonth = !prevWeek || format(prevWeek, 'MMM') !== currentMonth;
              return (
                <div key={`m-${i}`} style={{ width: '14px', flexShrink: 0, overflow: 'visible', whiteSpace: 'nowrap' }}>
                  {showMonth ? currentMonth : ''}
                </div>
              );
            })}
          </div>
          <div className="heatmap-grid" style={{ minWidth: 'max-content' }}>
            {weeks.map((week, i) => (
              <div key={i} className="heatmap-col">
                {week.map(day => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const activity = activityMap.get(dateStr);
                  const count = activity ? activity.count : 0;
                  
                  let summaryElements: React.ReactNode = 'No activity';
                  if (activity && activity.actions) {
                    const actionCounts = activity.actions.split(', ').reduce((acc: any, curr: string) => {
                      acc[curr] = (acc[curr] || 0) + 1;
                      return acc;
                    }, {});
                    
                    const getActionColor = (action: string) => {
                      if (action.includes('Applied')) return '#3b82f6';
                      if (action.includes('Interviewing')) return '#a855f7';
                      if (action.includes('Offer')) return '#22c55e';
                      if (action.includes('Rejected')) return '#ef4444';
                      if (action.includes('Queue')) return '#94a3b8';
                      if (action.includes('Resume')) return '#f59e0b';
                      return 'var(--text-secondary)';
                    };

                    summaryElements = Object.entries(actionCounts).map(([key, val]) => (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ color: 'var(--text-secondary)', width: '12px', textAlign: 'right' }}>{val as React.ReactNode}x</span>
                        <span style={{ color: getActionColor(key), fontWeight: 600 }}>{key}</span>
                      </div>
                    ));
                  }
                  
                  return (
                    <div key={dateStr} className={`heatmap-cell ${getIntensityClass(count)}`} style={{ flexShrink: 0 }}>
                      <div className="tooltip">
                        <strong style={{ display: 'block', marginBottom: '4px' }}>{format(day, 'MMM d, yyyy')}</strong>
                        <div style={{ textAlign: 'left', lineHeight: 1.5 }}>{summaryElements}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
