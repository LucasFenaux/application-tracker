import { getJobsWithMatchScores } from '@/app/actions';
import { Briefcase, CheckCircle, Clock, XCircle, Trash2 } from 'lucide-react';
import Link from 'next/link';
import DeleteJobButton from '@/components/DeleteJobButton';
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const jobs = await getJobsWithMatchScores();
  
  const inQueue = jobs.filter(j => j.stage === 'Queue').length;
  const interviewing = jobs.filter(j => j.stage === 'Interviewing').length;
  const offers = jobs.filter(j => j.stage === 'Offer').length;
  const applied = jobs.filter(j => j.stage === 'Applied').length;
  const rejected = jobs.filter(j => j.stage === 'Rejected').length;

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="page-title">Dashboard</h1>
        <Link href="/bin" className="btn-secondary" style={{ padding: '6px 12px', color: 'var(--text-secondary)' }}>
          <Trash2 size={16} /> Recycle Bin
        </Link>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '12px', background: 'rgba(100, 116, 139, 0.2)', borderRadius: '12px' }}>
            <Clock size={24} color="var(--stage-queue)" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{inQueue}</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>In Queue</p>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '12px', background: 'rgba(59, 130, 246, 0.2)', borderRadius: '12px' }}>
            <Briefcase size={24} color="var(--stage-applied)" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{applied}</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Applied</p>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '12px', background: 'rgba(245, 158, 11, 0.2)', borderRadius: '12px' }}>
            <CheckCircle size={24} color="var(--stage-interviewing)" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{interviewing}</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Interviewing</p>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '12px', background: 'rgba(16, 185, 129, 0.2)', borderRadius: '12px' }}>
            <CheckCircle size={24} color="var(--stage-offer)" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{offers}</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Offers</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Recent Applications</h2>
            <Link href="/board" style={{ color: 'var(--accent-color)', fontSize: '0.9rem' }}>View All</Link>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {jobs.slice(0, 5).map(job => (
              <div key={job.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                <div>
                  <h4 style={{ fontWeight: 600 }}>{job.title}</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{job.company}</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span className="kanban-badge" style={{ backgroundColor: `var(--stage-${job.stage.toLowerCase()})` }}>
                    {job.stage}
                  </span>
                  <DeleteJobButton id={job.id} />
                </div>
              </div>
            ))}
            {jobs.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>No jobs tracked yet.</p>}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>Insights</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Success Rate (Interview / Applied)</p>
              <h3 style={{ fontSize: '1.5rem', color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                {applied > 0 ? Math.round((interviewing + offers + rejected) / applied * 100) : 0}%
              </h3>
            </div>
            
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Applications</p>
              <h3 style={{ fontSize: '1.5rem', color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                {jobs.length}
              </h3>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
