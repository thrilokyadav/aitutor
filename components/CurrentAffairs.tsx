import React, { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { GroundingChunk, CurrentAffairsQuery, CurrentAffairsSession } from '../types';
import { LoadingSpinner } from './common/LoadingSpinner';
import Card from './common/Card';
import { NewsIcon } from './icons/NewsIcon';
import { useAppContext } from '../contexts/AppContext';
import useLocalStorage from '../hooks/useLocalStorage';
import PerplexityService from '../services/perplexityService';
import GeminiService from '../services/geminiService';
import { useI18n } from '../contexts/I18nContext';
import MarkdownRenderer from './common/MarkdownRenderer';
import { PanelCollapseIcon } from './icons/PanelCollapseIcon';
import { PanelExpandIcon } from './icons/PanelExpandIcon';

const SESSIONS_KEY = 'easyway-tutor-current-affairs-sessions';

const CurrentAffairs: React.FC = () => {
  const [sessions, setSessions] = useLocalStorage<CurrentAffairsSession[]>(SESSIONS_KEY, []);
  const [activeSession, setActiveSession] = useState<CurrentAffairsSession | null>(null);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  
  const [query, setQuery] = useState<CurrentAffairsQuery>({
    date: new Date().toISOString().split('T')[0],
    keywords: '',
    region: 'National',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { apiKeys, setActiveView, setExplainerPrefillTopic, setQuizPrefill } = useAppContext();
  
  const { lang, t } = useI18n();
  const newsService = useMemo(() => {
    if (apiKeys.perplexity) {
      return new PerplexityService(apiKeys.perplexity);
    }
    // Fallback to Gemini if no Perplexity key
    return new GeminiService();
  }, [apiKeys.perplexity]);

  const handleSearch = useCallback(async (searchQuery: CurrentAffairsQuery) => {
    setIsLoading(true);
    setError(null);
    setActiveSession(null);

    try {
      let summary: string;
      let sources: GroundingChunk[];
      if (lang === 'kn') {
        // Force Kannada by using Gemini regardless of Perplexity key
        const gemini = new GeminiService();
        const res = await gemini.getCurrentAffairs(searchQuery, lang);
        summary = res.summary;
        sources = res.sources;
      } else if (apiKeys.perplexity) {
        const res = await newsService.getCurrentAffairs(searchQuery);
        summary = res.summary;
        sources = res.sources;
      } else {
        const gemini = new GeminiService();
        const res = await gemini.getCurrentAffairs(searchQuery, lang);
        summary = res.summary;
        sources = res.sources;
      }
      
      const newSession: CurrentAffairsSession = {
        id: `session-${Date.now()}`,
        query: searchQuery,
        summary,
        sources,
        timestamp: Date.now(),
      };
      
      setSessions(prev => [newSession, ...prev].slice(0, 20)); // Keep last 20 sessions
      setActiveSession(newSession);

    } catch (err) {
      setError('Failed to fetch current affairs. Please check your API key and try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [newsService, setSessions]);

  const handleHistoryClick = (session: CurrentAffairsSession) => {
    setQuery(session.query);
    setActiveSession(session);
  }

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <LoadingSpinner className="w-12 h-12 mb-4" />
          <p className="text-[rgb(var(--color-text-secondary))]">{`Fetching news for "${query.keywords || query.date}"...`}</p>
        </div>
      );
    }
    if (error) {
       return <Card><p className="text-red-400">{error}</p></Card>;
    }
    if (activeSession) {
      return (
        <Card>
          <h2 className="text-xl font-bold mb-4 text-[rgb(var(--color-accent))]">
            {t('summary_for')} {new Date(activeSession.query.date + 'T12:00:00Z').toLocaleDateString()}
          </h2>
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <button
              className="px-3 py-2 text-sm rounded-md bg-[rgb(var(--color-primary))] text-white hover:bg-[rgb(var(--color-primary-hover))]"
              onClick={() => {
                const topic = activeSession.query.keywords || `Current Affairs ${activeSession.query.date}`;
                setQuizPrefill({ topic, numQuestions: 10, difficulty: 'Medium' });
                setActiveView('QUIZ' as any);
              }}
            >
              {t('generate_quiz_on_summary')}
            </button>
            <button
              className="px-3 py-2 text-sm rounded-md bg-[rgb(var(--color-input))] hover:bg-[rgb(var(--color-input-hover))]"
              onClick={() => {
                const topic = activeSession.query.keywords || `Current Affairs ${activeSession.query.date}`;
                setExplainerPrefillTopic(topic);
                setActiveView('EXPLAINER' as any);
              }}
            >
              {t('explain_this_summary')}
            </button>
          </div>
          <MarkdownRenderer content={activeSession.summary} />
          {activeSession.sources.length > 0 && (
            <div className="mt-6 border-t border-[rgb(var(--color-border))] pt-4">
              <h3 className="font-semibold text-lg text-[rgb(var(--color-text-secondary))] mb-2">{t('sources')}:</h3>
              <ul className="list-disc list-inside space-y-2">
                {activeSession.sources.map((source, index) => (
                  <li key={index}>
                    <a href={source.web.uri} target="_blank" rel="noopener noreferrer" className="text-[rgb(var(--color-accent))] hover:underline">
                      {source.web.title || source.web.uri}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      );
    }
    return (
      <div className="text-center text-[rgb(var(--color-text-secondary))] py-16">
        <NewsIcon className="mx-auto w-12 h-12 mb-4" />
        <p>{t('use_form_hint')}</p>
        {!apiKeys.perplexity && (
            <p className="mt-4 text-yellow-400 text-sm">{t('gemini_tip')}</p>
        )}
      </div>
    );
  };
  
  const formInputStyle = "w-full bg-[rgb(var(--color-input))] border border-[rgb(var(--color-border))] rounded-lg p-2 text-[rgb(var(--color-text-primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--color-background-start))] focus-visible:ring-[rgb(var(--color-primary))] transition-all duration-200";

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
         <button onClick={() => setIsPanelCollapsed(p => !p)} className="absolute -left-4 top-2 z-10 lg:hidden p-2 bg-[rgb(var(--color-card))] rounded-full border border-[rgb(var(--color-border))]">
            {isPanelCollapsed ? <PanelExpandIcon /> : <PanelCollapseIcon />}
        </button>

        <div className={`lg:col-span-1 flex-col gap-6 transition-all duration-300 ${isPanelCollapsed ? 'hidden lg:flex' : 'flex'}`}>
            <Card>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">{t('search_current_affairs')}</h2>
                     <button onClick={() => setIsPanelCollapsed(p => !p)} className="hidden lg:block p-1 text-[rgb(var(--color-text-secondary))] hover:text-white">
                        <PanelCollapseIcon />
                    </button>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); handleSearch(query); }} className="space-y-4">
                <div>
                    <label htmlFor="date" className="block text-sm font-medium text-[rgb(var(--color-text-secondary))] mb-1">{t('date')}</label>
                    <input type="date" id="date" value={query.date} onChange={e => setQuery(q => ({...q, date: e.target.value}))} className={formInputStyle} />
                </div>
                <div>
                    <label htmlFor="keywords" className="block text-sm font-medium text-[rgb(var(--color-text-secondary))] mb-1">{t('keywords_optional')}</label>
                    <input type="text" id="keywords" value={query.keywords} onChange={e => setQuery(q => ({...q, keywords: e.target.value}))} placeholder={t('keywords_placeholder')} className={formInputStyle} />
                </div>
                <div>
                    <label htmlFor="region" className="block text-sm font-medium text-[rgb(var(--color-text-secondary))] mb-1">{t('region')}</label>
                    <select id="region" value={query.region} onChange={e => setQuery(q => ({...q, region: e.target.value}))} className={formInputStyle}>
                        <option>{t('region_national')}</option>
                        <option>{t('region_international')}</option>
                        <option>{t('region_global')}</option>
                    </select>
                </div>
                <button type="submit" disabled={isLoading} className="w-full p-2 bg-[rgb(var(--color-primary))] text-white font-semibold rounded-lg hover:bg-[rgb(var(--color-primary-hover))] disabled:bg-slate-600">
                    {isLoading ? <LoadingSpinner /> : t('get_summary')}
                </button>
                </form>
            </Card>
            <Card className="flex-1">
                <h2 className="text-xl font-bold mb-4">{t('history')}</h2>
                <div className="space-y-2 overflow-y-auto max-h-96">
                    {sessions.length > 0 ? sessions.map(s => (
                        <div key={s.id} onClick={() => handleHistoryClick(s)} className={`p-2 rounded-md cursor-pointer transition-colors ${activeSession?.id === s.id ? 'bg-slate-700' : 'bg-slate-800 hover:bg-slate-700'}`}>
                            <p className="font-semibold text-sm truncate">{s.query.keywords || 'General Summary'}</p>
                            <p className="text-xs text-[rgb(var(--color-text-secondary))]">{new Date(s.query.date + 'T12:00:00Z').toLocaleDateString()}</p>
                        </div>
                    )) : (
                        <p className="text-sm text-center text-[rgb(var(--color-text-secondary))]">{t('no_search_history')}</p>
                    )}
                </div>
            </Card>
        </div>

        <div className={`${isPanelCollapsed ? 'lg:col-span-3' : 'lg:col-span-2'}`}>
            {isPanelCollapsed && (
                <button onClick={() => setIsPanelCollapsed(false)} className="hidden lg:block absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 p-2 bg-[rgb(var(--color-card))] rounded-full border border-[rgb(var(--color-border))]">
                    <PanelExpandIcon />
                </button>
            )}
            {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default CurrentAffairs;