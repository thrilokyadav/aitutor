import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import GeminiService from '../../services/geminiService';
import { ChatMessage, MessageSender, ChatSession } from '../../types';
import { UserIcon } from '../icons/UserIcon';
import { AIIcon } from '../icons/AIIcon';
import { SendIcon } from '../icons/SendIcon';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { PlusIcon } from '../icons/PlusIcon';
import { TrashIcon } from '../icons/TrashIcon';
import { PencilIcon } from '../icons/PencilIcon';
import { useAppContext } from '../../contexts/AppContext';
import MarkdownRenderer from '../common/MarkdownRenderer';
import { PanelCollapseIcon } from '../icons/PanelCollapseIcon';
import { PanelExpandIcon } from '../icons/PanelExpandIcon';


interface SubjectChatProps {
    subject: string;
    onBack: () => void;
}

const SubjectChat: React.FC<SubjectChatProps> = ({ subject, onBack }) => {
  const SESSIONS_KEY = `easyway-tutor-subject-chat-sessions-${subject.replace(/\s+/g, '-')}`;

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  
  const geminiService = useMemo(() => new GeminiService(), []);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleNewChat = useCallback(() => {
    const newSession: ChatSession = {
      id: `session-${Date.now()}`,
      name: `New ${subject} Chat`,
      messages: [],
      createdAt: Date.now(),
      model: 'gemini-2.5-flash',
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
  }, [subject]);

  useEffect(() => {
    try {
      const savedSessions = localStorage.getItem(SESSIONS_KEY);
      const parsedSessions = savedSessions ? JSON.parse(savedSessions) : [];
      setSessions(parsedSessions);
      if (parsedSessions.length > 0) {
        setActiveSessionId(parsedSessions[0].id);
      } else {
        setTimeout(() => handleNewChat(), 0);
      }
    } catch (error) {
      console.error(`Failed to load chat sessions for ${subject}:`, error);
    }
  }, [SESSIONS_KEY, handleNewChat]);

  useEffect(() => {
    try {
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    } catch (error) {
      console.error(`Failed to save chat sessions for ${subject}:`, error);
    }
  }, [sessions, SESSIONS_KEY]);

  const activeSession = sessions.find(s => s.id === activeSessionId);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [activeSession?.messages]);

  const updateMessages = (updateFn: (prevMessages: ChatMessage[]) => ChatMessage[]) => {
    setSessions(prevSessions =>
      prevSessions.map(session =>
        session.id === activeSessionId
          ? { ...session, messages: updateFn(session.messages) }
          : session
      )
    );
  };
  
  const handleSend = useCallback(async () => {
    if (input.trim() === '' || isLoading || !activeSession) return;

    const userMessage: ChatMessage = { sender: MessageSender.USER, text: input };
    const currentInput = input;
    setInput('');
    updateMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    updateMessages(prev => [...prev, { sender: MessageSender.AI, text: '' }]);

    try {
      const chat = geminiService.getSubjectChat(subject, activeSession.messages);
      const responseStream = await chat.sendMessageStream({ message: currentInput });
      for await (const chunk of responseStream) {
        updateMessages(prev => {
           const lastMessage = prev[prev.length - 1];
           const updatedMessages = [...prev];
           updatedMessages[prev.length - 1] = { ...lastMessage, text: lastMessage.text + chunk.text };
           return updatedMessages;
        });
      }
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
  }, [input, isLoading, activeSession, subject, geminiService]);

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
    setSessions(prev => prev.map(s => s.id === editingSessionId ? {...s, name: editingName} : s));
    setEditingSessionId(null);
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
    <div className="flex flex-col h-full bg-transparent">
        <div className="px-6 pt-6">
            <button onClick={onBack} className="mb-4 text-[rgb(var(--color-accent))] hover:brightness-90">&larr; Back to {subject}</button>
        </div>
        <div className="flex flex-1 overflow-hidden">
             <div className={`bg-[rgba(var(--color-card),0.5)] border-r border-[rgb(var(--color-border))] flex flex-col transition-all duration-300 ease-in-out ${isPanelCollapsed ? 'w-16' : 'w-72'}`}>
                <div className={`p-2 flex-1 overflow-hidden ${isPanelCollapsed ? 'flex flex-col items-center' : ''}`}>
                    <button 
                        onClick={handleNewChat} 
                        className={`flex items-center justify-center gap-2 p-2 mb-4 text-white rounded-md hover:opacity-90 transition-opacity w-full ${isPanelCollapsed ? '' : 'bg-gradient-to-r from-[rgb(var(--color-primary))] to-[rgb(var(--color-accent))] animated-gradient-bg'}`}
                        title="New Chat"
                    >
                        <PlusIcon /> 
                        {!isPanelCollapsed && <span className="flex-1">New Chat</span>}
                    </button>
                    {!isPanelCollapsed && (
                        <div className="flex-1 overflow-y-auto">
                            {sessions.map(session => (
                                <div key={session.id} className={`p-2 rounded-md mb-2 cursor-pointer group flex justify-between items-center ${activeSessionId === session.id ? 'bg-slate-700' : 'hover:bg-slate-800'}`} onClick={() => setActiveSessionId(session.id)}>
                                {editingSessionId === session.id ? (
                                    <input 
                                        type="text" 
                                        value={editingName} 
                                        onChange={e => setEditingName(e.target.value)}
                                        onBlur={handleSaveEdit}
                                        onKeyDown={e => e.key === 'Enter' && handleSaveEdit()}
                                        className="bg-slate-600 text-white p-1 rounded w-full"
                                        autoFocus
                                    />
                                ) : (
                                    <>
                                    <p className="text-sm truncate flex-1">{session.name}</p>
                                    <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={(e) => { e.stopPropagation(); handleStartEditing(session);}} className="p-1 hover:text-white"><PencilIcon className="w-4 h-4" /></button>
                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id);}} className="p-1 hover:text-red-500"><TrashIcon className="w-4 h-4" /></button>
                                    </div>
                                    </>
                                )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <button onClick={() => setIsPanelCollapsed(p => !p)} className="p-2 flex items-center justify-center text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-input))] border-t border-[rgb(var(--color-border))]">
                    {isPanelCollapsed ? <PanelExpandIcon /> : <PanelCollapseIcon />}
                </button>
            </div>
            <div className="flex flex-col flex-1 pl-6 pb-6 pr-6">
                <div className="flex-1 overflow-y-auto pr-4">
                    {!activeSession || activeSession.messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-[rgb(var(--color-text-secondary))]">
                        <AIIcon className="w-16 h-16 mb-4" />
                        <h2 className="text-2xl font-semibold">{subject} Expert</h2>
                        <p className="mt-2">Ask me any question about {subject}!</p>
                    </div>
                    ) : (
                        activeSession.messages.map((msg, index) => <ChatBubble key={index} message={msg} />)
                    )}
                    <div ref={messagesEndRef} />
                </div>
                <div className="mt-6">
                    <div className="flex items-center bg-[rgb(var(--color-input))] rounded-lg p-2 border border-[rgb(var(--color-border))] focus-within:ring-2 focus-within:ring-[rgb(var(--color-primary))] transition-all">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder={`Ask about ${subject}...`}
                        className="flex-1 bg-transparent border-none focus:ring-0 text-[rgb(var(--color-text-primary))] placeholder-[rgb(var(--color-text-secondary))]"
                        disabled={isLoading || !activeSession}
                    />
                    <button
                        onClick={handleSend}
                        disabled={isLoading || input.trim() === '' || !activeSession}
                        className="p-2 rounded-md bg-[rgb(var(--color-primary))] text-white disabled:bg-slate-600 disabled:cursor-not-allowed hover:bg-[rgb(var(--color-primary-hover))] transition-colors"
                        aria-label="Send message"
                    >
                        {isLoading ? <LoadingSpinner /> : <SendIcon />}
                    </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};

export default SubjectChat;