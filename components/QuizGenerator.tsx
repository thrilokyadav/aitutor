import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, useSpring, useTransform, AnimatePresence } from 'framer-motion';
import GeminiService from '../services/geminiService';
import { QuizQuestion, QuizDifficulty, QuizResult } from '../types';
import { LoadingSpinner } from './common/LoadingSpinner';
import Card from './common/Card';
import { QuizIcon } from './icons/QuizIcon';
import { useAppContext } from '../contexts/AppContext';
import MarkdownRenderer from './common/MarkdownRenderer';
import useLocalStorage from '../hooks/useLocalStorage';
import { HistoryIcon } from './icons/HistoryIcon';
import { ChartBarIcon } from './icons/ChartBarIcon';
import { CloseIcon } from './icons/CloseIcon';
import { supabase, SUPABASE_ENABLED } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

const SECONDS_PER_QUESTION = 90;
const QUIZ_RESULTS_KEY = 'easyway-tutor-quiz-results';

const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
};

const AnimatedScore = ({ score }: { score: number }) => {
  const motionScore = useSpring(0, { stiffness: 100, damping: 30 });
  const displayScore = useTransform(motionScore, (latest) => Math.round(latest));

  useEffect(() => {
    motionScore.set(score);
  }, [score, motionScore]);

  return <motion.span>{displayScore}</motion.span>;
};

