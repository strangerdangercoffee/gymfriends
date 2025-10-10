import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Database } from '../types/database';

// Replace with your actual Supabase URL and anon key
const supabaseUrl = 'https://yqqnpmhhemytzkeuuchv.supabase.co';
const supabaseAnonKey = 'sb_publishable_MNc0NGCqI90hPBPyiBt1pQ_UYZvjCrp';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
