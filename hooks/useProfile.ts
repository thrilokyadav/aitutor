import { useEffect, useState, useCallback } from 'react';
import { supabase, SUPABASE_ENABLED } from '../services/supabaseClient';

export interface UserProfile {
  user_id: string;
  full_name: string | null;
  study_goal: string | null;
  state?: string | null;
  district?: string | null;
  created_at?: string;
  updated_at?: string;
}

export const useProfile = (userId: string | null) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(!!userId);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!userId || !SUPABASE_ENABLED) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) setError(error.message);
    setProfile((data as UserProfile) ?? null);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const upsertProfile = useCallback(async (values: Partial<UserProfile>) => {
    if (!userId || !SUPABASE_ENABLED) return { error: new Error('Supabase disabled') };
    const payload: UserProfile = {
      user_id: userId,
      full_name: values.full_name ?? null,
      study_goal: values.study_goal ?? null,
      state: values.state ?? null,
      district: values.district ?? null,
    };
    const { error } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'user_id' });
    if (!error) await fetchProfile();
    return { error };
  }, [userId, fetchProfile]);

  return { profile, loading, error, refresh: fetchProfile, upsertProfile };
};
