import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabaseClient';
import MarkdownRenderer from '../common/MarkdownRenderer';
import { useI18n } from '../../contexts/I18nContext';

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
  const { t } = useI18n();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [selected, setSelected] = useState<Note | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [exportMd, setExportMd] = useState<string | null>(null);

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

  const handleCreateNote = () => {
    setIsCreating(true);
    setNewNoteTitle('');
    setNewNoteContent('');
  };

  const toggleSelectMode = () => {
    setSelectMode((m) => !m);
    setSelectedIds([]);
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const buildStudyGuideMarkdown = (items: Note[]) => {
    const date = new Date().toISOString();
    const header = `# Study Guide\n\nGenerated: ${date}\nSelected Notes: ${items.length}\n\n---\n`;
    const sections = items.map((n, idx) => {
      const updated = new Date(n.updated_at).toLocaleString();
      return `## ${idx + 1}. ${n.title}\n\n- Source: ${n.source}\n- Updated: ${updated}\n\n${n.content}\n`;
    }).join('\n---\n\n');
    return header + sections + '\n';
  };

  const handleExport = () => {
    const items = notes.filter(n => selectedIds.includes(n.id));
    if (items.length === 0) return;
    const md = buildStudyGuideMarkdown(items);
    setExportMd(md);
  };

  const handleCopy = async () => {
    if (!exportMd) return;
    try { await navigator.clipboard.writeText(exportMd); } catch {}
  };

  const handleDownload = () => {
    if (!exportMd) return;
    const blob = new Blob([exportMd], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `study_guide_${new Date().toISOString().slice(0,10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSaveNote = async () => {
    if (!newNoteTitle.trim() || !user) return;

    try {
      const { data, error } = await supabase
        .from('notes')
        .insert({
          title: newNoteTitle.trim(),
          content: newNoteContent.trim(),
          source: 'manual',
        })
        .select()
        .single();

      if (!error && data) {
        setNotes(prev => [data, ...prev]);
        setIsCreating(false);
        setNewNoteTitle('');
        setNewNoteContent('');
      }
    } catch (error) {
      console.error('Error saving note:', error);
    }
  };

  const handleCancelCreate = () => {
    setIsCreating(false);
    setNewNoteTitle('');
    setNewNoteContent('');
  };
  if (!user) {
    return (
      <div className="p-6 space-y-4">
        <h2 className="text-xl font-semibold">{t('notes')}</h2>
        <p className="text-[rgb(var(--color-text-secondary))]">{t('sign_in_notes')}</p>
        <button onClick={signInWithGoogle} className="px-4 py-2 rounded-md bg-[rgb(var(--color-primary))] text-white">{t('sign_in_with_google')}</button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{t('notes')}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleSelectMode}
            className="px-3 py-2 text-sm rounded-md border border-[rgb(var(--color-border))] bg-[rgb(var(--color-input))] hover:bg-[rgb(var(--color-input-hover))] transition-colors"
          >
            {selectMode ? 'Cancel Select' : 'Select Notes'}
          </button>
          {selectMode && selectedIds.length > 0 && (
            <button
              onClick={handleExport}
              className="px-3 py-2 text-sm rounded-md border border-[rgb(var(--color-border))] bg-[rgb(var(--color-primary))] text-white hover:bg-[rgb(var(--color-primary-hover))] transition-colors"
            >
              Export Study Guide
            </button>
          )}
          <button
            onClick={handleCreateNote}
            className="px-3 py-2 text-sm rounded-md border border-[rgb(var(--color-border))] bg-[rgb(var(--color-primary))] text-white hover:bg-[rgb(var(--color-primary-hover))] transition-colors"
          >
            {t('new_note')}
          </button>
        </div>
      </div>

      {loadingNotes ? (
        <div>{t('loading_notes')}</div>
      ) : notes.length === 0 ? (
        <div className="text-[rgb(var(--color-text-secondary))]">{t('no_notes_yet')}</div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {notes.map((n) => (
            <div key={n.id} className="p-4 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-card))]/50 hover:bg-[rgb(var(--color-card))] transition-colors">
              <div className="flex items-start justify-between mb-2 gap-2">
                <h3 className="font-medium truncate flex-1 cursor-pointer" onClick={() => !selectMode && setSelected(n)}>{n.title}</h3>
                {selectMode && (
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(n.id)}
                    onChange={() => toggleSelected(n.id)}
                    className="mt-1"
                  />
                )}
              </div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-[rgb(var(--color-text-secondary))] capitalize">{n.source}</span>
                <span className="text-xs text-[rgb(var(--color-text-secondary))]">{new Date(n.updated_at).toLocaleString()}</span>
              </div>
              <div className="text-sm text-[rgb(var(--color-text-secondary))] line-clamp-5 whitespace-pre-wrap cursor-pointer" onClick={() => !selectMode && setSelected(n)}>{n.content}</div>
            </div>
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
      {/* Create Note Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={handleCancelCreate} />
          <div className="relative z-10 w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-sidebar))] shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[rgb(var(--color-border))]">
              <h3 className="text-lg font-semibold">{t('create_new_note')}</h3>
              <button onClick={handleCancelCreate} className="px-3 py-1.5 text-xs rounded-md bg-[rgb(var(--color-input))] hover:bg-slate-600">{t('cancel')}</button>
            </div>
            <div className="px-4 py-3 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">{t('title')}</label>
                <input
                  type="text"
                  value={newNoteTitle}
                  onChange={(e) => setNewNoteTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-[rgb(var(--color-input))] border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))]"
                  placeholder={t('enter_note_title')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">{t('content')}</label>
                <textarea
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  rows={10}
                  className="w-full px-3 py-2 rounded-md bg-[rgb(var(--color-input))] border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] resize-vertical"
                  placeholder={t('enter_note_content')}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={handleSaveNote}
                  disabled={!newNoteTitle.trim()}
                  className="px-4 py-2 rounded-md bg-[rgb(var(--color-primary))] text-white hover:bg-[rgb(var(--color-primary-hover))] disabled:bg-slate-600 disabled:cursor-not-allowed"
                >
                  {t('save_note')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {exportMd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setExportMd(null)} />
          <div className="relative z-10 w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-sidebar))] shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[rgb(var(--color-border))]">
              <h3 className="text-lg font-semibold">Study Guide (Markdown)</h3>
              <div className="flex items-center gap-2">
                <button onClick={handleCopy} className="px-3 py-1.5 text-xs rounded-md bg-[rgb(var(--color-input))] hover:bg-slate-600">Copy</button>
                <button onClick={handleDownload} className="px-3 py-1.5 text-xs rounded-md bg-[rgb(var(--color-primary))] text-white hover:bg-[rgb(var(--color-primary-hover))]">Download .md</button>
                <button onClick={() => setExportMd(null)} className="px-3 py-1.5 text-xs rounded-md bg-[rgb(var(--color-input))] hover:bg-slate-600">Close</button>
              </div>
            </div>
            <div className="px-4 py-3 overflow-y-auto max-h-[calc(85vh-56px)]">
              <textarea readOnly className="w-full h-[60vh] rounded-md bg-[rgb(var(--color-input))] border border-[rgb(var(--color-border))] p-3 text-[rgb(var(--color-text-primary))] font-mono text-xs whitespace-pre" value={exportMd} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotesView;
