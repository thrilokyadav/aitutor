import { supabase, SUPABASE_ENABLED } from './supabaseClient';

export type AnalyticsEvent =
  | 'lang_toggled'
  | 'quiz_start'
  | 'quiz_submit'
  | 'quiz_abandon'
  | 'competitive_submit';

export interface AnalyticsProps {
  [key: string]: any;
}

export async function track(event: AnalyticsEvent, props: AnalyticsProps = {}) {
  try {
    if (!SUPABASE_ENABLED) {
      // In dev or without backend, keep it silent
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('analytics_events').insert({
      user_id: user?.id ?? null,
      event,
      props,
    });
  } catch (e) {
    // Non-fatal; avoid blocking UI
    // eslint-disable-next-line no-console
    console.warn('analytics.track failed', e);
  }
}
