import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useProfile } from '../../hooks/useProfile';

const OnboardingForm: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const { user } = useAuth();
  const { upsertProfile } = useProfile(user?.id ?? null);
  const [fullName, setFullName] = useState('');
  const [studyGoal, setStudyGoal] = useState('');
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await upsertProfile({ full_name: fullName, study_goal: studyGoal, state, district });
    setSaving(false);
    if (error) {
      alert('Failed to save profile: ' + error.message);
    } else {
      onDone();
    }
  };

  return (
    <div className="flex items-center justify-center h-full w-full">
      <form onSubmit={handleSubmit} className="max-w-lg w-full p-8 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-card))]/50">
        <h2 className="text-xl font-semibold mb-1">Complete your profile</h2>
        <p className="text-sm text-[rgb(var(--color-text-secondary))] mb-6">Tell us a bit about you to personalize analytics.</p>

        <label className="block text-sm mb-1">Full name</label>
        <input
          className="w-full mb-4 p-2 rounded-md bg-[rgb(var(--color-input))] border border-[rgb(var(--color-border))]"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />

        <label className="block text-sm mb-1">Study goal</label>
        <input
          className="w-full mb-4 p-2 rounded-md bg-[rgb(var(--color-input))] border border-[rgb(var(--color-border))]"
          value={studyGoal}
          onChange={(e) => setStudyGoal(e.target.value)}
          placeholder="e.g., Crack UPSC Prelims 2025"
        />

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm mb-1">State</label>
            <input
              className="w-full p-2 rounded-md bg-[rgb(var(--color-input))] border border-[rgb(var(--color-border))]"
              value={state}
              onChange={(e) => setState(e.target.value)}
              placeholder="Your state"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">District</label>
            <input
              className="w-full p-2 rounded-md bg-[rgb(var(--color-input))] border border-[rgb(var(--color-border))]"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              placeholder="Your district"
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full px-4 py-3 rounded-lg bg-[rgb(var(--color-primary))] text-white hover:bg-[rgb(var(--color-primary-hover))] disabled:bg-slate-600"
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Continue'}
        </button>
      </form>
    </div>
  );
};

export default OnboardingForm;
