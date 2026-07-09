'use client';

import React, { useState, useEffect } from 'react';
import { getCleanupStatus, startBulkCleanup, stopBulkCleanup, getDeletionSuggestions, voteKeepJob, voteDeleteJob } from '../actions';
import { Loader2, Wand2, Trash2, CheckCircle, AlertTriangle } from 'lucide-react';

export default function AiCleanupClient({ initialCleanupStatus, initialSuggestions }: { initialCleanupStatus: any, initialSuggestions: any[] }) {
  const [cleanupStatus, setCleanupStatus] = useState(initialCleanupStatus);
  const [suggestions, setSuggestions] = useState(initialSuggestions);
  const [isStarting, setIsStarting] = useState(false);
  const [isProcessingVote, setIsProcessingVote] = useState<string | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (cleanupStatus?.isRunning) {
      interval = setInterval(async () => {
        const [newStatus, newSuggestions] = await Promise.all([
          getCleanupStatus(),
          getDeletionSuggestions()
        ]);
        setCleanupStatus(newStatus);
        setSuggestions(newSuggestions);
      }, 2000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [cleanupStatus?.isRunning]);

  const handleStartCleanup = async () => {
    setIsStarting(true);
    const res = await startBulkCleanup();
    setIsStarting(false);
    if (!res.success) {
      alert(res.error || res.message);
    } else {
      const newStatus = await getCleanupStatus();
      setCleanupStatus(newStatus);
    }
  };

  const handleStopCleanup = async () => {
    await stopBulkCleanup();
    const newStatus = await getCleanupStatus();
    setCleanupStatus(newStatus);
  };

  const handleVoteKeep = async (id: number, type: 'job' | 'scraped' | 'extension') => {
    setIsProcessingVote(`${type}-${id}`);
    const res = await voteKeepJob(id, type);
    if (res.success) {
      const newSuggestions = await getDeletionSuggestions();
      setSuggestions(newSuggestions);
    }
    setIsProcessingVote(null);
  };

  const handleVoteDelete = async (id: number, type: 'job' | 'scraped' | 'extension') => {
    setIsProcessingVote(`${type}-${id}`);
    const res = await voteDeleteJob(id, type);
    if (res.success) {
      const newSuggestions = await getDeletionSuggestions();
      setSuggestions(newSuggestions);
    }
    setIsProcessingVote(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Bulk Job Cleanup */}
      <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--surface-border)', padding: '1.5rem', borderRadius: '8px' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Wand2 size={20} /> Bulk AI Job Cleanup
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
          Automatically clean up job descriptions using AI. This process runs in the background and processes all uncleaned jobs from the Kanban board, scraper, and extension. You can safely leave this page while it runs.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '2rem', marginBottom: '1rem' }}>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', flex: 1, border: '1px solid var(--surface-border)' }}>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{cleanupStatus?.uncleanedCount ?? '...'}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Jobs Need Cleanup</div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', flex: 1, border: '1px solid var(--surface-border)' }}>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-color)' }}>{cleanupStatus?.cleanedCount ?? '...'}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Jobs Cleaned</div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', flex: 1, border: '1px solid var(--surface-border)' }}>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#f59e0b' }}>{(cleanupStatus?.batchTotal - cleanupStatus?.progress) || 0}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Jobs Queued</div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', flex: 1, border: '1px solid var(--surface-border)' }}>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{cleanupStatus?.totalJobs ?? '...'}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Jobs</div>
            </div>
          </div>

          {cleanupStatus?.isRunning ? (
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--accent-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: 'var(--accent-color)' }}>
                  <Loader2 size={18} className="spin" /> Cleanup in Progress
                </div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  {cleanupStatus.progress} / {cleanupStatus.batchTotal || 1}
                </div>
              </div>
              <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden', marginBottom: '1rem' }}>
                <div 
                  style={{ 
                    height: '100%', 
                    background: 'var(--accent-color)', 
                    width: `${cleanupStatus.batchTotal > 0 ? (cleanupStatus.progress / cleanupStatus.batchTotal) * 100 : 0}%`, 
                    transition: 'width 0.3s ease' 
                  }} 
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{cleanupStatus?.status}</span>
                <button className="btn-secondary" onClick={handleStopCleanup} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', borderColor: 'var(--danger-color)', color: 'var(--danger-color)' }}>
                  Empty Queue / Stop
                </button>
              </div>
            </div>
          ) : (
            <button 
              className="btn-primary" 
              onClick={handleStartCleanup} 
              disabled={isStarting || cleanupStatus?.uncleanedCount === 0} 
              style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {isStarting ? <Loader2 size={18} className="spin" /> : <Wand2 size={18} />}
              {cleanupStatus?.uncleanedCount === 0 ? 'No Jobs Need Cleanup' : 'Start Bulk Cleanup'}
            </button>
          )}
        </div>
      </div>

      {/* Deletion Suggestions Dashboard */}
      <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--surface-border)', padding: '1.5rem', borderRadius: '8px' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px', color: '#fca5a5' }}>
          <AlertTriangle size={20} /> AI Deletion Suggestions
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
          The AI cleanup agent has flagged these items because they do not appear to be real job postings (e.g. cookie banners, generic website text, or scraping errors). Please review them and vote to either delete them or keep them.
        </p>

        {suggestions.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.1)', borderRadius: '8px' }}>
            <CheckCircle size={32} style={{ margin: '0 auto 1rem auto', color: 'var(--success-color)', opacity: 0.8 }} />
            <p>No deletion suggestions found. Looking good!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {suggestions.map((job) => (
              <div key={`${job.type}-${job.id}`} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '1rem', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h4 style={{ fontWeight: 600, fontSize: '1.1rem', margin: 0, color: 'var(--text-primary)' }}>{job.title}</h4>
                    <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', textTransform: 'capitalize' }}>
                      {job.type}
                    </span>
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                    {job.company} {job.location ? `• ${job.location}` : ''}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '4px', maxHeight: '100px', overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                    {job.description || 'No description available.'}
                  </div>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                  <button 
                    className="btn-secondary" 
                    onClick={() => handleVoteKeep(job.id, job.type)}
                    disabled={isProcessingVote !== null}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
                  >
                    {isProcessingVote === `${job.type}-${job.id}` ? <Loader2 size={14} className="spin" /> : <CheckCircle size={14} />}
                    Vote Keep (False Alarm)
                  </button>
                  <button 
                    className="btn-primary" 
                    onClick={() => handleVoteDelete(job.id, job.type)}
                    disabled={isProcessingVote !== null}
                    style={{ background: 'var(--danger-color)', color: 'white', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
                  >
                    {isProcessingVote === `${job.type}-${job.id}` ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
                    Vote Delete (Send to Bin)
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
