'use client';

import React, { useState } from 'react';
import { uploadMaterial } from '@/app/actions';
import { Upload, X } from 'lucide-react';

export default function UploadMaterialModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsUploading(true);
    const formData = new FormData(e.currentTarget);
    await uploadMaterial(formData);
    setIsUploading(false);
    setIsOpen(false);
  };

  return (
    <>
      <button className="btn-primary" onClick={() => setIsOpen(true)}>
        <Upload size={18} /> Upload Material
      </button>

      {isOpen && (
        <div className="modal-overlay" onClick={() => setIsOpen(false)}>
          <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Upload Document</h2>
              <button className="close-btn" onClick={() => setIsOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label htmlFor="name">Document Name</label>
                <input type="text" id="name" name="name" required placeholder="e.g. Resume - Core ML 2026" />
              </div>
              
              <div className="form-group">
                <label htmlFor="type">Document Type</label>
                <select id="type" name="type" required>
                  <option value="Resume">Resume</option>
                  <option value="Cover Letter">Cover Letter</option>
                  <option value="Transcript">Transcript</option>
                  <option value="Portfolio">Portfolio / Presentation</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="file">File (PDF, Docx, Tex, Bib)</label>
                <input type="file" id="file" name="file" required accept=".pdf,.doc,.docx,.tex,.bib,.md,.txt" />
              </div>

              <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" id="isProfile" name="isProfile" value="true" style={{ width: 'auto' }} />
                <label htmlFor="isProfile" style={{ fontSize: '0.9rem', color: 'var(--accent-color)', fontWeight: 600 }}>
                  Use this document for AI Job Matching (e.g. .tex resume)
                </label>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={isUploading}>
                  {isUploading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
