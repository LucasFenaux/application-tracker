'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User, Paperclip, Copy, Check } from 'lucide-react';
import { getAllMaterials } from '@/app/actions';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hi there! I can see the current page. How can I help you today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [materials, setMaterials] = useState<any[]>([]);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<number[]>([]);
  const [showMaterialSelector, setShowMaterialSelector] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleCopy = (content: string, idx: number) => {
    navigator.clipboard.writeText(content);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  useEffect(() => {
    if (isOpen && materials.length === 0) {
      getAllMaterials().then(m => setMaterials(m || []));
    }
  }, [isOpen, materials.length]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    // Extract context from the main content container
    const mainElement = document.querySelector('.main-content') as HTMLElement;
    const contextText = mainElement ? mainElement.innerText : 'No page context available.';

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, context: contextText, materialIds: selectedMaterialIds }),
      });

      if (!res.ok) {
        throw new Error('Failed to fetch response');
      }

      const data = await res.json();
      
      setMessages(prev => [
        ...prev, 
        { 
          role: 'assistant', 
          content: data.response || 'Sorry, I could not generate a response.' 
        }
      ]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [
        ...prev, 
        { role: 'assistant', content: 'Sorry, there was an error processing your request. Please ensure the local LLM is running.' }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="glass-panel"
        style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          display: isOpen ? 'none' : 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--accent-color)',
          cursor: 'pointer',
          zIndex: 9999,
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          border: '1px solid var(--surface-border)',
        }}
      >
        <MessageCircle size={32} />
      </button>

      {isOpen && (
        <div
          className="glass-panel"
          style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            width: '380px',
            height: '550px',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 9999,
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            border: '1px solid var(--surface-border)',
            background: '#0f172a',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem',
            borderBottom: '1px solid var(--surface-border)',
            background: 'rgba(0, 0, 0, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bot size={24} color="var(--accent-color)" />
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Page Assistant</h3>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              style={{ color: 'var(--text-secondary)' }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Messages Area */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            {messages.map((msg, idx) => (
              <div 
                key={idx} 
                style={{
                  display: 'flex',
                  gap: '12px',
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                }}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: msg.role === 'user' ? 'var(--accent-color)' : 'rgba(255,255,255,0.1)',
                  flexShrink: 0
                }}>
                  {msg.role === 'user' ? <User size={18} /> : <Bot size={18} />}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '80%', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div 
                    className={msg.role === 'assistant' ? 'markdown-content' : ''}
                    style={{
                    background: msg.role === 'user' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    padding: '12px',
                    borderRadius: '12px',
                    borderTopRightRadius: msg.role === 'user' ? 0 : '12px',
                    borderTopLeftRadius: msg.role === 'assistant' ? 0 : '12px',
                    border: '1px solid var(--surface-border)',
                    fontSize: '0.95rem',
                    lineHeight: '1.5',
                    wordBreak: 'break-word',
                    whiteSpace: msg.role === 'user' ? 'pre-wrap' : 'normal',
                    width: '100%'
                  }}>
                    {msg.role === 'user' ? (
                      msg.content
                    ) : (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    )}
                  </div>
                  
                  <button 
                    onClick={() => handleCopy(msg.content, idx)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.75rem',
                      padding: '2px 4px',
                      borderRadius: '4px',
                      opacity: 0.7
                    }}
                    title="Copy to clipboard"
                  >
                    {copiedIndex === idx ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                    {copiedIndex === idx ? <span style={{ color: '#10b981' }}>Copied</span> : <span>Copy</span>}
                  </button>
                </div>
              </div>
            ))}
            {isLoading && (
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.1)'
                }}>
                  <Bot size={18} />
                </div>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.05)', padding: '12px',
                  borderRadius: '12px', borderTopLeftRadius: 0,
                  border: '1px solid var(--surface-border)',
                  fontSize: '0.95rem'
                }}>
                  <span className="spin" style={{ display: 'inline-block' }}>⟳</span> Thinking...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Material Selector Popover */}
          {showMaterialSelector && (
            <div style={{
              padding: '10px',
              background: 'rgba(30, 41, 59, 0.95)',
              borderTop: '1px solid var(--surface-border)',
              borderBottom: '1px solid var(--surface-border)',
              maxHeight: '150px',
              overflowY: 'auto'
            }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Select Materials for Context:
              </div>
              {materials.length === 0 ? (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No materials found.</div>
              ) : (
                materials.map(mat => (
                  <label key={mat.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', marginBottom: '4px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={selectedMaterialIds.includes(mat.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedMaterialIds(prev => [...prev, mat.id]);
                        else setSelectedMaterialIds(prev => prev.filter(id => id !== mat.id));
                      }}
                    />
                    <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mat.name}</span>
                  </label>
                ))
              )}
            </div>
          )}

          {/* Input Area */}
          <form 
            onSubmit={handleSubmit}
            style={{
              padding: '1rem',
              borderTop: '1px solid var(--surface-border)',
              display: 'flex',
              gap: '8px',
              background: 'rgba(0, 0, 0, 0.2)',
              alignItems: 'center'
            }}
          >
            <button
              type="button"
              onClick={() => setShowMaterialSelector(!showMaterialSelector)}
              style={{
                padding: '8px',
                color: selectedMaterialIds.length > 0 ? 'var(--accent-color)' : 'var(--text-secondary)',
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '8px',
                border: selectedMaterialIds.length > 0 ? '1px solid var(--accent-color)' : '1px solid transparent'
              }}
              title="Attach materials"
            >
              <Paperclip size={18} />
              {selectedMaterialIds.length > 0 && (
                <span style={{ fontSize: '0.75rem', marginLeft: '4px' }}>{selectedMaterialIds.length}</span>
              )}
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  const form = e.currentTarget.closest('form');
                  if (form && input.trim() && !isLoading) {
                    form.requestSubmit();
                  }
                }
              }}
              placeholder="Ask a question about this page..."
              rows={1}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid var(--surface-border)',
                background: 'rgba(255, 255, 255, 0.05)',
                color: 'var(--text-primary)',
                fontSize: '0.95rem',
                outline: 'none',
                resize: 'none',
                minHeight: '42px',
                maxHeight: '120px',
                fontFamily: 'inherit',
                lineHeight: '1.5'
              }}
            />
            <button 
              type="submit"
              disabled={isLoading || !input.trim()}
              className="btn-primary"
              style={{ 
                padding: '10px',
                opacity: (isLoading || !input.trim()) ? 0.6 : 1,
                cursor: (isLoading || !input.trim()) ? 'not-allowed' : 'pointer'
              }}
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
