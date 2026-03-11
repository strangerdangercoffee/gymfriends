import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useOnboarding } from '../context/OnboardingContext';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import OnboardingSlide from '../components/OnboardingSlide';
import OnboardingPhoneStep from '../components/OnboardingPhoneStep';
import OnboardingGymSelection from '../components/OnboardingGymSelection';
import OnboardingCheckIn from '../components/OnboardingCheckIn';
import OnboardingClimbingProfile from '../components/OnboardingClimbingProfile';
import OnboardingInviteFriends from '../components/OnboardingInviteFriends';
import Button from '../components/Button';

const { width } = Dimensions.get('window');

type SlideType = 'slide' | 'phone' | 'gym-selection' | 'check-in' | 'climbing-profile' | 'invite-friends';

interface Slide {
  type: 'slide';
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  features: string[];
}

const SLIDES: Slide[] = [
  {
    type: 'slide',
    icon: 'people',
    title: 'Connect with Friends',
    description: 'Add friends in the community page to see when they\'re at the gym',
    features: [
      'Add friends by phone or scan their QR code',
      'Scan QR codes to connect instantly',
      'See friends\' gym activity in real-time',
    ],
  },
  {
    type: 'slide',
    icon: 'people-circle',
    title: 'Create Climbing Groups',
    description: 'Organize your different climbing groups and coordinate workouts together',
    features: [
      'Create groups for different climbing communities',
      'Group chat functionality',
      'Coordinate with multiple friends',
    ],
  },
  {
    type: 'slide',
    icon: 'calendar',
    title: 'Schedule Your Workouts',
    description: 'Plan workouts with groups and friends to coordinate your gym visits',
    features: [
      'Create workout schedules',
      'Invite friends and groups',
      'See when others are working out',
    ],
  },
];

const OnboardingScreen: React.FC = () => {
  const { completeOnboarding, skipOnboarding } = useOnboarding();
  const { gyms, isLoading: gymsLoading, refreshData } = useApp();
  const { user, updateProfile, refreshUser } = useAuth();
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedGyms, setSelectedGyms] = useState<string[]>([]);
  const [hasCompletedGymSelection, setHasCompletedGymSelection] = useState(false);
  const [hasCompletedCheckIn, setHasCompletedCheckIn] = useState(false);
  const [hasCompletedClimbingProfile, setHasCompletedClimbingProfile] = useState(false);

  const totalSteps = SLIDES.length + 5; // 3 slides + phone, gym, check-in, climbing-profile, invite-friends
  const currentStep = currentIndex + 1;

  const getCurrentStepType = (): SlideType => {
    if (currentIndex < SLIDES.length) {
      return 'slide';
    }
    if (currentIndex === SLIDES.length) {
      return 'phone';
    }
    if (currentIndex === SLIDES.length + 1) {
      return 'gym-selection';
    }
    if (currentIndex === SLIDES.length + 2) {
      return 'check-in';
    }
    if (currentIndex === SLIDES.length + 3) {
      return 'climbing-profile';
    }
    return 'invite-friends';
  };

  const handleNext = () => {
    if (currentIndex < totalSteps - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleSkip = async () => {
    await skipOnboarding();
  };

  const handleComplete = async () => {
    // Refresh user data to ensure all onboarding changes are reflected
    try {
      await refreshUser(); // Refresh user object to get updated followedGyms
      await refreshData(true); // Force refresh of app data
    } catch (error) {
      console.error('Error refreshing data after onboarding:', error);
    }
    await completeOnboarding();
  };

  const handleGymSelectionComplete = async (gymIds: string[]) => {
    setSelectedGyms(gymIds);
    setHasCompletedGymSelection(true);
    // Refresh user data to ensure followedGyms is up-to-date
    try {
      await refreshUser(); // Refresh user object to get updated followedGyms
      await refreshData(true); // Force refresh of app data
    } catch (error) {
      console.error('Error refreshing data after gym selection:', error);
    }
    handleNext();
  };

  const handleCheckInComplete = () => {
    setHasCompletedCheckIn(true);
    handleNext();
  };

  const handleClimbingProfileComplete = () => {
    setHasCompletedClimbingProfile(true);
    handleNext();
  };

  const handlePhoneComplete = () => {
    handleNext();
  };

  const handlePhoneSkip = () => {
    handleNext();
  };

  const handleInviteFriendsComplete = () => {
    handleComplete();
  };

  const handleInviteFriendsSkip = () => {
    handleComplete();
  };

  const renderContent = () => {
    const stepType = getCurrentStepType();

    switch (stepType) {
      case 'slide':
        const slide = SLIDES[currentIndex];
        return (
          <OnboardingSlide
            icon={slide.icon}
            title={slide.title}
            description={slide.description}
            features={slide.features}
          />
        );

      case 'phone':
        return (
          <OnboardingPhoneStep
            onComplete={handlePhoneComplete}
            onSkip={handlePhoneSkip}
          />
        );

      case 'gym-selection':
        return (
          <OnboardingGymSelection
            onComplete={handleGymSelectionComplete}
            initialSelectedGyms={selectedGyms}
          />
        );

      case 'check-in':
        return (
          <OnboardingCheckIn
            onComplete={handleCheckInComplete}
          />
        );

      case 'climbing-profile':
        return (
          <OnboardingClimbingProfile
            onComplete={handleClimbingProfileComplete}
            onSkip={handleNext}
          />
        );

      case 'invite-friends':
        return (
          <OnboardingInviteFriends
            onComplete={handleInviteFriendsComplete}
            onSkip={handleInviteFriendsSkip}
          />
        );

      default:
        return null;
    }
  };

  const isLastStep = currentIndex === totalSteps - 1;
  const isFirstStep = currentIndex === 0;
  const isInteractiveStep = currentIndex >= SLIDES.length;

  return (
    <View style={styles.container}>
      {/* Header: Skip button and progress bar in one row/stack so they don't overlap */}
      <View style={styles.header}>
        <View style={styles.skipButtonSpacer} />
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

      {/* Content */}
      {isInteractiveStep ? (
        // Interactive steps handle their own scrolling
        <View style={styles.content}>
          {renderContent()}
        </View>
      ) : (
        // Slides use ScrollView
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {renderContent()}
        </ScrollView>
      )}

      {/* Navigation Buttons - Only show for slides, not interactive steps */}
      {!isInteractiveStep && (
        <View style={styles.navigation}>
          {!isFirstStep && (
            <Button
              title="Back"
              variant="outline"
              onPress={handleBack}
              style={styles.backButton}
            />
          )}
          <Button
            title={isLastStep ? 'Get Started' : 'Next'}
            onPress={handleNext}
            style={[styles.nextButton, isFirstStep && styles.nextButtonFull]}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 44,
    paddingBottom: 8,
  },
  skipButtonSpacer: {
    flex: 1,
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  skipText: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '500',
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 16,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E5E5E7',
    borderRadius: 2,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
  },
  navigation: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 20,
    gap: 12,
  },
  backButton: {
    flex: 1,
  },
  nextButton: {
    flex: 1,
  },
  nextButtonFull: {
    flex: 1,
    marginLeft: 0,
  },
});

export default OnboardingScreen;
