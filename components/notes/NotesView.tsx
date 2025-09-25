import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabaseClient';
import MarkdownRenderer from '../common/MarkdownRenderer';

interface Note {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  source: 'assistant' | 'explainer' | 'manual';
}

const NotesView: React.FC = () => {
  const { user, loading, signInWithGoogle } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [selected, setSelected] = useState<Note | null>(null);

  useEffect(() => {
    const fetchNotes = async () => {
      if (!user) return;
      setLoadingNotes(true);
      const { data, error } = await supabase
        .from('notes')
        .select('id, title, content, created_at, updated_at, source')
        .order('updated_at', { ascending: false });
      if (!error) setNotes(data || []);
      setLoadingNotes(false);
    };
    fetchNotes();
  }, [user]);

  if (loading) return <div className="p-6">Loading...</div>;
  if (!user) {
    return (
      <div className="p-6 space-y-4">
        <h2 className="text-xl font-semibold">Notes</h2>
        <p className="text-[rgb(var(--color-text-secondary))]">Sign in to manage your notes.</p>
        <button onClick={signInWithGoogle} className="px-4 py-2 rounded-md bg-[rgb(var(--color-primary))] text-white">Sign in with Google</button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Notes</h2>
        {/* Placeholder for Add Note (manual) */}
        <button className="px-3 py-2 text-sm rounded-md border border-[rgb(var(--color-border))] bg-[rgb(var(--color-input))] text-white">New Note</button>
      </div>

      {loadingNotes ? (
        <div>Loading notes…</div>
      ) : notes.length === 0 ? (
        <div className="text-[rgb(var(--color-text-secondary))]">No notes yet. Save from Global Assistant or Topic Explainer.</div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {notes.map((n) => (
            <button
              key={n.id}
              onClick={() => setSelected(n)}
              className="text-left p-4 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-card))]/50 hover:bg-[rgb(var(--color-card))] transition-colors focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary))]"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium truncate">{n.title}</h3>
                <span className="text-xs text-[rgb(var(--color-text-secondary))] capitalize">{n.source}</span>
              </div>
              <div className="text-sm text-[rgb(var(--color-text-secondary))] line-clamp-5 whitespace-pre-wrap">{n.content}</div>
            </button>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelected(null)} />
          <div className="relative z-10 w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-sidebar))] shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[rgb(var(--color-border))]">
              <div>
                <h3 className="text-lg font-semibold truncate">{selected.title}</h3>
                <p className="text-xs text-[rgb(var(--color-text-secondary))]">{new Date(selected.updated_at).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[rgb(var(--color-text-secondary))] capitalize px-2 py-1 rounded bg-[rgb(var(--color-card))]">{selected.source}</span>
                <button onClick={() => setSelected(null)} className="px-3 py-1.5 text-xs rounded-md bg-[rgb(var(--color-input))] hover:bg-slate-600">Close</button>
              </div>
            </div>
            <div className="px-4 py-3 overflow-y-auto max-h-[calc(85vh-56px)]">
              <MarkdownRenderer content={selected.content} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
;

export default NotesView;
