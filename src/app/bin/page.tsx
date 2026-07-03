import { getDeletedJobs, getDeletedScrapedJobs, getDeletedExtensionJobs } from '@/app/actions';
import { ArrowLeft, Clock } from 'lucide-react';
import Link from 'next/link';
import { RestoreJobButton, PermanentlyDeleteJobButton, EmptyBinButton } from '@/components/BinActionButtons';

export const dynamic = 'force-dynamic';

function renderJobRow(job: any, type: 'job' | 'scraped' | 'extension') {
  const deletedAt = new Date(job.deleted_at);
  const daysLeft = 30 - Math.floor((new Date().getTime() - deletedAt.getTime()) / (1000 * 60 * 60 * 24));
  
  return (
    <div key={job.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', marginBottom: '1rem' }}>
      <div>
        <h4 style={{ fontWeight: 600 }}>{job.title}</h4>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          {job.company} {job.location && `• ${job.location}`}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#ef4444', marginTop: '4px' }}>
          <Clock size={12} />
          {daysLeft} days until permanent deletion
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        {job.stage && (
          <span className="kanban-badge" style={{ backgroundColor: `var(--stage-${job.stage.toLowerCase()})`, opacity: 0.7 }}>
            {job.stage}
          </span>
        )}
        <RestoreJobButton id={job.id} type={type} />
        <PermanentlyDeleteJobButton id={job.id} type={type} />
      </div>
    </div>
  );
}

export default async function BinPage() {
  const deletedJobs = await getDeletedJobs();
  const deletedScrapedJobs = await getDeletedScrapedJobs();
  const deletedExtensionJobs = await getDeletedExtensionJobs();

  return (
    <div className="page-container">
      <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
        <ArrowLeft size={16} /> Back to Dashboard
      </Link>
      
      <div className="page-header">
        <h1 className="page-title">Recycle Bin</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
          Deleted applications are kept here for 30 days before being permanently deleted.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Kanban Board Jobs */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Main Board Jobs</h2>
            {deletedJobs.length > 0 && <EmptyBinButton type="job" label="Clear Main Board" />}
          </div>
          {deletedJobs.length === 0 && <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No deleted jobs from the main board.</p>}
          {deletedJobs.map(job => renderJobRow(job, 'job'))}
        </div>

        {/* Scraper Jobs */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Hidden Scraper Jobs</h2>
            {deletedScrapedJobs.length > 0 && <EmptyBinButton type="scraped" label="Clear Scraper Jobs" />}
          </div>
          {deletedScrapedJobs.length === 0 && <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No hidden jobs from the scraper.</p>}
          {deletedScrapedJobs.map(job => renderJobRow(job, 'scraped'))}
        </div>

        {/* Extension Jobs */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Deleted Extension Jobs</h2>
            {deletedExtensionJobs.length > 0 && <EmptyBinButton type="extension" label="Clear Extension Jobs" />}
          </div>
          {deletedExtensionJobs.length === 0 && <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No deleted jobs from the extension.</p>}
          {deletedExtensionJobs.map(job => renderJobRow(job, 'extension'))}
        </div>

      </div>
    </div>
  );
}
