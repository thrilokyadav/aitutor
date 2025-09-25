import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, SUPABASE_ENABLED } from '../../services/supabaseClient';
import Card from '../common/Card';
import { LoadingSpinner } from '../common/LoadingSpinner';
import GeminiService from '../../services/geminiService';

interface UserRow {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  quiz_count: number;
  total_score: number;
  avg_accuracy: number;
}

interface QuizRow {
  id: string;
  title: string;
  subject: string;
  description: string | null;
  start_at: string;
  end_at: string;
  duration_seconds: number;
  published_leaderboard: boolean;
}

interface UserResult {
  user_id: string;
  user_email: string;
  quiz_id: string;
  quiz_title: string;
  quiz_subject: string;
  score: number;
  accuracy: number;
  time_taken_seconds: number;
  submitted_at: string;
  rank_in_quiz: number;
}

interface AttemptDetail {
  attempt_id: string;
  user_id: string;
  user_email: string;
  quiz_id: string;
  quiz_title: string;
  quiz_subject: string;
  question_id: string;
  question_text: string;
  user_options: any[];
  correct_index: number;
  user_chosen_index: number | null;
  is_correct: boolean;
  points_earned: number;
  question_order: number;
}

interface NewQuestion {
  question: string;
  options: string[];
  correct_index: number;
  points: number;
}

