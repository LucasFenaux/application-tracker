import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { recalculateMatchScoreForJob } from '@/app/actions';

export async function GET() {
  const db = getDb();
  
  // Find all cleaned jobs
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
