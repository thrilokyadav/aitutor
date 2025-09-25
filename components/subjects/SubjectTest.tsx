import React, { useState, useCallback, useEffect, useMemo } from 'react';
import GeminiService from '../../services/geminiService';
import { QuizQuestion, QuizDifficulty, QuizResult } from '../../types';
import { LoadingSpinner } from '../common/LoadingSpinner';
import Card from '../common/Card';
import { QuizIcon } from '../icons/QuizIcon';
import { useAppContext } from '../../contexts/AppContext';
import useLocalStorage from '../../hooks/useLocalStorage';
import MarkdownRenderer from '../common/MarkdownRenderer';
import { supabase, SUPABASE_ENABLED } from '../../services/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

const QUIZ_RESULTS_KEY = 'easyway-tutor-quiz-results';
const SECONDS_PER_QUESTION = 90;

const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
};

const SubjectTest: React.FC<{ subject: string; onBack: () => void; }> = ({ subject, onBack }) => {
  const [numQuestions, setNumQuestions] = useState<number>(10);
  const [difficulty, setDifficulty] = useState<QuizDifficulty>('Medium');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<(number | null)[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  
  const [, setQuizHistory] = useLocalStorage<QuizResult[]>(QUIZ_RESULTS_KEY, []);
  const geminiService = useMemo(() => new GeminiService(), []);
  const { user, signInWithGoogle } = useAuth();

  const saveQuizResult = useCallback(async () => {
     if (questions.length === 0) return;
     const score = userAnswers.reduce((acc, answer, index) => {
        return answer === questions[index]?.correctAnswerIndex ? acc + 1 : acc;
     }, 0);

     const result: QuizResult = {
        id: `quiz-${Date.now()}`,
        topicOrSubject: subject,
        difficulty,
        score,
        totalQuestions: questions.length,
        timestamp: Date.now(),
        questions,
        userAnswers,
     };
     setQuizHistory(prev => [result, ...prev].slice(0, 50)); // Keep last 50

     // Persist summary to Supabase tests for dashboard
     try {
       if (SUPABASE_ENABLED && user) {
         const percent = Math.round((score / Math.max(1, questions.length)) * 100);
         await supabase.from('tests').insert({
           user_id: user.id,
           subject: subject,
           topic: null,
           score: percent,
         });
       }
     } catch (e) {
       // eslint-disable-next-line no-console
       console.warn('Failed to persist subject test result to Supabase', e);
     }
  }, [questions, userAnswers, subject, difficulty, setQuizHistory, user]);


  const handleSubmit = useCallback(async () => {
    setShowResults(true);
    if (!user && SUPABASE_ENABLED) {
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
    setIsLoading(true);
    setError(null);
    setQuestions([]);
    setShowResults(false);
    setUserAnswers([]);
    setCurrentQuestionIndex(0);
    setTimeLeft(numQuestions * SECONDS_PER_QUESTION);

    try {
      const quizQuestions = await geminiService.generateSubjectQuiz(subject, numQuestions, difficulty);
      setQuestions(quizQuestions);
      setUserAnswers(new Array(quizQuestions.length).fill(null));
    } catch (err) {
      setError('Failed to generate quiz for this subject. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [subject, numQuestions, difficulty, geminiService]);

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
    setQuestions([]);
    setShowResults(false);
    setError(null);
  }

  const score = userAnswers.reduce((acc, answer, index) => {
    return answer === questions[index]?.correctAnswerIndex ? acc + 1 : acc;
  }, 0);

  if (showResults) {
    return (
      <div className="p-6 h-full overflow-y-auto">
        <div className="max-w-4xl mx-auto">
            <button onClick={onBack} className="mb-4 text-[rgb(var(--color-accent))] hover:brightness-90">&larr; Back to {subject}</button>
            <h1 className="text-3xl font-bold text-white mb-4">Quiz Results for "{subject}"</h1>
            <Card>
                <div className="text-center">
                    <p className="text-lg text-[rgb(var(--color-text-secondary))]">Your Score</p>
                    <p className="text-6xl font-bold text-[rgb(var(--color-accent))] my-2">{score} <span className="text-3xl text-[rgb(var(--color-text-secondary))]">/ {questions.length}</span></p>
                    <p className="text-lg text-[rgb(var(--color-text-secondary))]">Accuracy: {((score / questions.length) * 100).toFixed(2)}%</p>
                </div>
            </Card>
            <div className="mt-6 space-y-4">
            {questions.map((q, index) => {
                const userAnswer = userAnswers[index];
                const isCorrect = userAnswer === q.correctAnswerIndex;
                return (
                    <Card key={index}>
                        <p className="font-semibold mb-2">{index+1}. {q.question}</p>
                        <div className="space-y-2">
                        {q.options.map((opt, i) => {
                           let colorClass = 'border-[rgb(var(--color-border))]';
                           if(i === q.correctAnswerIndex) colorClass = 'border-green-500 bg-green-500/20';
                           else if(i === userAnswer && !isCorrect) colorClass = 'border-red-500 bg-red-500/20';
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
             <button onClick={resetQuiz} className="mt-6 w-full px-6 py-3 bg-[rgb(var(--color-primary))] text-white font-semibold rounded-lg hover:bg-[rgb(var(--color-primary-hover))] transition-colors">Take Another Test</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <button onClick={onBack} className="mb-4 text-[rgb(var(--color-accent))] hover:brightness-90">&larr; Back to {subject}</button>
        <h2 className="text-2xl font-bold text-white mb-6">Subject Test: {subject}</h2>
        {questions.length === 0 ? (
          <Card>
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div>
                        <label htmlFor="numQuestions" className="block text-sm font-medium text-[rgb(var(--color-text-secondary))] mb-2">Number of Questions</label>
                        <select
                            id="numQuestions"
                            value={numQuestions}
                            onChange={(e) => setNumQuestions(Number(e.target.value))}
                            disabled={isLoading}
                            className="w-full bg-[rgb(var(--color-input))] border border-[rgb(var(--color-border))] rounded-lg p-3 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-primary))]"
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
                            className="w-full bg-[rgb(var(--color-input))] border border-[rgb(var(--color-border))] rounded-lg p-3 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-primary))]"
                        >
                            <option value="Easy">Easy</option>
                            <option value="Medium">Medium</option>
                            <option value="Hard">Hard</option>
                        </select>
                    </div>
                </div>

              <button
                onClick={handleGenerateQuiz}
                disabled={isLoading}
                className="w-full px-6 py-3 text-lg bg-gradient-to-r from-[rgb(var(--color-primary))] to-[rgb(var(--color-accent))] text-white font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity duration-200 animated-gradient-bg"
              >
                {isLoading ? <LoadingSpinner /> : `Start ${subject} Test`}
              </button>
            </div>
            {error && <Card className="mt-4"><p className="text-red-400">{error}</p></Card>}
            {isLoading && !error && <Card className="mt-4"><div className="flex justify-center items-center gap-3"><LoadingSpinner /><p>Generating {numQuestions} questions... This may take a moment.</p></div></Card>}
            {!isLoading && !error && <div className="text-center text-[rgb(var(--color-text-secondary))] py-16"><QuizIcon className="mx-auto w-12 h-12 mb-4" /><p>Configure and start your test above.</p></div>}
          </Card>
        ) : (
          <div>
            <Card className="sticky top-0 z-10 mb-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-[rgb(var(--color-accent))]">Test on "{subject}"</h2>
                    <div className="text-lg font-mono bg-slate-700 text-white px-3 py-1 rounded-md">{formatTime(timeLeft)}</div>
                </div>
            </Card>
            <Card>
                <p className="text-sm text-[rgb(var(--color-text-secondary))] mb-2">Question {currentQuestionIndex + 1}/{questions.length}</p>
                <p className="text-lg text-white mb-4 font-semibold">{questions[currentQuestionIndex].question}</p>
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
    </div>
  );
};

export default SubjectTest;