import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { requestCalendarAccess, syncUpcomingEvents } from '../services/googleCalendar';
import { colors } from '../theme/colors';

interface OnboardingCalendarStepProps {
  onComplete: () => void;
  onSkip: () => void;
}

const OnboardingCalendarStep: React.FC<OnboardingCalendarStepProps> = ({
  onComplete,
  onSkip,
}) => {
  const { user } = useAuth();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    if (!user?.id) return;
    setError(null);
    setIsConnecting(true);

    try {
      const granted = await requestCalendarAccess(user.id);

      if (granted) {
        setIsConnected(true);
        // Kick off an initial sync in the background — don't await, let it run async
        syncUpcomingEvents(user.id).catch((err) =>
          console.warn('[GCal onboarding] Initial sync failed:', err)
        );
        // Brief pause so the user sees the success state
        await new Promise((resolve) => setTimeout(resolve, 800));
        onComplete();
      } else {
        setError('Could not connect Google Calendar. Please try again.');
      }
    } catch (err) {
      console.error('[GCal onboarding] Connect error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Icon */}
      <View style={styles.iconWrap}>
        <View style={styles.iconCircle}>
          <Ionicons name="calendar" size={44} color={colors.primary} />
        </View>
      </View>

      {/* Heading */}
      <Text style={styles.title}>Sync your calendar</Text>
      <Text style={styles.subtitle}>
        Let GymFriends see when you're busy so friends can find the perfect time
        to climb together — without the back-and-forth.
      </Text>

      {/* Feature bullets */}
      <View style={styles.features}>
        <FeatureRow
          icon="eye-off-outline"
          label="Events stay private — only busy/free is shared with friends"
        />
        <FeatureRow
          icon="people-outline"
          label="Friends see your availability, not your event titles"
        />
        <FeatureRow
          icon="sync-outline"
          label="Syncs automatically in the background"
        />
      </View>

      {/* Error */}
      {error ? (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* CTA */}
      <View style={styles.actions}>
        {isConnected ? (
          <View style={styles.connectedBadge}>
            <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
            <Text style={styles.connectedText}>Calendar connected!</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.connectButton, isConnecting && styles.connectButtonDisabled]}
            onPress={handleConnect}
            disabled={isConnecting}
            activeOpacity={0.8}
          >
            {isConnecting ? (
              <ActivityIndicator size="small" color={colors.background} />
            ) : (
              <>
                <Ionicons name="logo-google" size={18} color={colors.background} style={styles.googleIcon} />
                <Text style={styles.connectButtonText}>Connect Google Calendar</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.skipButton}
          onPress={onSkip}
          disabled={isConnecting}
        >
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
      </View>

      {/* Fine print */}
      <Text style={styles.finePrint}>
        You can connect or disconnect at any time in your profile settings.
      </Text>
    </View>
  );
};

// ── Feature row ────────────────────────────────────────────────────────────

interface FeatureRowProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
}

const FeatureRow: React.FC<FeatureRowProps> = ({ icon, label }) => (
  <View style={featureStyles.row}>
    <View style={featureStyles.iconWrap}>
      <Ionicons name={icon} size={18} color={colors.primary} />
    </View>
    <Text style={featureStyles.label}>{label}</Text>
  </View>
);

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 32,
    alignItems: 'center',
  },
  iconWrap: {
    marginBottom: 28,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1.5,
    borderColor: colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  features: {
    width: '100%',
    gap: 14,
    marginBottom: 32,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  errorText: {
    fontSize: 13,
    color: colors.error,
    flexShrink: 1,
  },
  actions: {
    width: '100%',
    gap: 12,
    alignItems: 'center',
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
    gap: 8,
  },
  connectButtonDisabled: {
    opacity: 0.6,
  },
  googleIcon: {
    marginRight: 2,
  },
  connectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  connectedText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  skipButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  skipText: {
    fontSize: 15,
    color: colors.textMuted,
    fontWeight: '500',
  },
  finePrint: {
    fontSize: 12,
    color: colors.textFaded,
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 18,
  },
});

const featureStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  label: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});

export default OnboardingCalendarStep;
