import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { LocationProvider } from './src/context/LocationContext';
import { AppProvider } from './src/context/AppContext';
import { OnboardingProvider } from './src/context/OnboardingContext';
import { NetworkProvider } from './src/context/NetworkContext';
import OfflineBanner from './src/components/OfflineBanner';
import AppNavigator from './src/navigation/AppNavigator';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    'Nunito-Regular': require('./assets/fonts/Nunito-Regular.ttf'),
    'Nunito-SemiBold': require('./assets/fonts/Nunito-SemiBold.ttf'),
    'Nunito-Bold': require('./assets/fonts/Nunito-Bold.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <NetworkProvider>
        <AuthProvider>
          <LocationProvider>
            <OnboardingProvider>
              <AppProvider>
                <OfflineBanner />
                <AppNavigator />
                <StatusBar style="light" />
              </AppProvider>
            </OnboardingProvider>
          </LocationProvider>
        </AuthProvider>
      </NetworkProvider>
    </SafeAreaProvider>
  );
}
