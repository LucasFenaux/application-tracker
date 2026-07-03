'use client';

import { RefreshCw, Trash, Trash2 } from 'lucide-react';
import { restoreJob, permanentlyDeleteJob, restoreScrapedJob, hardDeleteScrapedJob, restoreExtensionJob, hardDeleteExtensionJob, emptyMainBin, emptyScraperBin, emptyExtensionBin } from '@/app/actions';

type JobType = 'job' | 'scraped' | 'extension';

export function RestoreJobButton({ id, type = 'job' }: { id: number, type?: JobType }) {
  return (
    <button 
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (type === 'job') await restoreJob(id);
        else if (type === 'scraped') await restoreScrapedJob(id);
        else if (type === 'extension') await restoreExtensionJob(id);
        window.location.reload();
      }} 
      className="btn-secondary"
      style={{ padding: '4px 8px', color: 'var(--text-primary)' }}
      title="Restore Application"
    >
      <RefreshCw size={16} /> Restore
    </button>
  );
}

export function PermanentlyDeleteJobButton({ id, type = 'job' }: { id: number, type?: JobType }) {
  return (
    <button 
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (confirm('Are you sure you want to permanently delete this? This action cannot be undone.')) {
          if (type === 'job') await permanentlyDeleteJob(id);
          else if (type === 'scraped') await hardDeleteScrapedJob(id);
          else if (type === 'extension') await hardDeleteExtensionJob(id);
          window.location.reload();
        }
      }} 
      className="btn-secondary"
      style={{ padding: '4px 8px', color: '#ef4444', borderColor: '#ef4444' }}
      title="Permanently Delete Application"
    >
      <Trash size={16} /> Permanently Delete
    </button>
  );
}

export function EmptyBinButton({ type, label = 'Empty Bin' }: { type: JobType, label?: string }) {
  return (
    <button 
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (confirm(`Are you sure you want to permanently delete all items in this section? This action cannot be undone.`)) {
          if (type === 'job') await emptyMainBin();
          else if (type === 'scraped') await emptyScraperBin();
          else if (type === 'extension') await emptyExtensionBin();
          window.location.reload();
        }
      }} 
      className="btn-secondary"
      style={{ padding: '4px 12px', color: '#ef4444', borderColor: '#ef4444' }}
      title="Empty this section"
    >
      <Trash2 size={16} /> {label}
    </button>
  );
}
