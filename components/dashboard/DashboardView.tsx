import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabaseClient';
import { useAppContext } from '../../contexts/AppContext';
import { ActiveView } from '../../types';

type SubjectAnalytics = { subject: string; avg_score: number; tests_count: number };
type RecentTest = { id: string; subject: string; score: number; taken_at: string };
type StrengthWeakness = { top_subjects: string[]; weak_subjects: string[] };
type TopicAnalytics = { topic: string; accuracy: number; attempts: number; last_seen: string | null };
type TrendPoint = { bucket: string; avg_score: number };

const DashboardView: React.FC = () => {
  const { user, loading, signInWithGoogle } = useAuth();
  const { setActiveView, setExplainerPrefillTopic } = useAppContext();

  const [subjectAnalytics, setSubjectAnalytics] = useState<SubjectAnalytics[]>([]);
  const [recentTests, setRecentTests] = useState<RecentTest[]>([]);
  const [strengths, setStrengths] = useState<StrengthWeakness | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailSubject, setDetailSubject] = useState<string | null>(null);
  const [topicAnalytics, setTopicAnalytics] = useState<TopicAnalytics[] | null>(null);
  const [trend, setTrend] = useState<TrendPoint[] | null>(null);
  const [tracking, setTracking] = useState<Record<string, boolean>>({});
  const [granularity, setGranularity] = useState<'week' | 'month'>('week');

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      setLoadingData(true);
      setError(null);
      try {
        const [{ data: sData, error: sErr }, { data: rData, error: rErr }, { data: swData, error: swErr }] = await Promise.all([
          supabase.rpc('subject_analytics'),
          supabase.rpc('recent_tests', { limit_n: 20 }),
          supabase.rpc('subject_strengths_weaknesses', { top_n: 3 }),
        ]);
        if (sErr) throw sErr;
        if (rErr) throw rErr;
        if (swErr) throw swErr;
        setSubjectAnalytics((sData as SubjectAnalytics[]) || []);
        setRecentTests((rData as RecentTest[]) || []);
        setStrengths((swData as StrengthWeakness) || null);
      } catch (e: any) {
        setError(e.message || 'Failed to load analytics');
      } finally {
        setLoadingData(false);
      }
    };
    fetchData();
  }, [user]);

  // Fetch topic-level analytics and trend when a subject is selected
  useEffect(() => {
    const fetchDetail = async () => {
      if (!user || !detailSubject) return;
      try {
        const trendCall = granularity === 'month'
          ? supabase.rpc('subject_trend_monthly', { subject_name: detailSubject, buckets: 12 })
          : supabase.rpc('subject_trend', { subject_name: detailSubject, buckets: 12 });

        const [{ data: ta, error: taErr }, { data: tr, error: trErr }, { data: tt, error: ttErr }] = await Promise.all([
          supabase.rpc('subject_topic_analytics', { subject_name: detailSubject }),
          trendCall,
          supabase.rpc('tracked_topics_for_user'),
        ]);
        if (!taErr) setTopicAnalytics((ta as TopicAnalytics[]) ?? []);
        if (!trErr) setTrend((tr as TrendPoint[]) ?? []);
        if (!ttErr) {
          const tracked = Array.isArray(tt) ? (tt as { topic: string }[]).reduce((acc, cur) => { acc[cur.topic] = true; return acc; }, {} as Record<string, boolean>) : {};
          setTracking(tracked);
        }

        // Auto-track weak topics: accuracy < 60 and attempts >= 3
        if (user && Array.isArray(ta)) {
          const weak = (ta as TopicAnalytics[]).filter(t => (t.accuracy ?? 100) < 60 && (t.attempts ?? 0) >= 3 && !tracking[t.topic]);
          if (weak.length) {
            for (const w of weak) {
              await supabase.from('tracked_topics').upsert({ user_id: user.id, topic: w.topic, subject: detailSubject });
            }
            // refresh tracked
            const { data: tt2 } = await supabase.rpc('tracked_topics_for_user');
            const tracked2 = Array.isArray(tt2) ? (tt2 as { topic: string }[]).reduce((acc, cur) => { acc[cur.topic] = true; return acc; }, {} as Record<string, boolean>) : {};
            setTracking(tracked2);
          }
        }
      } catch (_e) {
        // soft-fail; these RPCs may not exist yet
      }
    };
    fetchDetail();
  }, [user, detailSubject, granularity]);

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="p-6 space-y-4">
        <h2 className="text-xl font-semibold">Dashboard</h2>
        <p className="text-[rgb(var(--color-text-secondary))]">Sign in to view your analytics.</p>
        <button onClick={signInWithGoogle} className="px-4 py-2 rounded-md bg-[rgb(var(--color-primary))] text-white">Sign in with Google</button>
      </div>
    );
  }

  const maxAvg = useMemo(() => Math.max(1, ...subjectAnalytics.map(s => s.avg_score || 0)), [subjectAnalytics]);

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-semibold">Dashboard</h2>
      {error && <div className="p-3 rounded-md bg-red-900/30 border border-red-800 text-red-200">{error}</div>}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="p-4 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-card))]/50">
          <h3 className="font-medium mb-3">Subject-wise Performance</h3>
          {loadingData ? (
            <p className="text-sm text-[rgb(var(--color-text-secondary))]">Loading...</p>
          ) : subjectAnalytics.length === 0 ? (
            <p className="text-sm text-[rgb(var(--color-text-secondary))]">No data yet. Take a quiz to see analytics.</p>
          ) : (
            <div className="space-y-2">
              {subjectAnalytics.map((s) => (
                <button key={s.subject} onClick={() => setDetailSubject(s.subject)} className="w-full text-left">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>{s.subject}</span>
                    <span className="text-[rgb(var(--color-text-secondary))]">{Math.round(s.avg_score)}%</span>
                  </div>
                  <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-3 bg-[rgb(var(--color-primary))]" style={{ width: `${(s.avg_score / maxAvg) * 100}%` }} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="p-4 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-card))]/50">
          <h3 className="font-medium mb-3">Strengths & Improvements</h3>
          {loadingData ? (
            <p className="text-sm text-[rgb(var(--color-text-secondary))]">Loading...</p>
          ) : strengths ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-semibold mb-2">Top</h4>
                <ul className="text-sm list-disc pl-5 space-y-1">
                  {strengths.top_subjects.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2">Needs Improvement</h4>
                <ul className="text-sm list-disc pl-5 space-y-1">
                  {strengths.weak_subjects.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[rgb(var(--color-text-secondary))]">No data yet.</p>
          )}
        </div>
        <div className="md:col-span-2 p-4 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-card))]/50">
          <h3 className="font-medium mb-3">Recent Tests</h3>
          {loadingData ? (
            <p className="text-sm text-[rgb(var(--color-text-secondary))]">Loading...</p>
          ) : recentTests.length === 0 ? (
            <p className="text-sm text-[rgb(var(--color-text-secondary))]">No recent tests.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[rgb(var(--color-text-secondary))]">
                    <th className="py-2">Date</th>
                    <th>Subject</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTests.map(t => (
                    <tr key={t.id} className="border-t border-[rgb(var(--color-border))]">
                      <td className="py-2">{new Date(t.taken_at).toLocaleString()}</td>
                      <td>{t.subject}</td>
                      <td>{t.score}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Drill-down panel */}
      {detailSubject && (
        <div className="p-4 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-card))]/50">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium">Details: {detailSubject}</h3>
            <button className="px-3 py-1 text-sm rounded-md bg-[rgb(var(--color-input))]" onClick={() => setDetailSubject(null)}>Close</button>
          </div>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-[rgb(var(--color-text-secondary))]">Trend:</span>
            <div className="inline-flex rounded-md overflow-hidden border border-[rgb(var(--color-border))]">
              <button className={`px-3 py-1 text-xs ${granularity==='week' ? 'bg-[rgb(var(--color-primary))] text-white' : 'bg-[rgb(var(--color-input))]'}`} onClick={() => setGranularity('week')}>Weekly</button>
              <button className={`px-3 py-1 text-xs ${granularity==='month' ? 'bg-[rgb(var(--color-primary))] text-white' : 'bg-[rgb(var(--color-input))]'}`} onClick={() => setGranularity('month')}>Monthly</button>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-[rgb(var(--color-text-secondary))] mb-2">Recent attempts:</p>
              <ul className="text-sm list-disc pl-5 space-y-1">
                {recentTests.filter(t => t.subject === detailSubject).slice(0, 12).map(t => (
                  <li key={t.id}>{new Date(t.taken_at).toLocaleString()} — {t.score}%</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-sm text-[rgb(var(--color-text-secondary))] mb-2">Trend (last 12):</p>
              {trend && trend.length > 0 ? (
                <div className="space-y-2">
                  {trend.map((p, idx) => (
                    <div key={idx}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-[rgb(var(--color-text-secondary))]">{p.bucket}</span>
                        <span>{Math.round(p.avg_score)}%</span>
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-2 bg-emerald-500" style={{ width: `${Math.min(100, Math.max(0, p.avg_score))}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[rgb(var(--color-text-secondary))]">No trend yet.</p>
              )}
            </div>
          </div>

          <div className="mt-4">
            <h4 className="font-medium mb-2">Topics to improve</h4>
            {topicAnalytics && topicAnalytics.length > 0 ? (
              <div className="space-y-2">
                {topicAnalytics
                  .slice() // copy
                  .sort((a, b) => (a.accuracy - b.accuracy) || (b.attempts - a.attempts))
                  .map((t) => (
                  <div key={t.topic} className="flex items-center justify-between gap-2 p-2 rounded-md border border-[rgb(var(--color-border))]">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate flex items-center gap-2">
                        <span>{t.topic}</span>
                        {tracking[t.topic] && t.accuracy >= 75 && t.attempts >= 5 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-700/30 text-emerald-300 border border-emerald-600">Improved</span>
                        )}
                      </div>
                      <div className="text-xs text-[rgb(var(--color-text-secondary))]">Accuracy {Math.round(t.accuracy)}% • Attempts {t.attempts}{t.last_seen ? ` • Last seen ${new Date(t.last_seen).toLocaleDateString()}` : ''}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className={`px-2 py-1 text-xs rounded-md ${tracking[t.topic] ? 'bg-amber-500/20 text-amber-300' : 'bg-[rgb(var(--color-input))]'}`}
                        onClick={async () => {
                          try {
                            if (tracking[t.topic]) {
                              await supabase.from('tracked_topics').delete().match({ user_id: user!.id, topic: t.topic });
                              setTracking(prev => ({ ...prev, [t.topic]: false }));
                            } else {
                              await supabase.from('tracked_topics').upsert({ user_id: user!.id, topic: t.topic, subject: detailSubject });
                              setTracking(prev => ({ ...prev, [t.topic]: true }));
                            }
                          } catch (_e) {}
                        }}
                      >{tracking[t.topic] ? 'Tracking' : 'Track'}</button>
                      <button
                        className="px-2 py-1 text-xs rounded-md bg-[rgb(var(--color-primary))] text-white"
                        onClick={() => { setExplainerPrefillTopic(`${detailSubject}: ${t.topic}`); setActiveView(ActiveView.EXPLAINER); }}
                      >Practice</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[rgb(var(--color-text-secondary))]">No topic analytics found.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardView;
