import React from 'react';
// FIX: Import Transition type to fix type inference issue for the `ease` property.
import { motion, AnimatePresence, Transition } from 'framer-motion';
import { ActiveView } from './types';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import TopicExplainer from './components/TopicExplainer';
import QuizGenerator from './components/QuizGenerator';
import CurrentAffairs from './components/CurrentAffairs';
import SubjectsView from './components/subjects/SubjectsView';
import PlannerView from './components/planner/PlannerView';
import GlobalAssistant from './components/GlobalAssistant';
import SettingsModal from './components/SettingsModal';
import { useAppContext } from './contexts/AppContext';
import MainLayout from './components/layout/MainLayout';
import DashboardView from './components/dashboard/DashboardView';
import NotesView from './components/notes/NotesView';
import HelpView from './components/help/HelpView';
import { useAuth } from './contexts/AuthContext';
import LoginScreen from './components/auth/LoginScreen';
import OnboardingForm from './components/auth/OnboardingForm';
import { useProfile } from './hooks/useProfile';
import CompetitiveView from './components/competitive/CompetitiveView';
import AdminView from './components/admin/AdminView';

const pageVariants = {
  initial: { opacity: 0, scale: 0.98 },
  in: { opacity: 1, scale: 1 },
  out: { opacity: 0, scale: 1.02 },
};

// FIX: Explicitly type `pageTransition` with the `Transition` type from framer-motion.
// This ensures properties like `ease` are correctly validated against allowed string literal values.
const pageTransition: Transition = {
  type: 'tween',
  ease: 'easeInOut',
  duration: 0.4,
};

const App: React.FC = () => {
  const { activeView, setActiveView, setActiveSubject } = useAppContext();
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile(user?.id ?? null);

  const renderActiveView = () => {
    switch (activeView) {
      case ActiveView.TUTOR:
        return <ChatInterface />;
      case ActiveView.EXPLAINER:
        return <TopicExplainer />;
      case ActiveView.QUIZ:
        return <QuizGenerator />;
      case ActiveView.COMPETITION:
        return <CompetitiveView />;
      case ActiveView.NEWS:
        return <CurrentAffairs />;
      case ActiveView.SUBJECTS:
        return <SubjectsView setActiveSubject={setActiveSubject} />;
      case ActiveView.PLANNER:
        return <PlannerView />;
      case ActiveView.DASHBOARD:
        return <DashboardView />;
      case ActiveView.NOTES:
        return <NotesView />;
      case ActiveView.HELP:
        return <HelpView />;
      case ActiveView.ADMIN:
        return <AdminView />;
      default:
        return <ChatInterface />;
    }
  };

  return (
    <div className="flex h-screen bg-[rgb(var(--color-background-start))] text-[rgb(var(--color-text-primary))] font-sans overflow-hidden">
      {authLoading ? (
        <div className="flex-1 flex items-center justify-center">Loading...</div>
      ) : !user ? (
        <div className="flex-1">
          <LoginScreen />
        </div>
      ) : profileLoading ? (
        <div className="flex-1 flex items-center justify-center">Loading profile...</div>
      ) : !profile ? (
        <div className="flex-1">
          <OnboardingForm onDone={() => window.location.reload()} />
        </div>
      ) : (
        <>
          <Sidebar />
          <main className="flex-1 flex flex-col overflow-hidden relative">
            <MainLayout>
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeView}
                  initial="initial"
                  animate="in"
                  exit="out"
                  variants={pageVariants}
                  transition={pageTransition}
                  className="h-full w-full"
                >
                  {renderActiveView()}
                </motion.div>
              </AnimatePresence>
            </MainLayout>
            <GlobalAssistant />
          </main>
          <SettingsModal />
        </>
      )}
    </div>
  );
};

export default App;