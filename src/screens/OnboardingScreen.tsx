import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useOnboarding } from '../context/OnboardingContext';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import OnboardingPhoneStep from '../components/OnboardingPhoneStep';
import OnboardingClimbingProfile from '../components/OnboardingClimbingProfile';
import OnboardingGymSelection from '../components/OnboardingGymSelection';
import OnboardingCragSelection from '../components/OnboardingCragSelection';
import OnboardingInviteFriends from '../components/OnboardingInviteFriends';
import { colors } from '../theme/colors';

type StepType = 'phone' | 'climbing-profile' | 'gym-selection' | 'crag-selection' | 'invite-friends';

const STEPS: StepType[] = [
  'phone',
  'climbing-profile',
  'gym-selection',
  'crag-selection',
  'invite-friends',
];

const OnboardingScreen: React.FC = () => {
  const { completeOnboarding, skipOnboarding } = useOnboarding();
  const { refreshData } = useApp();
  const { refreshUser } = useAuth();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedGyms, setSelectedGyms] = useState<string[]>([]);

  const totalSteps = STEPS.length;
  const currentStep = currentIndex + 1;
  const currentStepType = STEPS[currentIndex];

  const handleNext = () => {
    if (currentIndex < totalSteps - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = async () => {
    await skipOnboarding();
  };

  const handleComplete = async () => {
    try {
      await refreshUser();
      await refreshData();
    } catch (error) {
      console.error('Error refreshing data after onboarding:', error);
    }
    await completeOnboarding();
  };

  const handleGymSelectionComplete = async (gymIds: string[]) => {
    setSelectedGyms(gymIds);
    try {
      await refreshUser();
      await refreshData();
    } catch (error) {
      console.error('Error refreshing data after gym selection:', error);
    }
    handleNext();
  };

  const renderContent = () => {
    switch (currentStepType) {
      case 'phone':
        return (
          <OnboardingPhoneStep
            onComplete={handleNext}
            onSkip={handleNext}
          />
        );
      case 'climbing-profile':
        return (
          <OnboardingClimbingProfile
            onComplete={handleNext}
            onSkip={handleNext}
          />
        );
      case 'gym-selection':
        return (
          <OnboardingGymSelection
            onComplete={handleGymSelectionComplete}
            initialSelectedGyms={selectedGyms}
          />
        );
      case 'crag-selection':
        return (
          <OnboardingCragSelection
            onComplete={handleNext}
          />
        );
      case 'invite-friends':
        return (
          <OnboardingInviteFriends
            onComplete={handleComplete}
            onSkip={handleComplete}
          />
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${(currentStep / totalSteps) * 100}%` },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {currentStep} of {totalSteps}
        </Text>
      </View>

      <View style={styles.content}>
        {renderContent()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 44,
    paddingBottom: 8,
  },
  headerSpacer: {
    flex: 1,
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  skipText: {
    fontSize: 16,
    color: colors.textMuted,
    fontWeight: '500',
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
});

export default OnboardingScreen;
