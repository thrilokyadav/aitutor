import React from 'react';
import { useAuth } from '../../contexts/AuthContext';

const LoginScreen: React.FC = () => {
  const { signInWithGoogle, loading } = useAuth();
  return (
    <div className="flex items-center justify-center h-full w-full">
      <div className="max-w-md w-full p-8 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-card))]/50 text-center">
        <h1 className="text-2xl font-bold mb-2">Welcome to EASYWAY Tutor</h1>
        <p className="text-[rgb(var(--color-text-secondary))] mb-6">Sign in to get personalized analytics, save notes, and more.</p>
        <button
          onClick={signInWithGoogle}
          className="w-full px-4 py-3 rounded-lg bg-[rgb(var(--color-primary))] text-white hover:bg-[rgb(var(--color-primary-hover))] disabled:bg-slate-600"
          disabled={loading}
        >
          Continue with Google
        </button>
      </div>
    </div>
  );
};

export default LoginScreen;
