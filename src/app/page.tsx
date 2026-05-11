"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Shield, Mic, ShieldCheck, Activity, Send,
  KeyRound, Save, AlertTriangle, AlertCircle,
  Info, Loader2, Smartphone, Globe, Zap
} from 'lucide-react';

export default function Home() {
  const [activeTab, setActiveTab] = useState('home');
  const [apiKey, setApiKey] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  // Analysis State
  const [textInput, setTextInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    status: 'safe' | 'warning' | 'danger';
    text: string;
  } | null>(null);

  // Voice State
  const [isRecording, setIsRecording] = useState(false);
  const [voiceMessages, setVoiceMessages] = useState<
    { role: 'user' | 'ai'; content: string }[]
  >([]);
  const recognitionRef = useRef<any>(null);
  const synthesisRef = useRef<SpeechSynthesis | null>(null);

  // Intel Data
  const [intel, setIntel] = useState({ upis: 0, links: 0, numbers: 0 });

  useEffect(() => {
    const savedKey = localStorage.getItem('guardiannode_api_key');
    if (savedKey) setApiKey(savedKey);

    if (typeof window !== 'undefined') {
      synthesisRef.current = window.speechSynthesis;
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveApiKey = () => {
    localStorage.setItem('guardiannode_api_key', apiKey);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const extractIntel = (text: string) => {
    const upiRegex = /[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}/g;
    const linkRegex =
      /http[s]?:\/\/(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*(),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+/g;
    const phoneRegex = /\+?[0-9]{10,12}/g;

    const upis = (text.match(upiRegex) || []).length;
    const links = (text.match(linkRegex) || []).length;
    const numbers = (text.match(phoneRegex) || []).length;

    setIntel((prev) => ({
      upis: prev.upis + upis,
      links: prev.links + links,
      numbers: prev.numbers + numbers,
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

    const systemInstruction = `You are a professional Cyber-Security Fraud Analyst working for GuardianNode AI. Analyze the following message to determine if it's a scam.
    Return your answer starting with EXACTLY one of these words: "SAFE:", "WARNING:", or "DANGER:".
    Then provide a clear, concise explanation suitable for an elderly person. Identify any red flags clearly. Be helpful and reassuring.`;

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, prompt: textInput, systemInstruction }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      extractIntel(textInput);

      const text = data.text;
      let status: 'safe' | 'warning' | 'danger' = 'warning';
      if (text.startsWith('SAFE:')) status = 'safe';
      else if (text.startsWith('DANGER:')) status = 'danger';

      setAnalysisResult({
        status,
        text: text.replace(/^(SAFE|WARNING|DANGER):\s*/, ''),
      });
    } catch (error) {
      console.error(error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to analyze. Please check your API key.';
      setAnalysisResult({ status: 'warning', text: errorMessage });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleVoiceInput = useCallback(
    async (transcript: string) => {
      if (!apiKey) {
        setActiveTab('settings');
        return;
      }

      const newMessages: { role: 'user' | 'ai'; content: string }[] = [
        ...voiceMessages,
        { role: 'user', content: transcript },
      ];
      setVoiceMessages(newMessages);

      const conversationHistory = newMessages
        .map((m) => `${m.role === 'user' ? 'Caller' : 'Agent'}: ${m.content}`)
        .join('\n');

      const systemInstruction = `You are an AI defense agent named 'Guardian'. You are speaking to a potential scammer on the phone, or advising a victim.
    Keep your responses short (1-2 sentences) and conversational so the synthesis sounds natural. Speak clearly.`;

      try {
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey,
            prompt: conversationHistory,
            systemInstruction,
          }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error);

        const replyText = data.text;
        setVoiceMessages([...newMessages, { role: 'ai', content: replyText }]);
        speakText(replyText);
      } catch (error) {
        console.error(error);
        const errText =
          error instanceof Error
            ? error.message
            : 'I encountered an error connecting to the intelligence server. Please check your API key.';
        setVoiceMessages([...newMessages, { role: 'ai', content: errText }]);
        speakText(errText);
      }
    },
    [apiKey, voiceMessages]
  );

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
    } else {
      if (!recognitionRef.current) {
        alert(
          'Your browser does not support the Web Speech API. Please use a modern browser like Chrome or Edge.'
        );
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleTextAnalysis();
    }
  };

  return (
    <div className="container">
      {/* Navigation */}
      <nav className="navbar">
        <a
          href="#"
          className="logo"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('home');
          }}
        >
          <Shield
            size={22}
            style={{ color: 'var(--accent-primary)' }}
          />
          GuardianNode AI
        </a>
        <div className="nav-links">
          <button
            className={`nav-link ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => setActiveTab('home')}
          >
            Analysis
          </button>
          <button
            className={`nav-link ${activeTab === 'voice' ? 'active' : ''}`}
            onClick={() => setActiveTab('voice')}
          >
            Voice Agent
          </button>
          <button
            className={`nav-link ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            Settings
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="main-content">
        {/* ─── ANALYSIS TAB ─── */}
        {activeTab === 'home' && (
          <div className="animate-fade-in">
            <div className="hero">
              <h1 className="display-lg">
                Protect yourself from
                <br />
                <span className="text-gradient">Digital Fraud</span>
              </h1>
              <p className="body-lg hero-subtitle">
                Paste any suspicious email, SMS, or link below. Our AI will
                analyze it for scam patterns and provide a professional
                threat assessment.
              </p>
            </div>

            <div
              className="glass-panel no-lift"
              style={{ maxWidth: '780px', margin: '0 auto' }}
            >
              <div className="input-group">
                <label className="input-label">
                  Suspicious Message or Link
                </label>
                <textarea
                  className="input-field"
                  rows={5}
                  placeholder='e.g., "You have won a $1000 Walmart gift card! Click here to claim: http://suspicious-link.com"'
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              </div>
              <button
                className="btn btn-primary"
                style={{ width: '100%', padding: '0.875rem' }}
                onClick={handleTextAnalysis}
                disabled={isAnalyzing || !textInput.trim()}
              >
                {isAnalyzing ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <Send size={18} />
                )}
                {isAnalyzing ? 'Analyzing…' : 'Scan for Threats'}
              </button>

              {analysisResult && (
                <div className={`result-card ${analysisResult.status}`}>
                  <div className="result-header">
                    <span className={`result-badge ${analysisResult.status}`}>
                      {analysisResult.status === 'safe' && (
                        <ShieldCheck size={14} />
                      )}
                      {analysisResult.status === 'warning' && (
                        <AlertTriangle size={14} />
                      )}
                      {analysisResult.status === 'danger' && (
                        <AlertCircle size={14} />
                      )}
                      {analysisResult.status}
                    </span>
                  </div>
                  <p className="body-md" style={{ color: 'var(--text-primary)', lineHeight: 1.7 }}>
                    {analysisResult.text}
                  </p>
                </div>
              )}
            </div>

            {/* Stats Grid */}
            <div
              className="dashboard-grid stagger"
              style={{ maxWidth: '780px', margin: '2.5rem auto 0' }}
            >
              <div className="glass-panel">
                <div className="stat-card">
                  <div className="stat-icon blue">
                    <Globe size={22} />
                  </div>
                  <div>
                    <div className="stat-label">Links Flagged</div>
                    <div className="stat-value">{intel.links}</div>
                  </div>
                </div>
              </div>
              <div className="glass-panel">
                <div className="stat-card">
                  <div className="stat-icon purple">
                    <Smartphone size={22} />
                  </div>
                  <div>
                    <div className="stat-label">Suspicious Numbers</div>
                    <div className="stat-value">{intel.numbers}</div>
                  </div>
                </div>
              </div>
              <div className="glass-panel">
                <div className="stat-card">
                  <div className="stat-icon red">
                    <Zap size={22} />
                  </div>
                  <div>
                    <div className="stat-label">UPI / Financial IDs</div>
                    <div className="stat-value">{intel.upis}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── VOICE AGENT TAB ─── */}
        {activeTab === 'voice' && (
          <div
            className="animate-fade-in"
            style={{ maxWidth: '780px', margin: '0 auto' }}
          >
            <div className="hero">
              <h2 className="display-md">Live Voice Agent</h2>
              <p className="body-lg hero-subtitle">
                Speak naturally to our AI. It will analyze your situation
                or interact directly with a suspected scammer.
              </p>
            </div>

            <div
              className="glass-panel no-lift"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1.5rem',
              }}
            >
              <div
                className={`mic-button ${isRecording ? 'recording' : ''}`}
                onClick={toggleRecording}
                role="button"
                tabIndex={0}
                aria-label={isRecording ? 'Stop recording' : 'Start recording'}
              >
                <Mic
                  size={36}
                  color={
                    isRecording ? 'var(--danger)' : 'var(--accent-primary)'
                  }
                />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div
                  className="title-lg"
                  style={{
                    color: isRecording
                      ? 'var(--danger)'
                      : 'var(--text-primary)',
                    marginBottom: '0.25rem',
                  }}
                >
                  {isRecording ? 'Listening…' : 'Tap to Speak'}
                </div>
                <div className="body-md">
                  {isRecording
                    ? 'Speak clearly into your microphone.'
                    : 'Agent Guardian is standing by.'}
                </div>
              </div>
            </div>

            {voiceMessages.length > 0 && (
              <div
                className="glass-panel no-lift animate-fade-in"
                style={{ marginTop: '1.5rem' }}
              >
                <h3
                  className="title-lg"
                  style={{
                    marginBottom: '1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <Activity size={18} /> Live Transcript
                </h3>
                <div className="chat-container">
                  {voiceMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`message ${
                        msg.role === 'user' ? 'message-user' : 'message-ai'
                      }`}
                    >
                      <div className="message-role">
                        {msg.role === 'user' ? 'You' : 'Agent Guardian'}
                      </div>
                      <div className="body-md" style={{ color: 'var(--text-primary)' }}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── SETTINGS TAB ─── */}
        {activeTab === 'settings' && (
          <div
            className="animate-fade-in"
            style={{ maxWidth: '580px', margin: '0 auto' }}
          >
            <div className="hero">
              <h2 className="display-md">Configuration</h2>
              <p className="body-lg hero-subtitle">
                Manage your API key and system preferences.
              </p>
            </div>

            <div className="glass-panel no-lift">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  marginBottom: '1rem',
                }}
              >
                <KeyRound
                  size={22}
                  style={{ color: 'var(--accent-primary)' }}
                />
                <h3 className="title-lg" style={{ margin: 0 }}>
                  Google Gemini API
                </h3>
              </div>
              <p
                className="body-md"
                style={{ marginBottom: '1.5rem' }}
              >
                GuardianNode AI runs 100% locally in your browser to protect
                your privacy. You must provide your own Gemini API key. Your
                key is stored securely in your browser&apos;s local storage
                and is never sent to our servers.
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

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  marginTop: '0.5rem',
                }}
              >
                <button className="btn btn-primary" onClick={saveApiKey}>
                  <Save size={16} />
                  Save Configuration
                </button>
                {isSaved && (
                  <span className="save-feedback">
                    <ShieldCheck size={15} /> Saved
                  </span>
                )}
              </div>

              <div className="info-box">
                <Info
                  size={20}
                  style={{
                    color: 'var(--accent-secondary)',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                />
                <div className="body-md">
                  <strong>How to get an API key:</strong>
                  <br />
                  Visit{' '}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Google AI Studio
                  </a>{' '}
                  to generate a free API key. GuardianNode AI uses the{' '}
                  <strong>Gemini 2.5 Flash</strong> model.
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
