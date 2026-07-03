'use client';

import React, { useState } from 'react';
import { createJob } from '@/app/actions';
import { Plus, X } from 'lucide-react';

export default function NewJobModal() {
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    await createJob(formData);
    setIsOpen(false);
  };

  return (
    <>
      <button className="btn-primary" onClick={() => setIsOpen(true)}>
        <Plus size={18} /> Add Application
      </button>

      {isOpen && (
        <div className="modal-overlay" onClick={() => setIsOpen(false)}>
          <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>New Application</h2>
              <button className="close-btn" onClick={() => setIsOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label htmlFor="company">Company</label>
                <input type="text" id="company" name="company" required placeholder="e.g. Google" />
              </div>
              
              <div className="form-group">
                <label htmlFor="title">Job Title</label>
                <input type="text" id="title" name="title" required placeholder="e.g. Research Scientist" />
              </div>

              <div className="form-group">
                <label htmlFor="url">Posting URL (optional)</label>
                <input type="url" id="url" name="url" placeholder="https://..." />
              </div>

              <div className="form-group">
                <label htmlFor="description">Job Description (optional)</label>
                <textarea id="description" name="description" placeholder="Paste the job description here..." rows={4} style={{ resize: 'vertical' }} />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Add to Queue</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
