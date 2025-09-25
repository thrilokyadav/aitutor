import React from 'react';

const HelpView: React.FC = () => {
  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-semibold">Help & How to Use</h2>
      <div className="space-y-4 text-[rgb(var(--color-text-secondary))]">
        <div>
          <h3 className="font-medium text-white mb-2">Global Assistant</h3>
          <ul className="list-disc ml-6 space-y-1">
            <li>Use the header button "Global Assistant" to toggle it.</li>
            <li>Drag it anywhere on screen; position is saved. Press Alt+G to reset.</li>
            <li>Save helpful responses to Notes (button will appear in future update).</li>
          </ul>
        </div>
        <div>
          <h3 className="font-medium text-white mb-2">AI Tutor & Subjects</h3>
          <ul className="list-disc ml-6 space-y-1">
            <li>Ask questions in the Tutor view.</li>
            <li>Pick a subject in Subjects to focus your practice.</li>
          </ul>
        </div>
        <div>
          <h3 className="font-medium text-white mb-2">Topic Explainer</h3>
          <ul className="list-disc ml-6 space-y-1">
            <li>Generate an explanation; it will render on-page.</li>
            <li>Use "Save to Notes" to keep the explanation (coming in update).</li>
          </ul>
        </div>
        <div>
          <h3 className="font-medium text-white mb-2">Quiz Generator</h3>
          <ul className="list-disc ml-6 space-y-1">
            <li>Configure topic and difficulty and start a quiz.</li>
            <li>Your test results will be saved to Supabase and appear in Dashboard (after integration step).</li>
          </ul>
        </div>
        <div>
          <h3 className="font-medium text-white mb-2">Notes</h3>
          <ul className="list-disc ml-6 space-y-1">
            <li>View notes saved from the Assistant or Explainer.</li>
            <li>Create, edit, and delete notes (CRUD coming in update).</li>
          </ul>
        </div>
        <div>
          <h3 className="font-medium text-white mb-2">Auth & Sync</h3>
          <ul className="list-disc ml-6 space-y-1">
            <li>Sign in with Google to sync data to Supabase.</li>
            <li>Make sure you configured Google provider and redirect URL in Supabase.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default HelpView;
