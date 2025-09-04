import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GeminiService from '../services/geminiService';
import { LoadingSpinner } from './common/LoadingSpinner';
import { BookIcon } from './icons/BookIcon';
import { useAppContext } from '../contexts/AppContext';
import useLocalStorage from '../hooks/useLocalStorage';
import { TopicExplainerConfig, TopicExplainerSession } from '../types';
import { HistoryIcon } from './icons/HistoryIcon';
import { CloseIcon } from './icons/CloseIcon';
import Marquee from './common/Marquee';
import MarkdownRenderer from './common/MarkdownRenderer';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';

const SESSIONS_KEY = 'easyway-tutor-topic-explainer-sessions';

const SUGGESTED_TOPICS = [
    "DPSP vs Fundamental Rights", "Monetary Policy Committee (MPC)", "Panchayati Raj System",
    "Indus Valley Civilization", "The Revolt of 1857", "El Niño and La Niña",
    "Basic Structure Doctrine", "Parliamentary vs Presidential System", "Goods and Services Tax (GST)",
    "Non-Cooperation Movement", "Functions of the RBI", "India's Nuclear Doctrine",
    "The Partition of India", "Green Revolution in India", "Major Ports of India",
    "Climate Change and India's Role", "Judicial Review in India", "Anti-Defection Law",
    "National Emergency Provisions", "Make in India Initiative", "Buddhism and Jainism",
    "The Mughal Empire", "India's Foreign Policy", "Insolvency and Bankruptcy Code", "Election Commission of India",
];

const topics1 = SUGGESTED_TOPICS.slice(0, 9);
const topics2 = SUGGESTED_TOPICS.slice(9, 17);
const topics3 = SUGGESTED_TOPICS.slice(17);

