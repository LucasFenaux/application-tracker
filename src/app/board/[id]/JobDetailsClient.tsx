'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { updateJobNotes, attachMaterialToJob, generateResumeSuggestions, removeMaterialFromJob, updateJobDetails, updateJobDeadline } from '@/app/actions';
import { Save, Paperclip, ExternalLink, ArrowLeft, DownloadCloud, Wand2, AlertTriangle, Edit2, X, Trash2, CalendarIcon, Clock } from 'lucide-react';
import Link from 'next/link';

export default function JobDetailsClient({ job, jobMaterials, allMaterials, aiOllamaModel }: { job: any, jobMaterials: any[], allMaterials: any[], aiOllamaModel: string }) {
  const [notes, setNotes] = useState(job.notes || '');
  const [isSaving, setIsSaving] = useState(false);

  // Inline Editing State
  const [isEditingJob, setIsEditingJob] = useState(false);
  const [editTitle, setEditTitle] = useState(job.title || '');
  const [editCompany, setEditCompany] = useState(job.company || '');
  const [editLocation, setEditLocation] = useState(job.location || '');
  const [editDescription, setEditDescription] = useState(job.description || '');
  const [isSavingJob, setIsSavingJob] = useState(false);

  // Deadline State
  const [deadline, setDeadline] = useState(job.deadline || '');
  const [isSavingDeadline, setIsSavingDeadline] = useState(false);

  // AI Tailor State
  const [tailorMaterialId, setTailorMaterialId] = useState<number | ''>(jobMaterials.length > 0 ? jobMaterials[0].id : '');
  const [tailorContextMaterialIds, setTailorContextMaterialIds] = useState<number[]>([]);
  const [suggestions, setSuggestions] = useState('');
  const [thinking, setThinking] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showOllamaFallback, setShowOllamaFallback] = useState(false);
  const [showOllamaMissingModel, setShowOllamaMissingModel] = useState(false);

  const handleGenerateSuggestions = async () => {
    if (!tailorMaterialId) return;
    
    setIsGenerating(true);
    setSuggestions('');
    setThinking('');
    setShowOllamaFallback(false);
    setShowOllamaMissingModel(false);

    try {
      const res = await generateResumeSuggestions(job.id, Number(tailorMaterialId), tailorContextMaterialIds);
      if (!res.success) {
        if (res.error === 'OLLAMA_NOT_RUNNING') {
          setShowOllamaFallback(true);
        } else if (res.error === 'OLLAMA_MODEL_NOT_FOUND') {
          setShowOllamaMissingModel(true);
        }
      } else {
        setSuggestions(res.suggestions || '');
        if (res.thinking) {
          setThinking(res.thinking);
        }
      }
    } catch (err: any) {
      alert(err.message || 'Failed to generate suggestions.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveNotes = async () => {
    setIsSaving(true);
    await updateJobNotes(job.id, notes);
    setIsSaving(false);
  };

  const handleAttach = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const materialId = parseInt(e.target.value);
    if (!isNaN(materialId)) {
      await attachMaterialToJob(job.id, materialId);
      e.target.value = ''; // reset
    }
  };

  const handleRemoveMaterial = async (materialId: number) => {
    if (confirm('Are you sure you want to detach this material from the job?')) {
      await removeMaterialFromJob(job.id, materialId);
      if (tailorMaterialId === materialId) setTailorMaterialId('');
      setTailorContextMaterialIds(prev => prev.filter(id => id !== materialId));
    }
  };

  const handleSaveJobDetails = async () => {
    setIsSavingJob(true);
    await updateJobDetails(job.id, editTitle, editCompany, editLocation, editDescription);
    setIsSavingJob(false);
    setIsEditingJob(false);
  };

  const toggleContextMaterial = (id: number) => {
    setTailorContextMaterialIds(prev => 
      prev.includes(id) ? prev.filter(ctxId => ctxId !== id) : [...prev, id]
    );
  };

  const handleSaveDeadline = async (value: string) => {
    setDeadline(value);
    setIsSavingDeadline(true);
    await updateJobDeadline(job.id, value || null);
    setIsSavingDeadline(false);
  };

  const getDeadlineInfo = () => {
    if (!deadline) return null;
    const now = new Date();
    const dl = new Date(deadline + 'T23:59:59');
    const diffMs = dl.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { label: `${Math.abs(diffDays)}d overdue`, color: '#ef4444' };
    if (diffDays === 0) return { label: 'Due today', color: '#f59e0b' };
    if (diffDays <= 3) return { label: `${diffDays}d left`, color: '#f59e0b' };
    if (diffDays <= 7) return { label: `${diffDays}d left`, color: '#60a5fa' };
    return { label: `${diffDays}d left`, color: 'var(--text-secondary)' };
  };

  const deadlineInfo = getDeadlineInfo();

  return (
    <div className="page-container">
      <Link href="/board" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
        <ArrowLeft size={16} /> Back to Board
      </Link>
      
      <div className="page-header" style={{ position: 'relative' }}>
        {isEditingJob ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <input 
              className="glass-panel" 
              style={{ fontSize: '1.8rem', fontWeight: 700, padding: '0.5rem', width: '100%' }} 
              value={editTitle} 
              onChange={e => setEditTitle(e.target.value)} 
              placeholder="Job Title"
            />
            <input 
              className="glass-panel" 
              style={{ fontSize: '1.2rem', padding: '0.5rem', width: '100%' }} 
              value={editCompany} 
              onChange={e => setEditCompany(e.target.value)} 
              placeholder="Company Name"
            />
            <input 
              className="glass-panel" 
              style={{ fontSize: '1rem', padding: '0.5rem', width: '100%' }} 
              value={editLocation} 
              onChange={e => setEditLocation(e.target.value)} 
              placeholder="Location (e.g. San Francisco, Remote)"
            />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button className="btn-primary" onClick={handleSaveJobDetails} disabled={isSavingJob}>
                <Save size={16} /> {isSavingJob ? 'Saving...' : 'Save Details'}
              </button>
              <button className="btn-secondary" onClick={() => setIsEditingJob(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <h1 className="page-title">{job.title}</h1>
                <button className="btn-secondary" style={{ padding: '6px' }} onClick={() => setIsEditingJob(true)} title="Edit Job">
                  <Edit2 size={14} />
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{job.company}</p>
                <p style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>{job.location || 'Remote/Unknown'}</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <span className="kanban-badge" style={{ backgroundColor: `var(--stage-${job.stage.toLowerCase()})`, fontSize: '1rem', padding: '4px 12px' }}>
                {job.stage}
              </span>
              {job.url && (
                <a href={job.url} target="_blank" rel="noopener noreferrer" className="btn-secondary">
                  <ExternalLink size={18} /> Posting
                </a>
              )}
            </div>
          </>
        )}
      </div>

      {deadlineInfo && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.5rem 1rem', background: `${deadlineInfo.color}15`, border: `1px solid ${deadlineInfo.color}40`, borderRadius: '8px', marginBottom: '1rem' }}>
          <Clock size={16} style={{ color: deadlineInfo.color }} />
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: deadlineInfo.color }}>
            Deadline: {new Date(deadline + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} — {deadlineInfo.label}
          </span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {(job.description || isEditingJob) && (
            <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>Job Description</h2>
              {isEditingJob ? (
                <textarea 
                  value={editDescription} 
                  onChange={e => setEditDescription(e.target.value)} 
                  style={{ width: '100%', minHeight: '300px', resize: 'vertical' }}
                  placeholder="Paste job description here..."
                />
              ) : (
                <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', fontSize: '0.95rem', maxHeight: '300px', overflowY: 'auto', paddingRight: '10px' }}>
                  {job.description}
                </div>
              )}
            </div>
          )}

          <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Notes & Interview Prep</h2>
              <button className="btn-primary" onClick={handleSaveNotes} disabled={isSaving}>
                <Save size={16} /> {isSaving ? 'Saving...' : 'Save Notes'}
              </button>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Write your research, questions to ask, or interview notes here..."
              style={{ flex: 1, minHeight: job.description ? '300px' : '400px', resize: 'vertical' }}
            />
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Attached Materials</h2>
              {jobMaterials.length > 0 && (
                <a href={`/api/jobs/${job.id}/download-materials`} download className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.85rem' }}>
                  <DownloadCloud size={14} /> Download All (Zip)
                </a>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {jobMaterials.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Paperclip size={16} color="var(--accent-color)" />
                    <a href={`/uploads/${m.filename}`} download style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{m.name}</a>
                  </div>
                  <button onClick={() => handleRemoveMaterial(m.id)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {jobMaterials.length === 0 && <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No materials attached.</p>}
            </div>
          </div>

          <div style={{ paddingTop: '1.5rem', borderTop: '1px solid var(--surface-border)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Attach Existing Document</h3>
            <select onChange={handleAttach} defaultValue="" style={{ width: '100%' }}>
              <option value="" disabled>Select a document...</option>
              {allMaterials.filter(m => !jobMaterials.some(jm => jm.id === m.id)).map(m => (
                <option key={m.id} value={m.id}>{m.name} ({m.type})</option>
              ))}
            </select>
          </div>

          <div style={{ paddingTop: '1.5rem', borderTop: '1px solid var(--surface-border)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CalendarIcon size={16} /> Application Deadline
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <input 
                type="date" 
                value={deadline} 
                onChange={(e) => handleSaveDeadline(e.target.value)}
                style={{ padding: '8px', width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--surface-border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.9rem' }}
              />
              {deadline && (
                <button 
                  onClick={() => handleSaveDeadline('')}
                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.8rem', cursor: 'pointer', textAlign: 'left', padding: '4px 0' }}
                >
                  Clear deadline
                </button>
              )}
              {isSavingDeadline && <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Saving...</span>}
            </div>
          </div>

          <div style={{ paddingTop: '1.5rem', borderTop: '1px solid var(--surface-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
              <Wand2 size={18} color="var(--accent-color)" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Resume Tailor (AI)</h3>
            </div>
            
            {jobMaterials.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Attach a resume above to generate tailored suggestions.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', color: 'var(--text-secondary)' }}>Select Attached Resume</label>
                  <select 
                    value={tailorMaterialId} 
                    onChange={(e) => {
                      setTailorMaterialId(Number(e.target.value));
                      // Ensure it's not also in context files
                      setTailorContextMaterialIds(prev => prev.filter(id => id !== Number(e.target.value)));
                    }} 
                    style={{ width: '100%', padding: '8px' }}
                  >
                    <option value="" disabled>Select material...</option>
                    {jobMaterials.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>

                {jobMaterials.length > 1 && tailorMaterialId && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '8px', color: 'var(--text-secondary)' }}>Additional Context (Optional)</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: 'rgba(0,0,0,0.1)', padding: '0.75rem', borderRadius: '8px' }}>
                      {jobMaterials.filter(m => m.id !== tailorMaterialId).map(m => (
                        <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                          <input 
                            type="checkbox" 
                            checked={tailorContextMaterialIds.includes(m.id)} 
                            onChange={() => toggleContextMaterial(m.id)}
                          />
                          {m.name}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <button 
                  className="btn-primary" 
                  onClick={() => handleGenerateSuggestions()} 
                  disabled={!tailorMaterialId || isGenerating}
                  style={{ justifyContent: 'center', marginTop: '0.5rem' }}
                >
                  <Wand2 size={16} /> {isGenerating ? 'Analyzing...' : 'Generate Suggestions'}
                </button>

                {showOllamaFallback && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '1rem', borderRadius: '8px', marginTop: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '8px', color: '#f87171', marginBottom: '0.75rem', fontWeight: 600 }}>
                      <AlertTriangle size={18} /> Ollama Not Found
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '1rem', lineHeight: 1.4 }}>
                      Could not connect to Ollama on port 11434. Make sure the Ollama app is running.
                    </p>
                  </div>
                )}

                {showOllamaMissingModel && (
                  <div style={{ background: 'rgba(234, 179, 8, 0.15)', border: '1px solid rgba(234, 179, 8, 0.3)', padding: '1rem', borderRadius: '8px', marginTop: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '8px', color: '#eab308', marginBottom: '0.75rem', fontWeight: 600 }}>
                      <AlertTriangle size={18} /> Model Not Downloaded
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '1rem', lineHeight: 1.4 }}>
                      Ollama is running, but the <b>{aiOllamaModel}</b> model is not installed on your machine.
                      Please open your terminal and run <code>ollama run {aiOllamaModel}</code> to download it.
                    </p>
                  </div>
                )}

                {(suggestions || thinking) && (
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--surface-border)', marginTop: '0.5rem' }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--accent-color)', marginBottom: '0.5rem' }}>Suggestions</h4>
                    {thinking && (
                      <details style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
                        <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)', marginBottom: '0.5rem', userSelect: 'none' }}>
                          Show AI Reasoning Process
                        </summary>
                        <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.4, fontStyle: 'italic', borderLeft: '2px solid rgba(255,255,255,0.1)' }}>
                          {thinking}
                        </div>
                      </details>
                    )}
                    {suggestions && (
                      <div className="markdown-content" style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{suggestions}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
