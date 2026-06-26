import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetwork } from '../context/NetworkContext';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

/**
 * A slim persistent bar shown at the top of the screen whenever the device
 * is offline. Accounts for the safe-area top inset so it doesn't overlap
 * the notch or Dynamic Island.
 *
 * Render this once at the app root (inside NetworkProvider), above the
 * navigator, so it appears on every screen automatically.
 */
const OfflineBanner: React.FC = () => {
  const { isOffline } = useNetwork();
  const insets = useSafeAreaInsets();

  if (!isOffline) return null;

  return (
    <View style={[styles.banner, { paddingTop: insets.top + 4 }]}>
      <Text style={styles.text}>You're offline — showing saved data</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.secondary,
    paddingBottom: 6,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  text: {
    color: colors.secondary,
    fontFamily: fonts.nunito.semiBold,
    fontSize: 12,
    letterSpacing: 0.2,
  },
});

export default OfflineBanner;
