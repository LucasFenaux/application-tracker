'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createPrompt, updatePrompt, deletePrompt, setActivePrompt, updateSetting, startSmartCalibration, getCalibrationStatus } from '@/app/actions';
import { Settings, Save, Plus, Trash2, CheckCircle2, Sliders, FileText, Wand2, Loader2, BarChart2, Globe, RefreshCw } from 'lucide-react';

export default function SettingsClient({ prompts, settings, materials }: { prompts: any[], settings: any, materials: any[] }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'prompts' | 'calibration' | 'scraper' | 'system'>('prompts');
  
  useEffect(() => {
    const saved = localStorage.getItem('settingsTab');
    if (saved && ['prompts', 'calibration', 'scraper', 'system'].includes(saved)) {
      setActiveTab(saved as any);
    }
  }, []);

  const handleTabChange = (tab: 'prompts' | 'calibration' | 'scraper' | 'system') => {
    setActiveTab(tab);
    localStorage.setItem('settingsTab', tab);
  };
  
  const [scraperSites, setScraperSites] = useState<{name: string, url: string}[]>(() => {
    try {
      if (settings.scraper_default_sites) {
        return JSON.parse(settings.scraper_default_sites);
      }
    } catch {}
    return [
      { name: 'YCombinator', url: 'https://news.ycombinator.com/jobs' },
      { name: 'BuiltIn', url: 'https://builtin.com/jobs' },
      { name: 'RemoteOK', url: 'https://remoteok.com/' },
      { name: 'Simplify', url: 'https://simplify.jobs/jobs' },
    ];
  });
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteUrl, setNewSiteUrl] = useState('');
  const [scraperHeadless, setScraperHeadless] = useState(settings.scraper_headless !== 'false');

  const [savedFocusesState, setSavedFocusesState] = useState<string[]>(() => {
    try {
      if (settings.saved_focuses) {
        return JSON.parse(settings.saved_focuses);
      }
    } catch {}
    return [];
  });

  // Prompts State
  const [activePromptId, setActivePromptId] = useState<number | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<{ id?: number, name: string, content: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Calibration State
  const [calibrationMode, setCalibrationMode] = useState<'strict' | 'smart'>(settings.calibration_mode || 'strict');
  const [calibMaterialIds, setCalibMaterialIds] = useState<number[]>([]);
  
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibProgress, setCalibProgress] = useState(0);
  const [calibStatus, setCalibStatus] = useState('');
  const [showGeneratedJobs, setShowGeneratedJobs] = useState(false);
  const [generatedJobs, setGeneratedJobs] = useState<{ [category: string]: string[] }>(() => {
    try { return JSON.parse(settings.calibration_jobs || '{}'); } catch { return {}; }
  });
  const [calibrationProfile, setCalibrationProfile] = useState<string>(settings.calibration_profile || '');
  const [curve, setCurve] = useState<{similarity: number, expectedScore: number}[]>(() => {
    try { return JSON.parse(settings.calibration_curve || '[]'); } catch { return []; }
  });

  // Profile Modal State
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [generatedProfile, setGeneratedProfile] = useState('');
  const [isGeneratingProfile, setIsGeneratingProfile] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState('');

  // Target Job Goal State
  const [targetJobGoal, setTargetJobGoal] = useState(settings.target_job_goal || '');
  const [isSavingGoal, setIsSavingGoal] = useState(false);

  // System State
  const [isManuallyBackingUp, setIsManuallyBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // AI Models State
  const [aiOllamaModel, setAiOllamaModel] = useState(settings.ai_ollama_model || 'deepseek-r1');
  const [scraperAiModel, setScraperAiModel] = useState(settings.scraper_ai_model || 'deepseek-r1');
  const [availableOllamaModels, setAvailableOllamaModels] = useState<string[]>([]);
  const [isSavingAiModels, setIsSavingAiModels] = useState(false);

  // Bulk Cleanup State
  const [cleanupStatus, setCleanupStatus] = useState<any>(null);
  const [queuedJobsCount, setQueuedJobsCount] = useState<number | null>(null);
  const [isStartingCleanup, setIsStartingCleanup] = useState(false);
  const [cleanupPause, setCleanupPause] = useState(settings.cleanup_pause_seconds || '0');

  useEffect(() => {
    import('@/app/actions').then(({ getAvailableOllamaModels }) => {
      getAvailableOllamaModels().then(models => {
        setAvailableOllamaModels(models.length > 0 ? models : ['deepseek-r1']);
      });
    });
  }, []);

  const minSim = parseFloat(settings.calibration_min || '0.55');
  const maxSim = parseFloat(settings.calibration_max || '0.85');
  const simpleCurve = [
    { similarity: minSim + 0.05 * (maxSim - minSim), expectedScore: 5 },
    { similarity: minSim + 0.25 * (maxSim - minSim), expectedScore: 25 },
    { similarity: minSim + 0.65 * (maxSim - minSim), expectedScore: 65 },
    { similarity: minSim + 0.95 * (maxSim - minSim), expectedScore: 95 }
  ];

  useEffect(() => {
    const active = prompts.find(p => p.is_active === 1);
    if (active) {
      setActivePromptId(active.id);
      setEditingPrompt({ id: active.id, name: active.name, content: active.content });
    } else if (prompts.length > 0) {
      setActivePromptId(prompts[0].id);
      setEditingPrompt({ id: prompts[0].id, name: prompts[0].name, content: prompts[0].content });
    }
  }, [prompts]);

  useEffect(() => {
    if (settings.is_calibrating === 'true') {
      setIsCalibrating(true);
      setCalibProgress(parseInt(settings.calibration_progress || '0'));
      setCalibStatus(settings.calibration_status || 'Resuming connection...');
    }
    
    try { setGeneratedJobs(JSON.parse(settings.calibration_jobs || '{}')); } catch {}
    setCalibrationProfile(settings.calibration_profile || '');
    try { setCurve(JSON.parse(settings.calibration_curve || '[]')); } catch {}
  }, [settings.is_calibrating, settings.calibration_progress, settings.calibration_status, settings.calibration_jobs, settings.calibration_profile, settings.calibration_curve]);

  useEffect(() => {
    if (!isCalibrating) return;

    const interval = setInterval(async () => {
      try {
        const status = await getCalibrationStatus();
        setCalibProgress(status.progress);
        setCalibStatus(status.status);

        if (!status.isCalibrating) {
          setIsCalibrating(false);
          if (!status.status.includes('Error')) {
            router.refresh();
          }
        }
      } catch (err) {
        console.error('Failed to fetch status', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isCalibrating]);

  // Bulk Cleanup polling
  useEffect(() => {
    if (activeTab !== 'system') return;
    
    const fetchCleanupStatus = async () => {
      try {
        const { getCleanupStatus, getQueuedCleanups } = await import('@/app/actions');
        const status = await getCleanupStatus();
        setCleanupStatus(status);
        const queued = await getQueuedCleanups();
        setQueuedJobsCount(queued.length);
      } catch (err) {
        console.error('Failed to fetch cleanup status', err);
      }
    };

    fetchCleanupStatus();
    const interval = setInterval(fetchCleanupStatus, 3000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const handleModeChange = async (mode: 'strict' | 'smart') => {
    if (mode === 'smart' && curve.length === 0) {
      alert("You must run the Smart Calibration at least once before enabling it.");
      return;
    }
    setCalibrationMode(mode);
    await updateSetting('calibration_mode', mode);
  };

  const toggleCalibMaterial = (id: number) => {
    setCalibMaterialIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleRunCalibration = async () => {
    if (calibMaterialIds.length === 0) {
      alert("Please select at least one material (like your main resume) to calibrate against.");
      return;
    }

    setShowProfileModal(true);
    setIsGeneratingProfile(true);
    setProfileFeedback('');
    setGeneratedProfile('');
    
    try {
      const { generateCalibrationProfile } = await import('@/app/actions');
      const profile = await generateCalibrationProfile(calibMaterialIds);
      setGeneratedProfile(profile);
    } catch (err: any) {
      alert(`Error generating profile: ${err.message}`);
      setShowProfileModal(false);
    } finally {
      setIsGeneratingProfile(false);
    }
  };

  const handleRegenerateProfile = async () => {
    setIsGeneratingProfile(true);
    try {
      const { generateCalibrationProfile } = await import('@/app/actions');
      const profile = await generateCalibrationProfile(calibMaterialIds, generatedProfile, profileFeedback);
      setGeneratedProfile(profile);
      setProfileFeedback('');
    } catch (err: any) {
      alert(`Error generating profile: ${err.message}`);
    } finally {
      setIsGeneratingProfile(false);
    }
  };

  const handleApproveProfile = async () => {
    setShowProfileModal(false);
    setIsCalibrating(true);
    setCalibProgress(0);
    setCalibStatus('Starting background process...');

    try {
      const { startSmartCalibration } = await import('@/app/actions');
      await startSmartCalibration(calibMaterialIds, generatedProfile);
    } catch (err: any) {
      setCalibStatus(`Error: ${err.message}`);
      setIsCalibrating(false);
    }
  };

  const handleSaveTargetJobGoal = async () => {
    setIsSavingGoal(true);
    try {
      const { saveTargetJobGoal } = await import('@/app/actions');
      await saveTargetJobGoal(targetJobGoal);
    } catch (err: any) {
      alert(`Error saving target job goal: ${err.message}`);
    } finally {
      setIsSavingGoal(false);
    }
  };

  const handleManualBackup = async () => {
    setIsManuallyBackingUp(true);
    try {
      const { manualDbBackup } = await import('@/app/actions');
      const result = await manualDbBackup();
      alert(`Manual backup successful! Saved to: ${result.path}`);
    } catch (err: any) {
      alert(`Manual backup failed: ${err.message}`);
    } finally {
      setIsManuallyBackingUp(false);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      const { pickBackupFile, executeRestore } = await import('@/app/actions');
      const result = await pickBackupFile();
      if (result.canceled) return;
      if (!result.path) return;

      if (!confirm(`Are you sure you want to load the database from:\n${result.path}\n\nYour current database will be backed up as tracker_pre_restore_backup.db, and then overwritten.`)) {
        return;
      }

      const restoreResult = await executeRestore(result.path);
      alert(`Database successfully restored! A fallback backup was saved to:\n${restoreResult.preRestorePath}\n\nThe page will now reload.`);
      window.location.reload();
    } catch (err: any) {
      alert(`Restore failed: ${err.message}`);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleSaveAiModels = async () => {
    setIsSavingAiModels(true);
    await updateSetting('ai_ollama_model', aiOllamaModel);
    await updateSetting('scraper_ai_model', scraperAiModel);
    await updateSetting('cleanup_pause_seconds', cleanupPause.toString());
    setIsSavingAiModels(false);
  };

  const handleStartCleanup = async () => {
    setIsStartingCleanup(true);
    try {
      const { startBulkCleanup } = await import('@/app/actions');
      const res = await startBulkCleanup();
      if (!res.success) {
        alert(`Error: ${res.error}`);
      }
    } catch (e: any) {
      alert(`Error starting cleanup: ${e.message}`);
    } finally {
      setIsStartingCleanup(false);
    }
  };

  const handleSaveScraperSites = async (newSites: {name: string, url: string}[]) => {
    setScraperSites(newSites);
    await updateSetting('scraper_default_sites', JSON.stringify(newSites));
  };

  const handleAddSite = async () => {
    if (!newSiteName || !newSiteUrl) return;
    const newSites = [...scraperSites, { name: newSiteName, url: newSiteUrl }];
    await handleSaveScraperSites(newSites);
    setNewSiteName('');
    setNewSiteUrl('');
  };

  const handleRemoveSite = async (index: number) => {
    const newSites = [...scraperSites];
    newSites.splice(index, 1);
    await handleSaveScraperSites(newSites);
  };

  const handleRemoveFocus = async (index: number) => {
    const newFocuses = [...savedFocusesState];
    newFocuses.splice(index, 1);
    setSavedFocusesState(newFocuses);
    await updateSetting('saved_focuses', JSON.stringify(newFocuses));
  };

  const handleSelectPrompt = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = Number(e.target.value);
    const p = prompts.find(x => x.id === id);
    if (p) setEditingPrompt({ id: p.id, name: p.name, content: p.content });
  };
  const handleSavePrompt = async () => {
    if (!editingPrompt) return;
    setIsSaving(true);
    if (editingPrompt.id) await updatePrompt(editingPrompt.id, editingPrompt.name, editingPrompt.content);
    else await createPrompt(editingPrompt.name, editingPrompt.content);
    setIsSaving(false);
  };
  const handleSetDefault = async () => {
    if (!editingPrompt || !editingPrompt.id) return;
    await setActivePrompt(editingPrompt.id);
    setActivePromptId(editingPrompt.id);
  };
  const handleDelete = async () => {
    if (!editingPrompt || !editingPrompt.id) return;
    if (confirm(`Delete "${editingPrompt.name}"?`)) await deletePrompt(editingPrompt.id);
  };

  if (!editingPrompt) return null;
  const isSystemDefault = editingPrompt.id ? prompts.find(p => p.id === editingPrompt.id)?.is_system_default === 1 : false;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title"><Settings size={28} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }} /> Settings</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginTop: '0.5rem' }}>Manage your application preferences and AI tools.</p>
      </div>

      <div className="tabs" style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--surface-border)', marginBottom: '2rem' }}>
        <button className={`tab-button ${activeTab === 'prompts' ? 'active' : ''}`} onClick={() => handleTabChange('prompts')} style={{ padding: '0.75rem 1rem', borderBottom: activeTab === 'prompts' ? '2px solid var(--accent-color)' : 'none', color: activeTab === 'prompts' ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: 'pointer', background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>
          Resume Analysis Prompts
        </button>
        <button className={`tab-button ${activeTab === 'calibration' ? 'active' : ''}`} onClick={() => handleTabChange('calibration')} style={{ padding: '0.75rem 1rem', borderBottom: activeTab === 'calibration' ? '2px solid var(--accent-color)' : 'none', color: activeTab === 'calibration' ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: 'pointer', background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>
          AI Match Calibration
        </button>
        <button className={`tab-button ${activeTab === 'scraper' ? 'active' : ''}`} onClick={() => handleTabChange('scraper')} style={{ padding: '0.75rem 1rem', borderBottom: activeTab === 'scraper' ? '2px solid var(--accent-color)' : 'none', color: activeTab === 'scraper' ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: 'pointer', background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>
          Automated Scraper
        </button>
        <button className={`tab-button ${activeTab === 'system' ? 'active' : ''}`} onClick={() => handleTabChange('system')} style={{ padding: '0.75rem 1rem', borderBottom: activeTab === 'system' ? '2px solid var(--accent-color)' : 'none', color: activeTab === 'system' ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: 'pointer', background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>
          System
        </button>
      </div>

      {activeTab === 'prompts' && (
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 600 }}>AI Resume Tailor Prompts</h2>
            <button className="btn-secondary" onClick={() => setEditingPrompt({ name: 'New Custom Prompt', content: '' })}>
              <Plus size={16} /> New Profile
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <select value={editingPrompt.id || ''} onChange={handleSelectPrompt} style={{ width: '100%', padding: '10px', fontSize: '1rem' }}>
                {editingPrompt.id === undefined && <option value="" disabled>-- Unsaved Profile --</option>}
                {prompts.map(p => (
                  <option key={p.id} value={p.id}>{p.name} {p.is_active === 1 ? '(Active)' : ''} {p.is_system_default === 1 ? '[Default]' : ''}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '8px', color: 'var(--text-secondary)' }}>Profile Name</label>
                <input value={editingPrompt.name} onChange={(e) => setEditingPrompt({ ...editingPrompt, name: e.target.value })} style={{ width: '100%', padding: '10px', fontSize: '1rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--surface-border)', borderRadius: '6px', color: 'var(--text-primary)' }} disabled={isSystemDefault} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '8px', color: 'var(--text-secondary)' }}>System Prompt</label>
                <textarea value={editingPrompt.content} onChange={(e) => setEditingPrompt({ ...editingPrompt, content: e.target.value })} style={{ width: '100%', minHeight: '350px', padding: '10px', fontSize: '0.95rem', fontFamily: 'monospace', lineHeight: 1.5, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--surface-border)', borderRadius: '6px', color: 'var(--text-primary)', resize: 'vertical' }} disabled={isSystemDefault} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', paddingTop: '1.5rem', borderTop: '1px solid var(--surface-border)' }}>
              <div style={{ display: 'flex', gap: '1rem' }}>
                {!isSystemDefault && <button className="btn-primary" onClick={handleSavePrompt} disabled={isSaving}><Save size={16} /> {isSaving ? 'Saving...' : 'Save Changes'}</button>}
                {editingPrompt.id && activePromptId !== editingPrompt.id && <button className="btn-secondary" onClick={handleSetDefault} style={{ color: 'var(--accent-color)' }}><CheckCircle2 size={16} /> Set Active</button>}
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                {!isSystemDefault && editingPrompt.id && <button className="btn-secondary" onClick={handleDelete} style={{ color: '#ef4444' }}><Trash2 size={16} /> Delete</button>}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'calibration' && (
        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 600, marginBottom: '0.5rem' }}>Smart Match Calibration</h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              By default, we use a simple linear scaling for the Kanban Board matching score. By running a Smart Calibration, 
              the AI will generate fake job descriptions tailored specifically around your resume to learn exactly how your profile vector scores against Good vs Bad jobs.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <label style={{ fontSize: '1.1rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="radio" checked={calibrationMode === 'strict'} onChange={() => handleModeChange('strict')} style={{ transform: 'scale(1.2)' }} />
              Strict Calibration (Default)
            </label>
            <label style={{ fontSize: '1.1rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="radio" checked={calibrationMode === 'smart'} onChange={() => handleModeChange('smart')} style={{ transform: 'scale(1.2)' }} />
              Smart LLM Calibration
            </label>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.1)', border: '1px solid var(--surface-border)', padding: '1.5rem', borderRadius: '8px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Target Job Goal</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Define the specific type of role you are looking for (e.g., "ML / ML-security research internship positions"). 
              This will generate a secondary "Goal Match %" on the Kanban Board.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <textarea 
                value={targetJobGoal}
                onChange={(e) => setTargetJobGoal(e.target.value)}
                placeholder="e.g. AI Engineer, Next.js Full Stack Developer, Junior React Dev"
                style={{ width: '100%', padding: '10px', fontSize: '0.95rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--surface-border)', borderRadius: '6px', color: 'var(--text-primary)', resize: 'vertical', minHeight: '60px' }}
              />
              <button className="btn-primary" onClick={handleSaveTargetJobGoal} disabled={isSavingGoal} style={{ alignSelf: 'flex-start' }}>
                <Save size={16} /> {isSavingGoal ? 'Saving...' : 'Save Goal'}
              </button>
            </div>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.1)', border: '1px solid var(--surface-border)', padding: '1.5rem', borderRadius: '8px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>Run New Calibration</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>1. Select Base Materials</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {materials.map(m => (
                    <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={calibMaterialIds.includes(m.id)} onChange={() => toggleCalibMaterial(m.id)} />
                      {m.name} ({m.type})
                    </label>
                  ))}
                  {materials.length === 0 && <span style={{ color: 'var(--text-secondary)' }}>No materials uploaded yet.</span>}
                </div>
              </div>

              <div style={{ marginTop: '1rem' }}>
                <button className="btn-primary" onClick={handleRunCalibration} disabled={isCalibrating || calibMaterialIds.length === 0}>
                  {isCalibrating ? <Loader2 size={18} className="spin" /> : <Wand2 size={18} />}
                  {isCalibrating ? 'Calibrating...' : 'Start Smart Calibration'}
                </button>
              </div>

              {isCalibrating && (
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                    <span>{calibStatus}</span>
                    <span>{calibProgress}%</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: 'var(--accent-color)', width: `${calibProgress}%`, transition: 'width 0.3s ease' }} />
                  </div>
                </div>
              )}
              
              {!isCalibrating && calibStatus && (
                <div style={{ marginTop: '1rem', color: calibStatus.includes('Error') ? '#ef4444' : 'var(--accent-color)', fontSize: '0.9rem' }}>
                  {calibStatus}
                </div>
              )}
            </div>
          </div>

              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px', color: calibrationMode === 'strict' ? 'var(--accent-color)' : 'var(--text-primary)' }}>
                  <BarChart2 size={18} /> Strict Default Calibration Curve
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                  {simpleCurve.map((point, i) => (
                    <div key={i} style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', textAlign: 'center', opacity: calibrationMode === 'strict' ? 1 : 0.5 }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        {i === 0 ? 'Bad (5%)' : i === 1 ? 'Poor (25%)' : i === 2 ? 'Okay (65%)' : 'Great (95%)'}
                      </div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {(point.similarity).toFixed(3)}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        (Raw AI Similarity)
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {curve.length > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', color: calibrationMode === 'smart' ? 'var(--accent-color)' : 'var(--text-primary)' }}>
                      <BarChart2 size={18} /> Current Smart Calibration Curve
                    </h3>
                    {Object.keys(generatedJobs).length > 0 && (
                      <button className="btn-secondary" onClick={() => setShowGeneratedJobs(!showGeneratedJobs)}>
                        {showGeneratedJobs ? 'Hide' : 'View'} Generated Jobs
                      </button>
                    )}
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                    {curve.map((point, i) => (
                      <div key={i} style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', textAlign: 'center', opacity: calibrationMode === 'smart' ? 1 : 0.5 }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                          {i === 0 ? 'Bad (5%)' : i === 1 ? 'Poor (25%)' : i === 2 ? 'Okay (65%)' : 'Great (95%)'}
                        </div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--accent-color)' }}>
                          {(point.similarity).toFixed(3)}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                          (Raw AI Similarity)
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {showGeneratedJobs && Object.keys(generatedJobs).length > 0 && (
                    <div style={{ background: 'rgba(0,0,0,0.1)', border: '1px solid var(--surface-border)', padding: '1.5rem', borderRadius: '8px', marginTop: '1rem' }}>
                      <h4 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '1rem' }}>Calibration Job Postings</h4>
                      
                      {calibrationProfile && (
                        <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '1rem', borderRadius: '8px', borderLeft: '3px solid var(--accent-color)', marginBottom: '1.5rem' }}>
                          <h5 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                            AI Generated Candidate Profile Summary
                          </h5>
                          <p style={{ fontSize: '0.95rem', lineHeight: '1.5' }}>
                            "{calibrationProfile}"
                          </p>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                            The AI used this exact summary to generate the tailored jobs below.
                          </p>
                        </div>
                      )}

                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                        These are the jobs generated by the AI to anchor your match scores. Verify that a "Great" job looks perfect for you, and a "Bad" job is completely unrelated.
                      </p>
                      
                      {['Great', 'Okay', 'Poor', 'Bad'].map(cat => (
                        <div key={cat} style={{ marginBottom: '1.5rem' }}>
                          <h5 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--accent-color)', marginBottom: '0.5rem', borderBottom: '1px solid var(--surface-border)', paddingBottom: '4px' }}>
                            {cat} Matches
                          </h5>
                          {generatedJobs[cat]?.map((job, idx) => (
                            <div key={idx} style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '6px', marginBottom: '0.5rem', fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>
                              <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '8px', textTransform: 'uppercase' }}>
                                {idx === 0 ? 'Short' : idx === 1 ? 'Medium' : 'Long'} Job
                              </div>
                              {job}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              )}
              
              <div style={{ background: 'rgba(0,0,0,0.1)', border: '1px solid var(--surface-border)', padding: '1.5rem', borderRadius: '8px', marginTop: '2rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Data Maintenance</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Recalculate Match Scores</h4>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                      Force a bulk recalculation of semantic match scores for all previously AI-cleaned jobs. This takes a few seconds and uses your active AI matching settings.
                    </p>
                    <button 
                      className="btn-secondary" 
                      onClick={async () => {
                        const res = await fetch('/api/recalc');
                        const data = await res.json();
                        alert(data.message || 'Recalculation complete.');
                      }} 
                      style={{ alignSelf: 'flex-start', color: 'var(--text-primary)' }}
                    >
                      <RefreshCw size={16} style={{ display: 'inline', marginRight: '6px' }} /> 
                      Recalculate All Scores
                    </button>
                  </div>
                </div>
              </div>
        </div>
      )}

      {showProfileModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--surface-color)', padding: '2rem', borderRadius: '12px', width: '90%', maxWidth: '600px', border: '1px solid var(--surface-border)' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Wand2 size={20} className="text-accent" /> Review Candidate Profile
            </h2>
            
            {isGeneratingProfile ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '2rem' }}>
                <Loader2 size={32} className="spin text-accent" />
                <p style={{ color: 'var(--text-secondary)' }}>Extracting profile and seniority...</p>
              </div>
            ) : (
              <>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.95rem' }}>
                  The AI generated the following summary. This will be used as the anchor to generate the fake job postings for calibration. If it is inaccurate, provide feedback and regenerate.
                </p>
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', borderLeft: '3px solid var(--accent-color)', marginBottom: '1.5rem', minHeight: '80px', fontSize: '1rem', lineHeight: 1.5 }}>
                  {generatedProfile}
                </div>
                
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Feedback (Optional)</label>
                  <textarea 
                    value={profileFeedback}
                    onChange={(e) => setProfileFeedback(e.target.value)}
                    placeholder="e.g., 'Make it focus more on backend engineering' or 'I am a junior, not a senior'"
                    style={{ width: '100%', padding: '10px', fontSize: '0.95rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--surface-border)', borderRadius: '6px', color: 'var(--text-primary)', resize: 'vertical', minHeight: '80px' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                  <button className="btn-secondary" onClick={() => setShowProfileModal(false)}>Cancel</button>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="btn-secondary" onClick={handleRegenerateProfile}><Wand2 size={16}/> Regenerate</button>
                    <button className="btn-primary" onClick={handleApproveProfile}><CheckCircle2 size={16}/> Approve & Calibrate</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {activeTab === 'scraper' && (
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 600 }}>Default Scrape Sites</h2>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Hide Browser (Headless)</label>
              <input 
                type="checkbox" 
                checked={scraperHeadless}
                onChange={async (e) => {
                  setScraperHeadless(e.target.checked);
                  await updateSetting('scraper_headless', e.target.checked ? 'true' : 'false');
                }}
                style={{ width: '18px', height: '18px', accentColor: 'var(--accent-color)', cursor: 'pointer' }}
              />
            </div>
          </div>
          
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Configure the websites that will be automatically scraped when you click "Scrape All Defaults" on the Scraper dashboard. 
            If you get blocked by Cloudflare, uncheck "Hide Browser" and solve the captcha manually.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
            {scraperSites.length === 0 ? (
              <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', textAlign: 'center', color: 'var(--text-secondary)' }}>No default sites configured.</div>
            ) : (
              scraperSites.map((site, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', border: '1px solid var(--surface-border)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{site.name}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{site.url}</div>
                  </div>
                  <button onClick={() => handleRemoveSite(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '8px' }}>
                    <Trash2 size={18} />
                  </button>
                </div>
              ))
            )}
          </div>

          <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '1rem' }}>Add New Site</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: '1rem', alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '8px', color: 'var(--text-secondary)' }}>Site Name</label>
              <input value={newSiteName} onChange={e => setNewSiteName(e.target.value)} placeholder="e.g. Wellfound" style={{ width: '100%', padding: '10px', fontSize: '1rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--surface-border)', borderRadius: '6px', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '8px', color: 'var(--text-secondary)' }}>URL</label>
              <input value={newSiteUrl} onChange={e => setNewSiteUrl(e.target.value)} placeholder="https://wellfound.com/jobs" style={{ width: '100%', padding: '10px', fontSize: '1rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--surface-border)', borderRadius: '6px', color: 'var(--text-primary)' }} />
            </div>
            <button className="btn-primary" onClick={handleAddSite} disabled={!newSiteName || !newSiteUrl}>
              <Plus size={16} /> Add
            </button>
          </div>

          <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginTop: '3rem', marginBottom: '1rem' }}>Saved Focus Filters</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Manage the custom focus filters you have saved on the scraper dashboard.
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '2rem' }}>
            {savedFocusesState.length === 0 ? (
              <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', textAlign: 'center', color: 'var(--text-secondary)' }}>No saved focus filters.</div>
            ) : (
              savedFocusesState.map((f, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', border: '1px solid var(--surface-border)' }}>
                  <div style={{ fontSize: '1rem' }}>{f}</div>
                  <button onClick={() => handleRemoveFocus(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>

        </div>
      )}

      {activeTab === 'system' && (
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings size={20} className="text-accent" /> System Preferences
          </h2>

          <div style={{ background: 'rgba(0,0,0,0.1)', border: '1px solid var(--surface-border)', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>AI Models</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Select the LLM model used for intelligent features like Resume Tailoring and Smart Calibration.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Ollama LLM Model</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <select 
                    value={aiOllamaModel} 
                    onChange={(e) => setAiOllamaModel(e.target.value)}
                    style={{ flex: 1, padding: '10px', fontSize: '1rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--surface-border)', borderRadius: '6px', color: 'var(--text-primary)' }}
                  >
                    {availableOllamaModels.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                    {!availableOllamaModels.includes(aiOllamaModel) && (
                      <option value={aiOllamaModel}>{aiOllamaModel}</option>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Ollama Scraper Enhancement Model</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <select 
                    value={scraperAiModel} 
                    onChange={(e) => setScraperAiModel(e.target.value)}
                    style={{ flex: 1, padding: '10px', fontSize: '1rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--surface-border)', borderRadius: '6px', color: 'var(--text-primary)' }}
                  >
                    {availableOllamaModels.map(m => (
                      <option key={`scraper-${m}`} value={m}>{m}</option>
                    ))}
                    {!availableOllamaModels.includes(scraperAiModel) && (
                      <option value={scraperAiModel}>{scraperAiModel}</option>
                    )}
                  </select>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '4px' }}>Recommended: Fast 8B models (e.g. Llama-3 8B) to keep scraping speed high.</p>
              </div>
              
              <div style={{ marginTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>AI Cleanup Pause (Seconds)</label>
                <input 
                  type="number" 
                  min="0"
                  step="1"
                  value={cleanupPause} 
                  onChange={(e) => setCleanupPause(e.target.value)}
                  style={{ width: '100%', padding: '10px', fontSize: '1rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--surface-border)', borderRadius: '6px', color: 'var(--text-primary)' }}
                />
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '4px' }}>How long to pause between AI cleanup jobs to reduce CPU/GPU strain. Default is 0.</p>
              </div>
              
              <button className="btn-primary" onClick={handleSaveAiModels} disabled={isSavingAiModels} style={{ alignSelf: 'flex-start' }}>
                <Save size={16} /> {isSavingAiModels ? 'Saving...' : 'Save AI Settings'}
              </button>
            </div>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.1)', border: '1px solid var(--surface-border)', padding: '1.5rem', borderRadius: '8px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Database Automated Backup</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              The application smartly backs up your <code>tracker.db</code> database automatically every 12 hours.
            </p>
            <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Manual Backup</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                Trigger an immediate backup. This will save to a single <code>tracker_manual_backup_latest.db</code> file in your backup folder, ensuring it doesn't take up too much space.
              </p>
              <button 
                className="btn-secondary" 
                onClick={handleManualBackup} 
                disabled={isManuallyBackingUp} 
                style={{ alignSelf: 'flex-start', color: 'var(--text-primary)' }}
              >
                {isManuallyBackingUp ? <Loader2 size={16} className="spin" style={{ display: 'inline' }} /> : <Save size={16} style={{ display: 'inline' }} />}
                {isManuallyBackingUp ? ' Backing Up...' : ' Trigger Manual Backup'}
              </button>
            </div>

            <div style={{ marginTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', color: '#ef4444' }}>Restore Database</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                Load the database from an existing <code>.db</code> backup file. A special <code>tracker_pre_restore_backup.db</code> will automatically be created in your backup folder beforehand so you can revert this action if needed.
              </p>
              <button 
                className="btn-primary" 
                onClick={handleRestore} 
                disabled={isRestoring} 
                style={{ alignSelf: 'flex-start', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.5)', color: '#fca5a5' }}
              >
                {isRestoring ? <Loader2 size={16} className="spin" style={{ display: 'inline' }} /> : 'Load DB from Backup...'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
