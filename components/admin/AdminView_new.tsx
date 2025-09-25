import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, SUPABASE_ENABLED } from '../../services/supabaseClient';
import Card from '../common/Card';
import { LoadingSpinner } from '../common/LoadingSpinner';
import GeminiService from '../../services/geminiService';

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
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-semibold">Admin — Competitive Quizzes</h2>
      {loading && <div className="flex items-center gap-2"><LoadingSpinner /> Working…</div>}
      {error && <div className="p-3 rounded bg-red-900/30 border border-red-800 text-red-200">{error}</div>}

      <Card>
        <h3 className="font-semibold mb-3">Create Quiz</h3>
        <div className="grid md:grid-cols-2 gap-3">
          <input className="bg-[rgb(var(--color-input))] p-2 rounded border border-[rgb(var(--color-border))]" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} />
          <input className="bg-[rgb(var(--color-input))] p-2 rounded border border-[rgb(var(--color-border))]" placeholder="Subject" value={subject} onChange={e => setSubject(e.target.value)} />
          <input className="bg-[rgb(var(--color-input))] p-2 rounded border border-[rgb(var(--color-border))]" placeholder="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} />
          <input className="bg-[rgb(var(--color-input))] p-2 rounded border border-[rgb(var(--color-border))]" placeholder="Focus (how the quiz should be focused)" value={quizFocus} onChange={e => setQuizFocus(e.target.value)} />
          <input className="bg-[rgb(var(--color-input))] p-2 rounded border border-[rgb(var(--color-border))]" type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)} />
          <input className="bg-[rgb(var(--color-input))] p-2 rounded border border-[rgb(var(--color-border))]" type="number" min={60} step={30} value={duration} onChange={e => setDuration(parseInt(e.target.value || '600', 10))} placeholder="Duration seconds" />
        </div>
        <div className="mt-3 grid md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm mb-1 text-[rgb(var(--color-text-secondary))]">Auto-generate</label>
            <div className="flex items-center gap-2">
              <input className="bg-[rgb(var(--color-input))] p-2 rounded border border-[rgb(var(--color-border))] w-24" type="number" min={1} max={50} value={genCount} onChange={e => setGenCount(parseInt(e.target.value || '10', 10))} />
              <select className="bg-[rgb(var(--color-input))] p-2 rounded border border-[rgb(var(--color-border))]" value={genDifficulty} onChange={e => setGenDifficulty(e.target.value as any)}>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
              <button className="px-3 py-2 rounded bg-[rgb(var(--color-input))]" onClick={handleAutoGenerate}>Generate</button>
            </div>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          <div className="text-sm font-semibold">Questions</div>
          {questions.map((q, idx) => (
            <div key={idx} className="p-3 rounded border border-[rgb(var(--color-border))] bg-[rgb(var(--color-card))]/50">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-[rgb(var(--color-text-secondary))]">Question {idx + 1}</div>
                {questions.length > 1 && (
                  <button className="px-2 py-1 text-xs rounded bg-[rgb(var(--color-input))]" onClick={() => removeQuestion(idx)}>Remove</button>
                )}
              </div>
              <input className="w-full bg-[rgb(var(--color-input))] p-2 rounded border border-[rgb(var(--color-border))] mb-2" placeholder="Question text" value={q.question} onChange={e => setQuestions(prev => prev.map((qq, i) => i === idx ? { ...qq, question: e.target.value } : qq))} />
              <div className="grid md:grid-cols-2 gap-2">
                {q.options.map((opt, i) => (
                  <input key={i} className="bg-[rgb(var(--color-input))] p-2 rounded border border-[rgb(var(--color-border))]" placeholder={`Option ${i + 1}`} value={opt} onChange={e => setQuestions(prev => prev.map((qq, ii) => ii === idx ? { ...qq, options: qq.options.map((oo, oi) => oi === i ? e.target.value : oo) } : qq))} />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <label className="text-sm">Correct index</label>
                <select className="bg-[rgb(var(--color-input))] p-1 rounded border border-[rgb(var(--color-border))]" value={q.correct_index} onChange={e => setQuestions(prev => prev.map((qq, i) => i === idx ? { ...qq, correct_index: parseInt(e.target.value, 10) } : qq))}>
                  <option value={0}>0</option>
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                </select>
                <label className="text-sm">Points</label>
                <input className="bg-[rgb(var(--color-input))] p-1 rounded border border-[rgb(var(--color-border))] w-20" type="number" min={1} value={q.points} onChange={e => setQuestions(prev => prev.map((qq, i) => i === idx ? { ...qq, points: parseInt(e.target.value || '1', 10) } : qq))} />
              </div>
            </div>
          ))}
          <button className="px-3 py-1 rounded bg-[rgb(var(--color-input))]" onClick={addQuestion}>Add Question</button>
        </div>
        <div className="mt-4">
          <button className="px-4 py-2 rounded-md bg-[rgb(var(--color-primary))] text-white" onClick={handleCreateQuiz}>Create Quiz</button>
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold mb-3">Manage Quizzes</h3>
        {quizzes.length === 0 ? (
          <div className="text-[rgb(var(--color-text-secondary))]">No quizzes yet.</div>
        ) : (
          <div className="space-y-2">
            {quizzes.map(q => (
              <div key={q.id} className="p-3 rounded border border-[rgb(var(--color-border))] bg-[rgb(var(--color-card))]/50 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{q.title} — {q.subject}</div>
                  <div className="text-xs text-[rgb(var(--color-text-secondary))]">{new Date(q.start_at).toLocaleString()} → {new Date(q.end_at).toLocaleString()} • Duration {q.duration_seconds}s</div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="px-3 py-1 text-xs rounded bg-[rgb(var(--color-input))]" onClick={() => togglePublishLeaderboard(q)}>
                    {q.published_leaderboard ? 'Unpublish Leaderboard' : 'Publish Leaderboard'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">User Management</h3>
          <button
            className="px-3 py-1 text-sm rounded bg-[rgb(var(--color-input))] hover:bg-[rgb(var(--color-input-hover))]"
            onClick={fetchUsers}
          >
            Refresh
          </button>
        </div>

        {/* Search and Filter Controls */}
        <div className="mb-4 space-y-3">
          <div className="flex items-center gap-3">
            <input
              className="flex-1 bg-[rgb(var(--color-input))] p-2 rounded border border-[rgb(var(--color-border))]"
              placeholder="Search users by email..."
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
            />
            <select
              className="bg-[rgb(var(--color-input))] p-2 rounded border border-[rgb(var(--color-border))]"
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
          <div className="text-[rgb(var(--color-text-secondary))]">No users found.</div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {filteredUsers.map(user => (
              <div key={user.id} className="p-3 rounded border border-[rgb(var(--color-border))] bg-[rgb(var(--color-card))]/50">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{user.email}</div>
                    <div className="text-sm text-[rgb(var(--color-text-secondary))] space-y-1">
                      <div>Registered: {new Date(user.created_at).toLocaleString()}</div>
                      {user.last_sign_in_at && (
                        <div>Last Sign In: {new Date(user.last_sign_in_at).toLocaleString()}</div>
                      )}
                      {user.email_confirmed_at && (
                        <div>Email Confirmed: {new Date(user.email_confirmed_at).toLocaleString()}</div>
                      )}
                      <div className="flex items-center gap-4 pt-1">
                        <span>Quizzes: {user.quiz_count}</span>
                        <span>Total Score: {user.total_score}</span>
                        <span>Avg Accuracy: {user.avg_accuracy.toFixed(1)}%</span>
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
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">User Results & Leaderboards</h3>
          <button
            className="px-3 py-1 text-sm rounded bg-[rgb(var(--color-input))] hover:bg-[rgb(var(--color-input-hover))]"
            onClick={fetchUserResults}
          >
            Refresh
          </button>
        </div>

        {/* Results Search and Filter Controls */}
        <div className="mb-4 space-y-3">
          <div className="flex items-center gap-3">
            <input
              className="flex-1 bg-[rgb(var(--color-input))] p-2 rounded border border-[rgb(var(--color-border))]"
              placeholder="Search results by user email, quiz title, or subject..."
              value={resultsSearch}
              onChange={e => setResultsSearch(e.target.value)}
            />
            <select
              className="bg-[rgb(var(--color-input))] p-2 rounded border border-[rgb(var(--color-border))]"
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
          <div className="text-[rgb(var(--color-text-secondary))]">No results found.</div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {filteredResults.map((result, idx) => (
              <div key={`${result.user_id}-${result.quiz_id}-${result.submitted_at}`} className="p-3 rounded border border-[rgb(var(--color-border))] bg-[rgb(var(--color-card))]/50">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="font-semibold truncate">{result.user_email}</div>
                      <div className={`px-2 py-1 text-xs rounded ${
                        result.rank_in_quiz === 1 ? 'bg-yellow-900/30 text-yellow-200' :
                        result.rank_in_quiz === 2 ? 'bg-gray-900/30 text-gray-200' :
                        result.rank_in_quiz === 3 ? 'bg-orange-900/30 text-orange-200' :
                        'bg-[rgb(var(--color-input))]'
                      }`}>
                        #{result.rank_in_quiz}
                      </div>
                    </div>
                    <div className="text-sm text-[rgb(var(--color-text-secondary))] space-y-1">
                      <div className="font-medium">{result.quiz_title} — {result.quiz_subject}</div>
                      <div className="flex items-center gap-4">
                        <span>Score: {result.score}</span>
                        <span>Accuracy: {result.accuracy.toFixed(1)}%</span>
                        <span>Time: {Math.floor(result.time_taken_seconds / 60)}:{(result.time_taken_seconds % 60).toString().padStart(2, '0')}</span>
                      </div>
                      <div>Submitted: {new Date(result.submitted_at).toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default AdminView;
