import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { supabase, SUPABASE_ENABLED } from '../../services/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import Card from '../common/Card';
import { LoadingSpinner } from '../common/LoadingSpinner';
import UserResultsView from './UserResultsView';
import { useI18n } from '../../contexts/I18nContext';
import { track } from '../../services/analytics';

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
  user_email?: string | null;
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
  const [quizEndTs, setQuizEndTs] = useState<number | null>(null);
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
  const autoSubmitRef = useRef(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const last30AlertedRef = useRef(false);
  const STORAGE_KEY = 'competitive_exam_session_v1';
  const EXAM_STYLE_ID = 'exam-mode-style';

  const enableExamMode = useCallback(() => {
    try {
      document.body.classList.add('exam-mode');
      if (!document.getElementById(EXAM_STYLE_ID)) {
        const style = document.createElement('style');
        style.id = EXAM_STYLE_ID;
        style.textContent = `
          /* Hide common chrome while in exam mode */
          body.exam-mode header, body.exam-mode nav, body.exam-mode aside,
          body.exam-mode .sidebar, body.exam-mode .app-sidebar,
          body.exam-mode .global-assistant, body.exam-mode [data-global-assistant],
          body.exam-mode .topbar, body.exam-mode .leftbar {
            display: none !important;
          }
          /* Prevent background scrolling and interactions */
          body.exam-mode {
            overflow: hidden !important;
          }
        `;
        document.head.appendChild(style);
      }
    } catch {}
  }, []);

  const disableExamMode = useCallback(() => {
    try {
      document.body.classList.remove('exam-mode');
      const el = document.getElementById(EXAM_STYLE_ID);
      if (el && el.parentNode) el.parentNode.removeChild(el);
    } catch {}
  }, []);

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
    if (!q.published_leaderboard) {
      setToast('Leaderboard not published yet');
      setTimeout(() => setToast(null), 2500);
      return;
    }
    try {
      setLoadingBoard(true);
      setBoardQuiz(q);
      setLeaderboard(null);
      // Prefer public leaderboard with masked emails
      let rows: any[] = [];
      try {
        const { data: pubData, error: pubErr } = await supabase.rpc('leaderboard_public', { p_quiz_id: q.id, p_limit: 100 });
        if (pubErr) throw pubErr;
        rows = Array.isArray(pubData) ? pubData as any[] : [];
      } catch {
        // Fallback to internal leaderboard if public RPC not available
        const { data: lbData } = await supabase.rpc('leaderboard', { p_quiz_id: q.id, p_limit: 100 });
        rows = Array.isArray(lbData) ? lbData as any[] : [];
      }
      setLeaderboard(rows as LeaderboardRow[]);
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
      // Use the stricter of server end_at and client start+duration
      const clientEnd = Date.now() + (q.duration_seconds * 1000);
      const serverEnd = new Date(q.end_at).getTime();
      setQuizEndTs(Math.min(clientEnd, serverEnd));
      autoSubmitRef.current = false;
      last30AlertedRef.current = false;
      // Persist initial session to survive refresh
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          quiz_id: q.id,
          end_ts: Math.min(clientEnd, serverEnd),
          answers: initAns,
          started_at: Date.now(),
        }));
      } catch {}
      enableExamMode();
      try {
        // Attempt to enter fullscreen for better focus (non-blocking)
        if (document?.documentElement?.requestFullscreen) {
          await document.documentElement.requestFullscreen();
          setIsFullscreen(true);
        }
      } catch {}
    } catch (e: any) {
      setError(e.message || 'Failed to load quiz');
    } finally {
      setLoading(false);
    }
  };

  // countdown when taking quiz (robust using absolute end timestamp)
  useEffect(() => {
    if (!activeQuiz || quizEndTs == null) return;
    const tick = () => {
      const tl = Math.ceil((quizEndTs - Date.now()) / 1000);
      setTimeLeft(Math.max(0, tl));
      if (tl <= 1) {
        if (!autoSubmitRef.current) {
          autoSubmitRef.current = true;
          handleSubmit();
        }
      } else if (tl <= 30 && !last30AlertedRef.current) {
        last30AlertedRef.current = true;
        setToast('Only 30 seconds left!');
        setTimeout(() => setToast(null), 3000);
      }
      // Persist answers + remaining time frequently
      try {
        const existing = localStorage.getItem(STORAGE_KEY);
        if (existing) {
          const obj = JSON.parse(existing);
          obj.answers = answers;
          obj.end_ts = quizEndTs;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
        }
      } catch {}
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [activeQuiz, quizEndTs, answers]);

  // Restore persisted session on mount (if quiz still live)
  useEffect(() => {
    const restore = async () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const obj = JSON.parse(raw);
        if (!obj?.quiz_id || !obj?.end_ts) return;
        if (Date.now() > obj.end_ts + 10000) { // allow 10s grace
          // Session expired; clear
          localStorage.removeItem(STORAGE_KEY);
          return;
        }
        if (!SUPABASE_ENABLED) return;
        // Fetch quiz meta and payload to restore UI
        const { data: qrows } = await supabase
          .from('competitive_quizzes')
          .select('id, title, subject, description, start_at, end_at, duration_seconds, published_leaderboard, quiz_focus')
          .eq('id', obj.quiz_id)
          .limit(1);
        const quiz = Array.isArray(qrows) && qrows[0] as any;
        if (!quiz) return;
        const { data, error } = await supabase.rpc('quiz_payload', { p_quiz_id: quiz.id });
        if (error) return;
        const rows = (data as QuizPayloadRow[]) || [];
        setActiveQuiz(quiz);
        setPayload(rows);
        setAnswers(obj.answers || {});
        setQuizEndTs(obj.end_ts);
        setTimeLeft(Math.max(0, Math.ceil((obj.end_ts - Date.now()) / 1000)));
        enableExamMode();
      } catch {}
    };
    restore();
  }, []);

  // Lock background scroll when quiz overlay is open
  useEffect(() => {
    if (activeQuiz && payload) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [activeQuiz, payload]);

  const handleSubmit = useCallback(async () => {
    if (!activeQuiz || !payload) return;
    if (!user) { await signInWithGoogle(); return; }
    if (submitting) return;
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
      try {
        track('competitive_submit', {
          quiz_id: activeQuiz.id,
          score: row?.score ?? null,
          accuracy: row?.accuracy ?? null,
          time_taken_seconds: row?.time_taken_seconds ?? null,
        });
      } catch {}
      setToast('Submission received!');
      setTimeout(() => setToast(null), 3000);
      const submittedQuiz = activeQuiz; // capture before clearing
      // Return to list and refresh attempts so this quiz is marked as attempted
      setActiveQuiz(null);
      setPayload(null);
      setAnswers({});
      setTimeLeft(null);
      setQuizEndTs(null);
      // Exit fullscreen if we had entered it
      try {
        if (document?.fullscreenElement) {
          await document.exitFullscreen();
        }
      } catch {}
      setIsFullscreen(false);
      await fetchQuizzes();
      // Auto-open leaderboard if published
      if (submittedQuiz?.published_leaderboard) {
        await viewLeaderboard(submittedQuiz);
      }
    } catch (e: any) {
      setResultMsg(`Submit failed: ${e.message || e}`);
    } finally {
      setSubmitting(false);
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
      disableExamMode();
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
    const tl = Math.max(0, timeLeft ?? 0);
    const pct = activeQuiz.duration_seconds > 0 ? Math.max(0, Math.min(100, Math.round((tl / activeQuiz.duration_seconds) * 100))) : 0;
    return (
      <div className="fixed inset-0 z-[2147483647] overflow-y-auto bg-[rgb(var(--color-sidebar))]" style={{ minHeight: '100svh' }}>
        {/* Toast inside overlay */}
        {toast && (
          <div className="fixed top-4 right-4 z-[2147483647] px-4 py-2 rounded-md bg-amber-600 text-white shadow-lg">{toast}</div>
        )}
        {/* Sticky header with timer */}
        <div className="sticky top-0 z-[2147483000] border-b border-[rgb(var(--color-border))] bg-[rgb(var(--color-sidebar))]">
          <div className="px-4 py-3 flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-semibold truncate">{activeQuiz.title} — {activeQuiz.subject}</h2>
            <div className={`text-sm px-3 py-1 rounded-md ${tl <= 30 ? 'bg-red-700 text-white' : 'bg-[rgb(var(--color-input))]'}`}>{t('time_left')}: {tl}s</div>
          </div>
          <div className="h-1 bg-[rgb(var(--color-input))]"><div className="h-1 bg-[rgb(var(--color-accent))]" style={{ width: `${pct}%` }} /></div>
        </div>
        {/* Content */}
        <div className="p-4 space-y-3">
          {resultMsg && <div className="p-3 rounded bg-[rgb(var(--color-input))]">{resultMsg}</div>}
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
          <div className="flex items-center gap-2 pb-8">
            <button disabled={submitting} onClick={handleSubmit} className="px-4 py-2 rounded-md bg-[rgb(var(--color-primary))] text-white disabled:bg-slate-600">{t('submit')}</button>
            <button
              onClick={async () => {
                setActiveQuiz(null); setPayload(null); setAnswers({}); setTimeLeft(null); setQuizEndTs(null); setResultMsg(null);
                try { if (document?.fullscreenElement) { await document.exitFullscreen(); } } catch {}
                try { localStorage.removeItem('competitive_exam_session_v1'); } catch {}
                // @ts-ignore - disableExamMode in closure
                try { (disableExamMode as any)(); } catch {}
                setIsFullscreen(false);
              }}
              className="px-4 py-2 rounded-md bg-[rgb(var(--color-input))]"
            >{t('cancel')}</button>
          </div>
        </div>
        {/* Floating timer badge always visible */}
        <div className={`fixed bottom-4 right-4 z-[2147483647] px-3 py-2 rounded-md shadow-lg ${tl <= 30 ? 'bg-red-700 text-white' : 'bg-[rgb(var(--color-input))] text-white'}`}>
          {t('time_left')}: {tl}s
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
                {/* If no live items, show next upcoming timer banner in Live tab */}
                {activeTab === 'live' && source.length === 0 && quizzes.some(q => isUpcoming(q)) && (
                  <div className="mb-3 p-3 rounded border border-[rgb(var(--color-border))] bg-[rgb(var(--color-card))]/50">
                    {(() => {
                      const upcoming = quizzes.filter(q => isUpcoming(q)).sort((a,b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
                      const next = upcoming[0];
                      const s = Math.max(0, Math.floor((new Date(next.start_at).getTime() - nowTs) / 1000));
                      const mm = Math.floor(s / 60);
                      const ss = s % 60;
                      return <div>Next test starts in {mm}m {ss}s — <span className="font-semibold">{next.title}</span></div>;
                    })()}
                  </div>
                )}
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
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {(() => { const showMy = activeTab === 'past' || attempted[q.id]; return showMy; })() && (
                    <button
                      className="px-3 py-2 rounded-md bg-[rgb(var(--color-primary))] text-white hover:bg-[rgb(var(--color-primary-hover))] relative z-10 w-full sm:w-auto"
                      onClick={() => setShowingUserResults(q)}
                    >
                      {t('view_my_results')}
                    </button>
                  )}
                  <button
                    className={`px-3 py-2 rounded-md relative z-10 w-full sm:w-auto ${q.published_leaderboard ? 'bg-[rgb(var(--color-input))]' : 'bg-slate-600 cursor-not-allowed opacity-70'}`}
                    onClick={() => viewLeaderboard(q)}
                    aria-disabled={!q.published_leaderboard}
                  >{t('view_leaderboard')}</button>
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
                          <td className="truncate max-w-[220px]">{r.user_id === user?.id ? 'You' : (r.user_email || r.user_id)}</td>
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
