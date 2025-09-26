import React, { createContext, useState, useContext, Dispatch, SetStateAction, useEffect } from 'react';
import { ActiveView, Theme, UserProfile, ApiKeys, QuizConfig } from '../types';
import useLocalStorage from '../hooks/useLocalStorage';

interface AppContextType {
    activeView: ActiveView;
    setActiveView: Dispatch<SetStateAction<ActiveView>>;
    activeSubject: string | null;
    setActiveSubject: Dispatch<SetStateAction<string | null>>;
    explainerPrefillTopic: string | null;
    setExplainerPrefillTopic: Dispatch<SetStateAction<string | null>>;
    quizPrefill: QuizConfig | null;
    setQuizPrefill: Dispatch<SetStateAction<QuizConfig | null>>;
    isSettingsOpen: boolean;
    setIsSettingsOpen: Dispatch<SetStateAction<boolean>>;
    theme: Theme;
    setTheme: (theme: Theme) => void;
    profile: UserProfile;
    setProfile: Dispatch<SetStateAction<UserProfile>>;
    apiKeys: ApiKeys;
    setApiKeys: Dispatch<SetStateAction<ApiKeys>>;
    isSidebarCollapsed: boolean;
    setIsSidebarCollapsed: Dispatch<SetStateAction<boolean>>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [activeView, setActiveView] = useState<ActiveView>(ActiveView.TUTOR);
    const [activeSubject, setActiveSubject] = useState<string | null>(null);
    const [explainerPrefillTopic, setExplainerPrefillTopic] = useState<string | null>(null);
    const [quizPrefill, setQuizPrefill] = useState<QuizConfig | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    
    const [theme, setThemeState] = useLocalStorage<Theme>('easyway-theme', 'default');
    const [profile, setProfile] = useLocalStorage<UserProfile>('easyway-profile', { name: '', email: '', country: '', state: '', district: '' });
    const [apiKeys, setApiKeys] = useLocalStorage<ApiKeys>('easyway-apikeys', { openai: '', perplexity: '' });
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useLocalStorage<boolean>('easyway-sidebar-collapsed', false);

    useEffect(() => {
        const root = document.documentElement;
        root.className = `theme-${theme}`;
    }, [theme]);

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
    };

    const value = {
        activeView,
        setActiveView,
        activeSubject,
        setActiveSubject,
        explainerPrefillTopic,
        setExplainerPrefillTopic,
        quizPrefill,
        setQuizPrefill,
        isSettingsOpen,
        setIsSettingsOpen,
        theme,
        setTheme,
        profile,
        setProfile,
        apiKeys,
        setApiKeys,
        isSidebarCollapsed,
        setIsSidebarCollapsed,
    };

    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    );
};

export const useAppContext = (): AppContextType => {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
};