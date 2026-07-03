'use client';

import { Trash2 } from 'lucide-react';
import { deleteJob } from '@/app/actions';

export default function DeleteJobButton({ id }: { id: number }) {
  return (
    <button 
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this application?')) {
          deleteJob(id);
        }
      }} 
      className="btn-secondary"
      style={{ padding: '4px 8px', color: '#ef4444', borderColor: '#ef4444' }}
      title="Delete Application"
    >
      <Trash2 size={16} />
    </button>
  );
}