const AdminView: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = (user?.email || '').toLowerCase() === 'info.edensnews@gmail.com';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userFilter, setUserFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [userResults, setUserResults] = useState<UserResult[]>([]);
  const [resultsSearch, setResultsSearch] = useState('');
  const [resultsFilter, setResultsFilter] = useState<'all' | 'recent' | 'top_scores'>('all');
  const [expandedResult, setExpandedResult] = useState<string | null>(null);
  const [attemptDetails, setAttemptDetails] = useState<AttemptDetail[]>([]);

  // Create quiz form state
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [quizFocus, setQuizFocus] = useState('');
  const [startAt, setStartAt] = useState('');
  const [duration, setDuration] = useState(600);

  const [questions, setQuestions] = useState<NewQuestion[]>([
    { question: '', options: ['', '', '', ''], correct_index: 0, points: 1 },
  ]);

  const [genCount, setGenCount] = useState(10);
  const [genDifficulty, setGenDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = user.email.toLowerCase().includes(userSearch.toLowerCase());
      const hasActivity = user.last_sign_in_at !== null;
      const matchesFilter = userFilter === 'all' ||
        (userFilter === 'active' && hasActivity) ||
        (userFilter === 'inactive' && !hasActivity);
      return matchesSearch && matchesFilter;
    });
  }, [users, userSearch, userFilter]);

  const filteredResults = useMemo(() => {
    let filtered = userResults.filter(result => {
      const matchesSearch = resultsSearch === '' ||
        result.user_email.toLowerCase().includes(resultsSearch.toLowerCase()) ||
        result.quiz_title.toLowerCase().includes(resultsSearch.toLowerCase()) ||
        result.quiz_subject.toLowerCase().includes(resultsSearch.toLowerCase());

      return matchesSearch;
    });

    if (resultsFilter === 'recent') {
      filtered = filtered.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
    } else if (resultsFilter === 'top_scores') {
      filtered = filtered.sort((a, b) => b.score - a.score || a.time_taken_seconds - b.time_taken_seconds);
    }

    return filtered;
  }, [userResults, resultsSearch, resultsFilter]);

  const fetchAttemptDetails = useCallback(async (attemptId: string) => {
    if (!SUPABASE_ENABLED) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc('admin_get_attempt_details', { p_attempt_id: attemptId });
    if (error) setError(error.message);
    setAttemptDetails(Array.isArray(data) ? data as AttemptDetail[] : []);
    setLoading(false);
  }, []);

  const handleExpandResult = useCallback(async (result: UserResult) => {
    const resultKey = `${result.user_id}-${result.quiz_id}-${result.submitted_at}`;
    if (expandedResult === resultKey) {
      setExpandedResult(null);
      setAttemptDetails([]);
    } else {
      setExpandedResult(resultKey);
      // Find the attempt ID from the userResults data
      const attemptId = userResults.find(r =>
        r.user_id === result.user_id &&
        r.quiz_id === result.quiz_id &&
        r.submitted_at === result.submitted_at
      )?.attempt_id;

      if (attemptId) {
        await fetchAttemptDetails(attemptId);
      }
    }
  }, [expandedResult, userResults, fetchAttemptDetails]);

  const gemini = useMemo(() => new GeminiService(), []);

  const addQuestion = useCallback(() => setQuestions(prev => [...prev, { question: '', options: ['', '', '', ''], correct_index: 0, points: 1 }]), [setQuestions]);
  const removeQuestion = useCallback((idx: number) => setQuestions(prev => prev.filter((_, i) => i !== idx)), [setQuestions]);

  const fetchQuizzes = useCallback(async () => {
    if (!SUPABASE_ENABLED) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('competitive_quizzes')
      .select('id, title, subject, description, start_at, end_at, duration_seconds, published_leaderboard')
      .order('start_at', { ascending: false });
    if (error) setError(error.message);
    setQuizzes(Array.isArray(data) ? data as QuizRow[] : []);
    setLoading(false);
  }, []);

  const fetchUsers = useCallback(async () => {
    if (!SUPABASE_ENABLED) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc('admin_get_all_users');
    if (error) setError(error.message);
    setUsers(Array.isArray(data) ? data as UserRow[] : []);
    setLoading(false);
  }, []);

  const fetchUserResults = useCallback(async () => {
    if (!SUPABASE_ENABLED) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc('admin_get_all_user_results');
    if (error) setError(error.message);
    setUserResults(Array.isArray(data) ? data as UserResult[] : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchQuizzes();
      fetchUsers();
      fetchUserResults();
    }
  }, [isAdmin, fetchQuizzes, fetchUsers, fetchUserResults]);

  const handleCreateQuiz = async () => {
    if (!isAdmin) return;
    if (!title || !subject || !startAt) { alert('Please fill title, subject, and start time'); return; }
    try {
      setLoading(true);
      setError(null);
      const startIso = new Date(startAt).toISOString();
      const endIso = new Date(new Date(startAt).getTime() + duration * 1000).toISOString();
      const { data: qrow, error: qerr } = await supabase
        .from('competitive_quizzes')
        .insert({
          title,
          subject,
          description: description || null,
          quiz_focus: quizFocus || null,
          start_at: startIso,
          end_at: endIso,
          duration_seconds: duration,
        })
        .select('id')
        .single();
      if (qerr) throw qerr;
      const quizId = (qrow as any)?.id as string;
      // Insert questions
      if (quizId && questions.length > 0) {
        const rows = questions.map((q, idx) => ({
          quiz_id: quizId,
          question: q.question,
          options: q.options,
          correct_index: q.correct_index,
          points: q.points || 1,
          order_index: idx,
        }));
        const { error: qserr } = await supabase.from('competitive_quiz_questions').insert(rows);
        if (qserr) throw qserr;
      }
      // Reset form
      setTitle(''); setSubject(''); setDescription(''); setQuizFocus(''); setStartAt(''); setDuration(600);
      setQuestions([{ question: '', options: ['', '', '', ''], correct_index: 0, points: 1 }]);
      await fetchQuizzes();
      alert('Quiz created');
    } catch (e: any) {
      setError(e.message || 'Failed to create quiz');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoGenerate = async () => {
    if (!subject) { alert('Please set subject'); return; }
    try {
      setLoading(true);
      setError(null);
      // Use subject test generator; include focus in prompt by appending
      const topic = quizFocus ? `${subject} — Focus: ${quizFocus}` : subject;
      const qs = await gemini.generateSubjectQuiz(topic, genCount, genDifficulty);
      const mapped = qs.map(q => ({
        question: q.question,
        options: q.options,
        correct_index: q.correctAnswerIndex,
        points: 1,
      }));
      setQuestions(mapped);
    } catch (e: any) {
      setError(e.message || 'Failed to generate questions');
    } finally {
      setLoading(false);
    }
  };

  const togglePublishLeaderboard = async (quiz: QuizRow) => {
    if (!isAdmin) return;
    try {
      const { error } = await supabase
        .from('competitive_quizzes')
        .update({ published_leaderboard: !quiz.published_leaderboard })
        .eq('id', quiz.id);
      if (error) throw error;
      await fetchQuizzes();
    } catch (e: any) {
      alert(e.message || 'Failed to toggle leaderboard');
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-semibold">Admin</h2>
        <p className="text-[rgb(var(--color-text-secondary))]">You don\'t have access to this page.</p>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h2 className="text-lg sm:text-xl font-semibold">Admin — Competitive Quizzes</h2>
        <div className="flex items-center gap-2 text-sm text-[rgb(var(--color-text-secondary))]">
          {loading && <LoadingSpinner />}
          <span>{loading ? 'Working…' : 'Ready'}</span>
        </div>
      </div>
      {error && <div className="p-3 rounded bg-red-900/30 border border-red-800 text-red-200 text-sm">{error}</div>}

      <Card>
        <h3 className="font-semibold mb-3 text-base sm:text-lg">Create Quiz</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input className="bg-[rgb(var(--color-input))] p-3 sm:p-2 rounded border border-[rgb(var(--color-border))] text-sm sm:text-base w-full" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} />
          <input className="bg-[rgb(var(--color-input))] p-3 sm:p-2 rounded border border-[rgb(var(--color-border))] text-sm sm:text-base w-full" placeholder="Subject" value={subject} onChange={e => setSubject(e.target.value)} />
          <input className="bg-[rgb(var(--color-input))] p-3 sm:p-2 rounded border border-[rgb(var(--color-border))] text-sm sm:text-base w-full sm:col-span-2" placeholder="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} />
          <input className="bg-[rgb(var(--color-input))] p-3 sm:p-2 rounded border border-[rgb(var(--color-border))] text-sm sm:text-base w-full sm:col-span-2" placeholder="Focus (how the quiz should be focused)" value={quizFocus} onChange={e => setQuizFocus(e.target.value)} />
          <input className="bg-[rgb(var(--color-input))] p-3 sm:p-2 rounded border border-[rgb(var(--color-border))] text-sm sm:text-base w-full" type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)} />
          <input className="bg-[rgb(var(--color-input))] p-3 sm:p-2 rounded border border-[rgb(var(--color-border))] text-sm sm:text-base w-full" type="number" min={60} step={30} value={duration} onChange={e => setDuration(parseInt(e.target.value || '600', 10))} placeholder="Duration seconds" />
        </div>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="sm:col-span-2 lg:col-span-1">
            <label className="block text-sm mb-2 text-[rgb(var(--color-text-secondary))]">Auto-generate</label>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <input
                className="bg-[rgb(var(--color-input))] p-3 sm:p-2 rounded border border-[rgb(var(--color-border))] w-full sm:w-20 text-sm sm:text-base"
                type="number"
                min={1}
                max={50}
                value={genCount}
                onChange={e => setGenCount(parseInt(e.target.value || '10', 10))}
              />
              <select
                className="bg-[rgb(var(--color-input))] p-3 sm:p-2 rounded border border-[rgb(var(--color-border))] w-full sm:w-auto text-sm sm:text-base"
                value={genDifficulty}
                onChange={e => setGenDifficulty(e.target.value as any)}
              >
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
              <button
                className="px-4 py-3 sm:px-3 sm:py-2 rounded bg-[rgb(var(--color-input))] hover:bg-[rgb(var(--color-input-hover))] text-sm sm:text-base font-medium min-h-[44px] sm:min-h-0 w-full sm:w-auto"
                onClick={handleAutoGenerate}
              >
                Generate
              </button>
            </div>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          <div className="text-sm sm:text-base font-semibold">Questions</div>
          {questions.map((q, idx) => (
            <div key={idx} className="p-3 sm:p-4 rounded border border-[rgb(var(--color-border))] bg-[rgb(var(--color-card))]/50">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-2">
                <div className="text-sm text-[rgb(var(--color-text-secondary))]">Question {idx + 1}</div>
                {questions.length > 1 && (
                  <button
                    className="px-3 py-2 text-xs sm:text-sm rounded bg-[rgb(var(--color-input))] hover:bg-[rgb(var(--color-input-hover))] min-h-[44px] sm:min-h-0 self-start sm:self-auto"
                    onClick={() => removeQuestion(idx)}
                  >
                    Remove
                  </button>
                )}
              </div>
              <input
                className="w-full bg-[rgb(var(--color-input))] p-3 sm:p-2 rounded border border-[rgb(var(--color-border))] mb-3 text-sm sm:text-base"
                placeholder="Question text"
                value={q.question}
                onChange={e => setQuestions(prev => prev.map((qq, i) => i === idx ? { ...qq, question: e.target.value } : qq))}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                {q.options.map((opt, i) => (
                  <input
                    key={i}
                    className="bg-[rgb(var(--color-input))] p-3 sm:p-2 rounded border border-[rgb(var(--color-border))] text-sm sm:text-base"
                    placeholder={`Option ${i + 1}`}
                    value={opt}
                    onChange={e => setQuestions(prev => prev.map((qq, ii) => ii === idx ? { ...qq, options: qq.options.map((oo, oi) => oi === i ? e.target.value : oo) } : qq))}
                  />
                ))}
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm">Correct index</label>
                  <select
                    className="bg-[rgb(var(--color-input))] p-2 sm:p-1 rounded border border-[rgb(var(--color-border))] text-sm sm:text-base min-h-[44px] sm:min-h-0"
                    value={q.correct_index}
                    onChange={e => setQuestions(prev => prev.map((qq, i) => i === idx ? { ...qq, correct_index: parseInt(e.target.value, 10) } : qq))}
                  >
                    <option value={0}>0</option>
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm">Points</label>
                  <input
                    className="bg-[rgb(var(--color-input))] p-2 sm:p-1 rounded border border-[rgb(var(--color-border))] w-20 sm:w-16 text-sm sm:text-base min-h-[44px] sm:min-h-0"
                    type="number"
                    min={1}
                    value={q.points}
                    onChange={e => setQuestions(prev => prev.map((qq, i) => i === idx ? { ...qq, points: parseInt(e.target.value || '1', 10) } : qq))}
                  />
                </div>
              </div>
            </div>
          ))}
          <button
            className="px-4 py-3 sm:px-3 sm:py-2 rounded bg-[rgb(var(--color-input))] hover:bg-[rgb(var(--color-input-hover))] text-sm sm:text-base font-medium min-h-[44px] sm:min-h-0 w-full sm:w-auto"
            onClick={addQuestion}
          >
            Add Question
          </button>
        </div>
        <div className="mt-4">
          <button
            className="px-6 py-3 sm:px-4 sm:py-2 rounded-md bg-[rgb(var(--color-primary))] text-white text-sm sm:text-base font-medium min-h-[44px] sm:min-h-0 w-full sm:w-auto"
            onClick={handleCreateQuiz}
          >
            Create Quiz
          </button>
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold mb-3 text-base sm:text-lg">Manage Quizzes</h3>
        {quizzes.length === 0 ? (
          <div className="text-[rgb(var(--color-text-secondary))] text-sm sm:text-base">No quizzes yet.</div>
        ) : (
          <div className="space-y-2 sm:space-y-3">
            {quizzes.map(q => (
              <div key={q.id} className="p-3 sm:p-4 rounded border border-[rgb(var(--color-border))] bg-[rgb(var(--color-card))]/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate text-sm sm:text-base">{q.title} — {q.subject}</div>
                  <div className="text-xs sm:text-sm text-[rgb(var(--color-text-secondary))]">
                    {new Date(q.start_at).toLocaleString()} → {new Date(q.end_at).toLocaleString()} • Duration {q.duration_seconds}s
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="px-3 py-2 text-xs sm:text-sm rounded bg-[rgb(var(--color-input))] hover:bg-[rgb(var(--color-input-hover))] min-h-[44px] sm:min-h-0 whitespace-nowrap"
                    onClick={() => togglePublishLeaderboard(q)}
                  >
                    {q.published_leaderboard ? 'Unpublish' : 'Publish'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-2">
          <h3 className="font-semibold text-base sm:text-lg">User Management</h3>
          <button
            className="px-4 py-2 text-sm rounded bg-[rgb(var(--color-input))] hover:bg-[rgb(var(--color-input-hover))] min-h-[44px] sm:min-h-0 self-start sm:self-auto"
            onClick={fetchUsers}
          >
            Refresh
          </button>
        </div>

        {/* Search and Filter Controls */}
        <div className="mb-4 space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <input
              className="flex-1 bg-[rgb(var(--color-input))] p-3 sm:p-2 rounded border border-[rgb(var(--color-border))] text-sm sm:text-base w-full"
              placeholder="Search users by email..."
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
            />
            <select
              className="bg-[rgb(var(--color-input))] p-3 sm:p-2 rounded border border-[rgb(var(--color-border))] text-sm sm:text-base min-h-[44px] sm:min-h-0 w-full sm:w-auto"
              value={userFilter}
              onChange={e => setUserFilter(e.target.value as 'all' | 'active' | 'inactive')}
            >
              <option value="all">All Users</option>
              <option value="active">Active Users</option>
              <option value="inactive">Inactive Users</option>
            </select>
          </div>
          <div className="text-sm text-[rgb(var(--color-text-secondary))]">
            Showing {filteredUsers.length} of {users.length} users
          </div>
        </div>

        {filteredUsers.length === 0 ? (
          <div className="text-[rgb(var(--color-text-secondary))] text-sm sm:text-base">No users found.</div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {filteredUsers.map(user => (
              <div key={user.id} className="p-3 sm:p-4 rounded border border-[rgb(var(--color-border))] bg-[rgb(var(--color-card))]/50">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate text-sm sm:text-base">{user.email}</div>
                    <div className="text-xs sm:text-sm text-[rgb(var(--color-text-secondary))] space-y-1 mt-2">
                      <div>Registered: {new Date(user.created_at).toLocaleString()}</div>
                      {user.last_sign_in_at && (
                        <div>Last Sign In: {new Date(user.last_sign_in_at).toLocaleString()}</div>
                      )}
                      {user.email_confirmed_at && (
                        <div>Email Confirmed: {new Date(user.email_confirmed_at).toLocaleString()}</div>
                      )}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 pt-1">
                        <span className="font-medium">Quizzes: <span className="text-[rgb(var(--color-primary))]">{user.quiz_count}</span></span>
                        <span className="font-medium">Total Score: <span className="text-[rgb(var(--color-primary))]">{user.total_score}</span></span>
                        <span className="font-medium">Avg Accuracy: <span className="text-[rgb(var(--color-primary))]">{user.avg_accuracy.toFixed(1)}%</span></span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-2">
          <h3 className="font-semibold text-base sm:text-lg">User Results & Leaderboards</h3>
          <button
            className="px-4 py-2 text-sm rounded bg-[rgb(var(--color-input))] hover:bg-[rgb(var(--color-input-hover))] min-h-[44px] sm:min-h-0 self-start sm:self-auto"
            onClick={fetchUserResults}
          >
            Refresh
          </button>
        </div>

        {/* Results Search and Filter Controls */}
        <div className="mb-4 space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <input
              className="flex-1 bg-[rgb(var(--color-input))] p-3 sm:p-2 rounded border border-[rgb(var(--color-border))] text-sm sm:text-base w-full"
              placeholder="Search results by user email, quiz title, or subject..."
              value={resultsSearch}
              onChange={e => setResultsSearch(e.target.value)}
            />
            <select
              className="bg-[rgb(var(--color-input))] p-3 sm:p-2 rounded border border-[rgb(var(--color-border))] text-sm sm:text-base min-h-[44px] sm:min-h-0 w-full sm:w-auto"
              value={resultsFilter}
              onChange={e => setResultsFilter(e.target.value as 'all' | 'recent' | 'top_scores')}
            >
              <option value="all">All Results</option>
              <option value="recent">Most Recent</option>
              <option value="top_scores">Top Scores</option>
            </select>
          </div>
          <div className="text-sm text-[rgb(var(--color-text-secondary))]">
            Showing {filteredResults.length} of {userResults.length} results
          </div>
        </div>

        {filteredResults.length === 0 ? (
          <div className="text-[rgb(var(--color-text-secondary))] text-sm sm:text-base">No results found.</div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {filteredResults.map((result, idx) => {
              const resultKey = `${result.user_id}-${result.quiz_id}-${result.submitted_at}`;
              const isExpanded = expandedResult === resultKey;

              return (
                <div key={resultKey} className="border border-[rgb(var(--color-border))] rounded bg-[rgb(var(--color-card))]/50">
                  {/* Summary Card */}
                  <div
                    className="p-3 sm:p-4 cursor-pointer hover:bg-[rgb(var(--color-card))]/70 transition-colors"
                    onClick={() => handleExpandResult(result)}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                          <div className="font-semibold truncate text-sm sm:text-base">{result.user_email}</div>
                          <div className={`px-2 py-1 text-xs rounded self-start sm:self-auto ${
                            result.rank_in_quiz === 1 ? 'bg-yellow-900/30 text-yellow-200' :
                            result.rank_in_quiz === 2 ? 'bg-gray-900/30 text-gray-200' :
                            result.rank_in_quiz === 3 ? 'bg-orange-900/30 text-orange-200' :
                            'bg-[rgb(var(--color-input))]'
                          }`}>
                            #{result.rank_in_quiz}
                          </div>
                        </div>
                        <div className="text-xs sm:text-sm text-[rgb(var(--color-text-secondary))] space-y-1">
                          <div className="font-medium">{result.quiz_title} — {result.quiz_subject}</div>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                            <span className="font-medium">Score: <span className="text-[rgb(var(--color-primary))]">{result.score}</span></span>
                            <span className="font-medium">Accuracy: <span className="text-[rgb(var(--color-primary))]">{result.accuracy.toFixed(1)}%</span></span>
                            <span className="font-medium">Time: <span className="text-[rgb(var(--color-primary))]">{Math.floor(result.time_taken_seconds / 60)}:{(result.time_taken_seconds % 60).toString().padStart(2, '0')}</span></span>
                          </div>
                          <div className="text-xs">Submitted: {new Date(result.submitted_at).toLocaleString()}</div>
                        </div>
                      </div>
                      <div className="text-xs sm:text-sm text-[rgb(var(--color-text-secondary))] self-start sm:self-center">
                        {isExpanded ? '▼ Hide Details' : '▶ Show Details'}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t border-[rgb(var(--color-border))] p-3 sm:p-4 bg-[rgb(var(--color-card))]/30">
                      {loading ? (
                        <div className="flex items-center gap-2 text-sm text-[rgb(var(--color-text-secondary))]">
                          <LoadingSpinner />
                          Loading detailed results...
                        </div>
                      ) : attemptDetails.length === 0 ? (
                        <div className="text-sm text-[rgb(var(--color-text-secondary))]">
                          No detailed results available.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <h4 className="font-semibold text-sm sm:text-base">Question-by-Question Breakdown:</h4>
                          {attemptDetails.map((detail, detailIdx) => (
                            <div key={detail.question_id} className="p-3 rounded border border-[rgb(var(--color-border))] bg-[rgb(var(--color-card))]/50">
                              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-3 gap-2">
                                <div className="flex-1">
                                  <div className="font-medium text-sm sm:text-base">{detail.question_text}</div>
                                  <div className="text-xs text-[rgb(var(--color-text-secondary))] mt-1">
                                    Question {detail.question_order + 1}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className={`px-2 py-1 text-xs rounded ${
                                    detail.is_correct ? 'bg-green-900/30 text-green-200' : 'bg-red-900/30 text-red-200'
                                  }`}>
                                    {detail.is_correct ? '✓ Correct' : '✗ Incorrect'}
                                  </div>
                                  <div className="text-sm font-medium">
                                    {detail.points_earned}/{detail.user_options[detail.correct_index]?.length ? 1 : 0} pts
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-2">
                                {detail.user_options.map((option, optIdx) => (
                                  <div key={optIdx} className={`p-2 sm:p-3 rounded text-sm ${
                                    optIdx === detail.correct_index
                                      ? 'bg-green-900/20 border border-green-800/30'
                                      : optIdx === detail.user_chosen_index
                                      ? 'bg-red-900/20 border border-red-800/30'
                                      : 'bg-[rgb(var(--color-input))]'
                                  }`}>
                                    <div className="flex items-center gap-2">
                                      <span className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium ${
                                        optIdx === detail.correct_index
                                          ? 'bg-green-600 text-white'
                                          : optIdx === detail.user_chosen_index
                                          ? 'bg-red-600 text-white'
                                          : 'bg-[rgb(var(--color-border))]'
                                      }`}>
                                        {String.fromCharCode(65 + optIdx)}
                                      </span>
                                      <span className={`flex-1 ${optIdx === detail.correct_index ? 'text-green-200' : ''}`}>
                                        {option}
                                      </span>
                                      {optIdx === detail.correct_index && (
                                        <span className="text-xs text-green-300">✓ Correct Answer</span>
                                      )}
                                      {optIdx === detail.user_chosen_index && !detail.is_correct && (
                                        <span className="text-xs text-red-300">Your Choice</span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}

                          <div className="mt-4 p-3 rounded bg-[rgb(var(--color-primary))]/10 border border-[rgb(var(--color-primary))]/20">
                            <div className="text-sm sm:text-base font-medium mb-2">Quiz Summary:</div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-sm">
                              <div className="flex justify-between sm:block">
                                <span>Total Score:</span>
                                <span className="font-semibold text-[rgb(var(--color-primary))]">{result.score}</span>
                              </div>
                              <div className="flex justify-between sm:block">
                                <span>Accuracy:</span>
                                <span className="font-semibold text-[rgb(var(--color-primary))]">{result.accuracy.toFixed(1)}%</span>
                              </div>
                              <div className="flex justify-between sm:block">
                                <span>Completion Time:</span>
                                <span className="font-semibold text-[rgb(var(--color-primary))]">{Math.floor(result.time_taken_seconds / 60)}:{(result.time_taken_seconds % 60).toString().padStart(2, '0')}</span>
                              </div>
                              <div className="flex justify-between sm:block">
                                <span>Rank:</span>
                                <span className="font-semibold text-[rgb(var(--color-primary))]">#{result.rank_in_quiz}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

export default AdminView;
