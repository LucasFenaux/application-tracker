import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateEmbedding } from '@/lib/ml';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { title, company, location, url, description, source_website = 'Extension' } = data;
    
    if (!title || !company) {
      return NextResponse.json({ error: 'Missing title or company' }, { status: 400, headers: corsHeaders });
    }

    const db = getDb();
    
    // Generate vector embedding
    const vector = await generateEmbedding(`${title} - ${company}\n\n${description}`);

    db.prepare(`
      INSERT INTO extension_jobs (title, company, location, description, url, source_website, vector)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(title, company, location || null, description || '', url || '', source_website, JSON.stringify(vector));

    return NextResponse.json({ success: true }, { status: 200, headers: corsHeaders });
  } catch (error: any) {
    console.error('Failed to save extension job:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}
