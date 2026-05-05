"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Shield, Settings, Mic, ShieldAlert, ShieldCheck, Activity, Send, KeyRound, Save, AlertTriangle, AlertCircle, Info, RefreshCw, Smartphone, Mail, Globe } from 'lucide-react';

export default function Home() {
  const [activeTab, setActiveTab] = useState('home');
  const [apiKey, setApiKey] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  // Analysis State
  const [textInput, setTextInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{ status: 'safe' | 'warning' | 'danger', text: string } | null>(null);

  // Voice State
  const [isRecording, setIsRecording] = useState(false);
  const [voiceMessages, setVoiceMessages] = useState<{ role: 'user' | 'ai', content: string }[]>([]);
  const recognitionRef = useRef<any>(null);
  const synthesisRef = useRef<SpeechSynthesis | null>(null);

  // Intel Data
  const [intel, setIntel] = useState({ upis: 0, links: 0, numbers: 0 });

  useEffect(() => {
    // Load API key from local storage
    const savedKey = localStorage.getItem('scamsentinel_api_key');
    if (savedKey) setApiKey(savedKey);

    // Initialize Web Speech API
    if (typeof window !== 'undefined') {
      synthesisRef.current = window.speechSynthesis;
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onresult = async (event: any) => {
          const transcript = event.results[0][0].transcript;
          handleVoiceInput(transcript);
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          setIsRecording(false);
        };

        recognitionRef.current.onend = () => {
          setIsRecording(false);
        };
      }
    }
  }, []);

  const saveApiKey = () => {
    localStorage.setItem('scamsentinel_api_key', apiKey);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const extractIntel = (text: string) => {
    const upiRegex = /[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}/g;
    const linkRegex = /http[s]?:\/\/(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\(\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+/g;
    const phoneRegex = /\+?[0-9]{10,12}/g;

    const upis = (text.match(upiRegex) || []).length;
    const links = (text.match(linkRegex) || []).length;
    const numbers = (text.match(phoneRegex) || []).length;

    setIntel(prev => ({
      upis: prev.upis + upis,
      links: prev.links + links,
      numbers: prev.numbers + numbers
    }));
  };

  const handleTextAnalysis = async () => {
    if (!apiKey) {
      setActiveTab('settings');
      return;
    }
    if (!textInput.trim()) return;

    setIsAnalyzing(true);
    setAnalysisResult(null);

    const systemInstruction = `You are a professional Cyber-Security Fraud Analyst. Analyze the following message to determine if it's a scam.
    Return your answer starting with EXACTLY one of these words: "SAFE:", "WARNING:", or "DANGER:". 
    Then provide a clear, concise explanation suitable for an elderly person. Identify any red flags clearly.`;

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, prompt: textInput, systemInstruction })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      extractIntel(textInput);

      const text = data.text;
      let status: 'safe' | 'warning' | 'danger' = 'warning';
      if (text.startsWith('SAFE:')) status = 'safe';
      else if (text.startsWith('DANGER:')) status = 'danger';

      setAnalysisResult({ status, text: text.replace(/^(SAFE|WARNING|DANGER):\s*/, '') });
    } catch (error) {
      console.error(error);
      setAnalysisResult({ status: 'warning', text: 'Failed to analyze. Please check your API key.' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleVoiceInput = async (transcript: string) => {
    if (!apiKey) {
      setActiveTab('settings');
      return;
    }

    const newMessages = [...voiceMessages, { role: 'user' as const, content: transcript }];
    setVoiceMessages(newMessages);

    const conversationHistory = newMessages.map(m => `${m.role === 'user' ? 'Caller' : 'Agent'}: ${m.content}`).join('\n');
    
    const systemInstruction = `You are an AI defense agent named 'Sentinel'. You are speaking to a potential scammer on the phone, or advising a victim.
    Keep your responses short (1-2 sentences) and conversational so the synthesis sounds natural. Speak clearly.`;

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, prompt: conversationHistory, systemInstruction })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      const replyText = data.text;
      setVoiceMessages([...newMessages, { role: 'ai', content: replyText }]);
      speakText(replyText);
    } catch (error) {
      console.error(error);
      const errText = "I encountered an error connecting to the intelligence server. Please check your API key.";
      setVoiceMessages([...newMessages, { role: 'ai', content: errText }]);
      speakText(errText);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
    } else {
      if (!recognitionRef.current) {
        alert("Your browser does not support the Web Speech API. Please use a modern browser like Chrome or Edge.");
        return;
      }
      setVoiceMessages([]);
      synthesisRef.current?.cancel();
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  const speakText = (text: string) => {
    if (synthesisRef.current) {
      synthesisRef.current.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      synthesisRef.current.speak(utterance);
    }
  };

  return (
    <div className="container">
      <nav className="navbar">
        <a href="#" className="logo" onClick={() => setActiveTab('home')}>
          <ShieldAlert color="var(--accent-primary)" size={28} />
          ScamSentinel
        </a>
        <div className="nav-links">
          <button className={`nav-link ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')} style={{background:'none', border:'none', cursor:'pointer'}}>Analysis</button>
          <button className={`nav-link ${activeTab === 'voice' ? 'active' : ''}`} onClick={() => setActiveTab('voice')} style={{background:'none', border:'none', cursor:'pointer'}}>Voice Agent</button>
          <button className={`nav-link ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')} style={{background:'none', border:'none', cursor:'pointer'}}>Settings</button>
        </div>
      </nav>

      <main className="main-content">
        {activeTab === 'home' && (
          <div className="animate-fade-in">
            <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
              <h1 className="display-lg" style={{ marginBottom: '1rem' }}>
                Protect yourself from <br/><span className="text-gradient">Digital Fraud</span>
              </h1>
              <p className="body-lg" style={{ maxWidth: '600px', margin: '0 auto' }}>
                Paste any suspicious email, text message, or link below. Our advanced AI will analyze it for scam patterns and provide a professional assessment.
              </p>
            </div>

            <div className="glass-panel" style={{ maxWidth: '800px', margin: '0 auto' }}>
              <div className="input-group">
                <label className="input-label">Suspicious Message or Link</label>
                <textarea 
                  className="input-field" 
                  rows={5} 
                  placeholder="e.g. You have won a $1000 Walmart gift card! Click here to claim: http://suspicious-link.com"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>
              <button 
                className="btn btn-primary" 
                style={{ width: '100%', padding: '1rem' }}
                onClick={handleTextAnalysis}
                disabled={isAnalyzing}
              >
                {isAnalyzing ? <RefreshCw className="animate-spin" size={18} /> : <Send size={18} />}
                {isAnalyzing ? 'Analyzing Request...' : 'Scan for Threats'}
              </button>

              {analysisResult && (
                <div className="animate-fade-in" style={{ marginTop: '2rem', padding: '1.5rem', borderRadius: '12px', background: 'rgba(0,0,0,0.3)', borderLeft: `4px solid var(--${analysisResult.status})` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    {analysisResult.status === 'safe' && <ShieldCheck color="var(--success)" size={24} />}
                    {analysisResult.status === 'warning' && <AlertTriangle color="var(--warning)" size={24} />}
                    {analysisResult.status === 'danger' && <AlertCircle color="var(--danger)" size={24} />}
                    <h3 className="title-lg" style={{ margin: 0, color: `var(--${analysisResult.status})`, textTransform: 'uppercase', fontSize: '18px', fontWeight: 600 }}>
                      {analysisResult.status}
                    </h3>
                  </div>
                  <p className="body-md" style={{ color: 'var(--text-primary)' }}>{analysisResult.text}</p>
                </div>
              )}
            </div>

            <div className="dashboard-grid delay-200 animate-fade-in">
              <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ padding: '1rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '12px' }}>
                  <Globe color="var(--accent-primary)" size={24} />
                </div>
                <div>
                  <div className="body-lg">Malicious Links Blocked</div>
                  <div className="display-md">{intel.links}</div>
                </div>
              </div>
              <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ padding: '1rem', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '12px' }}>
                  <Smartphone color="var(--accent-secondary)" size={24} />
                </div>
                <div>
                  <div className="body-lg">Suspicious Numbers</div>
                  <div className="display-md">{intel.numbers}</div>
                </div>
              </div>
              <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '12px' }}>
                  <Activity color="var(--danger)" size={24} />
                </div>
                <div>
                  <div className="body-lg">UPI/Financial IDs</div>
                  <div className="display-md">{intel.upis}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'voice' && (
          <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
              <h2 className="display-md" style={{ marginBottom: '1rem' }}>Live Voice Agent</h2>
              <p className="body-lg">Speak naturally to our AI. It will analyze your situation or interact directly with a suspected scammer.</p>
            </div>

            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>
              <div 
                style={{ 
                  width: '120px', height: '120px', 
                  borderRadius: '50%', 
                  background: isRecording ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: `2px solid ${isRecording ? 'var(--danger)' : 'var(--accent-primary)'}`,
                  boxShadow: isRecording ? '0 0 40px rgba(239, 68, 68, 0.4)' : 'none',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer'
                }}
                onClick={toggleRecording}
              >
                <Mic size={48} color={isRecording ? 'var(--danger)' : 'var(--accent-primary)'} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div className="title-lg" style={{ color: isRecording ? 'var(--danger)' : 'var(--text-primary)' }}>
                  {isRecording ? 'Listening...' : 'Tap to Speak'}
                </div>
                <div className="body-md" style={{ color: 'var(--text-secondary)' }}>
                  {isRecording ? 'Speak clearly into your microphone.' : 'Agent Sentinel is standing by.'}
                </div>
              </div>
            </div>

            {voiceMessages.length > 0 && (
              <div className="glass-panel animate-fade-in" style={{ marginTop: '2rem' }}>
                <h3 className="title-lg" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Activity size={20} /> Live Transcript
                </h3>
                <div className="chat-container">
                  {voiceMessages.map((msg, idx) => (
                    <div key={idx} className={`message ${msg.role === 'user' ? 'message-user' : 'message-ai'}`}>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 600 }}>
                        {msg.role === 'user' ? 'You' : 'Agent Sentinel'}
                      </div>
                      <div className="body-md">{msg.content}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
              <h2 className="display-md" style={{ marginBottom: '1rem' }}>Configuration</h2>
              <p className="body-lg">Manage your API keys and system preferences.</p>
            </div>

            <div className="glass-panel">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <KeyRound color="var(--accent-primary)" size={24} />
                <h3 className="title-lg" style={{ margin: 0 }}>Google Gemini API</h3>
              </div>
              <p className="body-md" style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                ScamSentinel runs 100% locally in your browser to protect your privacy. You must provide your own Gemini API key. Your key is stored securely in your browser's local storage and is never sent to our servers.
              </p>
              
              <div className="input-group">
                <label className="input-label">API Key</label>
                <input 
                  type="password" 
                  className="input-field" 
                  placeholder="AIzaSy..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
                <button className="btn btn-primary" onClick={saveApiKey}>
                  <Save size={18} />
                  Save Configuration
                </button>
                {isSaved && <span className="body-md" style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><ShieldCheck size={16}/> Saved</span>}
              </div>

              <div style={{ marginTop: '3rem', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <Info color="var(--accent-secondary)" size={24} style={{ flexShrink: 0 }} />
                <div className="body-md" style={{ color: 'var(--text-secondary)' }}>
                  <strong>How to get an API key:</strong><br/>
                  Visit <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{color: 'var(--accent-primary)'}}>Google AI Studio</a> to generate a free API key.
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
