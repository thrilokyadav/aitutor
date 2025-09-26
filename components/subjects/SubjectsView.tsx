import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Card from '../common/Card';
import SubjectChat from './SubjectChat';
import SubjectTest from './SubjectTest';
import { BookIcon } from '../icons/BookIcon';
import { ChatIcon } from '../icons/ChatIcon';
import { QuizIcon } from '../icons/QuizIcon';
import { useI18n } from '../../contexts/I18nContext';


const ALL_GOV_SUBJECTS = [
    "Indian Polity & Governance",
    "Modern Indian History",
    "Ancient & Medieval History",
    "Geography (India & World)",
    "Indian Economy",
    "Environment and Ecology",
    "Science and Technology",
    "Art and Culture",
    "International Relations",
    "Internal Security",
    "Ethics, Integrity & Aptitude",
    "Social Justice"
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1 },
};

type SubjectViewMode = 'list' | 'chat' | 'test';

interface SubjectsViewProps {
    setActiveSubject: (subject: string | null) => void;
}

const SubjectsView: React.FC<SubjectsViewProps> = ({ setActiveSubject }) => {
    const { lang } = useI18n();
    const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
    const [mode, setMode] = useState<SubjectViewMode>('list');

    // Simple Kannada mapping for subjects
    const SUBJECTS_KN: Record<string, string> = {
      'Indian Polity & Governance': 'ಭಾರತದ ರಾಜಕೀಯ ಹಾಗೂ ಆಡಳಿತ',
      'Modern Indian History': 'ಆಧುನಿಕ ಭಾರತೀಯ ಇತಿಹಾಸ',
      'Ancient & Medieval History': 'ಪ್ರಾಚೀನ ಮತ್ತು ಮಧ್ಯಯುಗೀನ ಇತಿಹಾಸ',
      'Geography (India & World)': 'ಭೂಗೋಳ (ಭಾರತ ಮತ್ತು ವಿಶ್ವ)',
      'Indian Economy': 'ಭಾರತೀಯ ಅರ್ಥವ್ಯವಸ್ಥೆ',
      'Environment and Ecology': 'ಪರಿಸರ ಮತ್ತು ಪರಿಸರಶಾಸ್ತ್ರ',
      'Science and Technology': 'ವಿಜ್ಞಾನ ಮತ್ತು ತಂತ್ರಜ್ಞಾನ',
      'Art and Culture': 'ಕಲೆ ಮತ್ತು ಸಂಸ್ಕೃತಿ',
      'International Relations': 'ಅಂತಾರಾಷ್ಟ್ರೀಯ ಸಂಬಂಧಗಳು',
      'Internal Security': 'ಆಂತರಿಕ ಸುರಕ್ಷತೆ',
      'Ethics, Integrity & Aptitude': 'ನೈತಿಕತೆ, ಪ್ರಾಮಾಣಿಕತೆ ಮತ್ತು ಅಭಿರುಚಿ',
      'Social Justice': 'ಸಾಮಾಜಿಕ ನ್ಯಾಯ',
    };

    const tr = (en: string, kn: string) => (lang === 'kn' ? kn : en);

    useEffect(() => {
        setActiveSubject(selectedSubject);
        return () => setActiveSubject(null);
    }, [selectedSubject, setActiveSubject]);

    const handleSubjectSelect = (subject: string) => {
        setSelectedSubject(subject);
        setMode('list'); // Reset to option list
    };

    const handleBack = () => {
        setSelectedSubject(null);
        setMode('list');
    };

    const handleBackToSubjects = () => {
        setMode('list');
    };

    if (selectedSubject) {
        if (mode === 'chat') {
            return <SubjectChat subject={selectedSubject} onBack={handleBackToSubjects} />;
        }
        if (mode === 'test') {
            return <SubjectTest subject={selectedSubject} onBack={handleBackToSubjects} />;
        }
        
        return (
            <div className="p-6 h-full overflow-y-auto">
                <div className="max-w-4xl mx-auto">
                    <button onClick={handleBack} className="mb-4 text-[rgb(var(--color-accent))] hover:brightness-90">&larr; {tr('Back to All Subjects', 'ಎಲ್ಲಾ ವಿಷಯಗಳಿಗೆ ಹಿಂದಿರುಗಿ')}</button>
                    <h2 className="text-2xl font-bold text-[rgb(var(--color-text-primary))] mb-6">{tr('Subject', 'ವಿಷಯ')}: {lang === 'kn' ? (SUBJECTS_KN[selectedSubject] || selectedSubject) : selectedSubject}</h2>
                    <motion.div 
                        className="grid grid-cols-1 md:grid-cols-2 gap-6"
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        <motion.div variants={itemVariants}>
                            <Card onClick={() => setMode('chat')} className="cursor-pointer hover:border-[rgb(var(--color-accent))] transition-colors h-full">
                                <div className="flex items-center gap-4">
                                    <ChatIcon className="w-8 h-8 text-[rgb(var(--color-accent))]" />
                                    <div>
                                        <h2 className="text-xl font-bold">{tr('Chat with Expert', 'ತಜ್ಞರೊಂದಿಗೆ ಚಾಟ್ ಮಾಡಿ')}</h2>
                                        <p className="text-[rgb(var(--color-text-secondary))]">{tr('Ask questions and get detailed explanations.', 'ಪ್ರಶ್ನೆಗಳು ಕೇಳಿ ಮತ್ತು ವಿವರವಾದ ವಿವರಣೆಗಳನ್ನು ಪಡೆಯಿರಿ.')}</p>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>
                        <motion.div variants={itemVariants}>
                            <Card onClick={() => setMode('test')} className="cursor-pointer hover:border-[rgb(var(--color-accent))] transition-colors h-full">
                                <div className="flex items-center gap-4">
                                    <QuizIcon className="w-8 h-8 text-[rgb(var(--color-accent))]" />
                                    <div>
                                        <h2 className="text-xl font-bold">{tr('Take Subject Test', 'ವಿಷಯ ಪರೀಕ್ಷೆ ತೆಗೆದುಕೊಳ್ಳಿ')}</h2>
                                        <p className="text-[rgb(var(--color-text-secondary))]">{tr('Customizable, timed tests.', 'ಅನ್ವಯಿಸಬಹುದಾದ, ಸಮಯಮಿತ ಪರೀಕ್ಷೆಗಳು.')}</p>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>
                    </motion.div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 h-full overflow-y-auto">
            <div className="max-w-5xl mx-auto">
                <motion.div 
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                >
                    {ALL_GOV_SUBJECTS.map(subject => (
                        <motion.div key={subject} variants={itemVariants}>
                            <Card onClick={() => handleSubjectSelect(subject)} className="cursor-pointer hover:border-[rgb(var(--color-accent))] transition-colors h-full flex flex-col justify-center">
                                <div className="flex items-center gap-4">
                                   <BookIcon className="w-8 h-8 text-[rgb(var(--color-accent))] flex-shrink-0"/>
                                   <h2 className="text-lg font-bold">{lang === 'kn' ? (SUBJECTS_KN[subject] || subject) : subject}</h2>
                                </div>
                            </Card>
                        </motion.div>
                    ))}
                </motion.div>
            </div>
        </div>
    );
};

export default SubjectsView;