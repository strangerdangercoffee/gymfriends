import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Database } from '../types/database';

// Vanity subdomain — set in Supabase Dashboard → Settings → General → Custom Subdomain.
// TODO: pay $10/month for the custom domain. const supabaseUrl = 'https://rallyclimbing.supabase.co';
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
