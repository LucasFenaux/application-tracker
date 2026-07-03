import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const jobId = parseInt(resolvedParams.id);

  if (isNaN(jobId)) {
    return new NextResponse('Invalid Job ID', { status: 400 });
  }

  const db = getDb();
  
  // Get job details for filename
  const job = db.prepare('SELECT title, company FROM jobs WHERE id = ?').get(jobId) as any;
  if (!job) {
    return new NextResponse('Job not found', { status: 404 });
  }

  // Get materials
  const materials = db.prepare(`
    SELECT m.* FROM materials m
    JOIN job_materials jm ON m.id = jm.material_id
    WHERE jm.job_id = ?
  `).all(jobId) as any[];

  if (materials.length === 0) {
    return new NextResponse('No materials attached to this job', { status: 404 });
  }

  const zip = new AdmZip();
  let hasFiles = false;

  const uploadDir = path.join(process.cwd(), 'public/uploads');

  for (const material of materials) {
    const filePath = path.join(uploadDir, material.filename);
    if (fs.existsSync(filePath)) {
      // Add local file to zip with its original clean name, not the timestamped filename
      zip.addLocalFile(filePath, '', material.name);
      hasFiles = true;
    }
  }

  if (!hasFiles) {
    return new NextResponse('Materials files are missing from disk', { status: 404 });
  }

  const zipBuffer = zip.toBuffer();
  
  // Clean filename
  const safeTitle = job.title.replace(/[^a-zA-Z0-9]/g, '_');
  const safeCompany = job.company.replace(/[^a-zA-Z0-9]/g, '_');
  const zipFileName = `${safeTitle}_${safeCompany}_Materials.zip`;

  const headers = new Headers();
  headers.set('Content-Type', 'application/zip');
  headers.set('Content-Disposition', `attachment; filename="${zipFileName}"`);

  return new NextResponse(zipBuffer, {
    status: 200,
    headers,
  });
}
