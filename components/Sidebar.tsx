import React from 'react';
import { motion } from 'framer-motion';
import { ActiveView } from '../types';
import { ChatIcon } from './icons/ChatIcon';
import { BookIcon } from './icons/BookIcon';
import { QuizIcon } from './icons/QuizIcon';
import { NewsIcon } from './icons/NewsIcon';
import { SubjectsIcon } from './icons/SubjectsIcon';
import { PlannerIcon } from './icons/PlannerIcon';
import { ChartBarIcon } from './icons/ChartBarIcon';
import { DocumentTextIcon } from './icons/DocumentTextIcon';
import { useAppContext } from '../contexts/AppContext';
import UserProfile from './layout/UserProfile';
import { ChevronDoubleLeftIcon } from './icons/ChevronDoubleLeftIcon';
import { ChevronDoubleRightIcon } from './icons/ChevronDoubleRightIcon';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  isCollapsed: boolean;
  onClick: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, isActive, isCollapsed, onClick }) => (
  <button
    onClick={onClick}
    className={`relative flex items-center w-full px-3 sm:px-4 py-3 sm:py-3 text-sm font-medium rounded-lg transition-all duration-200 transform hover:scale-105 group min-h-[44px] sm:min-h-0 ${
      isActive
        ? 'text-white'
        : 'text-[rgb(var(--color-text-secondary))] hover:bg-slate-700/50 hover:text-white'
    } ${isCollapsed ? 'justify-center' : ''}`}
    aria-label={label}
    title={isCollapsed ? label : ''}
  >
    {isActive && (
       <motion.div
        layoutId="active-nav-indicator"
        className="absolute inset-0 bg-gradient-to-r from-[rgb(var(--color-primary))] to-[rgb(var(--color-accent))] rounded-lg shadow-lg animated-gradient-bg"
        initial={false}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
       />
    )}
    <div className="relative z-10 flex items-center">
        {icon}
        <span className={`ml-3 whitespace-nowrap transition-opacity duration-300 ${isCollapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>{label}</span>
    </div>
  </button>
);

const Sidebar: React.FC = () => {
  const { activeView, setActiveView, isSidebarCollapsed, setIsSidebarCollapsed } = useAppContext();
  const { user, signOut } = useAuth();
  const { lang, setLang, t } = useI18n();
  const navItems = [
    { view: ActiveView.DASHBOARD, label: t('menu_dashboard'), icon: <ChartBarIcon /> },
    { view: ActiveView.TUTOR, label: t('menu_ai_tutor'), icon: <ChatIcon /> },
    { view: ActiveView.SUBJECTS, label: t('menu_subjects'), icon: <SubjectsIcon /> },
    { view: ActiveView.EXPLAINER, label: t('menu_topic_explainer'), icon: <BookIcon /> },
    { view: ActiveView.QUIZ, label: t('menu_quiz_generator'), icon: <QuizIcon /> },
    { view: ActiveView.COMPETITION, label: t('menu_competitive'), icon: <QuizIcon /> },
    { view: ActiveView.NEWS, label: t('menu_current_affairs'), icon: <NewsIcon /> },
    { view: ActiveView.PLANNER, label: t('menu_planner'), icon: <PlannerIcon /> },
    { view: ActiveView.NOTES, label: t('menu_notes'), icon: <DocumentTextIcon /> },
    { view: ActiveView.HELP, label: t('menu_help'), icon: <DocumentTextIcon /> },
  ];

  return (
    <aside className={`bg-[rgb(var(--color-sidebar))] p-3 sm:p-4 flex flex-col flex-shrink-0 border-r border-[rgb(var(--color-border))] transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'w-20' : 'w-64'}`}>
      <div className={`flex items-center mb-6 sm:mb-8 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
        <div className="p-2 bg-gradient-to-br from-[rgb(var(--color-primary))] to-[rgb(var(--color-accent))] animated-gradient-bg rounded-lg">
           <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
        </div>
        <h1 className={`ml-3 text-lg sm:text-xl font-bold text-white whitespace-nowrap transition-opacity duration-300 ${isSidebarCollapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>EASYWAY Tutor</h1>
      </div>
      <nav className="flex flex-col space-y-2">
        {navItems
          .filter(item => item.view !== ActiveView.ADMIN)
          .map((item) => (
          <NavItem
            key={item.view}
            icon={item.icon}
            label={item.label}
            view={item.view}
            isActive={activeView === item.view}
            isCollapsed={isSidebarCollapsed}
            onClick={() => setActiveView(item.view)}
          />
        ))}
        {/* Admin entry visible only to specific email */}
        {user?.email === 'info.edensnews@gmail.com' && (
          <NavItem
            key={ActiveView.ADMIN}
            icon={<ChartBarIcon />}
            label={t('menu_admin')}
            view={ActiveView.ADMIN}
            isActive={activeView === ActiveView.ADMIN}
            isCollapsed={isSidebarCollapsed}
            onClick={() => setActiveView(ActiveView.ADMIN)}
          />
        )}
      </nav>
      <div className="mt-auto space-y-3 sm:space-y-4">
        <button
          onClick={() => setIsSidebarCollapsed(prev => !prev)}
          className="w-full flex items-center justify-center p-2 sm:p-2 rounded-lg text-[rgb(var(--color-text-secondary))] hover:bg-slate-700/50 hover:text-white transition-colors min-h-[44px] sm:min-h-0"
          title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isSidebarCollapsed ? <ChevronDoubleRightIcon /> : <ChevronDoubleLeftIcon />}
        </button>
        <UserProfile isCollapsed={isSidebarCollapsed} />
        {/* Language toggle */}
        <div className={`flex ${isSidebarCollapsed ? 'justify-center' : 'justify-between'} items-center gap-2`}>
          {!isSidebarCollapsed && <span className="text-xs text-[rgb(var(--color-text-secondary))]">{t('language')}</span>}
          <div className="flex items-center gap-1">
            <button onClick={() => setLang('en')} className={`px-2 py-1 text-xs rounded ${lang === 'en' ? 'bg-[rgb(var(--color-primary))] text-white' : 'bg-[rgb(var(--color-input))] text-[rgb(var(--color-text-primary))]'}`}>EN</button>
            <button onClick={() => setLang('kn')} className={`px-2 py-1 text-xs rounded ${lang === 'kn' ? 'bg-[rgb(var(--color-primary))] text-white' : 'bg-[rgb(var(--color-input))] text-[rgb(var(--color-text-primary))]'}`}>KN</button>
          </div>
        </div>
        {/* Logout */}
        <button
          onClick={signOut}
          className="w-full px-3 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 text-sm"
        >
          {t('logout')}
        </button>
        <div className={`text-xs text-slate-500 text-center transition-opacity duration-300 ${isSidebarCollapsed ? 'opacity-0' : 'opacity-100'}`}>
          <p>&copy; 2024 AI Learning Platform</p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;