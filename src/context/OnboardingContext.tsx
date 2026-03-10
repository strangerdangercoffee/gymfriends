import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { storageService } from '../services/storage';
import { useAuth } from './AuthContext';

interface OnboardingContextType {
  hasCompletedOnboarding: boolean;
  isLoading: boolean;
  completeOnboarding: () => Promise<void>;
  skipOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

interface OnboardingProviderProps {
  children: ReactNode;
}

export const OnboardingProvider: React.FC<OnboardingProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  /** User id we've loaded onboarding status for. Until this matches user?.id, we're still loading. */
  const [loadedForUserId, setLoadedForUserId] = useState<string | null>(null);
  /** Loading only while we have a user and haven't loaded onboarding for that user yet. */
  const isLoading = user?.id != null && loadedForUserId !== user.id;

  useEffect(() => {
    loadOnboardingStatus();
  }, [user?.id]);

  const loadOnboardingStatus = async () => {
    const userId = user?.id ?? null;
    if (!userId) {
      setLoadedForUserId(null);
      return;
    }
    const cache = await storageService.getLastUserCache();
    if (cache?.userId === userId) {
      setHasCompletedOnboarding(cache.hasCompletedOnboarding);
      setLoadedForUserId(userId);
      return;
    }
    try {
      const completed = await storageService.hasCompletedOnboarding(userId);
      setHasCompletedOnboarding(completed);
      setLoadedForUserId(userId);
      if (user) {
        storageService.setLastUserCache({
          userId,
          hasCompletedOnboarding: completed,
          user,
        });
      }
    } catch (error) {
      console.error('[Onboarding] Error loading onboarding status:', error);
      setHasCompletedOnboarding(false);
      setLoadedForUserId(userId);
    }
  };

  const completeOnboarding = async () => {
    try {
      await storageService.setOnboardingCompleted(user?.id ?? null, true);
      setHasCompletedOnboarding(true);
    } catch (error) {
      console.error('Error completing onboarding:', error);
      throw error;
    }
  };

  const skipOnboarding = async () => {
    try {
      await storageService.setOnboardingCompleted(user?.id ?? null, true);
      setHasCompletedOnboarding(true);
    } catch (error) {
      console.error('Error skipping onboarding:', error);
      throw error;
    }
  };

  const resetOnboarding = async () => {
    try {
      await storageService.clearOnboardingStatus(user?.id ?? null);
      setHasCompletedOnboarding(false);
    } catch (error) {
      console.error('Error resetting onboarding:', error);
      throw error;
    }
  };

  return (
    <OnboardingContext.Provider
      value={{
        hasCompletedOnboarding,
        isLoading,
        completeOnboarding,
        skipOnboarding,
        resetOnboarding,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = (): OnboardingContextType => {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
};
