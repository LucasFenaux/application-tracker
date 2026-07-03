import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateTextBuiltin, generateTextOllama } from '@/lib/ml';
import fs from 'fs';
import path from 'path';
import pdfParse from '@/lib/pdf';

export async function POST(request: Request) {
  try {
    const { message, context, materialIds } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const db = getDb();
    
    // Parse extra context materials
    let extraContextText = '';
    if (materialIds && Array.isArray(materialIds) && materialIds.length > 0) {
      for (const id of materialIds) {
        const material = db.prepare('SELECT name, filename FROM materials WHERE id = ?').get(id) as any;
        if (!material) continue;
        
        const filePath = path.join(process.cwd(), 'public/uploads', material.filename);
        if (!fs.existsSync(filePath)) continue;

        const buffer = fs.readFileSync(filePath);
        let text = '';
        if (material.filename.toLowerCase().endsWith('.pdf')) {
          try {
            const data = await pdfParse(buffer);
            text = data.text;
          } catch (err) {}
        } else {
          text = buffer.toString('utf-8');
          text = text.replace(/\\[a-zA-Z]+\{.*?\}/g, ' ').replace(/[{}]/g, ' ');
        }
        if (text) {
          extraContextText += `\n\n--- Additional Material Context: ${material.name} ---\n${text.slice(0, 3000)}`;
        }
      }
    }

    const providerSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('ai_provider') as any;
    const provider = providerSetting ? providerSetting.value : 'ollama';

    const prompt = `You are a helpful Page Assistant for the Application Tracker web app.
Below is the text content extracted from the current page the user is viewing.
Use this context to answer the user's question accurately.

--- Page Context ---
${context ? context.slice(0, 5000) : 'No page context provided.'}
-------------------
${extraContextText}

User Question: ${message}

Provide a concise, helpful, and direct answer. Format your response in Markdown.`;

    let responseText = '';

    if (provider === 'ollama') {
      try {
        responseText = await generateTextOllama(prompt);
        // Clean out any <think> blocks if present (from reasoning models)
        responseText = responseText.replace(/<think>[\s\S]*?<\/think>/, '').trim();
      } catch (err: any) {
        console.error('Ollama Error in Chat API:', err);
        return NextResponse.json(
          { error: 'Failed to communicate with local Ollama server. Make sure it is running.' }, 
          { status: 503 }
        );
      }
    } else {
      try {
        responseText = await generateTextBuiltin(prompt);
      } catch (err: any) {
        console.error('Built-in Model Error in Chat API:', err);
        return NextResponse.json(
          { error: 'Failed to generate response using the built-in model.' }, 
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ response: responseText });

  } catch (error: any) {
    console.error('Error in chat route:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
