import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import GeminiService from '../services/geminiService';
import OpenAiService from '../services/openAiService';
import { ChatMessage, MessageSender, ChatSession, ChatModel } from '../types';
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
import MarkdownRenderer from './common/MarkdownRenderer';
import { PanelCollapseIcon } from './icons/PanelCollapseIcon';
import { PanelExpandIcon } from './icons/PanelExpandIcon';

const CHAT_SESSIONS_KEY = 'easyway-tutor-chat-sessions';

const ChatInterface: React.FC = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);

  const { apiKeys } = useAppContext();
  const geminiService = useMemo(() => new GeminiService(), []);
  const openAiService = useMemo(() => apiKeys.openai ? new OpenAiService(apiKeys.openai) : null, [apiKeys.openai]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const savedSessions = localStorage.getItem(CHAT_SESSIONS_KEY);
      const parsedSessions = savedSessions ? JSON.parse(savedSessions) : [];
      setSessions(parsedSessions);
      if (parsedSessions.length > 0) {
        setActiveSessionId(parsedSessions[0].id);
      } else {
        handleNewChat();
      }
    } catch (error) {
      console.error("Failed to load chat sessions:", error);
      handleNewChat();
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(sessions));
    } catch (error) {
      console.error("Failed to save chat sessions:", error);
    }
  }, [sessions]);

  const activeSession = sessions.find(s => s.id === activeSessionId);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [activeSession?.messages]);
  
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
      name: `New Chat ${sessions.length + 1}`,
      messages: [],
      createdAt: Date.now(),
      model: 'gemini-2.5-flash',
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
  }, [sessions.length]);
  
  const handleSend = useCallback(async () => {
    if (input.trim() === '' || isLoading || !activeSession) return;

    const currentModel = activeSession.model;
    if (currentModel.startsWith('gpt') && !openAiService) {
        alert("OpenAI API key is not set. Please add it in settings.");
        return;
    }
    
    const userMessage: ChatMessage = { sender: MessageSender.USER, text: input };
    const currentInput = input;
    setInput('');
    
    updateMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    updateMessages(prev => [...prev, { sender: MessageSender.AI, text: '' }]);

    try {
      let responseStream;
      if (currentModel.startsWith('gpt')) {
        responseStream = openAiService!.sendMessageStream(currentModel, activeSession.messages, "You are an expert tutor for ALL GOV examinations.");
      } else {
        const chat = geminiService.getGeneralTutorChat(activeSession.messages);
        responseStream = await chat.sendMessageStream({ message: currentInput });
      }

      for await (const chunk of responseStream) {
        const textChunk = typeof chunk === 'string' ? chunk : chunk.text;
        updateMessages(prev => {
          const lastMessage = prev[prev.length - 1];
          const updatedMessages = [...prev];
          updatedMessages[prev.length - 1] = { ...lastMessage, text: lastMessage.text + textChunk };
          return updatedMessages;
        });
      }
    } catch (error) {
      console.error('Error streaming response:', error);
      updateMessages(prev => {
          const lastMessage = prev[prev.length - 1];
          const updatedMessages = [...prev];
          updatedMessages[prev.length - 1] = { ...lastMessage, text: "Sorry, I encountered an error. Please check your API key and try again."};
          return updatedMessages;
      });
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, activeSession, geminiService, openAiService]);

  const handleDeleteSession = (sessionId: string) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    if(activeSessionId === sessionId) {
        const remainingSessions = sessions.filter(s => s.id !== sessionId);
        setActiveSessionId(remainingSessions.length > 0 ? remainingSessions[0].id : null);
    }
  }

  const handleStartEditing = (session: ChatSession) => {
    setEditingSessionId(session.id);
    setEditingName(session.name);
  }

  const handleSaveEdit = () => {
    if(editingSessionId){
        updateSession(editingSessionId, session => ({...session, name: editingName}));
    }
    setEditingSessionId(null);
  }

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if(activeSessionId) {
        const newModel = e.target.value as ChatModel;
        updateSession(activeSessionId, session => ({...session, model: newModel}));
    }
  }

  const ChatBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
    const isUser = message.sender === MessageSender.USER;
    const isAILoading = message.sender === MessageSender.AI && message.text === '' && isLoading;

    return (
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className={`flex items-start gap-3 my-4 ${isUser ? 'flex-row-reverse' : ''}`}
      >
        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${isUser ? 'bg-gradient-to-br from-[rgb(var(--color-primary))] to-[rgb(var(--color-accent))]' : 'bg-[rgb(var(--color-input))]'}`}>
          {isUser ? <UserIcon /> : <AIIcon />}
        </div>
        <div className={`p-4 rounded-xl max-w-2xl ${isUser ? 'bg-gradient-to-br from-[rgb(var(--color-primary))] to-[rgb(var(--color-accent))] animated-gradient-bg text-white' : 'bg-[rgb(var(--color-input))] text-[rgb(var(--color-text-primary))]'}`}>
            {isAILoading ? <LoadingSpinner /> : (
              isUser ? <div className="whitespace-pre-wrap">{message.text}</div> : <MarkdownRenderer content={message.text} />
            )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="flex h-full bg-transparent">
      {/* Mobile Sidebar Overlay */}
      {isPanelCollapsed === false && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 sm:hidden"
          onClick={() => setIsPanelCollapsed(true)}
        />
      )}

      {/* Sidebar Panel */}
      <div className={`bg-[rgba(var(--color-card),0.5)] border-r border-[rgb(var(--color-border))] flex flex-col transition-all duration-300 ease-in-out z-50 ${
        isPanelCollapsed
          ? 'w-16 sm:w-16'
          : 'w-80 sm:w-72'
      } ${isPanelCollapsed ? '' : 'absolute sm:relative h-full sm:h-auto'}`}>

        <div className={`p-3 sm:p-2 flex-1 overflow-hidden ${isPanelCollapsed ? 'flex flex-col items-center' : ''}`}>
          <div className={`flex items-center mb-4 ${isPanelCollapsed ? 'flex-col gap-4' : 'justify-between'}`}>
            <button
              onClick={handleNewChat}
              className={`flex items-center justify-center gap-2 p-3 sm:p-2 text-white rounded-md hover:opacity-90 transition-opacity w-full min-h-[44px] sm:min-h-0 ${
                isPanelCollapsed ? '' : 'bg-gradient-to-r from-[rgb(var(--color-primary))] to-[rgb(var(--color-accent))] animated-gradient-bg'
              }`}
              title="New Chat"
            >
              <PlusIcon />
              {!isPanelCollapsed && <span className="flex-1">New Chat</span>}
            </button>
          </div>

          {!isPanelCollapsed && (
            <div className="flex-1 overflow-y-auto">
              {sessions.map(session => (
                <div
                  key={session.id}
                  className={`p-3 sm:p-2 rounded-md mb-2 cursor-pointer group flex justify-between items-center min-h-[44px] sm:min-h-0 ${
                    activeSessionId === session.id
                      ? 'bg-[rgb(var(--color-card))] border border-[rgb(var(--color-primary))]'
                      : 'hover:bg-[rgb(var(--color-input))]'
                  }`}
                  onClick={() => setActiveSessionId(session.id)}
                >
                  {editingSessionId === session.id ? (
                    <input
                      type="text"
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      onBlur={handleSaveEdit}
                      onKeyDown={e => e.key === 'Enter' && handleSaveEdit()}
                      className="bg-[rgb(var(--color-input))] text-white p-1 rounded w-full text-sm"
                      autoFocus
                    />
                  ) : (
                    <>
                      <p className="text-sm truncate flex-1">{session.name}</p>
                      <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleStartEditing(session);}}
                          className="p-1 hover:text-white min-h-[32px] sm:min-h-0"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id);}}
                          className="p-1 hover:text-red-500 min-h-[32px] sm:min-h-0"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => setIsPanelCollapsed(p => !p)}
          className="p-3 sm:p-2 flex items-center justify-center text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-input))] border-t border-[rgb(var(--color-border))] min-h-[44px] sm:min-h-0"
        >
          {isPanelCollapsed ? <PanelExpandIcon /> : <PanelCollapseIcon />}
        </button>
      </div>

      {/* Mobile Menu Button */}
      {isPanelCollapsed && (
        <button
          onClick={() => setIsPanelCollapsed(false)}
          className="fixed top-4 left-4 z-40 p-2 bg-[rgb(var(--color-primary))] text-white rounded-md sm:hidden"
        >
          <ChatIcon className="w-5 h-5" />
        </button>
      )}

      {/* Main Chat Area */}
      <div className="flex flex-col flex-1 p-3 sm:p-4 lg:p-6">
        <div className="flex-1 overflow-y-auto pr-0 sm:pr-4">
          {!activeSession || activeSession.messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-[rgb(var(--color-text-secondary))] px-4">
              <ChatIcon className="w-12 h-12 sm:w-16 sm:h-16 mb-4" />
              <h2 className="text-xl sm:text-2xl font-semibold text-center">EASYWAY AI Tutor</h2>
              <p className="mt-2 text-sm sm:text-base text-center">Ask me anything about the ALL GOV syllabus!</p>
            </div>
          ) : (
            activeSession.messages.map((msg, index) => <ChatBubble key={index} message={msg} />)
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="mt-4 sm:mt-6">
          <div className="flex items-end bg-[rgb(var(--color-input))] rounded-lg p-2 sm:p-3 border border-[rgb(var(--color-border))] focus-within:ring-2 focus-within:ring-[rgb(var(--color-primary))] transition-all">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Type your question here..."
              className="flex-1 bg-transparent border-none focus:ring-0 text-[rgb(var(--color-text-primary))] placeholder-[rgb(var(--color-text-secondary))] text-sm sm:text-base min-h-[44px] sm:min-h-0"
              disabled={isLoading || !activeSession}
            />
            <button
              onClick={handleSend}
              disabled={isLoading || input.trim() === '' || !activeSession}
              className="p-2 sm:p-3 rounded-md bg-[rgb(var(--color-primary))] text-white disabled:bg-slate-600 disabled:cursor-not-allowed hover:bg-[rgb(var(--color-primary-hover))] transition-colors min-h-[44px] sm:min-h-0"
              aria-label="Send message"
            >
              {isLoading ? <LoadingSpinner /> : <SendIcon />}
            </button>
          </div>

          {/* Model Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end mt-2 gap-2 text-xs">
            <CpuChipIcon className="w-4 h-4 text-[rgb(var(--color-text-secondary))]" />
            <select
              value={activeSession?.model || 'gemini-2.5-flash'}
              onChange={handleModelChange}
              disabled={!activeSession || isLoading}
              className="bg-[rgb(var(--color-input))] border border-[rgb(var(--color-border))] rounded-md py-2 px-3 text-[rgb(var(--color-text-secondary))] text-xs focus:ring-1 focus:ring-[rgb(var(--color-primary))] focus:outline-none min-h-[44px] sm:min-h-0"
            >
              <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
              <option value="gpt-4o" disabled={!openAiService}>OpenAI GPT-4o</option>
              <option value="gpt-3.5-turbo" disabled={!openAiService}>OpenAI GPT-3.5</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;