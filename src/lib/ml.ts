import { pipeline, env } from '@xenova/transformers';

// Try to use CoreML for Apple Silicon GPU acceleration, fallback to CPU
env.backends.onnx.executionProviders = ['coreml', 'cpu'];

class PipelineSingleton {
  static task = 'feature-extraction';
  static model = 'Xenova/bge-large-en-v1.5';
  static instance: any = null;

  static async getInstance(progress_callback?: Function) {
    if (this.instance === null) {
      this.instance = pipeline(this.task as any, this.model, { progress_callback });
    }
    return this.instance;
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim() === '') return [];
  try {
    const embedder = await PipelineSingleton.getInstance();
    const output = await embedder(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  } catch (err) {
    console.error('Error generating embedding:', err);
    return [];
  }
}

class TextGenerationPipeline {
  static task = 'text-generation';
  static model = 'Xenova/TinyLlama-1.1B-Chat-v1.0';
  static instance: any = null;

  static async getInstance(progress_callback?: Function) {
    if (this.instance === null) {
      this.instance = pipeline(this.task as any, this.model, { 
        progress_callback,
        // Quantized models take less RAM
        dtype: 'q4' 
      } as any);
    }
    return this.instance;
  }
}

export async function generateTextBuiltin(prompt: string): Promise<string> {
  try {
    const generator = await TextGenerationPipeline.getInstance();
    const output = await generator(prompt, { 
      max_new_tokens: 400,
      temperature: 0.7,
      do_sample: true,
      return_full_text: false 
    });
    return output[0].generated_text.trim();
  } catch (err) {
    console.error('Error in built-in generation:', err);
    throw new Error('Failed to generate suggestions using built-in model.');
  }
}

export async function generateTextOllama(prompt: string): Promise<string> {
  try {
    const { getDb } = await import('@/lib/db');
    const db = getDb();
    const modelSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('ai_ollama_model') as { value: string };
    const modelName = modelSetting ? modelSetting.value : 'deepseek-r1';

    const response = await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        prompt: prompt,
        stream: false
      }),
      signal: AbortSignal.timeout(60000) // 60s timeout for reasoning models
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('OLLAMA_MODEL_NOT_FOUND');
      }
      throw new Error(`Ollama responded with status: ${response.status}`);
    }

    const data = await response.json();
    return data.response.trim();
  } catch (err: any) {
    if (err.name === 'TypeError' || err.message.includes('fetch') || err.message.includes('ECONNREFUSED')) {
      throw new Error('OLLAMA_NOT_RUNNING');
    }
    console.error('Error connecting to Ollama:', err);
    throw err;
  }
}

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0 || vecA.length !== vecB.length) {
    return 0;
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function calculateMatchScore(similarity: number, mode: string, calibrationCurve: any[], minSim: number, maxSim: number): number {
  if (mode === 'smart' && calibrationCurve && calibrationCurve.length >= 2) {
    let matchScore = 0;
    if (similarity <= calibrationCurve[0].similarity) {
      const p1 = calibrationCurve[0];
      const p2 = calibrationCurve[1];
      const ratio = (similarity - p1.similarity) / (p2.similarity - p1.similarity);
      matchScore = p1.expectedScore + ratio * (p2.expectedScore - p1.expectedScore);
    } else if (similarity >= calibrationCurve[calibrationCurve.length - 1].similarity) {
      const p1 = calibrationCurve[calibrationCurve.length - 2];
      const p2 = calibrationCurve[calibrationCurve.length - 1];
      const ratio = (similarity - p1.similarity) / (p2.similarity - p1.similarity);
      matchScore = p1.expectedScore + ratio * (p2.expectedScore - p1.expectedScore);
    } else {
      for (let i = 0; i < calibrationCurve.length - 1; i++) {
        if (similarity >= calibrationCurve[i].similarity && similarity <= calibrationCurve[i+1].similarity) {
          const p1 = calibrationCurve[i];
          const p2 = calibrationCurve[i+1];
          const ratio = (similarity - p1.similarity) / (p2.similarity - p1.similarity);
          matchScore = p1.expectedScore + ratio * (p2.expectedScore - p1.expectedScore);
          break;
        }
      }
    }
    return Math.max(0, Math.min(100, Math.round(matchScore)));
  } else {
    let normalized = (similarity - minSim) / (maxSim - minSim);
    normalized = Math.pow(Math.max(0, Math.min(1, normalized)), 1.5);
    return Math.max(0, Math.min(100, Math.round(normalized * 100)));
  }
}
