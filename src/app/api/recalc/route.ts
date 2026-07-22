import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { recalculateMatchScoreForJob } from '@/app/actions';
import { generateEmbedding } from '@/lib/ml';
import fs from 'fs';
import path from 'path';
import pdfParse from '@/lib/pdf';

export async function GET() {
  const db = getDb();
  
  // 1. Re-embed all materials
  const materials = db.prepare('SELECT id, filename, type FROM materials').all() as any[];
  for (const m of materials) {
    try {
      const filePath = path.join(process.cwd(), 'public/uploads', m.filename);
      if (!fs.existsSync(filePath)) continue;
      
      const buffer = fs.readFileSync(filePath);
      let cleanText = '';
      
      if (m.filename.toLowerCase().endsWith('.pdf')) {
        try {
          const data = await pdfParse(buffer);
          cleanText = data.text;
        } catch (err) {
          cleanText = '';
        }
      } else {
        const textContent = buffer.toString('utf-8');
        cleanText = textContent.replace(/\\[a-zA-Z]+\\{.*?\\}/g, ' ').replace(/[{}]/g, ' ');
      }
      
      cleanText = cleanText.slice(0, 4000);
      
      if (cleanText) {
        const vec = await generateEmbedding(cleanText);
        db.prepare('UPDATE materials SET vector = ? WHERE id = ?').run(JSON.stringify(vec), m.id);
      }
    } catch (err) {
      console.error('Failed to embed material', m.id, err);
    }
  }

  // 2. Recompute combined profile vector
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

  // 3. Recompute calibration curve if calibration_jobs exists
  const calibrationJobs = db.prepare("SELECT value FROM settings WHERE key = 'calibration_jobs'").get() as any;
  if (calibrationJobs && calibrationJobs.value && combinedProfileVector) {
    try {
      const { cosineSimilarity } = await import('@/lib/ml');
      const generated = JSON.parse(calibrationJobs.value);
      
      let badSum = 0, poorSum = 0, okaySum = 0, greatSum = 0;
      
      for (const category of ['Bad', 'Poor', 'Okay', 'Great']) {
        const jobs = generated[category] || [];
        for (const fakeJob of jobs) {
          const jobEmbedding = await generateEmbedding(fakeJob);
          let similarity = 0;
          if (jobEmbedding.length > 0) {
            similarity = cosineSimilarity(combinedProfileVector, jobEmbedding);
          }
          if (category === 'Bad') badSum += similarity;
          if (category === 'Poor') poorSum += similarity;
          if (category === 'Okay') okaySum += similarity;
          if (category === 'Great') greatSum += similarity;
        }
      }

      const curve = [
        { similarity: badSum / 3, expectedScore: 5 },
        { similarity: poorSum / 3, expectedScore: 25 },
        { similarity: okaySum / 3, expectedScore: 65 },
        { similarity: greatSum / 3, expectedScore: 95 }
      ];
      
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('calibration_curve', JSON.stringify(curve));
    } catch (err) {
      console.error('Failed to recompute calibration curve', err);
    }
  }

  // 4. Re-embed target_job_goal
  const targetJobGoal = db.prepare("SELECT value FROM settings WHERE key = 'target_job_goal'").get() as any;
  if (targetJobGoal && targetJobGoal.value) {
    try {
      const vec = await generateEmbedding(targetJobGoal.value);
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('target_job_goal_vector', ?)").run(JSON.stringify(vec));
    } catch (err) {
      console.error('Failed to embed target_job_goal', err);
    }
  }
  
  // 3. Find all cleaned jobs
  const jobs = db.prepare("SELECT id, title, company, description, 'job' as type FROM jobs WHERE original_job_data IS NOT NULL AND deleted_at IS NULL").all() as any[];
  const scraped = db.prepare("SELECT id, title, company, description, 'scraped' as type FROM scraped_jobs WHERE original_job_data IS NOT NULL AND deleted_at IS NULL").all() as any[];
  const extension = db.prepare("SELECT id, title, company, description, 'extension' as type FROM extension_jobs WHERE original_job_data IS NOT NULL AND deleted_at IS NULL").all() as any[];
  
  const allCleaned = [...jobs, ...scraped, ...extension];
  
  let count = 0;
  for (const item of allCleaned) {
    if (!item.title || !item.company) continue;
    
    let table = 'jobs';
    if (item.type === 'scraped') table = 'scraped_jobs';
    if (item.type === 'extension') table = 'extension_jobs';
    
    const text = `${item.title}\n${item.title}\n${item.title}\n${item.title} - ${item.company}\n\n${item.description || ''}`;
    
    // Recalculate
    await recalculateMatchScoreForJob(table, item.id, text);
    count++;
  }
  
  return NextResponse.json({ success: true, count, message: `Recalculated scores for ${count} jobs.` });
}