const TopicExplainer: React.FC = () => {
  const [sessions, setSessions] = useLocalStorage<TopicExplainerSession[]>(SESSIONS_KEY, []);
  const [activeSession, setActiveSession] = useState<TopicExplainerSession | null>(null);
  const { user, signInWithGoogle } = useAuth();
  const { explainerPrefillTopic, setExplainerPrefillTopic } = useAppContext();

  const [topic, setTopic] = useState('');
  const [topicToConfirm, setTopicToConfirm] = useState<string | null>(null);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [isHistoryVisible, setIsHistoryVisible] = useState(false);
  const [config, setConfig] = useState<TopicExplainerConfig>({
      depth: 'Intermediate',
      format: 'Detailed Paragraphs',
      focus: ''
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const handleCopy = useCallback(async () => {
    try {
      const text = activeSession?.explanation || '';
      if (!text) return;
      await navigator.clipboard.writeText(text);
      alert('Copied to clipboard');
    } catch (e) {
      alert('Copy failed');
    }
  }, [activeSession]);

  const handleExportMarkdown = useCallback(() => {
    const text = activeSession?.explanation || '';
    if (!text) return;
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeTopic = (activeSession?.topic || 'topic-explainer').replace(/[^a-z0-9-_]+/gi, '-').toLowerCase();
    a.download = `${safeTopic}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [activeSession]);
  
  const geminiService = useMemo(() => new GeminiService(), []);

  // Prefill topic from Dashboard CTA
  useEffect(() => {
    if (explainerPrefillTopic) {
      setTopic(explainerPrefillTopic);
      setTopicToConfirm(explainerPrefillTopic);
      setActiveSession(null);
      setIsHistoryVisible(false);
      setExplainerPrefillTopic(null);
    }
  }, [explainerPrefillTopic, setExplainerPrefillTopic]);

  const handleSelectTopic = (selectedTopic: string) => {
    if (selectedTopic.trim() === '') return;
    setTopic(selectedTopic);
    setActiveSession(null);
    setTopicToConfirm(selectedTopic);
    setIsHistoryVisible(false); // Close history on new topic selection
  };

  const handleSaveToNotes = async () => {
    if (!activeSession) return;
    if (!user) {
      await signInWithGoogle();
      return;
    }
    const defaultTitle = activeSession.topic || 'Explainer Note';
    const title = window.prompt('Save note title:', defaultTitle) || defaultTitle;
    const { error } = await supabase.from('notes').insert({
      user_id: user.id,
      title,
      content: activeSession.explanation,
      source: 'explainer',
    });
    if (error) {
      alert('Failed to save note: ' + error.message);
    } else {
      alert('Saved to Notes');
    }
  };

  const handleConfirm = () => {
      setTopicToConfirm(null);
      setIsFormVisible(true);
  };

  const handleGenerate = useCallback(async () => {
    setIsFormVisible(false);
    setIsLoading(true);
    setError(null);

    try {
      const result = await geminiService.explainTopic(topic, config);
      const newSession: TopicExplainerSession = {
        id: `session-${Date.now()}`,
        topic,
        config,
        explanation: result,
        timestamp: Date.now(),
      };
      setSessions(prev => [newSession, ...prev].slice(0, 20));
      setActiveSession(newSession);
    } catch (err) {
      setError('Failed to fetch explanation. Please check your API key and try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [geminiService, topic, config, setSessions]);

  const handleHistoryClick = (session: TopicExplainerSession) => {
    setTopic(session.topic);
    setConfig(session.config);
    setActiveSession(session);
    setTopicToConfirm(null);
    setIsFormVisible(false);
    setIsHistoryVisible(false);
  };
  
  const closeOutputPanel = () => {
      setActiveSession(null);
      setTopicToConfirm(null);
      setIsFormVisible(false);
      setError(null);
  };

  const renderPanelContent = () => {
    if (isLoading) {
      return <div><div className="flex justify-center items-center gap-3"><LoadingSpinner /><p>Generating explanation for "{topic}"...</p></div></div>;
    }
    if (error) {
       return <div><p className="text-red-400 text-center">{error}</p></div>;
    }
    if (activeSession) {
       return <MarkdownRenderer content={activeSession.explanation} />;
    }
    if (topicToConfirm) {
        return (
            <div>
                <h3 className="text-xl font-semibold text-center mb-4">Confirm Topic</h3>
                <p className="text-center text-[rgb(var(--color-text-secondary))] mb-6">Generate an explanation for "{topicToConfirm}"?</p>
                <div className="flex justify-center gap-4">
                    <button onClick={() => setTopicToConfirm(null)} className="px-6 py-2 bg-[rgb(var(--color-input))] rounded-lg hover:bg-slate-700">Cancel</button>
                    <button onClick={handleConfirm} className="px-6 py-2 bg-[rgb(var(--color-primary))] text-white rounded-lg hover:bg-[rgb(var(--color-primary-hover))]">Confirm</button>
                </div>
            </div>
        );
    }
    if (isFormVisible) {
        const formInputStyle = "w-full bg-[rgb(var(--color-input))] border border-[rgb(var(--color-border))] rounded-lg p-2 text-[rgb(var(--color-text-primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--color-background-start))] focus-visible:ring-[rgb(var(--color-primary))]";
        return (
            <div>
                <h3 className="text-xl font-semibold mb-2">Refine Explanation</h3>
                <p className="text-sm text-[rgb(var(--color-text-secondary))] mb-6">Topic: <span className="font-bold text-slate-300">{topic}</span></p>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-[rgb(var(--color-text-secondary))] mb-1">Depth</label>
                        <select value={config.depth} onChange={e => setConfig(c => ({...c, depth: e.target.value as TopicExplainerConfig['depth']}))} className={formInputStyle}>
                            <option>Beginner</option><option>Intermediate</option><option>Expert</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[rgb(var(--color-text-secondary))] mb-1">Format</label>
                        <select value={config.format} onChange={e => setConfig(c => ({...c, format: e.target.value as TopicExplainerConfig['format']}))} className={formInputStyle}>
                            <option>Detailed Paragraphs</option><option>Bullet Points</option><option>Q&A Format</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[rgb(var(--color-text-secondary))] mb-1">Specific Focus (optional)</label>
                        <input type="text" value={config.focus} onChange={e => setConfig(c => ({...c, focus: e.target.value}))} placeholder="e.g., Economic Impact, Constitutional Articles" className={formInputStyle} />
                    </div>
                    <div className="flex justify-end gap-4 pt-2">
                        <button onClick={() => setIsFormVisible(false)} className="px-6 py-2 bg-[rgb(var(--color-input))] rounded-lg hover:bg-slate-700">Cancel</button>
                        <button onClick={handleGenerate} className="px-6 py-2 bg-[rgb(var(--color-primary))] text-white rounded-lg hover:bg-[rgb(var(--color-primary-hover))]">Generate</button>
                    </div>
                </div>
            </div>
        );
    }
    return null;
  };

  const renderTopicButton = (topic: string) => (
    <button
      key={topic}
      onClick={() => handleSelectTopic(topic)}
      disabled={isLoading || isFormVisible || !!topicToConfirm}
      className="mx-4 px-5 py-2 whitespace-nowrap bg-[rgb(var(--color-input))] text-[rgb(var(--color-text-secondary))] rounded-full text-sm hover:bg-[rgb(var(--color-primary))] hover:text-white transition-colors disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed"
    >
      {topic}
    </button>
  );
  
  const isOutputVisible = isLoading || !!error || !!activeSession || !!topicToConfirm || isFormVisible;

  return (
    <div className="h-full w-full flex flex-col items-center justify-start pt-16 relative">
      {/* Main Content */}
      <motion.div 
        key="main-content-area"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-20 w-full max-w-3xl px-4 text-center"
      >
        <h1 className="text-3xl font-bold mb-1">Topic Explainer</h1>
        <p className="text-base text-[rgb(var(--color-text-secondary))] mb-6">Dive deep into any ALL GOV topic.</p>
        <div className="flex items-center gap-2">
            <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., 'Indian President'"
                className="w-full bg-[rgb(var(--color-input))] border border-[rgb(var(--color-border))] rounded-lg p-2.5 text-base text-[rgb(var(--color-text-primary))] placeholder-[rgb(var(--color-text-secondary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-primary))]"
                disabled={isLoading || isFormVisible || !!topicToConfirm}
                onKeyDown={(e) => e.key === 'Enter' && handleSelectTopic(topic)}
            />
            <button
                onClick={() => handleSelectTopic(topic)}
                disabled={isLoading || topic.trim() === '' || isFormVisible || !!topicToConfirm}
                className="px-4 py-2.5 bg-[rgb(var(--color-primary))] text-white font-semibold rounded-lg hover:bg-[rgb(var(--color-primary-hover))] disabled:bg-slate-600 disabled:cursor-not-allowed text-base"
            >
                Explain
            </button>
        </div>
      </motion.div>

      {/* Marquee Topics */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="relative z-10 w-full mt-10 space-y-4"
      >
        <Marquee speed={40} direction="left">
          {topics1.map(renderTopicButton)}
        </Marquee>
        <Marquee speed={45} direction="right">
          {topics2.map(renderTopicButton)}
        </Marquee>
        <Marquee speed={40} direction="left">
          {topics3.map(renderTopicButton)}
        </Marquee>
      </motion.div>

      {/* History Button */}
      <button 
        onClick={() => setIsHistoryVisible(true)}
        className="absolute top-6 right-6 z-30 p-3 rounded-full bg-[rgb(var(--color-card))]/50 hover:bg-[rgb(var(--color-card))] transition-colors"
        aria-label="View History"
      >
        <HistoryIcon />
      </button>

      {/* History Panel */}
      <AnimatePresence>
        {isHistoryVisible && (
            <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="absolute top-0 right-0 bottom-0 w-full max-w-md bg-[rgb(var(--color-sidebar))] z-50 border-l border-[rgb(var(--color-border))] shadow-2xl flex flex-col"
            >
                <div className="flex justify-between items-center p-4 border-b border-[rgb(var(--color-border))] flex-shrink-0">
                    <h2 className="text-xl font-bold">History</h2>
                    <button onClick={() => setIsHistoryVisible(false)} className="p-2 rounded-full hover:bg-[rgb(var(--color-input))]">
                        <CloseIcon />
                    </button>
                </div>
                <div className="flex-1 p-4 space-y-2 overflow-y-auto">
                    {sessions.length > 0 ? sessions.map(s => (
                        <div key={s.id} onClick={() => handleHistoryClick(s)} className={`p-3 rounded-md cursor-pointer transition-colors ${activeSession?.id === s.id ? 'bg-slate-700' : 'bg-slate-800 hover:bg-slate-700'}`}>
                            <p className="font-semibold truncate">{s.topic}</p>
                            <p className="text-xs text-[rgb(var(--color-text-secondary))]">{new Date(s.timestamp).toLocaleString()}</p>
                        </div>
                    )) : (
                        <div className="text-center text-sm text-[rgb(var(--color-text-secondary))] pt-8">
                            <BookIcon className="w-8 h-8 mx-auto mb-2" />
                            <p>No history yet.</p>
                        </div>
                    )}
                </div>
            </motion.div>
        )}
      </AnimatePresence>
      
      {/* Inline Output Section */}
      {isOutputVisible && (
        <div className={`relative z-20 w-full ${isFullscreen ? 'max-w-none px-0' : 'max-w-4xl px-4'} mt-8`}>
          <div className={`${isFullscreen ? 'fixed inset-0 z-40 p-4 md:p-8' : ''}`}>
            <div className={`p-4 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-card))]/70 backdrop-blur ${isFullscreen ? 'h-full max-h-none shadow-2xl' : ''}`}>
              <div className={`sticky top-0 z-10 -mx-4 px-4 py-2.5 mb-2 flex items-center justify-between border-b border-[rgb(var(--color-border))] bg-[rgb(var(--color-card))]/80 backdrop-blur rounded-t-xl`}>
                <h3 className="text-base font-semibold">Result</h3>
                <div className="flex items-center gap-2">
                  {activeSession && (
                    <>
                      <button onClick={handleCopy} className="px-3 py-1.5 text-xs rounded-md bg-[rgb(var(--color-input))] hover:bg-slate-600">Copy</button>
                      <button onClick={handleExportMarkdown} className="px-3 py-1.5 text-xs rounded-md bg-[rgb(var(--color-input))] hover:bg-slate-600">Export MD</button>
                      <button onClick={handleSaveToNotes} className="px-3 py-1.5 text-xs rounded-md bg-[rgb(var(--color-primary))] text-white">Save to Notes</button>
                    </>
                  )}
                  <button onClick={() => setIsFullscreen(f => !f)} className="px-3 py-1.5 text-xs rounded-md bg-[rgb(var(--color-input))]">
                    {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                  </button>
                  <button onClick={closeOutputPanel} className="px-3 py-1.5 text-xs rounded-md bg-[rgb(var(--color-input))]">Close</button>
                </div>
              </div>
              <div
                ref={scrollAreaRef}
                className={`${isFullscreen ? 'h-[calc(100%-56px)]' : ''} max-h-[72vh] md:max-h-[78vh] overflow-y-auto pr-2 overscroll-contain`}
                onScroll={(e) => {
                  const target = e.currentTarget;
                  setShowScrollTop(target.scrollTop > 200);
                  setShowScrollDown(target.scrollHeight - target.scrollTop - target.clientHeight > 200);
                }}
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeSession?.id || (topicToConfirm ? `confirm-${topicToConfirm}` : (isFormVisible ? 'form' : (isLoading ? 'loading' : 'error')))}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    {renderPanelContent()}
                  </motion.div>
                </AnimatePresence>
              </div>
              {/* Bottom gradient hint */}
              <div className="pointer-events-none sticky bottom-0 -mx-5 h-10 bg-gradient-to-t from-[rgb(var(--color-card))]/90 to-transparent" />
            </div>
          </div>
          {/* Scroll helpers */}
          {showScrollTop && (
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.96 }}
              className="fixed bottom-6 right-6 z-50 px-3 py-2 rounded-full bg-[rgb(var(--color-primary))] text-white shadow-lg"
              onClick={() => {
                const el = scrollAreaRef.current;
                if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              ↑ Top
            </motion.button>
          )}
          {showScrollDown && (
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.96 }}
              className="fixed bottom-6 right-24 z-50 px-3 py-2 rounded-full bg-[rgb(var(--color-input))] text-white shadow-lg"
              onClick={() => {
                const el = scrollAreaRef.current;
                if (el) el.scrollBy({ top: 300, behavior: 'smooth' });
              }}
            >
              ↓ More
            </motion.button>
          )}
        </div>
      )}

    </div>
  );
};

export default TopicExplainer;