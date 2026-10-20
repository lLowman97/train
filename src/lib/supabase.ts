import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

// The publishable key is meant to ship inside the app. Access to data is
// protected by Row Level Security (supabase/migrations). Never put the secret
// or service_role key here.
const SUPABASE_URL = 'https://khxitfasisrjzaodunww.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_T8pEFZUDnfJX2EtJ_c2Ojw_pburgnO4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Only refresh the session while the app is in the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
