'use client';

import { useState, useEffect } from 'react';
import { deleteExtensionJob, moveToMainBoardFromExtension, aiCleanupJob } from '@/app/actions';
import { Puzzle, CheckCircle2, Trash2, ArrowRight, Wand2, Loader2, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ExtensionClient({ initialJobs }: { initialJobs: any[] }) {
  const router = useRouter();
  
  const [jobs, setJobs] = useState(initialJobs);
  const [expandedJobId, setExpandedJobId] = useState<number | null>(null);
  const [cleaningJobs, setCleaningJobs] = useState<Record<number, boolean>>({});
  const [globalCleaningJobs, setGlobalCleaningJobs] = useState<Record<number, boolean>>({});
  const [showingOriginals, setShowingOriginals] = useState<Record<number, boolean>>({});

  const handleMove = async (id: number) => {
    await moveToMainBoardFromExtension(id);
    setJobs(jobs.filter(j => j.id !== id));
    router.refresh();
  };

  const handleDelete = async (id: number) => {
    await deleteExtensionJob(id);
    setJobs(jobs.filter(j => j.id !== id));
    router.refresh();
  };

  useEffect(() => {
    const fetchCleaning = async () => {
      try {
        const { getQueuedCleanups } = await import('@/app/actions');
        const queued = await getQueuedCleanups();
        const newGlobal: Record<number, boolean> = {};
        queued.forEach(key => {
          const [type, id] = key.split('-');
          if (type === 'extension') newGlobal[Number(id)] = true;
        });
        setGlobalCleaningJobs(newGlobal);
      } catch (e) {}
    };

    fetchCleaning();
    const interval = setInterval(fetchCleaning, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleCleanup = async (id: number) => {
    setCleaningJobs(prev => ({ ...prev, [id]: true }));
    try {
      const res = await aiCleanupJob(id, 'extension');
      if (!res.success) {
        alert(res.error || 'Failed to clean up job');
      } else {
        setJobs(prev => prev.map(j => j.id === id ? { ...j, original_job_data: '{}' } : j));
        router.refresh();
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCleaningJobs(prev => ({ ...prev, [id]: false }));
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title"><Puzzle size={28} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }} /> Extension Saves</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginTop: '0.5rem' }}>Jobs you saved manually from the browser extension.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Saved Jobs ({jobs.length})</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {jobs.length === 0 ? (
              <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                No jobs saved via the extension yet.
              </div>
            ) : (
              jobs.map((job) => {
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
                const displayDescription = isOriginal && originalData ? originalData.description : job.description;

                return (
                <div key={job.id} className="glass-panel" style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{displayTitle}</h3>
                        {job.deletion_suggested === 1 && (
                          <span style={{ fontSize: '0.75rem', background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.3)' }} title="AI flagged this as an invalid job post. See AI Cleanup tab to keep or delete.">
                            Deletion Suggested
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        {displayCompany} {displayLocation && `• ${displayLocation}`}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--accent-color)' }}>
                        <a href={job.url} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                          View Original Posting ↗
                        </a>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {job.original_job_data ? (
                        <div style={{ display: 'flex', border: '1px solid rgba(168, 85, 247, 0.2)', borderRadius: '6px', overflow: 'hidden', background: 'rgba(168, 85, 247, 0.05)' }}>
                          <button 
                            onClick={() => setShowingOriginals(prev => ({ ...prev, [job.id]: !prev[job.id] }))}
                            style={{ border: 'none', borderRight: '1px solid rgba(168, 85, 247, 0.2)', background: showingOriginals[job.id] ? 'rgba(168, 85, 247, 0.2)' : 'transparent', color: '#c084fc', padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', margin: 0, borderRadius: 0 }}
                            title="Toggle Clean/Original View"
                          >
                            {showingOriginals[job.id] ? 'Original View' : 'Cleaned View'}
                          </button>
                          <button 
                            onClick={() => handleCleanup(job.id)}
                            disabled={cleaningJobs[job.id] || globalCleaningJobs[job.id]}
                            style={{ border: 'none', background: 'transparent', color: '#c084fc', padding: '8px 16px', cursor: (cleaningJobs[job.id] || globalCleaningJobs[job.id]) ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', margin: 0, borderRadius: 0 }}
                            title="Re-run AI Cleanup"
                          >
                            {(cleaningJobs[job.id] || globalCleaningJobs[job.id]) ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />} Re-run
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => handleCleanup(job.id)}
                          disabled={cleaningJobs[job.id] || globalCleaningJobs[job.id]}
                          style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.2)', padding: '8px 16px', borderRadius: '6px', cursor: (cleaningJobs[job.id] || globalCleaningJobs[job.id]) ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                          title="Clean up with AI"
                        >
                          {(cleaningJobs[job.id] || globalCleaningJobs[job.id]) ? <Loader2 size={16} className="spin" /> : <Wand2 size={16} />} Clean
                        </button>
                      )}
                      <button 
                        onClick={() => handleMove(job.id)}
                        style={{ background: 'var(--accent-color)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}
                      >
                        <CheckCircle2 size={16} /> Track It
                      </button>
                      <button 
                        onClick={() => handleDelete(job.id)}
                        style={{ background: 'rgba(255, 60, 60, 0.1)', color: '#ff4d4d', border: '1px solid rgba(255, 60, 60, 0.2)', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Trash2 size={16} /> Delete
                      </button>
                    </div>
                  </div>

                  {job.description && (
                    <div style={{ marginTop: '1rem' }}>
                      <button 
                        onClick={() => setExpandedJobId(expandedJobId === job.id ? null : job.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.9rem', padding: 0 }}
                      >
                        <ArrowRight size={14} style={{ transform: expandedJobId === job.id ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} /> 
                        {expandedJobId === job.id ? 'Hide Description' : 'View Description'}
                      </button>
                      
                      {expandedJobId === job.id && (
                        <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', fontSize: '0.9rem', color: 'var(--text-secondary)', maxHeight: '300px', overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                          {displayDescription}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
