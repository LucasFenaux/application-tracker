'use client';

import { useState } from 'react';
import { deleteExtensionJob, moveToMainBoardFromExtension } from '@/app/actions';
import { Puzzle, CheckCircle2, Trash2, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ExtensionClient({ initialJobs }: { initialJobs: any[] }) {
  const router = useRouter();
  
  const [jobs, setJobs] = useState(initialJobs);
  const [expandedJobId, setExpandedJobId] = useState<number | null>(null);

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
              jobs.map((job) => (
                <div key={job.id} className="glass-panel" style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>{job.title}</h3>
                      <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        {job.company} {job.location && `• ${job.location}`}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--accent-color)' }}>
                        <a href={job.url} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                          View Original Posting ↗
                        </a>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
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
                          {job.description}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
