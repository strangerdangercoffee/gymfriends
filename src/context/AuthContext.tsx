import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../services/supabase';
import { userApi } from '../services/api';
import { notificationService } from '../services/notifications';
import { storageService } from '../services/storage';
import { User, AuthContextType } from '../types';
import { Linking, Platform } from 'react-native';

// Complete the auth session for better UX
WebBrowser.maybeCompleteAuthSession();

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Max wait for getSession */
const GET_SESSION_TIMEOUT_MS = 10000;

/** Build a minimal User from auth session so we can show the app immediately while loadUser runs in background. */
function userFromSession(authUser: { id: string; email?: string; user_metadata?: Record<string, unknown> }): User {
  const now = new Date().toISOString();
  return {
    id: authUser.id,
    name: (authUser.user_metadata?.full_name ?? authUser.user_metadata?.name ?? authUser.email?.split('@')[0] ?? 'User') as string,
    email: authUser.email ?? '',
    avatar: authUser.user_metadata?.avatar_url as string | undefined,
    friends: [],
    followedGyms: [],
    privacySettings: { shareLocation: true, shareSchedule: true, autoCheckIn: false },
    createdAt: now,
    updatedAt: now,
  };
}

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  /** True while handleNewUser is running so we don't create duplicate profile */
  const creationInProgressRef = useRef(false);

  useEffect(() => {
    const runInitialAuth = async () => {
      const t0 = Date.now();
      const cache = await storageService.getLastUserCache();

      // Cache hit: show app immediately (~tens of ms), verify session in background
      if (cache?.userId && cache?.user) {
        setUser(cache.user);
        setIsLoading(false);
        console.log('[Auth timing] cache hit, showing in', Date.now() - t0, 'ms');
        Promise.race([
          supabase.auth.getSession(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('GET_SESSION_TIMEOUT')), GET_SESSION_TIMEOUT_MS)
          ),
        ])
          .then((sessionResult) => {
            const session = sessionResult?.data?.session;
            if (!session?.user || session.user.id !== cache.userId) {
              setUser(null);
              return;
            }
            loadUser(session.user.id);
          })
          .catch(() => {
            setUser(null);
          });
        return;
      }

      // No cache: wait for getSession (unavoidable on first load / cleared cache)
      let sessionResult: { data: { session: any } } | null = null;
      try {
        sessionResult = await Promise.race([
          supabase.auth.getSession(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('GET_SESSION_TIMEOUT')), GET_SESSION_TIMEOUT_MS)
          ),
        ]);
      } catch (err: any) {
        if (err?.message === 'GET_SESSION_TIMEOUT') {
          console.warn('Get session timed out');
        } else {
          console.error('Initial auth error:', err);
        }
        setUser(null);
        setIsLoading(false);
        return;
      }
      const tAfterSession = Date.now();
      console.log('[Auth timing] getSession (no cache):', tAfterSession - t0, 'ms');
      const session = sessionResult?.data?.session;
      if (!session?.user) {
        setIsLoading(false);
        return;
      }
      setUser(userFromSession(session.user));
      setIsLoading(false);
      loadUser(session.user.id);
    };
    runInitialAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'INITIAL_SESSION') return;
        if (session?.user) {
          console.log('Auth state changed:', event, session.user.id);
          setUser(userFromSession(session.user));
          setIsLoading(false);
          loadUser(session.user.id);
        } else {
          setUser(null);
          setIsLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Push token is registered after onboarding (see AppNavigator) so we don't run heavy work during onboarding

  const loadUser = async (userId: string) => {
    try {
      console.log('Loading user:', userId);
      const userData = await userApi.getCurrentUserMinimal(userId);
      console.log('User loaded successfully:', userData?.id);
      setUser(userData);
    } catch (error: any) {
      if (error?.code !== 'PGRST116' && !error?.message?.includes('No rows')) {
        console.error('Error loading user:', error);
      }
      // If user doesn't exist in database, try to create profile
      if (error?.code === 'PGRST116' || error?.message?.includes('No rows')) {
        // Prevent concurrent user creation attempts
        if (isCreatingUser) {
          console.log('User creation already in progress, waiting...');
          await new Promise(resolve => setTimeout(resolve, 500));
          try {
            const userData = await userApi.getCurrentUserMinimal(userId);
            if (userData) {
              setUser(userData);
              return;
            }
          } catch (retryError) {
            return;
          }
        }
        
        console.log('User profile not found, attempting to create...');
        try {
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (authUser) {
            await handleNewUser(authUser);
            return;
          }
        } catch (createError) {
          console.error('Error creating user profile:', createError);
        }
      }
      
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewUser = async (authUser: any) => {
    if (creationInProgressRef.current) {
      console.log('User creation already in progress, skipping duplicate call');
      await new Promise(resolve => setTimeout(resolve, 500));
      try {
        const userData = await userApi.getCurrentUserMinimal(authUser.id);
        if (userData) {
          setUser(userData);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error loading user after concurrent creation:', error);
      }
      return;
    }
    creationInProgressRef.current = true;
    if (isCreatingUser) {
      console.log('User creation already in progress, skipping duplicate call');
      await new Promise(resolve => setTimeout(resolve, 500));
      try {
        const userData = await userApi.getCurrentUserMinimal(authUser.id);
        if (userData) {
          setUser(userData);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error loading user after concurrent creation:', error);
      }
      creationInProgressRef.current = false;
      return;
    }

    setIsCreatingUser(true);
    try {
      console.log('Handling new user:', authUser.id, authUser.email);
      try {
        const existingUser = await userApi.getCurrentUserMinimal(authUser.id);
        if (existingUser) {
          console.log('User profile already exists');
          setUser(existingUser);
          setIsLoading(false);
          return;
        }
      } catch (error: any) {
        // User doesn't exist, create profile
        console.log('Creating new user profile...');
        const userData: Partial<User> = {
          id: authUser.id,
          name: authUser.user_metadata?.full_name || 
                authUser.user_metadata?.name ||
                authUser.email?.split('@')[0] || 
                'User',
          email: authUser.email || '',
          friends: [],
          followedGyms: [],
          privacySettings: {
            shareLocation: true,
            shareSchedule: true,
          },
        };
        try {
          await userApi.createUser(userData);
          console.log('User profile created successfully');
          await storageService.setOnboardingCompleted(authUser.id, false);
        } catch (createError: any) {
          if (createError?.code === '23505') {
            console.log('User already exists (created concurrently), loading...');
            const userData = await userApi.getCurrentUserMinimal(authUser.id);
            if (userData) {
              setUser(userData);
              setIsLoading(false);
              return;
            }
          }
          throw createError;
        }
        // Pending invitations are matched when the user adds their phone (onboarding or profile)
      }
      
      const userData = await userApi.getCurrentUserMinimal(authUser.id);
      if (userData) {
        console.log('User loaded after handleNewUser:', userData.id);
        setUser(userData);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error handling new user:', error);
      setUser(null);
      setIsLoading(false);
      throw error;
    } finally {
      setIsCreatingUser(false);
      creationInProgressRef.current = false;
    }
  };

  const signIn = async (email: string, password: string): Promise<void> => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        await loadUser(data.user.id);
      }
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (email: string, password: string, name: string): Promise<void> => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        // Create user profile
        const userData: Partial<User> = {
          id: data.user.id,
          name,
          email,
          friends: [],
          followedGyms: [],
          privacySettings: {
            shareLocation: true,
            shareSchedule: true,
            autoCheckIn: false,
          },
        };

        try {
          await userApi.createUser(userData);
        } catch (createError: any) {
          // If creation fails, it might be because the trigger already created it
          // Try to load the user - it might exist from the trigger
          try {
            const existingUser = await userApi.getCurrentUser();
            if (existingUser) {
              // User exists! Update it with the name
              try {
                await userApi.updateUser(data.user.id, {
                  name,
                  privacySettings: userData.privacySettings,
                });
              } catch (updateError) {
                console.log('Failed to update user name:', updateError);
              }
            }
          } catch (loadError) {
            console.log('Failed to load user after creation error:', loadError);
          }
        }
        
        // Try to load the user
        try {
          await loadUser(data.user.id);
        } catch (loadError) {
          console.log('Failed to load user after signup, will be loaded on next login');
        }
        // Pending invitations are matched when the user adds their phone (onboarding or profile)
      }
    } catch (error: any) {
      console.error('Error signing up:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const createSessionFromUrl = async (url: string): Promise<{ user: any } | null> => {
    try {
      const { params, errorCode } = QueryParams.getQueryParams(url);
      if (errorCode) {
        console.error('Error parsing OAuth callback URL:', errorCode);
        return null;
      }
      const access_token = params?.access_token ?? params?.accessToken;
      const refresh_token = params?.refresh_token ?? params?.refreshToken;
      if (!access_token) {
        console.warn('No access_token in OAuth callback URL');
        return null;
      }
      const { data, error } = await supabase.auth.setSession({
        access_token,
        refresh_token: refresh_token ?? '',
      });
      if (error) {
        console.error('Error setting session from OAuth URL:', error);
        return null;
      }
      return data?.session?.user ? { user: data.session.user } : null;
    } catch (e) {
      console.error('createSessionFromUrl error:', e);
      return null;
    }
  };

  // Handle OAuth callback when app is opened via redirect (first attempt often delivers URL via Linking, not openAuthSessionAsync result)
  useEffect(() => {
    const isAuthCallbackUrl = (url: string | null) =>
      url && (url.includes('auth/callback') || url.includes('access_token'));

    const handleAuthUrl = async (url: string) => {
      if (!isAuthCallbackUrl(url)) return;
      try {
        const sessionResult = await createSessionFromUrl(url);
        if (sessionResult?.user) {
          await loadUser(sessionResult.user.id);
        } else {
          setIsLoading(false);
        }
      } catch (e) {
        console.error('Error handling OAuth callback URL:', e);
        setIsLoading(false);
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) handleAuthUrl(url);
    });

    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleAuthUrl(url);
    });

    return () => subscription.remove();
  }, []);

  const signInWithGoogle = async (): Promise<void> => {
    try {
      setIsLoading(true);
      
      const redirectTo = AuthSession.makeRedirectUri({
        scheme: 'gymfriends',
        path: 'auth/callback',
      });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) throw error;

      if (data.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectTo
        );

        console.log('OAuth result:', result.type, result.url ? '(has url)' : '(no url)');

        if (result.type === 'success') {
          let urlToUse = result.url;
          if (!urlToUse) {
            urlToUse = await Linking.getInitialURL() ?? undefined;
            if (urlToUse) console.log('Using OAuth URL from Linking.getInitialURL()');
          }
          if (urlToUse) {
            const sessionResult = await createSessionFromUrl(urlToUse);
            if (sessionResult?.user) {
              await loadUser(sessionResult.user.id);
              return;
            }
            console.warn('Could not create session from OAuth URL - user may need to try again');
          }
          setIsLoading(false);
          if (!urlToUse) {
            console.warn('No callback URL from browser or Linking - session may be set when Linking fires');
          }
        } else if (result.type === 'cancel') {
          setIsLoading(false);
          return;
        } else {
          setIsLoading(false);
          throw new Error('OAuth flow was not completed');
        }
      } else {
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error signing in with Google:', error);
      setIsLoading(false);
      throw error;
    }
    // Note: Don't set isLoading(false) in finally - let onAuthStateChange handle it if session is created
  };

  const signInWithApple = async (): Promise<void> => {
    try {
      setIsLoading(true);
      
      const redirectTo = AuthSession.makeRedirectUri({
        scheme: 'gymfriends',
        path: 'auth/callback',
      });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;

      if (data.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectTo
        );

        console.log('OAuth result:', result.type, result.url ? '(has url)' : '(no url)');

        if (result.type === 'success' && result.url) {
          const sessionResult = await createSessionFromUrl(result.url);
          if (sessionResult?.user) {
            await loadUser(sessionResult.user.id);
            return;
          }
          console.warn('Could not create session from OAuth URL - user may need to try again');
          setIsLoading(false);
        } else if (result.type === 'cancel') {
          setIsLoading(false);
          return;
        } else {
          setIsLoading(false);
          throw new Error('OAuth flow was not completed');
        }
      } else {
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error signing in with Apple:', error);
      setIsLoading(false);
      throw error;
    }
    // Note: Don't set isLoading(false) in finally - let onAuthStateChange handle it if session is created
  };

  const signOut = async (): Promise<void> => {
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      await storageService.clearLastUserCache();
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<User>): Promise<void> => {
    if (!user) throw new Error('No user logged in');

    try {
      // Don't set loading state for profile updates to avoid unmounting components
      // that depend on user state (like onboarding screens)
      const updatedUser = await userApi.updateUser(user.id, updates);
      setUser(updatedUser);
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  };

  const deleteAccount = async (): Promise<void> => {
    if (!user) throw new Error('No user logged in');

    try {
      setIsLoading(true);
      
      // Delete user data from database
      await userApi.deleteUser(user.id);
      
      // Sign out the user
      await supabase.auth.signOut();
      
      // Clear user state and cache
      setUser(null);
      await storageService.clearLastUserCache();
      
    } catch (error) {
      console.error('Error deleting account:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /** Load full user (friends, followedGyms) and update state. Use after initial minimal load. */
  const refreshUser = async (): Promise<void> => {
    if (!user) return;
    try {
      const fullUser = await userApi.getCurrentUser();
      if (fullUser) setUser(fullUser);
    } catch (error) {
      console.error('Error refreshing user:', error);
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    signIn,
    signUp,
    signInWithGoogle,
    signInWithApple,
    signOut,
    updateProfile,
    deleteAccount,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
