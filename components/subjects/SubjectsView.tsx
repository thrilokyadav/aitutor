import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Card from '../common/Card';
import SubjectChat from './SubjectChat';
import SubjectTest from './SubjectTest';
import { BookIcon } from '../icons/BookIcon';
import { ChatIcon } from '../icons/ChatIcon';
import { QuizIcon } from '../icons/QuizIcon';


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
    const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
    const [mode, setMode] = useState<SubjectViewMode>('list');

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
                    <button onClick={handleBack} className="mb-4 text-[rgb(var(--color-accent))] hover:brightness-90">&larr; Back to All Subjects</button>
                    <h2 className="text-2xl font-bold text-[rgb(var(--color-text-primary))] mb-6">Subject: {selectedSubject}</h2>
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
                                        <h2 className="text-xl font-bold">Chat with Expert</h2>
                                        <p className="text-[rgb(var(--color-text-secondary))]">Ask questions and get detailed explanations.</p>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>
                        <motion.div variants={itemVariants}>
                            <Card onClick={() => setMode('test')} className="cursor-pointer hover:border-[rgb(var(--color-accent))] transition-colors h-full">
                                <div className="flex items-center gap-4">
                                    <QuizIcon className="w-8 h-8 text-[rgb(var(--color-accent))]" />
                                    <div>
                                        <h2 className="text-xl font-bold">Take Subject Test</h2>
                                        <p className="text-[rgb(var(--color-text-secondary))]">Customizable, timed tests.</p>
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
                                   <h2 className="text-lg font-bold">{subject}</h2>
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