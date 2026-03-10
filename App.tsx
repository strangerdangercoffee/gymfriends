import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { LocationProvider } from './src/context/LocationContext';
import { AppProvider } from './src/context/AppContext';
import { OnboardingProvider } from './src/context/OnboardingContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <LocationProvider>
          <OnboardingProvider>
            <AppProvider>
              <AppNavigator />
              <StatusBar style="dark" />
            </AppProvider>
          </OnboardingProvider>
        </LocationProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
