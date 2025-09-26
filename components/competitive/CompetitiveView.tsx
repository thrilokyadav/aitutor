import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase, SUPABASE_ENABLED } from '../../services/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import Card from '../common/Card';
import { LoadingSpinner } from '../common/LoadingSpinner';
import UserResultsView from './UserResultsView';
import { useI18n } from '../../contexts/I18nContext';

interface QuizMeta {
  id: string;
  title: string;
  subject: string;
  description: string | null;
  start_at: string;
  end_at: string;
  duration_seconds: number;
  published_leaderboard: boolean;
  quiz_focus?: string | null;
}

interface LeaderboardRow {
  rank: number;
  user_id: string;
  score: number | null;
  time_taken_seconds: number | null;
  submitted_at: string | null;
  state?: string | null;
  district?: string | null;
}

interface QuizPayloadRow extends QuizMeta {
  question_id: string;
  question: string;
  options: string[] | any;
  correct_index: number;
  points: number;
  order_index: number;
}

const CompetitiveView: React.FC = () => {
  const { user, signInWithGoogle } = useAuth();
  const { t } = useI18n();
  const fmt = (s: string, ...args: Array<string | number>) =>
    args.reduce<string>((acc, v, i) => acc.replace(new RegExp(`\\{${i}\\}`, 'g'), String(v)), s);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quizzes, setQuizzes] = useState<QuizMeta[]>([]);
  const [pastQuizzes, setPastQuizzes] = useState<(QuizMeta & { submitted_at?: string | null })[]>([]);

  // Active quiz state
  const [activeQuiz, setActiveQuiz] = useState<QuizMeta | null>(null);
  const [payload, setPayload] = useState<QuizPayloadRow[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [boardQuiz, setBoardQuiz] = useState<QuizMeta | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[] | null>(null);
  const [loadingBoard, setLoadingBoard] = useState(false);
  const [showingUserResults, setShowingUserResults] = useState<QuizMeta | null>(null);
  const [attempted, setAttempted] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [nowTs, setNowTs] = useState<number>(Date.now());
  const [activeTab, setActiveTab] = useState<'live' | 'upcoming' | 'past'>('live');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [page, setPage] = useState<number>(1);
  const pageSize = 10;

  const isLive = (q: QuizMeta) => {
    const now = Date.now();
    return now >= new Date(q.start_at).getTime() && now <= new Date(q.end_at).getTime();
  };

  const isUpcoming = (q: QuizMeta) => Date.now() < new Date(q.start_at).getTime();

  // Ticking clock for countdowns
  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const viewLeaderboard = useCallback(async (q: QuizMeta) => {
    try {
      setLoadingBoard(true);
      setBoardQuiz(q);
      setLeaderboard(null);
      const { data, error } = await supabase.rpc('leaderboard', { p_quiz_id: q.id, p_limit: 100 });
      if (error) throw error;
      setLeaderboard(Array.isArray(data) ? (data as LeaderboardRow[]) : []);
    } catch (e: any) {
      setLeaderboard([]);
      alert(e.message || 'Failed to load leaderboard (may be unpublished).');
    } finally {
      setLoadingBoard(false);
    }
  }, []);

  const fetchQuizzes = useCallback(async () => {
    if (!SUPABASE_ENABLED) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc('open_quizzes_now');
    if (error) setError(error.message);
    const list = Array.isArray(data) ? (data as QuizMeta[]) : [];
    setQuizzes(list);
    // fetch attempt status for each quiz
    if (user && list.length > 0) {
      const ids = list.map(q => q.id);
      const { data: attemptRows, error: attErr } = await supabase
        .from('competitive_quiz_attempts')
        .select('quiz_id')
        .in('quiz_id', ids)
        .eq('user_id', user.id);
      if (!attErr && Array.isArray(attemptRows)) {
        const status: Record<string, boolean> = {};
        ids.forEach(id => { status[id] = false; });
        attemptRows.forEach((row: any) => { status[row.quiz_id] = true; });
        setAttempted(status);
      } else {
        setAttempted({});
      }
    }
    // Load past quizzes that the user attempted (end_at < now)
    if (user) {
      const { data: myAttempts } = await supabase
        .from('competitive_quiz_attempts')
        .select('quiz_id, submitted_at')
        .eq('user_id', user.id)
        .order('submitted_at', { ascending: false });
      const ids = (myAttempts || []).map((r: any) => r.quiz_id);
      if (ids.length > 0) {
        const { data: quizzesData } = await supabase
          .from('competitive_quizzes')
          .select('id, title, subject, description, start_at, end_at, duration_seconds, published_leaderboard, quiz_focus')
          .in('id', ids)
          .lt('end_at', new Date().toISOString())
          .order('start_at', { ascending: false });
        const submittedMap: Record<string, string> = {};
        (myAttempts || []).forEach((r: any) => { submittedMap[r.quiz_id] = r.submitted_at; });
        const merged = (quizzesData || []).map((q: any) => ({ ...q, submitted_at: submittedMap[q.id] || null }));
        setPastQuizzes(merged as any);
      } else {
        setPastQuizzes([]);
      }
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchQuizzes(); }, [fetchQuizzes]);

  // If navigated from Dashboard with a request to open leaderboard, honor it
  useEffect(() => {
    try {
      const qid = localStorage.getItem('openLeaderboardQuiz');
      if (qid && quizzes.length > 0) {
        const q = quizzes.find(x => x.id === qid);
        if (q) {
          viewLeaderboard(q);
          localStorage.removeItem('openLeaderboardQuiz');
        }
      }
    } catch {}
  }, [quizzes, viewLeaderboard]);

  const startQuiz = async (q: QuizMeta) => {
    if (!user) { await signInWithGoogle(); return; }
    if (!SUPABASE_ENABLED) { alert('Supabase not configured'); return; }
    if (attempted[q.id]) { alert('You have already submitted this quiz. Please wait for results.'); return; }
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase.rpc('quiz_payload', { p_quiz_id: q.id });
      if (error) throw error;
      const rows = (data as QuizPayloadRow[]) || [];
      setActiveQuiz(q);
      setPayload(rows);
      // init answers
      const initAns: Record<string, number | null> = {};
      rows.forEach(r => { initAns[r.question_id] = null; });
      setAnswers(initAns);
      setTimeLeft(q.duration_seconds);
    } catch (e: any) {
      setError(e.message || 'Failed to load quiz');
    } finally {
      setLoading(false);
    }
  };

  // countdown when taking quiz
  useEffect(() => {
    if (activeQuiz && timeLeft !== null) {
      if (timeLeft <= 0) {
        // auto submit
        handleSubmit();
        return;
      }
      const t = setTimeout(() => setTimeLeft(prev => (prev !== null ? prev - 1 : prev)), 1000);
      return () => clearTimeout(t);
    }
  }, [activeQuiz, timeLeft]);

  const handleSubmit = useCallback(async () => {
    if (!activeQuiz || !payload) return;
    if (!user) { await signInWithGoogle(); return; }
    setSubmitting(true);
    setResultMsg(null);
    try {
      const answersArray = Object.keys(answers).map(qid => ({ question_id: qid, chosen_index: answers[qid] }));
      const { data, error } = await supabase.rpc('submit_competitive_attempt', {
        p_quiz_id: activeQuiz.id,
        p_answers: answersArray,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      setResultMsg(`Submitted! Score ${row?.score ?? 0}, Accuracy ${row?.accuracy?.toFixed?.(2) ?? row?.accuracy}%`);
      setToast('Submission received!');
      setTimeout(() => setToast(null), 3000);
      const submittedQuiz = activeQuiz; // capture before clearing
      // Return to list and refresh attempts so this quiz is marked as attempted
      setActiveQuiz(null);
      setPayload(null);
      setAnswers({});
      setTimeLeft(null);
      await fetchQuizzes();
      // Auto-open leaderboard if published
      if (submittedQuiz?.published_leaderboard) {
        await viewLeaderboard(submittedQuiz);
      }
    } catch (e: any) {
      setResultMsg(`Submit failed: ${e.message || e}`);
    } finally {
      setSubmitting(false);
    }
  }, [activeQuiz, payload, answers, user, signInWithGoogle, fetchQuizzes]);

  

  if (!user) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-2">{t('competitive_quizzes')}</h2>
        <p className="text-[rgb(var(--color-text-secondary))] mb-3">{t('sign_in_competitive')}</p>
        <button className="px-4 py-2 rounded-md bg-[rgb(var(--color-primary))] text-white" onClick={() => signInWithGoogle()}>{t('sign_in_with_google')}</button>
      </div>
    );
  }

  if (activeQuiz && payload) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">{activeQuiz.title} — {activeQuiz.subject}</h2>
          <div className="text-sm bg-[rgb(var(--color-input))] px-3 py-1 rounded-md">{t('time_left')}: {timeLeft ?? 0}s</div>
        </div>
        {resultMsg && <div className="p-3 rounded bg-[rgb(var(--color-input))]">{resultMsg}</div>}
        <div className="space-y-3">
          {payload.map((q, idx) => (
            <Card key={q.question_id}>
              <div className="text-sm text-[rgb(var(--color-text-secondary))] mb-1">{t('question_n')} {idx + 1}</div>
              <div className="font-medium mb-2">{q.question}</div>
              <div className="space-y-2">
                {(Array.isArray(q.options) ? q.options : (q.options?.options || [])).map((opt: string, i: number) => (
                  <button
                    key={i}
                    className={`w-full text-left p-2 rounded-md border ${answers[q.question_id] === i ? 'border-[rgb(var(--color-accent))]' : 'border-[rgb(var(--color-border))]'}`}
                    onClick={() => setAnswers(prev => ({ ...prev, [q.question_id]: i }))}
                  >{opt}</button>
                ))}
              </div>
            </Card>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button disabled={submitting} onClick={handleSubmit} className="px-4 py-2 rounded-md bg-[rgb(var(--color-primary))] text-white disabled:bg-slate-600">{t('submit')}</button>
          <button onClick={() => { setActiveQuiz(null); setPayload(null); setAnswers({}); setTimeLeft(null); setResultMsg(null); }} className="px-4 py-2 rounded-md bg-[rgb(var(--color-input))]">{t('cancel')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {toast && (
        <div className="fixed top-4 right-4 z-40 px-4 py-2 rounded-md bg-emerald-600 text-white shadow-lg">{toast}</div>
      )}

      {/* User Results View */}
      {showingUserResults && (
        <UserResultsView
          quiz={showingUserResults}
          onClose={() => setShowingUserResults(null)}
        />
      )}

      {/* Main Content */}
      {!showingUserResults && (
        <>
          <h2 className="text-xl font-semibold">{t('competitive_quizzes')}</h2>
          {/* Tabs and controls */}
          <div className="flex items-center gap-2">
            {(['live','upcoming','past'] as const).map(tab => (
              <button
                key={tab}
                className={`px-3 py-1 rounded-md ${activeTab === tab ? 'bg-[rgb(var(--color-primary))] text-white' : 'bg-[rgb(var(--color-input))]'}`}
                onClick={() => { setActiveTab(tab); setPage(1); }}
              >{tab === 'live' ? t('tabs_live') : tab === 'upcoming' ? t('tabs_upcoming') : t('tabs_past')}</button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder={t('search_title_desc')}
                className="px-2 py-1 rounded bg-[rgb(var(--color-input))] border border-[rgb(var(--color-border))]"
              />
              <select
                value={subjectFilter}
                onChange={(e) => { setSubjectFilter(e.target.value); setPage(1); }}
                className="px-2 py-1 rounded bg-[rgb(var(--color-input))] border border-[rgb(var(--color-border))]"
              >
                <option value="all">{t('all_subjects')}</option>
                {Array.from(new Set((activeTab === 'past' ? pastQuizzes : quizzes).map(q => q.subject))).map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as any)}
                className="px-2 py-1 rounded bg-[rgb(var(--color-input))] border border-[rgb(var(--color-border))]"
              >
                <option value="newest">{t('newest')}</option>
                <option value="oldest">{t('oldest')}</option>
              </select>
            </div>
          </div>
          {loading && <div className="flex items-center gap-2"><LoadingSpinner /> {t('loading')}</div>}
          {error && <div className="p-3 rounded bg-red-900/30 border border-red-800 text-red-200">{error}</div>}

          {(() => {
            let source: (QuizMeta & { submitted_at?: string | null })[] = [];
            if (activeTab === 'live') source = quizzes.filter(q => isLive(q));
            else if (activeTab === 'upcoming') source = quizzes.filter(q => isUpcoming(q));
            else source = pastQuizzes;
            const filtered = source.filter(q =>
              (subjectFilter === 'all' || q.subject === subjectFilter) &&
              ((q.title + ' ' + (q.description || '')).toLowerCase().includes(search.toLowerCase()))
            );
            filtered.sort((a, b) => sortOrder === 'newest'
              ? new Date(b.start_at).getTime() - new Date(a.start_at).getTime()
              : new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
            const total = filtered.length;
            const totalPages = Math.max(1, Math.ceil(total / pageSize));
            const currentPage = Math.min(page, totalPages);
            const startIdx = (currentPage - 1) * pageSize;
            const pageItems = filtered.slice(startIdx, startIdx + pageSize);
            return (
              <>
                <div className="grid md:grid-cols-2 gap-4">
                  {pageItems.length === 0 && !loading ? (
                    <div className="text-[rgb(var(--color-text-secondary))]">{t('no_quizzes')}</div>
                  ) : pageItems.map(q => (
              <Card key={q.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{q.title}</div>
                    <div className="text-sm text-[rgb(var(--color-text-secondary))]">{q.subject} • {new Date(q.start_at).toLocaleString()} → {new Date(q.end_at).toLocaleString()}</div>
                  </div>
                  {isLive(q) ? (
                    <div className="flex items-center gap-2">
                      <button onClick={() => startQuiz(q)} className="px-3 py-1 rounded-md bg-[rgb(var(--color-primary))] text-white">{t('start')}</button>
                      <span className="px-3 py-1 rounded-md bg-[rgb(var(--color-input))]">
                        {(() => {
                          const ms = new Date(q.end_at).getTime() - nowTs;
                          const s = Math.max(0, Math.floor(ms / 1000));
                          const mm = Math.floor(s / 60);
                          const ss = s % 60;
                          return `${t('ends_in')} ${mm}m ${ss}s`;
                        })()}
                      </span>
                    </div>
                  ) : isUpcoming(q) ? (
                    <span className="px-3 py-1 rounded-md bg-[rgb(var(--color-input))]">
                      {(() => {
                        const ms = new Date(q.start_at).getTime() - nowTs;
                        const s = Math.max(0, Math.floor(ms / 1000));
                        const mm = Math.floor(s / 60);
                        const ss = s % 60;
                        return `${t('starts_in')} ${mm}m ${ss}s`;
                      })()}
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-md bg-[rgb(var(--color-input))]">{t('closed')}</span>
                  )}
                </div>
                {q.description && <p className="mt-2 text-sm text-[rgb(var(--color-text-secondary))]">{q.description}</p>}
                {q.quiz_focus && <p className="mt-1 text-xs text-[rgb(var(--color-text-secondary))]"><span className="font-semibold">{t('focus')}:</span> {q.quiz_focus}</p>}
                {attempted[q.id] && (
                  <p className="mt-2 text-xs text-amber-300">{t('already_taken')}</p>
                )}
                <div className="mt-2 flex items-center gap-2">
                  {activeTab === 'past' && attempted[q.id] && q.published_leaderboard && (
                    <button
                      className="px-3 py-1 rounded-md bg-[rgb(var(--color-primary))] text-white hover:bg-[rgb(var(--color-primary-hover))]"
                      onClick={() => setShowingUserResults(q)}
                    >
                      {t('view_my_results')}
                    </button>
                  )}
                  <button className="px-3 py-1 rounded-md bg-[rgb(var(--color-input))]" onClick={() => viewLeaderboard(q)}>{t('view_leaderboard')}</button>
                  {q.published_leaderboard ? <span className="text-xs text-emerald-300">{t('published')}</span> : <span className="text-xs text-[rgb(var(--color-text-secondary))]">{t('unpublished')}</span>}
                </div>
              </Card>
            ))}
                </div>
                {/* Pagination */}
                <div className="flex items-center justify-between mt-3">
                  <div className="text-xs text-[rgb(var(--color-text-secondary))]">{fmt(t('page_of'), currentPage, totalPages)}</div>
                  <div className="flex items-center gap-2">
                    <button disabled={currentPage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="px-2 py-1 rounded bg-[rgb(var(--color-input))] disabled:opacity-50">{t('prev')}</button>
                    <button disabled={currentPage >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="px-2 py-1 rounded bg-[rgb(var(--color-input))] disabled:opacity-50">{t('next')}</button>
                  </div>
                </div>
              </>
            );
          })()}

          <div className="mt-3">
            <button onClick={fetchQuizzes} className="px-3 py-1 rounded-md bg-[rgb(var(--color-input))]">{t('refresh')}</button>
          </div>

          {/* Leaderboard Panel */}
          {boardQuiz && (
            <Card>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{fmt(t('leaderboard_for'), boardQuiz.title)}</h3>
                <button className="px-2 py-1 text-xs rounded bg-[rgb(var(--color-input))]" onClick={() => { setBoardQuiz(null); setLeaderboard(null); }}>{t('close')}</button>
              </div>
              {loadingBoard ? (
                <div className="flex items-center gap-2 mt-2"><LoadingSpinner /> {t('loading')}</div>
              ) : leaderboard && leaderboard.length > 0 ? (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[rgb(var(--color-text-secondary))]">
                        <th className="py-2">{t('tbl_rank')}</th>
                        <th>{t('tbl_user')}</th>
                        <th>{t('tbl_state')}</th>
                        <th>{t('tbl_district')}</th>
                        <th>{t('tbl_score')}</th>
                        <th>{t('tbl_time_s')}</th>
                        <th>{t('tbl_submitted')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.map((r, idx) => (
                        <tr key={idx} className={`border-t border-[rgb(var(--color-border))] ${r.user_id === user?.id ? 'bg-[rgb(var(--color-input))]' : ''}`}>
                          <td className="py-2">{r.rank}</td>
                          <td className="truncate max-w-[180px]">{r.user_id === user?.id ? 'You' : r.user_id}</td>
                          <td className="truncate max-w-[120px]">{r.state || '-'}</td>
                          <td className="truncate max-w-[120px]">{r.district || '-'}</td>
                          <td>{r.score ?? '-'}</td>
                          <td>{r.time_taken_seconds ?? '-'}</td>
                          <td>{r.submitted_at ? new Date(r.submitted_at).toLocaleString() : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-[rgb(var(--color-text-secondary))] mt-2">{t('no_leaderboard')}</p>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default CompetitiveView;
