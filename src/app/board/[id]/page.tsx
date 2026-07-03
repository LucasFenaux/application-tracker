import { getDb } from '@/lib/db';
import { getJobMaterials, getAllMaterials } from '@/app/actions';
import JobDetailsClient from './JobDetailsClient';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function JobDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const db = getDb();
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(resolvedParams.id);
  
  if (!job) {
    notFound();
  }

  const jobMaterials = await getJobMaterials(Number(resolvedParams.id));
  const allMaterials = await getAllMaterials();

  const aiModelSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('ai_ollama_model') as { value: string };
  const aiOllamaModel = aiModelSetting ? aiModelSetting.value : 'deepseek-r1';

  return (
    <JobDetailsClient 
      job={job} 
      jobMaterials={jobMaterials} 
      allMaterials={allMaterials} 
      aiOllamaModel={aiOllamaModel}
    />
  );
}
