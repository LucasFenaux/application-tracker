'use server'

import { revalidatePath } from 'next/cache';

import { getDb } from '@/lib/db';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { cosineSimilarity, calculateMatchScore } from '@/lib/ml';
import pdfParse from '@/lib/pdf';

const execAsync = promisify(exec);

export async function getJobsWithMatchScores() {
  const db = getDb();
  const jobs = db.prepare('SELECT * FROM jobs WHERE deleted_at IS NULL ORDER BY updated_at DESC').all() as any[];
  const profiles = db.prepare('SELECT vector FROM materials WHERE is_profile = 1').all() as any[];
  
  let combinedProfileVector: number[] | null = null;
  const parsedProfiles = profiles.map(p => p.vector ? JSON.parse(p.vector) : null).filter(v => v !== null);
  
  if (parsedProfiles.length > 0) {
    const vecLength = parsedProfiles[0].length;
    combinedProfileVector = new Array(vecLength).fill(0);
    for (const vec of parsedProfiles) {
      for (let i = 0; i < vecLength; i++) {
        combinedProfileVector[i] += vec[i];
      }
    }
    for (let i = 0; i < vecLength; i++) {
      combinedProfileVector[i] /= parsedProfiles.length;
    }
  }

  const settingsRaw = db.prepare('SELECT * FROM settings').all() as any[];
  const settings = settingsRaw.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
  
  const mode = settings.calibration_mode || 'simple';
  const minSim = parseFloat(settings.calibration_min || '0.55');
  const maxSim = parseFloat(settings.calibration_max || '0.85');
  
  let calibrationCurve: { similarity: number, expectedScore: number }[] = [];
  if (mode === 'smart' && settings.calibration_curve) {
    try {
      calibrationCurve = JSON.parse(settings.calibration_curve);
      // Ensure sorted by similarity
      calibrationCurve.sort((a, b) => a.similarity - b.similarity);
    } catch (err) {
      console.error('Failed to parse calibration curve');
    }
  }

  let targetJobGoalVector: number[] | null = null;
  if (settings.target_job_goal_vector) {
    try {
      targetJobGoalVector = JSON.parse(settings.target_job_goal_vector);
    } catch (err) {
      console.error('Failed to parse target_job_goal_vector');
    }
  }

  return jobs.map(job => {
    let matchScore = null;
    let goalMatchScore = null;
    if (job.vector) {
      const jobVector = JSON.parse(job.vector);
      if (combinedProfileVector) {
        const similarity = cosineSimilarity(combinedProfileVector, jobVector);
        matchScore = calculateMatchScore(similarity, mode, calibrationCurve, minSim, maxSim);
      }
      if (targetJobGoalVector) {
        const goalSimilarity = cosineSimilarity(targetJobGoalVector, jobVector);
        goalMatchScore = calculateMatchScore(goalSimilarity, mode, calibrationCurve, minSim, maxSim);
      }
    }
    
    return {
      ...job,
      matchScore,
      goalMatchScore,
      vector: undefined // Remove large vector from client payload
    };
  });
}

export async function getJobs() {
  const db = getDb();
  return db.prepare('SELECT * FROM jobs WHERE deleted_at IS NULL ORDER BY updated_at DESC').all();
}

