'use client';

import React, { useState, useEffect } from 'react';
import { updateJobStage } from '@/app/actions';
import { ExternalLink, Calendar as CalendarIcon } from 'lucide-react';
import DeleteJobButton from './DeleteJobButton';

const STAGES = ['Queue', 'Applied', 'Interviewing', 'Offer', 'Rejected'];

export default function KanbanBoard({ initialJobs }: { initialJobs: any[] }) {
  const [jobs, setJobs] = useState(initialJobs);
  const [draggedJob, setDraggedJob] = useState<any>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  useEffect(() => {
    setJobs(initialJobs);
  }, [initialJobs]);

  const handleDragStart = (e: React.DragEvent, job: any) => {
    setDraggedJob(job);
    e.dataTransfer.effectAllowed = 'move';
    // Small delay to keep the card visible while dragging
    setTimeout(() => {
      e.target && (e.target as HTMLElement).classList.add('dragging');
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedJob(null);
    setDragOverStage(null);
    e.target && (e.target as HTMLElement).classList.remove('dragging');
  };

  const handleDragOver = (e: React.DragEvent, stage: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverStage !== stage) {
      setDragOverStage(stage);
    }
  };

  const handleDrop = async (e: React.DragEvent, stage: string) => {
    e.preventDefault();
    setDragOverStage(null);
    
    if (draggedJob && draggedJob.stage !== stage) {
      // Optimistic update
      const newJobs = jobs.map(j => 
        j.id === draggedJob.id ? { ...j, stage } : j
      );
      setJobs(newJobs);
      
      // Server action
      await updateJobStage(draggedJob.id, stage);
    }
  };

  return (
    <div className="kanban-board">
      {STAGES.map(stage => {
        const stageJobs = jobs.filter(j => j.stage === stage);
        const isDragOver = dragOverStage === stage;
        
        return (
          <div 
            key={stage} 
            className={`kanban-column ${isDragOver ? 'drag-over' : ''}`}
            onDragOver={(e) => handleDragOver(e, stage)}
            onDrop={(e) => handleDrop(e, stage)}
          >
            <div className="kanban-column-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ 
                  width: '10px', height: '10px', borderRadius: '50%', 
                  backgroundColor: `var(--stage-${stage.toLowerCase()})` 
                }}></span>
                {stage}
              </div>
              <span className="kanban-badge">{stageJobs.length}</span>
            </div>
            
            <div className="kanban-cards">
              {stageJobs.map(job => (
                <div 
                  key={job.id} 
                  className="kanban-card"
                  draggable
                  onDragStart={(e) => handleDragStart(e, job)}
                  onDragEnd={handleDragEnd}
                >
                  <div className="card-title">
                    <a href={`/board/${job.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                      {job.title}
                    </a>
                  </div>
                  <div className="card-company">{job.company}</div>
                  <div className="card-location" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{job.location || 'Remote/Unknown'}</div>
                  
                  {job.matchScore != null && (
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                      <div style={{ 
                        fontSize: '0.8rem', 
                        padding: '2px 8px', 
                        borderRadius: '4px', 
                        display: 'inline-block',
                        background: job.matchScore > 75 ? 'rgba(34, 197, 94, 0.15)' : job.matchScore > 50 ? 'rgba(234, 179, 8, 0.15)' : 'rgba(239, 68, 68, 0.15)', 
                        color: job.matchScore > 75 ? '#4ade80' : job.matchScore > 50 ? '#facc15' : '#f87171',
                        fontWeight: 600
                      }}>
                        {job.matchScore}% Profile
                      </div>
                      
                      {job.goalMatchScore != null && (
                        <div style={{ 
                          fontSize: '0.8rem', 
                          padding: '2px 8px', 
                          borderRadius: '4px', 
                          display: 'inline-block',
                          background: job.goalMatchScore > 75 ? 'rgba(59, 130, 246, 0.15)' : job.goalMatchScore > 50 ? 'rgba(168, 85, 247, 0.15)' : 'rgba(236, 72, 153, 0.15)', 
                          color: job.goalMatchScore > 75 ? '#60a5fa' : job.goalMatchScore > 50 ? '#c084fc' : '#f472b6',
                          fontWeight: 600
                        }}>
                          {job.goalMatchScore}% Goal
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="card-footer">
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      {job.url && (
                        <a href={job.url} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ padding: '4px 8px', color: 'var(--accent-color)', borderColor: 'var(--accent-color)' }} title="Open Job Post">
                          <ExternalLink size={16} />
                        </a>
                      )}
                      {job.deadline && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CalendarIcon size={12} />
                          {(() => {
                            const now = new Date();
                            const dl = new Date(job.deadline + 'T23:59:59');
                            const diffDays = Math.ceil((dl.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                            const dateStr = new Date(job.deadline + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                            const color = diffDays < 0 ? '#ef4444' : diffDays <= 3 ? '#f59e0b' : diffDays <= 7 ? '#60a5fa' : 'inherit';
                            const label = diffDays < 0 ? `${dateStr} (overdue)` : diffDays === 0 ? `${dateStr} (today!)` : `${dateStr} (${diffDays}d)`;
                            return <span style={{ color, fontWeight: 600 }}>{label}</span>;
                          })()}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <DeleteJobButton id={job.id} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
