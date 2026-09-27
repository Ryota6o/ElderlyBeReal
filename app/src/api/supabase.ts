import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabaseの接続情報が設定されていません。',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
