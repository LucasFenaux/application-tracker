'use client';

import { Trash2 } from 'lucide-react';
import { deleteMaterial } from '@/app/actions';

export default function DeleteMaterialButton({ id }: { id: number }) {
  return (
    <button 
      onClick={() => {
        if (confirm('Are you sure you want to delete this material?')) {
          deleteMaterial(id);
        }
      }} 
      className="btn-secondary"
      style={{ padding: '4px 8px', color: '#ef4444', borderColor: '#ef4444' }}
      title="Delete"
    >
      <Trash2 size={16} />
    </button>
  );
}
