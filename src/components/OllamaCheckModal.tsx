'use client';

import { useState, useEffect } from 'react';
import { checkOllamaSetup } from '@/app/actions';
import { X, Server, Download, AlertTriangle, CheckCircle2 } from 'lucide-react';
import './OllamaCheckModal.css';

export default function OllamaCheckModal() {
  const [status, setStatus] = useState<{
    isRunning: boolean;
    hasEmbedding: boolean;
    hasLlm: boolean;
    models: string[];
  } | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (dismissed) return;
    
    const checkStatus = async () => {
      const result = await checkOllamaSetup();
      setStatus(result);
      if (!result.isRunning || !result.hasEmbedding || !result.hasLlm) {
        setIsOpen(true);
      }
    };
    
    checkStatus();
  }, [dismissed]);

  if (!isOpen || !status) return null;

  return (
    <div className="ollama-modal-overlay">
      <div className="ollama-modal glass-panel">
        <button className="close-btn" onClick={() => setIsOpen(false)}><X size={20} /></button>
        
        <div className="modal-header">
          <Server size={32} className={status.isRunning ? "status-icon running" : "status-icon error"} />
          <h2>Ollama Setup Required</h2>
        </div>
        
        <div className="modal-content">
          <p className="description">
            This application relies entirely on <strong>Ollama</strong> to process your data locally and securely. We noticed your setup is incomplete.
          </p>

          <div className="status-checks">
            <div className={`status-item ${status.isRunning ? 'passed' : 'failed'}`}>
              {status.isRunning ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
              <div className="status-text">
                <strong>1. Ollama Running</strong>
                {!status.isRunning && <span>You need to download and install Ollama from <a href="https://ollama.com" target="_blank" rel="noreferrer">ollama.com</a>. Ensure the app is open and running in your menubar/tray.</span>}
              </div>
            </div>

            <div className={`status-item ${status.hasEmbedding ? 'passed' : 'failed'}`}>
              {status.hasEmbedding ? <CheckCircle2 size={18} /> : <Download size={18} />}
              <div className="status-text">
                <strong>2. Embedding Model (For semantic search)</strong>
                {!status.hasEmbedding && <span>Open your terminal and run: <br/><code>ollama pull nomic-embed-text</code></span>}
              </div>
            </div>

            <div className={`status-item ${status.hasLlm ? 'passed' : 'failed'}`}>
              {status.hasLlm ? <CheckCircle2 size={18} /> : <Download size={18} />}
              <div className="status-text">
                <strong>3. LLM (For chat and analysis)</strong>
                {!status.hasLlm && <span>Open your terminal and run (recommendation): <br/><code>ollama pull llama3.2</code><br/><small>Other good options: <code>deepseek-r1</code>, <code>qwen2.5</code>, <code>mistral</code></small></span>}
              </div>
            </div>
          </div>

          <div className="modal-actions">
            <button className="primary-btn" onClick={() => {
              checkOllamaSetup().then(res => {
                setStatus(res);
                if (res.isRunning && res.hasEmbedding && res.hasLlm) {
                  setIsOpen(false);
                }
              });
            }}>
              Check Again
            </button>
            <button className="secondary-btn" onClick={() => {
              setIsOpen(false);
              setDismissed(true);
            }}>
              Dismiss for now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
