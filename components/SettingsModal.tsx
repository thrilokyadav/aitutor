import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppContext } from '../contexts/AppContext';
import { Theme, UserProfile, ApiKeys } from '../types';

const THEMES: { id: Theme, name: string }[] = [
    { id: 'default', name: 'Cyberpunk Neon' },
    { id: 'solaris', name: 'Solaris Orange' },
    { id: 'galaxy', name: 'Galaxy Purple' },
    { id: 'midnight', name: 'Midnight Dusk' },
    { id: 'crimson', name: 'Crimson Code' },
    { id: 'forest', name: 'Forest Tech' },
    { id: 'ivory', name: 'Classic Ivory' },
];

const SettingsModal: React.FC = () => {
    const { 
        isSettingsOpen, 
        setIsSettingsOpen, 
        theme, 
        setTheme, 
        profile,
        setProfile,
        apiKeys,
        setApiKeys
    } = useAppContext();

    const [activeTab, setActiveTab] = useState('account');

    const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setProfile(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setApiKeys(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    if (!isSettingsOpen) return null;

    const renderContent = () => {
        const inputStyle = "w-full bg-[rgb(var(--color-input))] border border-[rgb(var(--color-border))] rounded-md p-2 text-[rgb(var(--color-text-primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--color-card))] focus-visible:ring-[rgb(var(--color-primary))] transition-all duration-200";
        switch (activeTab) {
            case 'account':
                return (
                     <div>
                        <h3 className="text-lg font-semibold mb-4">Account Information</h3>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="name" className="block text-sm text-[rgb(var(--color-text-secondary))] mb-1">Full Name</label>
                                <input type="text" name="name" id="name" value={profile.name} onChange={handleProfileChange} className={inputStyle} />
                            </div>
                             <div>
                                <label htmlFor="email" className="block text-sm text-[rgb(var(--color-text-secondary))] mb-1">Email Address</label>
                                <input type="email" name="email" id="email" value={profile.email} onChange={handleProfileChange} className={inputStyle} />
                            </div>
                            <div>
                                <label htmlFor="country" className="block text-sm text-[rgb(var(--color-text-secondary))] mb-1">Country</label>
                                <input type="text" name="country" id="country" value={profile.country} onChange={handleProfileChange} className={inputStyle} />
                            </div>
                        </div>
                    </div>
                );
            case 'theme':
                 return (
                    <div>
                        <h3 className="text-lg font-semibold mb-4">Theme Settings</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {THEMES.map(t => (
                                <motion.div 
                                    key={t.id} 
                                    onClick={() => setTheme(t.id)} 
                                    className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${theme === t.id ? 'border-[rgb(var(--color-primary))]' : 'border-[rgb(var(--color-border))] hover:border-slate-500'}`}
                                    whileHover={{ scale: 1.05 }}
                                    animate={{ scale: theme === t.id ? 1.05 : 1 }}
                                >
                                    <div className={`theme-${t.id} w-full h-12 rounded-md bg-gradient-to-br from-[rgb(var(--color-background-start))] to-[rgb(var(--color-background-end))] border border-[rgb(var(--color-border))]`}></div>
                                    <p className="mt-2 text-sm text-center font-medium text-[rgb(var(--color-text-secondary))]">{t.name}</p>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                );
            case 'apikeys':
                return (
                     <div>
                        <h3 className="text-lg font-semibold mb-4">API Keys (Bring Your Own Key)</h3>
                        <p className="text-sm text-[rgb(var(--color-text-secondary))] mb-4">
                           The Gemini API is configured globally. Optionally provide your own API keys for other services. Keys are stored securely in your browser's local storage.
                        </p>
                        <div className="space-y-4">
                             <div>
                                <label htmlFor="openai" className="block text-sm text-[rgb(var(--color-text-secondary))] mb-1">OpenAI API Key</label>
                                <input type="password" name="openai" id="openai" value={apiKeys.openai} onChange={handleApiKeyChange} className={inputStyle} />
                                <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-xs text-[rgb(var(--color-accent))] hover:underline">Get an OpenAI key</a>
                            </div>
                            <div>
                                <label htmlFor="perplexity" className="block text-sm text-[rgb(var(--color-text-secondary))] mb-1">Perplexity API Key</label>
                                <input type="password" name="perplexity" id="perplexity" value={apiKeys.perplexity} onChange={handleApiKeyChange} className={inputStyle} />
                                <a href="https://docs.perplexity.ai/docs/getting-started" target="_blank" rel="noopener noreferrer" className="text-xs text-[rgb(var(--color-accent))] hover:underline">Get a Perplexity key</a>
                            </div>
                        </div>
                    </div>
                );
        }
    }

    const TabButton: React.FC<{id: string, children: React.ReactNode}> = ({id, children}) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`p-2 text-left rounded-md text-sm w-full font-medium transition-colors ${activeTab === id ? 'bg-[rgb(var(--color-primary))] text-white' : 'text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-input))] hover:text-[rgb(var(--color-text-primary))]'}`}
        >
            {children}
        </button>
    )

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-md z-40 flex items-center justify-center p-4"
                onClick={() => setIsSettingsOpen(false)}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    className="bg-[rgb(var(--color-card))] w-full max-w-2xl rounded-xl border border-[rgb(var(--color-border))] shadow-2xl flex flex-col max-h-[90vh]"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="p-6 border-b border-[rgb(var(--color-border))]">
                        <h2 className="text-xl font-bold text-[rgb(var(--color-text-primary))]">Profile & Settings</h2>
                    </div>
                    <div className="flex flex-1 overflow-hidden">
                        <div className="w-48 border-r border-[rgb(var(--color-border))] p-4 bg-[rgb(var(--color-sidebar))]/50">
                            <nav className="flex flex-col gap-2">
                                <TabButton id="account">Account</TabButton>
                                <TabButton id="theme">Theme</TabButton>
                                <TabButton id="apikeys">API Keys</TabButton>
                            </nav>
                        </div>
                        <div className="flex-1 p-6 overflow-y-auto">
                           {renderContent()}
                        </div>
                    </div>
                     <div className="p-4 border-t border-[rgb(var(--color-border))] text-right bg-[rgb(var(--color-sidebar))] rounded-b-xl">
                        <button 
                            onClick={() => setIsSettingsOpen(false)}
                            className="px-4 py-2 bg-slate-700 text-[rgb(var(--color-text-primary))] rounded-lg hover:bg-slate-600 transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default SettingsModal;