export async function createJob(formData: FormData) {
  const company = formData.get('company') as string;
  const title = formData.get('title') as string;
  const url = formData.get('url') as string;
  const location = formData.get('location') as string || '';
  const description = formData.get('description') as string;
  
  let vectorJson = null;
  if (title || company || description) {
    const { generateEmbedding } = await import('@/lib/ml');
    const text = `${title} at ${company}. ${description || ''}`.slice(0, 4000);
    const embedding = await generateEmbedding(text);
    if (embedding.length > 0) vectorJson = JSON.stringify(embedding);
  }

  const db = getDb();
  const stmt = db.prepare('INSERT INTO jobs (company, title, location, url, description, stage, vector) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const result = stmt.run(company, title, location, url, description, 'Queue', vectorJson);
  
  logActivityInternal('Added to Queue', result.lastInsertRowid as number);
  
  revalidatePath('/');
  return result;
}

export async function updateJobStage(id: number, stage: string) {
  const db = getDb();
  const stmt = db.prepare('UPDATE jobs SET stage = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
  stmt.run(stage, id);
  
  logActivityInternal(`Moved to ${stage}`, id);
  
  revalidatePath('/');
}

export async function deleteJob(id: number) {
  const db = getDb();
  db.prepare('UPDATE jobs SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
  revalidatePath('/');
  revalidatePath('/board');
}

export async function getDeletedJobs() {
  const db = getDb();
  // Automatic cleanup of jobs older than 30 days
  db.prepare("DELETE FROM jobs WHERE deleted_at <= datetime('now', '-30 days')").run();
  
  return db.prepare('SELECT * FROM jobs WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC').all() as any[];
}

export async function restoreJob(id: number) {
  const db = getDb();
  db.prepare('UPDATE jobs SET deleted_at = NULL WHERE id = ?').run(id);
  revalidatePath('/');
  revalidatePath('/board');
  revalidatePath('/bin');
}

export async function permanentlyDeleteJob(id: number) {
  const db = getDb();
  db.prepare('DELETE FROM jobs WHERE id = ?').run(id);
  revalidatePath('/bin');
}

export async function updateJobNotes(id: number, notes: string) {
  const db = getDb();
  db.prepare('UPDATE jobs SET notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(notes, id);
  revalidatePath('/');
}

export async function updateJobDetails(id: number, title: string, company: string, location: string, description: string) {
  const db = getDb();
  db.prepare('UPDATE jobs SET title = ?, company = ?, location = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(title, company, location, description, id);
  
  // Update vector since details changed
  const { generateEmbedding } = await import('@/lib/ml');
  const text = `${title} at ${company}. ${description || ''}`.slice(0, 4000);
  const embedding = await generateEmbedding(text);
  if (embedding.length > 0) {
    db.prepare('UPDATE jobs SET vector = ? WHERE id = ?').run(JSON.stringify(embedding), id);
  }
  revalidatePath('/');
}

export async function updateJobDeadline(id: number, deadline: string | null) {
  const db = getDb();
  db.prepare('UPDATE jobs SET deadline = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(deadline, id);
  revalidatePath('/');
  revalidatePath('/board');
}

export async function getJobMaterials(jobId: number) {
  const db = getDb();
  return db.prepare(`
    SELECT m.* FROM materials m
    JOIN job_materials jm ON m.id = jm.material_id
    WHERE jm.job_id = ?
  `).all(jobId);
}

export async function getAllMaterials() {
  const db = getDb();
  return db.prepare('SELECT * FROM materials ORDER BY uploaded_at DESC').all();
}

export async function attachMaterialToJob(jobId: number, materialId: number) {
  const db = getDb();
  db.prepare('INSERT OR IGNORE INTO job_materials (job_id, material_id) VALUES (?, ?)').run(jobId, materialId);
  revalidatePath('/');
}

export async function removeMaterialFromJob(jobId: number, materialId: number) {
  const db = getDb();
  db.prepare('DELETE FROM job_materials WHERE job_id = ? AND material_id = ?').run(jobId, materialId);
  revalidatePath('/');
}

export async function uploadMaterial(formData: FormData) {
  const file = formData.get('file') as File;
  const type = formData.get('type') as string;
  const name = formData.get('name') as string;
  const isProfile = formData.get('isProfile') === 'true' ? 1 : 0;

  if (!file || !type || !name) return;

  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
  const uploadDir = path.join(process.cwd(), 'public/uploads');
  
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  
  fs.writeFileSync(path.join(uploadDir, filename), buffer);

  let vectorJson = null;
  if (isProfile) {
    let cleanText = '';
    
    if (file.name.toLowerCase().endsWith('.pdf')) {
      try {
        const data = await pdfParse(buffer);
        cleanText = data.text;
      } catch (err) {
        console.error('Failed to parse PDF', err);
        cleanText = ''; // Do not use buffer.toString('utf-8') as it feeds binary garbage to the tokenizer!
      }
    } else {
      const textContent = buffer.toString('utf-8');
      cleanText = textContent.replace(/\\[a-zA-Z]+\{.*?\}/g, ' ').replace(/[{}]/g, ' ');
    }
    
    cleanText = cleanText.slice(0, 4000);
    
    const { generateEmbedding } = await import('@/lib/ml');
    const embedding = await generateEmbedding(cleanText);
    if (embedding.length > 0) vectorJson = JSON.stringify(embedding);
  }

  const db = getDb();
  db.prepare('INSERT INTO materials (name, filename, type, is_profile, vector) VALUES (?, ?, ?, ?, ?)')
    .run(name, filename, type, isProfile, vectorJson);

  logActivityInternal(`Uploaded ${type}`);
  revalidatePath('/materials');
}

export async function deleteMaterial(id: number) {
  const db = getDb();
  
  // Get filename to delete from disk
  const material = db.prepare('SELECT filename FROM materials WHERE id = ?').get(id) as any;
  if (material && material.filename) {
    const filePath = path.join(process.cwd(), 'public/uploads', material.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  // Delete from DB
  db.prepare('DELETE FROM materials WHERE id = ?').run(id);
  db.prepare('DELETE FROM job_materials WHERE material_id = ?').run(id);

  revalidatePath('/materials');
}

export async function getActivities() {
  const db = getDb();
  return db.prepare(`
    SELECT date, COUNT(*) as count, GROUP_CONCAT(action, ', ') as actions
    FROM activities
    GROUP BY date
    ORDER BY date ASC
  `).all();
}

function logActivityInternal(action: string, jobId?: number) {
  const db = getDb();
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  db.prepare('INSERT INTO activities (date, action, job_id) VALUES (?, ?, ?)')
    .run(date, action, jobId || null);
}

export async function generateResumeSuggestions(jobId: number, resumeMaterialId: number, contextMaterialIds: number[]) {
  const db = getDb();
  
  const providerSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('ai_provider') as any;
  const provider = providerSetting ? providerSetting.value : 'ollama';

  const job = db.prepare('SELECT title, company, description FROM jobs WHERE id = ?').get(jobId) as any;
  if (!job || !job.description) {
    throw new Error('Job description is missing. Cannot generate tailored suggestions without a job description.');
  }

  // Helper to read and parse a material
  const parseMaterialText = async (id: number) => {
    const material = db.prepare('SELECT name, filename, type FROM materials WHERE id = ?').get(id) as any;
    if (!material) return { name: 'Unknown', text: '' };

    const filePath = path.join(process.cwd(), 'public/uploads', material.filename);
    if (!fs.existsSync(filePath)) return { name: material.name, text: '' };

    const buffer = fs.readFileSync(filePath);
    let text = '';
    if (material.filename.toLowerCase().endsWith('.pdf')) {
      try {
        const data = await pdfParse(buffer);
        text = data.text;
      } catch (err) {
        console.error('Failed to parse PDF', err);
      }
    } else {
      text = buffer.toString('utf-8');
      text = text.replace(/\\[a-zA-Z]+\{.*?\}/g, ' ').replace(/[{}]/g, ' ');
    }
    return { name: material.name, text };
  };

  const resume = await parseMaterialText(resumeMaterialId);
  if (!resume.text) {
    throw new Error('Could not extract text from the selected resume.');
  }

  // Parse contextual materials
  let contextText = '';
  if (contextMaterialIds && contextMaterialIds.length > 0) {
    for (const ctxId of contextMaterialIds) {
      const ctx = await parseMaterialText(ctxId);
      if (ctx.text) {
        contextText += `\n\n--- Additional Context (${ctx.name}) ---\n${ctx.text.slice(0, 3000)}`;
      }
    }
  }

  // Get active prompt
  const activePrompt = db.prepare('SELECT content FROM prompts WHERE is_active = 1 LIMIT 1').get() as { content: string };
  let promptTemplate = activePrompt ? activePrompt.content : `You are an expert technical recruiter and resume writer.
I am applying for the role of "{jobTitle}" at "{companyName}".

Here is the Job Description:
"""
{jobDescription}
"""

Here is my current Resume:
"""
{resumeText}
"""

{contextFiles}

Please suggest exactly 3 to 5 specific, actionable bullet point tweaks I should make to my resume to better align with the job description. Be concise and direct. Format your response in Markdown.`;

  let prompt = promptTemplate
    .replace('{jobTitle}', job.title || '')
    .replace('{companyName}', job.company || '')
    .replace('{jobDescription}', job.description.slice(0, 3000))
    .replace('{resumeText}', resume.text.slice(0, 4000))
    .replace('{contextFiles}', contextText);

  const { generateTextBuiltin, generateTextOllama } = await import('@/lib/ml');

  if (provider === 'ollama') {
    try {
      let suggestions = await generateTextOllama(prompt);
      let thinking = '';
      const thinkMatch = suggestions.match(/<think>([\s\S]*?)<\/think>/);
      if (thinkMatch) {
        thinking = thinkMatch[1].trim();
        suggestions = suggestions.replace(/<think>[\s\S]*?<\/think>/, '').trim();
      }
      return { success: true, suggestions, thinking };
    } catch (err: any) {
      if (err.message === 'OLLAMA_NOT_RUNNING') {
        return { success: false, error: 'OLLAMA_NOT_RUNNING' };
      }
      if (err.message === 'OLLAMA_MODEL_NOT_FOUND') {
        return { success: false, error: 'OLLAMA_MODEL_NOT_FOUND' };
      }
      throw err;
    }
  } else {
    const suggestions = await generateTextBuiltin(prompt);
    return { success: true, suggestions };
  }
}

// ---- Prompt Management Actions ----

export async function getPrompts() {
  const db = getDb();
  return db.prepare('SELECT * FROM prompts ORDER BY id ASC').all();
}

export async function createPrompt(name: string, content: string) {
  const db = getDb();
  const stmt = db.prepare('INSERT INTO prompts (name, content) VALUES (?, ?)');
  stmt.run(name, content);
  revalidatePath('/settings');
}

export async function updatePrompt(id: number, name: string, content: string) {
  const db = getDb();
  db.prepare('UPDATE prompts SET name = ?, content = ? WHERE id = ?').run(name, content, id);
  revalidatePath('/settings');
}

export async function setActivePrompt(id: number) {
  const db = getDb();
  db.prepare('UPDATE prompts SET is_active = 0').run();
  db.prepare('UPDATE prompts SET is_active = 1 WHERE id = ?').run(id);
  revalidatePath('/settings');
}

export async function deletePrompt(id: number) {
  const db = getDb();
  const prompt = db.prepare('SELECT is_system_default FROM prompts WHERE id = ?').get(id) as any;
  if (prompt && prompt.is_system_default === 1) {
    throw new Error('Cannot delete the system default prompt.');
  }
  db.prepare('DELETE FROM prompts WHERE id = ?').run(id);
  
  // Ensure we have an active prompt
  const activePromptCount = db.prepare('SELECT COUNT(*) as count FROM prompts WHERE is_active = 1').get() as { count: number };
  if (activePromptCount.count === 0) {
    db.prepare('UPDATE prompts SET is_active = 1 WHERE is_system_default = 1').run();
  }
  revalidatePath('/settings');
}

// ---- Settings Actions ----

export async function saveTargetJobGoal(goal: string) {
  const db = getDb();
  let vectorJson = null;
  
  if (goal && goal.trim().length > 0) {
    const { generateEmbedding } = await import('@/lib/ml');
    const vector = await generateEmbedding(goal);
    vectorJson = JSON.stringify(vector);
  }
  
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('target_job_goal', goal);
  if (vectorJson) {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('target_job_goal_vector', vectorJson);
  } else {
    db.prepare('DELETE FROM settings WHERE key = ?').run('target_job_goal_vector');
  }
  
  revalidatePath('/');
  revalidatePath('/board');
  revalidatePath('/scraper');
  revalidatePath('/settings');
}

export async function pickBackupFolder() {
  if (process.platform !== 'darwin') {
    throw new Error('Native folder picker is only supported on macOS.');
  }
  
  try {
    const { stdout } = await execAsync(`osascript -e 'POSIX path of (choose folder with prompt "Select Backup Folder")'`);
    return { path: stdout.trim() };
  } catch (err: any) {
    if (err.message && err.message.includes('User canceled')) {
      return { canceled: true };
    }
    throw new Error(`Failed to open folder picker: ${err.message}`);
  }
}

export async function manualDbBackup() {
  const db = getDb();
  const backupFolderRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('db_backup_folder') as any;
  if (!backupFolderRow || !backupFolderRow.value || backupFolderRow.value.trim() === '') {
    throw new Error('Please set and save a backup folder first.');
  }

  const targetDir = backupFolderRow.value.trim();
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const backupPath = path.join(targetDir, 'tracker_manual_backup_latest.db');
  
  // SQLite safe backup
  await db.backup(backupPath);
  return { success: true, path: backupPath };
}

export async function pickBackupFile() {
  if (process.platform !== 'darwin') {
    throw new Error('Native file picker is only supported on macOS.');
  }
  
  try {
    const { stdout } = await execAsync(`osascript -e 'POSIX path of (choose file with prompt "Select Backup DB to Load" of type {"db"})'`);
    return { path: stdout.trim() };
  } catch (err: any) {
    if (err.message && err.message.includes('User canceled')) {
      return { canceled: true };
    }
    throw new Error(`Failed to open file picker: ${err.message}`);
  }
}

export async function executeRestore(backupPath: string) {
  const { restoreDbFromBackup } = await import('@/lib/db');
  const preRestorePath = await restoreDbFromBackup(backupPath);
  
  // Revalidate to clear Next.js server caches
  revalidatePath('/');
  revalidatePath('/board');
  revalidatePath('/scraper');
  revalidatePath('/settings');

  return { success: true, preRestorePath };
}

export async function getAvailableOllamaModels() {
  try {
    const res = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.models || []).map((m: any) => m.name);
  } catch (e) {
    return [];
  }
}

export async function getSettings() {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM settings').all() as any[];
  return rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
}

export async function updateSetting(key: string, value: string) {
  const db = getDb();
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
  revalidatePath('/settings');
}

export async function getScraperStatus() {
  const db = getDb();
  let isRunning = db.prepare("SELECT value FROM settings WHERE key = 'scraper_is_running'").get() as any;
  const liveStatus = db.prepare("SELECT value FROM settings WHERE key = 'scraper_live_status'").get() as any;
  const progress = db.prepare("SELECT value FROM settings WHERE key = 'scraper_progress'").get() as any;
  const heartbeat = db.prepare("SELECT value FROM settings WHERE key = 'scraper_heartbeat'").get() as any;
  
  let running = isRunning ? isRunning.value === 'true' : false;

  // Watchdog / Dead-man switch: If the scraper is marked as running but hasn't updated its heartbeat in 60s, it crashed.
  if (running && heartbeat && heartbeat.value) {
    const lastSeen = parseInt(heartbeat.value);
    if (Date.now() - lastSeen > 60000) {
      console.log("[Scraper] Watchdog detected dead scraper. Resetting status.");
      db.prepare("UPDATE settings SET value = 'false' WHERE key = 'scraper_is_running'").run();
      running = false;
    }
  }

  return {
    isRunning: running,
    status: liveStatus ? liveStatus.value : 'Idle',
    progress: progress ? parseInt(progress.value) : 0
  };
}

export async function getCalibrationStatus() {
  const db = getDb();
  const isCalibrating = db.prepare('SELECT value FROM settings WHERE key = ?').get('is_calibrating') as any;
  const progress = db.prepare('SELECT value FROM settings WHERE key = ?').get('calibration_progress') as any;
  const status = db.prepare('SELECT value FROM settings WHERE key = ?').get('calibration_status') as any;
  
  return {
    isCalibrating: isCalibrating ? isCalibrating.value === 'true' : false,
    progress: progress ? parseInt(progress.value) || 0 : 0,
    status: status ? status.value : ''
  };
}

export async function generateCalibrationProfile(materialIds: number[], previousSummary?: string, feedback?: string) {
  const db = getDb();

  const providerSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('ai_provider') as any;
  const provider = providerSetting ? providerSetting.value : 'ollama';

  let combinedText = '';
  for (const id of materialIds) {
    const material = db.prepare('SELECT name, filename, type FROM materials WHERE id = ?').get(id) as any;
    if (!material) continue;
    const filePath = path.join(process.cwd(), 'public/uploads', material.filename);
    if (!fs.existsSync(filePath)) continue;

    const buffer = fs.readFileSync(filePath);
    if (material.filename.toLowerCase().endsWith('.pdf')) {
      try {
        const data = await pdfParse(buffer);
        combinedText += `\n\n--- ${material.name} ---\n${data.text}`;
      } catch (err) {}
    } else {
      let t = buffer.toString('utf-8');
      t = t.replace(/\\[a-zA-Z]+\{.*?\}/g, ' ').replace(/[{}]/g, ' ');
      combinedText += `\n\n--- ${material.name} ---\n${t}`;
    }
  }

  let profilePrompt = `You are an expert technical recruiter. Based on the following documents of a candidate, write a concise 1-2 sentence summary of their professional profile.
Include their primary role, key specializations, and focus (e.g. research vs engineering).
CRITICAL: Accurately identify their EXACT seniority or career level (e.g., Student, Intern, Junior, Mid-level, or Senior). Do not overestimate their seniority based on the volume of work, personal projects, or achievements; look for explicit titles, experience duration, or current status to accurately determine their career stage.
Respond with ONLY the summary and no intro text.`;

  if (previousSummary && feedback) {
    profilePrompt += `\n\nThe user rejected your previous summary:\n"${previousSummary}"\n\nThey provided this feedback to correct it:\n"${feedback}"\n\nEnsure your new summary strictly adheres to their feedback.`;
  }

  profilePrompt += `\nDocuments:\n"""\n${combinedText.slice(0, 4000)}\n"""`;

  const { generateTextBuiltin, generateTextOllama } = await import('@/lib/ml');
  let applicantProfile = '';
  if (provider === 'ollama') {
    applicantProfile = await generateTextOllama(profilePrompt);
  } else {
    applicantProfile = await generateTextBuiltin(profilePrompt);
  }

  return applicantProfile;
}

export async function startSmartCalibration(materialIds: number[], approvedProfile: string) {
  const db = getDb();
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('is_calibrating', 'true')").run();
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('calibration_progress', '0');
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('calibration_status', 'Starting background process...');
  
  // Fire and forget
  runCalibrationBackground(approvedProfile).catch(err => {
    console.error("Calibration Background Error:", err);
    const dbErr = getDb();
    dbErr.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('calibration_status', `Error: ${err.message}`);
    dbErr.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('is_calibrating', 'false');
  });

  return { success: true };
}

async function runCalibrationBackground(approvedProfile: string) {
  const db = getDb();
  
  const providerSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('ai_provider') as any;
  const provider = providerSetting ? providerSetting.value : 'ollama';

  const updateStatus = (status: string, progress: number) => {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('calibration_status', status);
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('calibration_progress', progress.toString());
  };

  try {
    updateStatus('Saving profile and preparing to generate jobs...', 10);
    const { cosineSimilarity, generateTextBuiltin, generateTextOllama, generateEmbedding } = await import('@/lib/ml');

    const applicantProfile = approvedProfile;

    // 3. Loop over categories and lengths
    const categories = ['Bad', 'Poor', 'Okay', 'Great'];
    const lengths = ['Short', 'Medium', 'Long'];
    
    let badSum = 0, poorSum = 0, okaySum = 0, greatSum = 0;
    let generated: { [category: string]: string[] } = { Bad: [], Poor: [], Okay: [], Great: [] };
    
    // Calculate combined user profile vector once
    const profiles = db.prepare('SELECT vector FROM materials WHERE is_profile = 1').all() as any[];
    const parsedProfiles = profiles.map(p => p.vector ? JSON.parse(p.vector) : null).filter(v => v !== null);
    
    let combinedProfileVector: number[] | null = null;
    if (parsedProfiles.length > 0) {
      const vecLength = parsedProfiles[0].length;
      combinedProfileVector = new Array(vecLength).fill(0);
      for (const vec of parsedProfiles) {
        for (let i = 0; i < vecLength; i++) combinedProfileVector[i] += vec[i];
      }
      for (let i = 0; i < vecLength; i++) combinedProfileVector[i] /= parsedProfiles.length;
    }

    let step = 0;
    for (const category of categories) {
      for (const length of lengths) {
        step++;
        const currentProgress = 10 + Math.round((step / 12) * 85); // Progress from 10% to 95%
        updateStatus(`Generating ${length.toLowerCase()} ${category.toLowerCase()} match...`, currentProgress);
        
        let categoryDesc = '';
        if (category === 'Bad') categoryDesc = `completely unrelated to this candidate's profile. Write a job in a totally different field (e.g. if they are in tech, write a job for retail or healthcare).`;
        if (category === 'Poor') categoryDesc = `in the same broad industry, but entirely the wrong specialization or level for this candidate.`;
        if (category === 'Okay') categoryDesc = `a decent match for this candidate, but focuses on slightly different daily tasks (e.g., engineering instead of research) or requires a few different technologies than they specialize in.`;
        if (category === 'Great') categoryDesc = `the absolute perfect ideal role for this candidate, perfectly matching their specific specialization, academic/research focus, and exact skills.`;

        const jobPrompt = `You are writing a fake job posting. The candidate's profile is: "${applicantProfile}"
Write a ${length.toLowerCase()} length job description that is ${categoryDesc}. 
Try to naturally align the job's expected experience level with the seniority mentioned in the profile (if applicable), but you do not need to be overly strict.
Do not include any introductory or concluding text. ONLY write the job description text.`;

        let fakeJob = '';
        if (provider === 'ollama') fakeJob = await generateTextOllama(jobPrompt);
        else fakeJob = await generateTextBuiltin(jobPrompt);

        const jobEmbedding = await generateEmbedding(fakeJob);
        
        let similarity = 0;
        if (combinedProfileVector && jobEmbedding.length > 0) {
          similarity = cosineSimilarity(combinedProfileVector, jobEmbedding);
        }

        generated[category].push(fakeJob);
        if (category === 'Bad') badSum += similarity;
        if (category === 'Poor') poorSum += similarity;
        if (category === 'Okay') okaySum += similarity;
        if (category === 'Great') greatSum += similarity;
      }
    }

    updateStatus('Saving calibration curve...', 99);
    
    const curve = [
      { similarity: badSum / 3, expectedScore: 5 },
      { similarity: poorSum / 3, expectedScore: 25 },
      { similarity: okaySum / 3, expectedScore: 65 },
      { similarity: greatSum / 3, expectedScore: 95 }
    ];
    
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('calibration_curve', JSON.stringify(curve));
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('calibration_mode', 'smart');
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('calibration_jobs', JSON.stringify(generated));
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('calibration_profile', applicantProfile);
    
    updateStatus('Calibration Complete!', 100);
    
  } catch (err: any) {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('calibration_status', `Error: ${err.message}`);
  } finally {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('is_calibrating', 'false');
  }
}

// removed saveCalibrationCurve since it's now handled entirely within runCalibrationBackground

// --- SCRAPER ACTIONS ---

export async function startScraper(url: string, website: string, focus: string, minMatch: number, minGoalMatch: number, provider: 'ollama'|'builtin' = 'builtin') {
  const db = getDb();
  db.prepare("INSERT INTO settings (key, value) VALUES ('scraper_cancel_requested', 'false') ON CONFLICT(key) DO UPDATE SET value = 'false'").run();
  import('@/lib/scraper').then(async scraper => {
    try {
      await scraper.runScraperTask(url, website, focus, minMatch, minGoalMatch, provider);
    } catch (err) {
      console.error(err);
    } finally {
      getDb().prepare("UPDATE settings SET value = 'false' WHERE key = 'scraper_is_running'").run();
    }
  });
  return { success: true };
}

function buildSearchQuery(focus: string) {
  if (!focus || focus === 'none' || focus === 'custom' || focus.trim() === '') return '';
  const normalizedSearch = focus.replace(/-\s+/g, '-');
  const regex = /(-?)(?:"([^"]+)"|(\S+))/g;
  let match;
  const positiveTerms = [];
  while ((match = regex.exec(normalizedSearch)) !== null) {
    const isNegated = match[1] === '-';
    if (!isNegated) {
      const term = match[2] || match[3];
      if (term) positiveTerms.push(term);
    }
  }
  return positiveTerms.join(' ');
}

export async function startSequentialScraper(sites: any[], focus: string, minMatch: number, minGoalMatch: number, provider: 'ollama'|'builtin' = 'builtin') {
  const db = getDb();
  db.prepare("INSERT INTO settings (key, value) VALUES ('scraper_cancel_requested', 'false') ON CONFLICT(key) DO UPDATE SET value = 'false'").run();
  
  const searchQuery = buildSearchQuery(focus);
  if (searchQuery) {
    const encodedQuery = encodeURIComponent(searchQuery);
    sites = sites.map(site => {
      let url = site.url;
      if (url.includes('builtin.com')) {
        url = url.includes('?') ? `${url}&search=${encodedQuery}` : `${url}?search=${encodedQuery}`;
      } else if (url.includes('simplify.jobs') || url.includes('news.ycombinator.com') || url.includes('remoteok.com')) {
        url = url.includes('?') ? `${url}&q=${encodedQuery}` : `${url}?q=${encodedQuery}`;
      }
      return { ...site, url };
    });
  }

  import('@/lib/scraper').then(async scraper => {
    let keepRunning = true;
    const pageMap: Record<string, number> = {};
    
    try {
      while (keepRunning) {
        for (const site of sites) {
          const cancelFlag = getDb().prepare("SELECT value FROM settings WHERE key = 'scraper_cancel_requested'").get() as any;
          if (cancelFlag && cancelFlag.value === 'true') {
            console.log("[Scraper] Sequential run cancelled before starting", site.name);
            keepRunning = false;
            break; 
          }

          const currentPage = pageMap[site.url] || 1;

          try {
            const result = await scraper.runScraperTask(site.url, site.name, focus, minMatch, minGoalMatch, provider, currentPage);
            
            if (result && result.jobsAdded > 0) {
              pageMap[site.url] = currentPage + 1;
            } else {
              // If it found 0 new jobs, it's either out of jobs or pagination failed. Reset to page 1 for the next cycle.
              pageMap[site.url] = 1;
            }
          } catch (err) {
            console.error(`Error scraping ${site.name}:`, err);
            pageMap[site.url] = 1;
          }
        }
        
        if (keepRunning) {
          console.log("[Scraper] Finished a cycle. Waiting 60 seconds before next cycle...");
          getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('scraper_live_status', 'Taking a 60-second break before the next cycle...');
          getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('scraper_progress', '100');
          // Pause for 60 seconds before restarting the cycle to avoid IP blocks
          await new Promise(r => setTimeout(r, 60000));
        }
      }
    } finally {
      getDb().prepare("UPDATE settings SET value = 'false' WHERE key = 'scraper_is_running'").run();
    }
  });
  return { success: true };
}

export async function cancelScraper() {
  const db = getDb();
  db.prepare("INSERT INTO settings (key, value) VALUES ('scraper_cancel_requested', 'true') ON CONFLICT(key) DO UPDATE SET value = 'true'").run();
  db.prepare("UPDATE settings SET value = 'false' WHERE key = 'scraper_is_running'").run();
  return { success: true };
}

export async function getScraperLogs() {
  const db = getDb();
  return db.prepare('SELECT * FROM scraper_logs ORDER BY created_at DESC LIMIT 50').all() as any[];
}

export async function getScrapedJobs() {
  const db = getDb();
  const jobs = db.prepare('SELECT * FROM scraped_jobs WHERE deleted_at IS NULL ORDER BY match_score DESC, created_at DESC').all() as any[];
  const profiles = db.prepare('SELECT vector FROM materials WHERE is_profile = 1').all() as any[];
  
  let combinedProfileVector: number[] | null = null;
  const parsedProfiles = profiles.map(p => p.vector ? JSON.parse(p.vector) : null).filter(v => v !== null);
  
  if (parsedProfiles.length > 0) {
    const vecLength = parsedProfiles[0].length;
    combinedProfileVector = new Array(vecLength).fill(0);
    for (const vec of parsedProfiles) {
      for (let i = 0; i < vecLength; i++) {
        combinedProfileVector[i] += vec[i];
      }
    }
    for (let i = 0; i < vecLength; i++) {
      combinedProfileVector[i] /= parsedProfiles.length;
    }
  }

  const settingsRaw = db.prepare('SELECT * FROM settings').all() as any[];
  const settings = settingsRaw.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
  
  const mode = settings.calibration_mode || 'simple';
  const minSim = parseFloat(settings.calibration_min || '0.55');
  const maxSim = parseFloat(settings.calibration_max || '0.85');
  
  let calibrationCurve: { similarity: number, expectedScore: number }[] = [];
  if (mode === 'smart' && settings.calibration_curve) {
    try {
      calibrationCurve = JSON.parse(settings.calibration_curve);
      calibrationCurve.sort((a, b) => a.similarity - b.similarity);
    } catch (err) {}
  }

  let targetJobGoalVector: number[] | null = null;
  if (settings.target_job_goal_vector) {
    try {
      targetJobGoalVector = JSON.parse(settings.target_job_goal_vector);
    } catch (err) {
      console.error('Failed to parse target_job_goal_vector');
    }
  }

  return jobs.map(job => {
    let matchScore = job.match_score; // fallback to stored
    let goalMatchScore = job.goal_match_score || null;
    
    if (job.vector) {
      const jobVector = JSON.parse(job.vector);
      if (combinedProfileVector) {
        const similarity = cosineSimilarity(combinedProfileVector, jobVector);
        matchScore = calculateMatchScore(similarity, mode, calibrationCurve, minSim, maxSim);
      }
      if (targetJobGoalVector) {
        const goalSimilarity = cosineSimilarity(targetJobGoalVector, jobVector);
        goalMatchScore = calculateMatchScore(goalSimilarity, mode, calibrationCurve, minSim, maxSim);
      }
    }
    
    return {
      ...job,
      match_score: matchScore,
      goal_match_score: goalMatchScore,
      vector: undefined // Remove large vector from client payload
    };
  });
}


export async function deleteScrapedJob(id: number) {
  const db = getDb();
  db.prepare('UPDATE scraped_jobs SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
}

export async function hideScrapedJob(id: number) {
  const db = getDb();
  db.prepare('UPDATE scraped_jobs SET is_hidden = 1 WHERE id = ?').run(id);
}

export async function unhideScrapedJob(id: number) {
  const db = getDb();
  db.prepare('UPDATE scraped_jobs SET is_hidden = 0 WHERE id = ?').run(id);
}

export async function restoreScrapedJob(id: number) {
  const db = getDb();
  db.prepare('UPDATE scraped_jobs SET deleted_at = NULL WHERE id = ?').run(id);
}

export async function hardDeleteScrapedJob(id: number) {
  const db = getDb();
  db.prepare('DELETE FROM scraped_jobs WHERE id = ?').run(id);
}

export async function getDeletedScrapedJobs() {
  const db = getDb();
  db.prepare("DELETE FROM scraped_jobs WHERE deleted_at <= datetime('now', '-30 days')").run();
  return db.prepare('SELECT * FROM scraped_jobs WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC').all() as any[];
}

export async function moveToMainBoard(id: number) {
  const db = getDb();
  const job = db.prepare('SELECT * FROM scraped_jobs WHERE id = ?').get(id) as any;
  if (!job) return;

  const { generateEmbedding } = await import('@/lib/ml');
  const vector = await generateEmbedding(`${job.title} - ${job.company}\n\n${job.description}`);
  
  db.prepare(`
    INSERT INTO jobs (company, title, location, description, url, vector, stage)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(job.company, job.title, job.location, job.description, job.url, JSON.stringify(vector), 'Queue');

  db.prepare('DELETE FROM scraped_jobs WHERE id = ?').run(id);
}

export async function saveFocusToSettings(focus: string) {
  if (!focus || focus.trim() === '') return;
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('saved_focuses') as any;
  let focuses: string[] = [];
  if (row && row.value) {
    try {
      focuses = JSON.parse(row.value);
    } catch (e) {}
  }
  
  if (!focuses.includes(focus.trim())) {
    focuses.push(focus.trim());
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('saved_focuses', JSON.stringify(focuses));
  }
}

// ---- Extension Actions ----

export async function getExtensionJobs() {
  const db = getDb();
  return db.prepare('SELECT * FROM extension_jobs WHERE deleted_at IS NULL ORDER BY created_at DESC').all() as any[];
}

export async function deleteExtensionJob(id: number) {
  const db = getDb();
  db.prepare('UPDATE extension_jobs SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
}

export async function restoreExtensionJob(id: number) {
  const db = getDb();
  db.prepare('UPDATE extension_jobs SET deleted_at = NULL WHERE id = ?').run(id);
}

export async function hardDeleteExtensionJob(id: number) {
  const db = getDb();
  db.prepare('DELETE FROM extension_jobs WHERE id = ?').run(id);
}

export async function getDeletedExtensionJobs() {
  const db = getDb();
  db.prepare("DELETE FROM extension_jobs WHERE deleted_at <= datetime('now', '-30 days')").run();
  return db.prepare('SELECT * FROM extension_jobs WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC').all() as any[];
}

export async function moveToMainBoardFromExtension(id: number) {
  const db = getDb();
  const job = db.prepare('SELECT * FROM extension_jobs WHERE id = ?').get(id) as any;
  if (!job) return;

  db.prepare(`
    INSERT INTO jobs (company, title, location, description, url, vector, stage)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(job.company, job.title, job.location, job.description, job.url, job.vector, 'Queue');

  db.prepare('DELETE FROM extension_jobs WHERE id = ?').run(id);
}

export async function emptyMainBin() {
  const db = getDb();
  db.prepare('DELETE FROM jobs WHERE deleted_at IS NOT NULL').run();
}

export async function emptyScraperBin() {
  const db = getDb();
  db.prepare('DELETE FROM scraped_jobs WHERE deleted_at IS NOT NULL').run();
}

export async function emptyExtensionBin() {
  const db = getDb();
  db.prepare('DELETE FROM extension_jobs WHERE deleted_at IS NOT NULL').run();
}
