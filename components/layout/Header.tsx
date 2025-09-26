import React from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { ActiveView } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';

const VIEW_TITLES: Record<ActiveView, string> = {
    [ActiveView.TUTOR]: 'AI Tutor',
    [ActiveView.SUBJECTS]: 'Subjects',
    [ActiveView.EXPLAINER]: 'Topic Explainer',
    [ActiveView.QUIZ]: 'Quiz Generator',
    [ActiveView.NEWS]: 'Current Affairs',
    [ActiveView.PLANNER]: 'Study Planner',
    [ActiveView.DASHBOARD]: 'Dashboard',
    [ActiveView.NOTES]: 'Notes',
    [ActiveView.HELP]: 'Help',
    [ActiveView.COMPETITION]: 'Competitive',
    [ActiveView.ADMIN]: 'Admin',
};

const Header: React.FC = () => {
    const { activeView, activeSubject } = useAppContext();
    const { signOut } = useAuth();
    const { lang, setLang, t } = useI18n();
    const title = VIEW_TITLES[activeView] || 'Dashboard';
    
    const toggleAssistant = () => {
        window.dispatchEvent(new CustomEvent('toggle-global-assistant'));
    };

    return (
        <header className="flex-shrink-0 bg-[rgb(var(--color-card))]/50 border-b border-[rgb(var(--color-border))] px-6 py-4">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">
                        {title}
                        {activeView === ActiveView.SUBJECTS && activeSubject && (
                            <span className="text-[rgb(var(--color-text-secondary))]">: {activeSubject}</span>
                        )}
                    </h1>
                    {activeView === ActiveView.TUTOR && <p className="text-sm text-[rgb(var(--color-text-secondary))]">Your personal AI assistant for ALL GOV preparation.</p>}
                    {activeView === ActiveView.NEWS && <p className="text-sm text-[rgb(var(--color-text-secondary))]">Get daily news summaries powered by AI search.</p>}
                    {activeView === ActiveView.PLANNER && <p className="text-sm text-[rgb(var(--color-text-secondary))]">Organize your study schedule and generate AI-powered guides.</p>}
                    {activeView === ActiveView.DASHBOARD && <p className="text-sm text-[rgb(var(--color-text-secondary))]">View subject-wise performance and track progress over time.</p>}
                    {activeView === ActiveView.NOTES && <p className="text-sm text-[rgb(var(--color-text-secondary))]">Create, manage, and review your saved notes.</p>}
                    {activeView === ActiveView.HELP && <p className="text-sm text-[rgb(var(--color-text-secondary))]">How to use EASYWAY Tutor and its features.</p>}
                </div>
                <div className="pt-1 flex items-center gap-2">
                    <button
                        onClick={toggleAssistant}
                        className="text-sm px-3 py-2 rounded-md border border-[rgb(var(--color-border))] bg-[rgb(var(--color-input))] text-white hover:bg-[rgb(var(--color-input-hover))]"
                        aria-label="Toggle Global Assistant"
                    >
                        {t('assistant')}
                    </button>
                    <div className="flex items-center gap-1 text-xs">
                      <button
                        onClick={() => setLang('en')}
                        className={`px-2 py-1 rounded ${lang === 'en' ? 'bg-[rgb(var(--color-primary))] text-white' : 'bg-[rgb(var(--color-input))] text-[rgb(var(--color-text-primary))]'}`}
                        title="English"
                      >EN</button>
                      <button
                        onClick={() => setLang('kn')}
                        className={`px-2 py-1 rounded ${lang === 'kn' ? 'bg-[rgb(var(--color-primary))] text-white' : 'bg-[rgb(var(--color-input))] text-[rgb(var(--color-text-primary))]'}`}
                        title="Kannada"
                      >KN</button>
                    </div>
                    <button
                        onClick={signOut}
                        className="text-sm px-3 py-2 rounded-md bg-red-600 text-white hover:bg-red-700"
                    >
                        {t('logout')}
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header;