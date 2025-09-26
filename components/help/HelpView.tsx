import React from 'react';

const HelpView: React.FC = () => {
  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-semibold">Help & How to Use</h2>
      <div className="space-y-6 text-[rgb(var(--color-text-secondary))]">
        <section>
          <h3 className="font-medium text-white mb-2">Global Assistant</h3>
          <ul className="list-disc ml-6 space-y-1">
            <li>Open via the header "Global Assistant" button. It floats over any view.</li>
            <li>Drag to reposition; layout is remembered. Press Alt+G to reset position.</li>
            <li>Use it for quick Q&A, definitions, and summaries.</li>
          </ul>
        </section>

        <section>
          <h3 className="font-medium text-white mb-2">Current Affairs</h3>
          <ul className="list-disc ml-6 space-y-1">
            <li>Enter a date, keywords, and select a region; click Get Summary.</li>
            <li>Sources come from Gemini by default, or Perplexity if API key is set in Settings.</li>
            <li>From a generated summary you can: <strong>Generate Quiz on this summary</strong> or <strong>Explain this summary</strong>. These jump to Quiz/Explainer with the topic prefilled.</li>
          </ul>
        </section>

        <section>
          <h3 className="font-medium text-white mb-2">Topic Explainer</h3>
          <ul className="list-disc ml-6 space-y-1">
            <li>Type a topic and choose depth/format; click Generate to get a rich explanation.</li>
            <li>Coming from Current Affairs: we prefill the topic automatically.</li>
          </ul>
        </section>

        <section>
          <h3 className="font-medium text-white mb-2">Quiz Generator</h3>
          <ul className="list-disc ml-6 space-y-1">
            <li>Set topic, number of questions, and difficulty; click Generate Quiz.</li>
            <li>Timer counts down; use Next/Show Results to finish. Results show accuracy and explanations.</li>
            <li>History: review past quizzes from the side history panel.</li>
            <li>Prefill: when launched from Current Affairs, topic/difficulty are auto-filled.</li>
          </ul>
        </section>

        <section>
          <h3 className="font-medium text-white mb-2">Competitive Quizzes</h3>
          <ul className="list-disc ml-6 space-y-1">
            <li>See Live, Upcoming, and Past quizzes; filter by subject and search title/description.</li>
            <li>Start a live quiz, answer in-page, and submit to see your leaderboard standing (if published).</li>
            <li>View My Results (for past quizzes you attempted) and open published leaderboards.</li>
          </ul>
        </section>

        <section>
          <h3 className="font-medium text-white mb-2">Notes</h3>
          <ul className="list-disc ml-6 space-y-1">
            <li>Create personal notes (title + content). Notes list shows source and updated time.</li>
            <li>Study Guide Export: click "Select Notes" → choose notes → "Export Study Guide" to generate Markdown. Copy or Download the .md file.</li>
            <li>Planned: tags & search, smart summaries, and backlinks from quizzes/explainers.</li>
          </ul>
        </section>

        <section>
          <h3 className="font-medium text-white mb-2">Admin</h3>
          <ul className="list-disc ml-6 space-y-1">
            <li>Create and publish competitive quizzes (title, subject, schedule, duration, optional focus).</li>
            <li>Leaderboards: per-quiz and overall boards with rank, user, region, score, time, and submission date.</li>
            <li>Analytics: 14-day dashboard with totals and mini charts for quiz_start, quiz_submit, competitive_submit, and lang_toggled.</li>
            <li>User results: search by user email, quiz title, or subject; inspect attempt details.</li>
          </ul>
        </section>

        <section>
          <h3 className="font-medium text-white mb-2">Language & Theme</h3>
          <ul className="list-disc ml-6 space-y-1">
            <li>Switch language (English/Kannada) from the header. UI updates instantly.</li>
            <li>Pick a theme in Settings; your choice persists across reloads.</li>
          </ul>
        </section>

        <section>
          <h3 className="font-medium text-white mb-2">Authentication & Sync</h3>
          <ul className="list-disc ml-6 space-y-1">
            <li>Sign in with Google to sync results and notes to Supabase.</li>
            <li>Ensure Supabase auth providers and redirect URLs are properly configured.</li>
          </ul>
        </section>

        <section>
          <h3 className="font-medium text-white mb-2">API Keys & Providers</h3>
          <ul className="list-disc ml-6 space-y-1">
            <li>Settings → add Perplexity API key to use it for Current Affairs; Gemini is the default fallback.</li>
            <li>Keys are stored locally and used client-side only for eligible features.</li>
          </ul>
        </section>

        <section>
          <h3 className="font-medium text-white mb-2">Shortcuts</h3>
          <ul className="list-disc ml-6 space-y-1">
            <li>Alt+G: reset Global Assistant panel position.</li>
          </ul>
        </section>
      </div>
    </div>
  );
};

export default HelpView;
