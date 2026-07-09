'use client';

import React, { useState, useEffect } from 'react';
import { updateJobStage, aiCleanupJob } from '@/app/actions';
import { ExternalLink, Calendar as CalendarIcon, Wand2, Loader2, RefreshCw } from 'lucide-react';
import DeleteJobButton from './DeleteJobButton';

const STAGES = ['Queue', 'Applied', 'Interviewing', 'Offer', 'Rejected'];

export default function KanbanBoard({ initialJobs }: { initialJobs: any[] }) {
  const [jobs, setJobs] = useState(initialJobs);
  const [draggedJob, setDraggedJob] = useState<any>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [cleaningJobs, setCleaningJobs] = useState<Record<number, boolean>>({});
  const [globalCleaningJobs, setGlobalCleaningJobs] = useState<Record<number, boolean>>({});
  const [showingOriginals, setShowingOriginals] = useState<Record<number, boolean>>({});

  const handleCleanup = async (e: React.MouseEvent, jobId: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    setCleaningJobs(prev => ({ ...prev, [jobId]: true }));
    try {
      const res = await aiCleanupJob(jobId);
      if (!res.success) {
        alert(res.error || 'Failed to clean up job');
      } else {
        setJobs(prev => prev.map(j => j.id === jobId ? { ...j, original_job_data: '{}' } : j));
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCleaningJobs(prev => ({ ...prev, [jobId]: false }));
    }
  };

  useEffect(() => {
    setJobs(initialJobs);
  }, [initialJobs]);

  useEffect(() => {
    const fetchCleaning = async () => {
      try {
        const { getQueuedCleanups } = await import('@/app/actions');
        const queued = await getQueuedCleanups();
        const newGlobal: Record<number, boolean> = {};
        queued.forEach(key => {
          const [type, id] = key.split('-');
          if (type === 'job') newGlobal[Number(id)] = true;
        });
        setGlobalCleaningJobs(newGlobal);
      } catch (e) {}
    };

    fetchCleaning();
    const interval = setInterval(fetchCleaning, 3000);
    return () => clearInterval(interval);
  }, []);

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
              {stageJobs.map(job => {
                const isOriginal = showingOriginals[job.id];
                let originalData = null;
                if (job.original_job_data) {
                  try {
                    originalData = JSON.parse(job.original_job_data);
                  } catch (e) {}
                }
                const displayTitle = isOriginal && originalData ? originalData.title : job.title;
                const displayCompany = isOriginal && originalData ? originalData.company : job.company;
                const displayLocation = isOriginal && originalData ? originalData.location : job.location;

                return (
                <div 
                  key={job.id} 
                  className="kanban-card"
                  draggable
                  onDragStart={(e) => handleDragStart(e, job)}
                  onDragEnd={handleDragEnd}
                >
                  <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <a href={`/board/${job.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                      {displayTitle}
                    </a>
                    {job.deletion_suggested === 1 && (
                      <span style={{ fontSize: '0.7rem', background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.3)', whiteSpace: 'nowrap', marginLeft: '8px' }} title="AI flagged this as an invalid job post. See AI Cleanup tab to keep or delete.">
                        Deletion Suggested
                      </span>
                    )}
                  </div>
                  <div className="card-company">{displayCompany}</div>
                  <div className="card-location" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{displayLocation || 'Remote/Unknown'}</div>
                  
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
                      {job.original_job_data ? (
                        <div style={{ display: 'flex', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '6px', overflow: 'hidden', background: 'rgba(168, 85, 247, 0.05)' }}>
                          <button 
                            className="btn-secondary" 
                            style={{ border: 'none', borderRight: '1px solid rgba(168, 85, 247, 0.3)', padding: '4px 8px', fontSize: '0.75rem', background: showingOriginals[job.id] ? 'rgba(168, 85, 247, 0.2)' : 'transparent', color: '#c084fc', borderRadius: 0, margin: 0 }}
                            onClick={(e) => { e.stopPropagation(); setShowingOriginals(prev => ({ ...prev, [job.id]: !prev[job.id] })); }}
                            title="Toggle Original/Cleaned"
                          >
                            {showingOriginals[job.id] ? 'Original' : 'Cleaned'}
                          </button>
                          <button 
                            className="btn-secondary" 
                            style={{ border: 'none', padding: '4px 6px', color: '#c084fc', background: 'transparent', borderRadius: 0, margin: 0 }}
                            onClick={(e) => handleCleanup(e, job.id)}
                            disabled={cleaningJobs[job.id] || globalCleaningJobs[job.id]}
                            title="Re-run AI Cleanup"
                          >
                            {(cleaningJobs[job.id] || globalCleaningJobs[job.id]) ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />}
                          </button>
                        </div>
                      ) : (
                        <button 
                          className="btn-secondary" 
                          style={{ padding: '4px', color: 'var(--accent-color)' }}
                          onClick={(e) => handleCleanup(e, job.id)}
                          disabled={cleaningJobs[job.id] || globalCleaningJobs[job.id]}
                          title="Clean up with AI"
                        >
                          {(cleaningJobs[job.id] || globalCleaningJobs[job.id]) ? <Loader2 size={16} className="spin" /> : <Wand2 size={16} />}
                        </button>
                      )}
                      <DeleteJobButton id={job.id} />
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