const QuizGenerator: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [numQuestions, setNumQuestions] = useState<number>(10);
  const [difficulty, setDifficulty] = useState<QuizDifficulty>('Medium');
  
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<(number | null)[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [timeLeft, setTimeLeft] = useState(0);

  const [quizHistory, setQuizHistory] = useLocalStorage<QuizResult[]>(QUIZ_RESULTS_KEY, []);
  const [isHistoryVisible, setIsHistoryVisible] = useState(false);
  const [reviewingQuiz, setReviewingQuiz] = useState<QuizResult | null>(null);

  const geminiService = useMemo(() => new GeminiService(), []);
  const { user, signInWithGoogle } = useAuth();

  const saveQuizResult = useCallback(async () => {
     if (questions.length === 0) return;
     const score = userAnswers.reduce((acc, answer, index) => {
        return answer === questions[index]?.correctAnswerIndex ? acc + 1 : acc;
     }, 0);

     const result: QuizResult = {
        id: `quiz-${Date.now()}`,
        topicOrSubject: topic,
        difficulty,
        score,
        totalQuestions: questions.length,
        timestamp: Date.now(),
        questions,
        userAnswers,
     };
     setQuizHistory(prev => [result, ...prev].slice(0, 50)); // Keep last 50

      // Persist a summary row to Supabase tests for dashboard analytics
      try {
        if (SUPABASE_ENABLED && user) {
          const percent = Math.round((score / Math.max(1, questions.length)) * 100);
          // Insert test summary and get test_id
          const { data: testRow, error: testErr } = await supabase
            .from('tests')
            .insert({
              user_id: user.id,
              subject: topic || 'General',
              topic: topic || null,
              score: percent,
            })
            .select('id')
            .single();
          if (testErr) throw testErr;
          const testId = (testRow as any)?.id as string | undefined;

          // Insert per-question attempts for deeper analytics
          if (testId) {
            const attempts = questions.map((q, idx) => ({
              test_id: testId,
              user_id: user.id,
              subject: (topic || 'General'),
              topic: (topic || null),
              question: q.question,
              chosen_index: userAnswers[idx],
              correct_index: q.correctAnswerIndex,
              is_correct: userAnswers[idx] === q.correctAnswerIndex,
            }));
            // Best-effort insert; ignore partial errors to avoid blocking UI
            await supabase.from('test_attempts').insert(attempts);
          }
        }
      } catch (e) {
        // Non-fatal: we still keep local history
        // eslint-disable-next-line no-console
        console.warn('Failed to persist quiz result to Supabase', e);
      }
  }, [questions, userAnswers, topic, difficulty, setQuizHistory, user]);

  const handleSubmit = useCallback(async () => {
    setShowResults(true);
    if (!user && SUPABASE_ENABLED) {
      // Encourage sign-in so results can sync to dashboard
      try { await signInWithGoogle(); } catch {}
    }
    await saveQuizResult();
  }, [saveQuizResult, user, signInWithGoogle]);
  
  useEffect(() => {
    if (questions.length > 0 && !showResults) {
      const timer = setInterval(() => {
        setTimeLeft(prevTime => {
          if (prevTime <= 1) {
            clearInterval(timer);
            handleSubmit();
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [questions.length, showResults, handleSubmit]);
  
  const handleGenerateQuiz = useCallback(async () => {
    if (topic.trim() === '') return;
    setIsLoading(true);
    setError(null);
    setQuestions([]);
    setShowResults(false);
    setUserAnswers([]);
    setCurrentQuestionIndex(0);

    const duration = numQuestions * SECONDS_PER_QUESTION;
    setTimeLeft(duration);

    try {
      const quizQuestions = await geminiService.generateQuiz(topic, numQuestions, difficulty);
      setQuestions(quizQuestions);
      setUserAnswers(new Array(quizQuestions.length).fill(null));
    } catch (err) {
      setError('Failed to generate quiz. Please try again or rephrase your topic.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [topic, numQuestions, difficulty, geminiService]);

  const handleAnswerSelect = (optionIndex: number) => {
    const newAnswers = [...userAnswers];
    newAnswers[currentQuestionIndex] = optionIndex;
    setUserAnswers(newAnswers);
  };
  
  const handleNext = () => {
      if(currentQuestionIndex < questions.length - 1){
          setCurrentQuestionIndex(prev => prev + 1);
      } else {
          handleSubmit();
      }
  }
  
  const resetQuiz = () => {
    setTopic('');
    setQuestions([]);
    setShowResults(false);
    setReviewingQuiz(null);
  }

  const handleReviewQuiz = (result: QuizResult) => {
    setReviewingQuiz(result);
    setIsHistoryVisible(false);
  }

  const score = reviewingQuiz ? reviewingQuiz.score : userAnswers.reduce((acc, answer, index) => {
    return answer === questions[index]?.correctAnswerIndex ? acc + 1 : acc;
  }, 0);
  
  const currentQuestions = reviewingQuiz ? reviewingQuiz.questions : questions;
  const currentAnswers = reviewingQuiz ? reviewingQuiz.userAnswers : userAnswers;
  const currentTopic = reviewingQuiz ? reviewingQuiz.topicOrSubject : topic;

  if (showResults || reviewingQuiz) {
    return (
      <div className="p-6 h-full overflow-y-auto">
        <div className="max-w-4xl mx-auto">
            {reviewingQuiz && (
                <button onClick={() => { setReviewingQuiz(null); setIsHistoryVisible(true); }} className="mb-4 text-[rgb(var(--color-accent))] hover:brightness-90">&larr; Back to History</button>
            )}
            <h1 className="text-3xl font-bold text-[rgb(var(--color-text-primary))] mb-4">Quiz Results for "{currentTopic}"</h1>
            <Card>
                <div className="text-center">
                    <p className="text-lg text-[rgb(var(--color-text-secondary))]">Your Score</p>
                    <p className="text-6xl font-bold text-[rgb(var(--color-accent))] my-2">
                      <AnimatedScore score={score} />
                      <span className="text-3xl text-[rgb(var(--color-text-secondary))]"> / {currentQuestions.length}</span>
                    </p>
                    <p className="text-lg text-[rgb(var(--color-text-secondary))]">Accuracy: {((score / currentQuestions.length) * 100).toFixed(2)}%</p>
                </div>
            </Card>
            <div className="mt-6 space-y-4">
            {currentQuestions.map((q, index) => {
                const userAnswer = currentAnswers[index];
                const isCorrect = userAnswer === q.correctAnswerIndex;
                return (
                    <Card key={index}>
                        <p className="font-semibold mb-2">{index+1}. {q.question}</p>
                        <div className="space-y-2">
                        {q.options.map((opt, i) => {
                           let colorClass = 'border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))]';
                           if(i === q.correctAnswerIndex) colorClass = 'border-green-500 bg-green-500/20 text-green-300';
                           else if(i === userAnswer && !isCorrect) colorClass = 'border-red-500 bg-red-500/20 text-red-300';
                           return <div key={i} className={`p-2 rounded-md border ${colorClass}`}>{opt}</div>
                        })}
                        </div>
                        <p className={`mt-3 text-sm ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                           Your answer: {userAnswer !== null ? q.options[userAnswer] : 'Not answered'}
                           {!isCorrect && <span className="block">Correct answer: {q.options[q.correctAnswerIndex]}</span>}
                        </p>
                        <div className="mt-2 text-xs text-[rgb(var(--color-text-secondary))] bg-[rgb(var(--color-input))] p-2 rounded-md">
                            <p className="font-semibold mb-1 text-slate-300">Explanation:</p>
                            <MarkdownRenderer content={q.explanation} className="prose-sm" />
                        </div>
                    </Card>
                )
            })}
            </div>
             <button onClick={resetQuiz} className="mt-6 w-full px-6 py-3 bg-[rgb(var(--color-primary))] text-white font-semibold rounded-lg hover:bg-[rgb(var(--color-primary-hover))] transition-colors">Start New Quiz</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        {questions.length === 0 ? (
          <Card>
            <div className="flex justify-between items-start">
                <div className="space-y-6 flex-1">
                    <div>
                        <label htmlFor="topic" className="block text-sm font-medium text-[rgb(var(--color-text-secondary))] mb-2">Topic</label>
                        <input
                            id="topic"
                            type="text"
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            placeholder="e.g., 'Fundamental Rights'"
                            className="w-full bg-[rgb(var(--color-input))] border border-[rgb(var(--color-border))] rounded-lg p-3 text-[rgb(var(--color-text-primary))] placeholder-[rgb(var(--color-text-secondary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--color-background-start))] focus-visible:ring-[rgb(var(--color-primary))] transition-all duration-200"
                            disabled={isLoading}
                        />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="numQuestions" className="block text-sm font-medium text-[rgb(var(--color-text-secondary))] mb-2">Number of Questions</label>
                            <select
                                id="numQuestions"
                                value={numQuestions}
                                onChange={(e) => setNumQuestions(Number(e.target.value))}
                                disabled={isLoading}
                                className="w-full bg-[rgb(var(--color-input))] border border-[rgb(var(--color-border))] rounded-lg p-3 text-[rgb(var(--color-text-primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--color-background-start))] focus-visible:ring-[rgb(var(--color-primary))] transition-all duration-200"
                            >
                                <option value={5}>5</option>
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="difficulty" className="block text-sm font-medium text-[rgb(var(--color-text-secondary))] mb-2">Difficulty</label>
                            <select
                                id="difficulty"
                                value={difficulty}
                                onChange={(e) => setDifficulty(e.target.value as QuizDifficulty)}
                                disabled={isLoading}
                                className="w-full bg-[rgb(var(--color-input))] border border-[rgb(var(--color-border))] rounded-lg p-3 text-[rgb(var(--color-text-primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--color-background-start))] focus-visible:ring-[rgb(var(--color-primary))] transition-all duration-200"
                            >
                                <option value="Easy">Easy</option>
                                <option value="Medium">Medium</option>
                                <option value="Hard">Hard</option>
                            </select>
                        </div>
                    </div>

                    <button
                        onClick={handleGenerateQuiz}
                        disabled={isLoading || topic.trim() === ''}
                        className="w-full px-6 py-3 text-lg bg-gradient-to-r from-[rgb(var(--color-primary))] to-[rgb(var(--color-accent))] text-white font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity duration-200 animated-gradient-bg"
                    >
                        {isLoading ? <LoadingSpinner /> : 'Generate Quiz'}
                    </button>
                </div>
                 <button onClick={() => setIsHistoryVisible(true)} className="ml-4 p-2 text-[rgb(var(--color-text-secondary))] hover:text-white transition-colors" title="History & Stats"><HistoryIcon /></button>
            </div>
            {error && <Card className="mt-4"><p className="text-red-400">{error}</p></Card>}
            {isLoading && !error && <Card className="mt-4"><div className="flex justify-center items-center gap-3"><LoadingSpinner /><p>Generating {numQuestions} questions... This may take a moment.</p></div></Card>}
            {!isLoading && !error && <div className="text-center text-[rgb(var(--color-text-secondary))] py-16"><QuizIcon className="mx-auto w-12 h-12 mb-4" /><p>Configure your quiz above and start learning.</p></div>}
          </Card>
        ) : (
          <div>
            <Card className="sticky top-0 z-10 mb-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-[rgb(var(--color-accent))]">Quiz on "{topic}"</h2>
                    <div className="text-lg font-mono bg-[rgb(var(--color-input))] text-[rgb(var(--color-text-primary))] px-3 py-1 rounded-md">{formatTime(timeLeft)}</div>
                </div>
            </Card>
            <Card>
                <p className="text-sm text-[rgb(var(--color-text-secondary))] mb-2">Question {currentQuestionIndex + 1}/{questions.length}</p>
                <p className="text-lg text-[rgb(var(--color-text-primary))] mb-4 font-semibold">{questions[currentQuestionIndex].question}</p>
                <div className="space-y-3">
                    {questions[currentQuestionIndex].options.map((option, index) => (
                        <button
                            key={index}
                            onClick={() => handleAnswerSelect(index)}
                            className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${userAnswers[currentQuestionIndex] === index ? 'border-[rgb(var(--color-accent))] bg-gradient-to-r from-[rgb(var(--color-primary))] to-[rgb(var(--color-accent))] animated-gradient-bg text-white' : 'bg-[rgb(var(--color-input))] border-[rgb(var(--color-border))] hover:border-[rgb(var(--color-accent))]'}`}
                        >
                            {option}
                        </button>
                    ))}
                </div>
            </Card>
            <div className="mt-6 flex justify-between items-center">
                <div className="text-[rgb(var(--color-text-secondary))]">Question {currentQuestionIndex + 1} of {questions.length}</div>
                <button onClick={handleNext} disabled={userAnswers[currentQuestionIndex] === null} className="px-6 py-3 bg-[rgb(var(--color-primary))] text-white font-semibold rounded-lg hover:bg-[rgb(var(--color-primary-hover))] disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors">
                    {currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'Show Results'}
                </button>
            </div>
          </div>
        )}
      </div>
      <AnimatePresence>
        {isHistoryVisible && <QuizHistoryPanel history={quizHistory} onReview={handleReviewQuiz} onClose={() => setIsHistoryVisible(false)} />}
      </AnimatePresence>
    </div>
  );
};

const QuizHistoryPanel: React.FC<{history: QuizResult[], onReview: (result: QuizResult) => void, onClose: () => void}> = ({history, onReview, onClose}) => {
    const stats = useMemo(() => {
        if (history.length === 0) return null;
        const totalQuizzes = history.length;
        const totalQs = history.reduce((sum, q) => sum + q.totalQuestions, 0);
        const totalCorrect = history.reduce((sum, q) => sum + q.score, 0);
        const avgScore = totalQs > 0 ? (totalCorrect / totalQs) * 100 : 0;
        return { totalQuizzes, avgScore: avgScore.toFixed(2) };
    }, [history]);

    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-40 flex items-center justify-center p-4"
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                className="bg-[rgb(var(--color-card))] w-full max-w-4xl rounded-xl border border-[rgb(var(--color-border))] shadow-2xl flex flex-col max-h-[90vh]"
            >
                <div className="p-4 border-b border-[rgb(var(--color-border))] flex justify-between items-center">
                    <h2 className="text-xl font-bold">Quiz History & Stats</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-[rgb(var(--color-input))]"><CloseIcon /></button>
                </div>
                {history.length > 0 && stats ? (
                    <div className="p-4 grid grid-cols-2 gap-4 border-b border-[rgb(var(--color-border))]">
                        <div className="bg-[rgb(var(--color-input))] p-4 rounded-lg text-center">
                            <p className="text-sm text-[rgb(var(--color-text-secondary))]">Total Quizzes</p>
                            <p className="text-2xl font-bold">{stats.totalQuizzes}</p>
                        </div>
                        <div className="bg-[rgb(var(--color-input))] p-4 rounded-lg text-center">
                            <p className="text-sm text-[rgb(var(--color-text-secondary))]">Average Score</p>
                            <p className="text-2xl font-bold">{stats.avgScore}%</p>
                        </div>
                    </div>
                ) : null}
                <div className="flex-1 p-4 overflow-y-auto">
                    {history.length > 0 ? (
                        <div className="space-y-3">
                            {history.map(result => (
                                <div key={result.id} className="p-3 bg-[rgb(var(--color-input))] rounded-lg flex items-center justify-between">
                                    <div>
                                        <p className="font-semibold truncate">{result.topicOrSubject}</p>
                                        <p className="text-sm text-[rgb(var(--color-text-secondary))]">{new Date(result.timestamp).toLocaleString()}</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <p className="font-bold text-lg">{result.score}/{result.totalQuestions}</p>
                                        <button onClick={() => onReview(result)} className="px-3 py-1 bg-[rgb(var(--color-primary))] text-white text-sm rounded-md hover:bg-[rgb(var(--color-primary-hover))]">Review</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                         <div className="text-center text-[rgb(var(--color-text-secondary))] py-16">
                            <ChartBarIcon className="mx-auto w-12 h-12 mb-4" />
                            <p>No quiz history yet. Take a quiz to see your stats!</p>
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
};


export default QuizGenerator;