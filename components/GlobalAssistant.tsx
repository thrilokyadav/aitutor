import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GeminiService from '../services/geminiService';
import OpenAiService from '../services/openAiService';
import { ChatMessage, MessageSender, ChatSession, ActiveView, ChatModel } from '../types';
import { UserIcon } from './icons/UserIcon';
import { AIIcon } from './icons/AIIcon';
import { SendIcon } from './icons/SendIcon';
import { LoadingSpinner } from './common/LoadingSpinner';
import { ChatIcon } from './icons/ChatIcon';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';
import { PencilIcon } from './icons/PencilIcon';
import { useAppContext } from '../contexts/AppContext';
import { CpuChipIcon } from './icons/CpuChipIcon';
import { CloseIcon } from './icons/CloseIcon';
import MarkdownRenderer from './common/MarkdownRenderer';
import useLocalStorage from '../hooks/useLocalStorage';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { supabase, SUPABASE_ENABLED } from '../services/supabaseClient';

const SESSIONS_KEY = 'easyway-tutor-global-assistant-sessions';

const GlobalAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const { user, signInWithGoogle } = useAuth();
  const { lang } = useI18n();
  const { activeView, activeSubject, apiKeys, setActiveView, setExplainerPrefillTopic } = useAppContext() as any;
  const geminiService = useMemo(() => new GeminiService(), []);
  const openAiService = useMemo(() => apiKeys.openai ? new OpenAiService(apiKeys.openai) : null, [apiKeys.openai]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null); // panel container
  const messagesListRef = useRef<HTMLDivElement>(null);  // scrolling list
  const containerRef = useRef<HTMLDivElement>(null);

  // Drag state (without animation libs)
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragRafRef = useRef<number | null>(null);

  // Detect reduced motion preference and provide a flicker-free fallback
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduceMotion(mq.matches);
    apply();
    if (mq.addEventListener) {
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    } else {
      mq.addListener(apply);
      return () => mq.removeListener(apply);
    }
  }, []);

  const [position, setPosition] = useLocalStorage<{ x: number; y: number }>(
    'easyway-global-assistant-position',
    { x: 20, y: 200 }
  );

  const handleDragEnd = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    // Clamp within viewport bounds with small margins
    const margin = 8;
    const maxX = Math.max(margin, window.innerWidth - rect.width - margin);
    const maxY = Math.max(margin, window.innerHeight - rect.height - margin);
    const clampedX = Math.min(Math.max(rect.left, margin), maxX);
    const clampedY = Math.min(Math.max(rect.top, margin), maxY);
    setPosition({ x: clampedX, y: clampedY });
  }, [setPosition]);

  // Listen for global header toggle
  useEffect(() => {
    const onToggle = () => setIsOpen(prev => !prev);
    window.addEventListener('toggle-global-assistant' as any, onToggle);
    return () => window.removeEventListener('toggle-global-assistant' as any, onToggle);
  }, []);

  // Ensure the assistant stays within the viewport on mount and when resizing
  useEffect(() => {
    const clampToViewport = () => {
      const margin = 8;
      const btnW = 80; // approximate width incl. shadow
      const btnH = 80; // approximate height incl. shadow
      const maxX = Math.max(margin, window.innerWidth - btnW - margin);
      const maxY = Math.max(margin, window.innerHeight - btnH - margin);
      setPosition(prev => ({
        x: Math.min(Math.max(prev.x ?? 20, margin), maxX),
        y: Math.min(Math.max(prev.y ?? 200, margin), maxY),
      }));
    };

    clampToViewport();
    window.addEventListener('resize', clampToViewport);
    return () => window.removeEventListener('resize', clampToViewport);
  }, [setPosition]);

  // Keyboard shortcut to reset position: Alt+G
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'g' || e.key === 'G')) {
        setPosition({ x: 20, y: 200 });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPosition]);


  useEffect(() => {
    try {
      const savedSessions = localStorage.getItem(SESSIONS_KEY);
      const parsedSessions = savedSessions ? JSON.parse(savedSessions) : [];
      setSessions(parsedSessions);
      if (parsedSessions.length > 0) {
        setActiveSessionId(parsedSessions[0].id);
      } else {
        handleNewChat();
      }
    } catch (error) {
      console.error("Failed to load global assistant sessions:", error);
    }
  }, []);

  useEffect(() => {
    // Debounce session persistence to avoid frequent writes during streaming
    const id = setTimeout(() => {
      try {
        localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
      } catch (error) {
        console.error("Failed to save global assistant sessions:", error);
      }
    }, 250);
    return () => clearTimeout(id);
  }, [sessions]);

  const activeSession = sessions.find(s => s.id === activeSessionId);

  const scrollToBottom = () => {
    const el = messagesListRef.current;
    if (el) {
      // Use RAF to avoid layout thrash mid-paint while streaming
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  };

  const scrollToTop = () => {
    const el = messagesListRef.current;
    if (el) {
      requestAnimationFrame(() => {
        el.scrollTop = 0;
      });
    }
  };

  const handleScroll = () => {
    const el = messagesListRef.current;
    if (!el) return;
    const isNearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 10;
    // Show button whenever not at (or very near) the bottom
    setShowScrollButton(!isNearBottom);
  };

  useEffect(scrollToBottom, [activeSession?.messages]);

  useEffect(() => {
    const el = messagesListRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll);
    // Initialize button state on mount/update
    handleScroll();
    return () => el.removeEventListener('scroll', handleScroll);
  }, [activeSession?.messages]);
  
  const updateSession = (sessionId: string, updateFn: (session: ChatSession) => ChatSession) => {
    setSessions(prev => prev.map(s => s.id === sessionId ? updateFn(s) : s));
  };

  const updateMessages = (updateFn: (prevMessages: ChatMessage[]) => ChatMessage[]) => {
    if(!activeSessionId) return;
    updateSession(activeSessionId, session => ({...session, messages: updateFn(session.messages)}));
  };

  const handleNewChat = useCallback(() => {
    const newSession: ChatSession = {
      id: `session-${Date.now()}`,
      name: `New Query`,
      messages: [],
      createdAt: Date.now(),
      model: 'gemini-2.5-flash',
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
  }, []);

  const getLastAIText = () => {
    const msgs = activeSession?.messages || [];
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].sender === MessageSender.AI && msgs[i].text) return msgs[i].text;
    }
    return '';
  };

  const extractTopicFromText = (text: string): string => {
    const cleaned = text.trim();
    const headingMatch = cleaned.match(/^#+\s*(.+)$/m);
    if (headingMatch) return headingMatch[1].trim().slice(0, 120);
    const firstLine = cleaned.split(/\n|\.|\!|\?/)[0] || '';
    return firstLine.trim().slice(0, 120) || 'General Topic';
  };

  const navigateTo = (view: ActiveView) => {
    setActiveView?.(view);
    setIsOpen(false);
  };

  const sendToExplainer = (topic?: string) => {
    const text = topic && topic.trim() ? topic.trim() : extractTopicFromText(getLastAIText());
    if (!text) return alert('No content to send to Explainer. Type /explainer <topic> or get an AI response first.');
    setExplainerPrefillTopic?.(text);
    navigateTo(ActiveView.EXPLAINER);
  };

  const handleSend = useCallback(async () => {
    if (input.trim() === '' || isLoading || !activeSession) return;

    // Slash commands (client-side actions)
    const raw = input.trim();
    if (raw.startsWith('/')) {
      const [cmd, ...args] = raw.split(' ');
      const argText = args.join(' ').trim();
      switch (cmd.toLowerCase()) {
        case '/goto':
        case '/nav': {
          const dest = argText.toLowerCase();
          const map: Record<string, ActiveView> = {
            tutor: ActiveView.TUTOR,
            explainer: ActiveView.EXPLAINER,
            quiz: ActiveView.QUIZ,
            news: ActiveView.NEWS,
            subjects: ActiveView.SUBJECTS,
            planner: ActiveView.PLANNER,
            dashboard: ActiveView.DASHBOARD,
            notes: ActiveView.NOTES,
            help: ActiveView.HELP,
          };
          if (map[dest]) navigateTo(map[dest]);
          setInput('');
          return;
        }
        case '/explainer': {
          sendToExplainer(argText);
          setInput('');
          return;
        }
        case '/notes': {
          navigateTo(ActiveView.NOTES);
          setInput('');
          return;
        }
        default:
          break;
      }
    }

    const currentModel = activeSession.model;
     if (currentModel.startsWith('gpt') && !openAiService) {
        alert("OpenAI API key is not set. Please add it in settings.");
        return;
    }
    
    let context = `[Current View: ${ActiveView[activeView]}]`;
    if (activeView === ActiveView.SUBJECTS && activeSubject) {
        context += ` [Subject: ${activeSubject}]`;
    }
    const fullInput = `Context: ${context}\n\nUser query: ${input}`;

    const userMessage: ChatMessage = { sender: MessageSender.USER, text: input };
    setInput('');
    updateMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setStreamError(null);

    updateMessages(prev => [...prev, { sender: MessageSender.AI, text: '' }]);

    try {
      let responseStream;
      const instruction = "You are a helpful AI assistant for a user studying for ALL GOV exams. The user will provide you with their current context (what they are looking at in the app). Use this context to provide relevant and concise help. Be friendly and supportive.";

      if (currentModel.startsWith('gpt')) {
        const langPrefix = lang === 'kn' ? 'IMPORTANT: Respond in Kannada (kn-IN) language.\n' : '';
        responseStream = openAiService!.sendMessageStream(currentModel, activeSession.messages, instruction + (lang === 'kn' ? '\n' + langPrefix : ''), langPrefix + fullInput);
      } else {
        const chat = geminiService.getGlobalAssistantChat(activeSession.messages, lang);
        responseStream = await chat.sendMessageStream({ message: fullInput });
      }
      // Watchdog to avoid indefinite buffering
      let receivedAnyChunk = false;
      const watchdog = setTimeout(() => {
        if (!receivedAnyChunk) {
          setStreamError('The model is taking too long to respond. Please try again or switch models.');
          updateMessages(prev => {
            const lastMessage = prev[prev.length - 1];
            const updated = [...prev];
            updated[prev.length - 1] = { ...lastMessage, text: 'Sorry, the response timed out. Please try again.' };
            return updated;
          });
          setIsLoading(false);
        }
      }, 20000);

      // Throttle updates to reduce re-renders
      let buffer = '';
      let scheduled = false;
      const flush = () => {
        if (!buffer) return;
        const toAppend = buffer;
        buffer = '';
        updateMessages(prev => {
          const lastMessage = prev[prev.length - 1];
          const updated = [...prev];
          updated[prev.length - 1] = { ...lastMessage, text: lastMessage.text + toAppend };
          return updated;
        });
        scheduled = false;
      };

      for await (const chunk of responseStream) {
        const textChunk = typeof chunk === 'string' ? chunk : (chunk?.text ?? '');
        if (!textChunk) continue;
        receivedAnyChunk = true;
        buffer += textChunk;
        if (!scheduled) {
          scheduled = true;
          setTimeout(flush, 50);
        }
      }
      // final flush
      if (buffer) flush();
      clearTimeout(watchdog);
    } catch (error) {
      console.error('Error streaming response:', error);
       updateMessages(prev => {
          const lastMessage = prev[prev.length - 1];
          const updatedMessages = [...prev];
          updatedMessages[prev.length - 1] = { ...lastMessage, text: "Sorry, I encountered an error. Please try again."};
          return updatedMessages;
      });
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, activeSession, activeView, activeSubject, geminiService, openAiService]);
  
  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if(activeSessionId) {
        const newModel = e.target.value as ChatModel;
        updateSession(activeSessionId, session => ({...session, model: newModel}));
    }
  }

  const handleCopy = async (text: string) => {
    if (!text) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback: create a temporary textarea
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      alert('Copied to clipboard');
    } catch (e) {
      console.error('Copy failed', e);
      alert('Copy failed. You can select the text and copy manually.');
    }
  };

  const handleSaveToNotes = async (text: string) => {
    if (!text) return;
    if (!SUPABASE_ENABLED) {
      alert('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local to enable Notes.');
      return;
    }
    if (!user) {
      await signInWithGoogle();
      return;
    }
    const defaultTitle = text.split('\n')[0]?.slice(0, 60) || 'Assistant Note';
    const title = window.prompt('Save note title:', defaultTitle) || defaultTitle;
    const { error } = await supabase.from('notes').insert({
      user_id: user.id,
      title,
      content: text,
      source: 'assistant',
    });
    if (error) {
      alert('Failed to save note: ' + error.message);
    } else {
      alert('Saved to Notes');
    }
  };

  const ChatBubble: React.FC<{ message: ChatMessage; animate?: boolean; streaming?: boolean }> = React.memo(({ message, animate = true, streaming = false }) => {
    const isUser = message.sender === MessageSender.USER;
    const isAILoading = message.sender === MessageSender.AI && message.text === '' && isLoading;

    const Wrapper: React.ElementType = 'div';
    const wrapperProps = {} as any;

    return (
      <Wrapper
        className={`flex items-start gap-3 my-2 ${isUser ? 'flex-row-reverse' : ''}`}
        style={{ willChange: 'transform', backfaceVisibility: 'hidden' as any }}
      >
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isUser ? 'bg-[rgb(var(--color-primary))]' : 'bg-[rgb(var(--color-input))]'}`}>
          {isUser ? <UserIcon className="w-5 h-5" /> : <AIIcon className="w-5 h-5" />}
        </div>
        <div className={`p-3 rounded-lg max-w-md ${isUser ? 'bg-[rgb(var(--color-primary))] text-white' : 'bg-[rgb(var(--color-input))] text-[rgb(var(--color-text-primary))]'}`}>
            {isAILoading ? (
              <LoadingSpinner />
            ) : isUser ? (
              <div className="whitespace-pre-wrap">{message.text}</div>
            ) : streaming ? (
              <div className="whitespace-pre-wrap">{message.text}</div>
            ) : (
              <div>
                <MarkdownRenderer content={message.text} className="prose-sm" />
                <div className="mt-2 flex gap-2 justify-end">
                  <button
                    onClick={() => handleCopy(message.text)}
                    className="px-2 py-1 text-xs rounded bg-[rgb(var(--color-card))] hover:bg-slate-600"
                    title="Copy this message to clipboard"
                  >
                    Copy
                  </button>
                  <button
                    onClick={() => {
                      if (!SUPABASE_ENABLED) {
                        alert('Notes requires Supabase configuration. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local and restart.');
                        return;
                      }
                      if (!user) {
                        alert('Please sign in to save notes. You will be prompted to sign in.');
                      }
                      handleSaveToNotes(message.text);
                    }}
                    className={`px-2 py-1 text-xs rounded text-white ${(!SUPABASE_ENABLED || !user) ? 'bg-slate-600 cursor-not-allowed' : 'bg-[rgb(var(--color-primary))]'}`}
                    title={!SUPABASE_ENABLED ? 'Supabase not configured' : (!user ? 'Sign in to save notes' : 'Save to Notes')}
                    aria-disabled={!SUPABASE_ENABLED || !user}
                  >
                    Save to Notes
                  </button>
                </div>
              </div>
            )}
        </div>
      </Wrapper>
    );
  }, (prevProps, nextProps) => {
    // Skip re-render if message object is referentially equal and flags unchanged
    return prevProps.message === nextProps.message && prevProps.animate === nextProps.animate && prevProps.streaming === nextProps.streaming;
  });
  
  const animateUI = !(reduceMotion || isLoading);

  // Helpers for drag
  const getPoint = (e: MouseEvent | TouchEvent) => {
    if (e instanceof MouseEvent) return { x: e.clientX, y: e.clientY };
    const t = e.touches[0] ?? e.changedTouches[0];
    return { x: t.clientX, y: t.clientY };
  };

  const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

  const onDragMove = (e: MouseEvent | TouchEvent) => {
    if (!dragStartRef.current || !pointerStartRef.current) return;
    const { x, y } = getPoint(e);
    const dx = x - pointerStartRef.current.x;
    const dy = y - pointerStartRef.current.y;
    const next = { x: dragStartRef.current.x + dx, y: dragStartRef.current.y + dy };

    if (dragRafRef.current) cancelAnimationFrame(dragRafRef.current);
    dragRafRef.current = requestAnimationFrame(() => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const btnSize = 64; // matches w-16 h-16
      setPosition({
        x: clamp(next.x, 8, vw - btnSize - 8),
        y: clamp(next.y, 8, vh - btnSize - 8),
      });
    });
  };

  const onDragEnd = (e?: MouseEvent | TouchEvent) => {
    setDragging(false);
    dragStartRef.current = null;
    pointerStartRef.current = null;
    if (dragRafRef.current) cancelAnimationFrame(dragRafRef.current);
    dragRafRef.current = null;
    window.removeEventListener('mousemove', onDragMove as any);
    window.removeEventListener('mouseup', onDragEnd as any);
    window.removeEventListener('touchmove', onDragMove as any);
    window.removeEventListener('touchend', onDragEnd as any);
    // persist position via existing handler if any side-effects needed
    try {
      // call existing on-drag-end logic if present
      // handleDragEnd maintained from previous implementation
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      (handleDragEnd as any) && handleDragEnd();
    } catch {}
  };

  const onDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    setDragging(true);
    dragStartRef.current = { ...position };
    const isTouch = 'touches' in e;
    const point = isTouch ? { x: (e as React.TouchEvent).touches[0].clientX, y: (e as React.TouchEvent).touches[0].clientY } : { x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY };
    pointerStartRef.current = point;
    window.addEventListener('mousemove', onDragMove as any, { passive: true });
    window.addEventListener('mouseup', onDragEnd as any);
    window.addEventListener('touchmove', onDragMove as any, { passive: true });
    window.addEventListener('touchend', onDragEnd as any);
  };

  return (
    <>
      <div
        ref={containerRef}
        className="fixed z-30"
        style={{ left: position.x, top: position.y, willChange: 'transform', backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' as any }}
        onMouseUp={onDragEnd as any}
      >
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-16 h-16 bg-[rgb(var(--color-primary))] rounded-full text-white flex items-center justify-center shadow-lg hover:opacity-90"
          onMouseDown={onDragStart}
          onTouchStart={onDragStart}
          style={{ cursor: dragging ? 'grabbing' : 'grab' }}
          aria-label="Toggle Global Assistant"
        >
          {isOpen ? <CloseIcon className="w-8 h-8"/> : <ChatIcon className="w-8 h-8"/>}
        </button>
        {isOpen && (
          <div
              ref={chatContainerRef}
              className="absolute right-full mr-4 bottom-0 w-[500px] max-h-[85vh] bg-[rgb(var(--color-card))] rounded-2xl shadow-2xl border border-[rgb(var(--color-border))] flex flex-col"
              style={{ willChange: 'transform, opacity', backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' as any }}
            >
              <div className="p-4 border-b border-[rgb(var(--color-border))] flex justify-between items-center sticky top-0 bg-[rgb(var(--color-card))] z-10">
                <h2 className="text-lg font-bold">Global Assistant</h2>
                <button onClick={handleNewChat} className="flex items-center justify-center gap-1 text-xs p-1 px-2 bg-[rgb(var(--color-primary))] text-white rounded-md hover:bg-[rgb(var(--color-primary-hover))] transition-colors">
                  <PlusIcon className="w-4 h-4"/> New
                </button>
              </div>
              <div className="relative flex flex-col flex-1 p-3">
                <div ref={messagesListRef} className="flex-1 overflow-y-auto global-assistant-scrollbar" style={{ contain: 'content' as any }}>
                  {(!activeSession || activeSession.messages.length === 0) ? (
                    <div className="flex flex-col items-center justify-center h-full text-[rgb(var(--color-text-secondary))] text-center px-4">
                      <AIIcon className="w-12 h-12 mb-4" />
                      <p>I can see what you're doing. Ask me for help!</p>
                    </div>
                  ) : (
                    activeSession.messages.map((msg, index) => {
                      const isLast = index === activeSession.messages.length - 1;
                      const isStreamingAI = isLast && isLoading && msg.sender === MessageSender.AI;
                      return (
                        <ChatBubble
                          key={index}
                          message={msg}
                          animate={!isStreamingAI}
                          streaming={isStreamingAI}
                        />
                      );
                    })
                  )}
                </div>

                {/* Scroll Button */}
                {showScrollButton && (
                  <div className="absolute bottom-24 right-4 z-20">
                    <button
                      onClick={scrollToBottom}
                      className={`w-12 h-12 bg-[rgb(var(--color-primary))] text-white rounded-full shadow-xl hover:bg-[rgb(var(--color-primary-hover))] transition-colors flex items-center justify-center ${isLoading ? 'animate-pulse' : ''}`}
                      title="Scroll to bottom"
                      aria-label="Scroll to bottom"
                    >
                      <span className="text-xl">▾</span>
                    </button>
                  </div>
                )}

                <div className="mt-2" ref={messagesEndRef}>
                  <div className="flex items-center bg-[rgb(var(--color-input))] rounded-lg p-1 border border-[rgb(var(--color-border))] focus-within:ring-2 focus-within:ring-[rgb(var(--color-primary))] gap-1">
                    <select
                      aria-label="Select model"
                      className="bg-transparent text-sm p-2 rounded-md text-[rgb(var(--color-text-primary))]"
                      value={activeSession?.model}
                      onChange={handleModelChange}
                    >
                      <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                      <option value="gpt-4o" disabled={!openAiService}>OpenAI GPT-4o</option>
                      <option value="gpt-3.5-turbo" disabled={!openAiService}>OpenAI GPT-3.5</option>
                    </select>
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                      placeholder="Ask for help... (try /goto notes or /explainer <topic>)"
                      className="flex-1 bg-transparent border-none focus:ring-0 text-[rgb(var(--color-text-primary))] placeholder-[rgb(var(--color-text-secondary))] text-sm"
                      disabled={isLoading}
                    />
                    <button
                      onClick={handleSend}
                      disabled={isLoading || input.trim() === ''}
                      className="p-2 rounded-md bg-[rgb(var(--color-primary))] text-white disabled:bg-slate-600 disabled:cursor-not-allowed hover:bg-[rgb(var(--color-primary-hover))]"
                      aria-label="Send message"
                    >
                      {isLoading ? <LoadingSpinner className="w-4 h-4"/> : <SendIcon className="w-4 h-4"/>}
                    </button>
                  </div>
                  {/* Quick Actions */}
                  <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                    <span className="text-[rgb(var(--color-text-secondary))]">Actions:</span>
                    <button onClick={() => navigateTo(ActiveView.DASHBOARD)} className="px-2 py-1 rounded bg-[rgb(var(--color-input))] hover:bg-slate-600">Dashboard</button>
                    <button onClick={() => navigateTo(ActiveView.NOTES)} className="px-2 py-1 rounded bg-[rgb(var(--color-input))] hover:bg-slate-600">Notes</button>
                    <button onClick={() => navigateTo(ActiveView.PLANNER)} className="px-2 py-1 rounded bg-[rgb(var(--color-input))] hover:bg-slate-600">Planner</button>
                    <button onClick={() => navigateTo(ActiveView.EXPLAINER)} className="px-2 py-1 rounded bg-[rgb(var(--color-input))] hover:bg-slate-600">Explainer</button>
                    <button onClick={() => sendToExplainer()} className="px-2 py-1 rounded bg-[rgb(var(--color-primary))] text-white">Send last AI → Explainer</button>
                  </div>
                </div>
              </div>
          </div>
        )}
      </div>
    </>
  );
};

export default GlobalAssistant;