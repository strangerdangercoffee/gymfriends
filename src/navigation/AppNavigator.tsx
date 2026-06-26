import React, { useEffect, useRef } from 'react';
import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useOnboarding } from '../context/OnboardingContext';
import { notificationService } from '../services/notifications';
import {
  RootTabParamList,
  ScheduleStackParamList,
  FindStackParamList,
  MessagesStackParamList,
} from '../types';
import { colors } from '../theme/colors';

// Import screens
import AuthScreen from '../screens/AuthScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import ScheduleScreen from '../screens/ScheduleScreen';
import AddScheduleScreen from '../screens/AddScheduleScreen';
import GroupChatScreen from '../screens/GroupChatScreen';
import ProfileScreen from '../screens/ProfileScreen';
import HomeScreen from '../screens/HomeScreen';
import AreaFeedScreen from '../screens/AreaFeedScreen';
import AreaDetailScreen from '../screens/AreaDetailScreen';
import AreaFriendCalendarScreen from '../screens/AreaFriendCalendarScreen';
import AreasMapScreen from '../screens/AreasMapScreen';
import GymDetailScreen from '../screens/GymDetailScreen';
import FindTimeScreen from '../screens/FindTimeScreen';

// New screens
import FindScreen from '../screens/FindScreen';
import FriendProfileScreen from '../screens/FriendProfileScreen';
import MessagesScreen from '../screens/MessagesScreen';
import DirectChatScreen from '../screens/DirectChatScreen';

const Tab = createBottomTabNavigator<RootTabParamList>();

export const navigationRef = createNavigationContainerRef();

function navigateToTripInvitationFromPush(data: Record<string, unknown>) {
  if (data?.type !== 'trip_invitation' || typeof data.areaId !== 'string') return;
  if (!navigationRef.isReady()) return;
  const invitationId =
    typeof data.invitationId === 'string' ? data.invitationId : undefined;
  (navigationRef as any).navigate('Find', {
    screen: 'AreaDetail',
    params: {
      areaId: data.areaId,
      highlightTripInvitationId: invitationId,
    },
  });
}

const ScheduleStack = createStackNavigator<ScheduleStackParamList>();
const FindStack = createStackNavigator<FindStackParamList>();
const MessagesStack = createStackNavigator<MessagesStackParamList>();

const screenOptions = {
  headerStyle: {
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  } as any,
  headerTitleStyle: {
    fontWeight: '600' as const,
    fontSize: 18,
    color: colors.text,
  },
  headerTintColor: colors.primary,
};

const LoadingScreen: React.FC = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color={colors.primary} />
  </View>
);

const ScheduleStackNavigator: React.FC = () => (
  <ScheduleStack.Navigator screenOptions={screenOptions}>
    <ScheduleStack.Screen
      name="ScheduleMain"
      component={ScheduleScreen}
      options={{ title: 'My Schedule' }}
    />
    <ScheduleStack.Screen
      name="AddSchedule"
      component={AddScheduleScreen}
      options={{ title: 'Add Schedule' }}
    />
  </ScheduleStack.Navigator>
);

const FindStackNavigator: React.FC = () => (
  <FindStack.Navigator screenOptions={screenOptions}>
    <FindStack.Screen
      name="FindMain"
      component={FindScreen}
      options={{ title: 'Find', headerShown: false }}
    />
    <FindStack.Screen
      name="FriendProfile"
      component={FriendProfileScreen}
      options={{ title: 'Profile' }}
    />
    <FindStack.Screen
      name="GymDetail"
      component={GymDetailScreen}
      options={{ title: 'Gym' }}
    />
    <FindStack.Screen
      name="AreaDetail"
      component={AreaDetailScreen}
      options={{ title: 'Area' }}
    />
    <FindStack.Screen
      name="AreaFriendCalendar"
      component={AreaFriendCalendarScreen}
      options={({ route }) => ({
        title: route.params?.areaName ? `${route.params.areaName} · Trips` : 'Trip calendar',
      })}
    />
    <FindStack.Screen
      name="AreasMap"
      component={AreasMapScreen}
      options={{ title: 'Map', headerShown: false }}
    />
    <FindStack.Screen
      name="FriendSchedule"
      component={FindTimeScreen}
      options={({ route }) => ({ title: (route.params as any)?.userName ?? 'Schedule' })}
    />
    <FindStack.Screen
      name="GroupSchedule"
      component={FindTimeScreen}
      options={({ route }) => ({ title: (route.params as any)?.groupName ?? 'Group Schedule' })}
    />
  </FindStack.Navigator>
);

const HomeStack = createStackNavigator();

const HomeStackNavigator: React.FC = () => (
  <HomeStack.Navigator screenOptions={screenOptions}>
    <HomeStack.Screen
      name="HomeMain"
      component={HomeScreen}
      options={{ headerShown: false }}
    />
    <HomeStack.Screen
      name="MySchedule"
      component={ScheduleScreen}
      options={{ title: 'My Schedule' }}
    />
  </HomeStack.Navigator>
);

const MessagesStackNavigator: React.FC = () => (
  <MessagesStack.Navigator screenOptions={screenOptions}>
    <MessagesStack.Screen
      name="MessagesMain"
      component={MessagesScreen}
      options={{ title: 'Messages', headerShown: false }}
    />
    <MessagesStack.Screen
      name="DirectChat"
      component={DirectChatScreen}
      options={({ route }) => ({ title: route.params.otherUserName })}
    />
    <MessagesStack.Screen
      name="GroupChat"
      component={GroupChatScreen}
      options={({ route }) => ({ title: route.params.groupName })}
    />
  </MessagesStack.Navigator>
);

const TabNavigator: React.FC = () => (
  <Tab.Navigator
    initialRouteName="Home"
    screenOptions={({ route }) => ({
      tabBarIcon: ({ focused, color, size }) => {
        let iconName: keyof typeof Ionicons.glyphMap;
        if (route.name === 'Home') {
          iconName = focused ? 'home' : 'home-outline';
        } else if (route.name === 'Find') {
          iconName = focused ? 'search' : 'search-outline';
        } else if (route.name === 'Messages') {
          iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
        } else if (route.name === 'Profile') {
          iconName = focused ? 'person' : 'person-outline';
        } else {
          iconName = 'help-outline';
        }
        return <Ionicons name={iconName} size={size} color={color} />;
      },
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.textMuted,
      tabBarStyle: {
        backgroundColor: colors.background,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingBottom: 5,
        paddingTop: 5,
        height: 60,
      },
      headerStyle: {
        backgroundColor: colors.background,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      },
      headerTitleStyle: {
        fontWeight: '600',
        fontSize: 18,
        color: colors.text,
      },
      headerTintColor: colors.primary,
    })}
  >
    <Tab.Screen
      name="Home"
      component={HomeStackNavigator}
      options={{ title: 'Home', headerShown: false }}
    />
    <Tab.Screen
      name="Find"
      component={FindStackNavigator}
      options={{ title: 'Find', headerShown: false }}
    />
    <Tab.Screen
      name="Messages"
      component={MessagesStackNavigator}
      options={{ title: 'Messages', headerShown: false }}
    />
    <Tab.Screen
      name="Profile"
      component={ProfileScreen}
      options={{ title: 'Profile' }}
    />
  </Tab.Navigator>
);

const AppNavigator: React.FC = () => {
  const { user, isLoading: authLoading } = useAuth();
  const { hasCompletedOnboarding, isLoading: onboardingLoading } = useOnboarding();
  const lastLoggedScreenRef = useRef<string | null>(null);

  useEffect(() => {
    let screen: string;
    if (authLoading || onboardingLoading) {
      screen = 'LoadingScreen';
    } else if (!user) {
      screen = 'AuthScreen';
    } else if (!hasCompletedOnboarding) {
      screen = 'OnboardingScreen';
    } else {
      screen = 'TabNavigator';
    }
    if (lastLoggedScreenRef.current !== screen) {
      console.log('[Onboarding] Screen decision:', {
        screen,
        authLoading,
        onboardingLoading,
        userId: user?.id ?? null,
        hasCompletedOnboarding,
      });
      lastLoggedScreenRef.current = screen;
    }
  }, [authLoading, onboardingLoading, user?.id, hasCompletedOnboarding]);

  useEffect(() => {
    if (user && hasCompletedOnboarding) {
      notificationService.getExpoPushToken().then((token) => {
        if (token) {
          notificationService.savePushToken(user.id, token).then(
            () => console.log('Push token registered for user:', user.id),
            (err) => console.error('Error registering push token:', err)
          );
        }
      });
    }
  }, [user?.id, hasCompletedOnboarding]);

  useEffect(() => {
    if (!user?.id || !hasCompletedOnboarding) return;
    const sub = notificationService.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as Record<string, unknown>;
        navigateToTripInvitationFromPush(data || {});
      }
    );
    return () => notificationService.removeNotificationSubscription(sub);
  }, [user?.id, hasCompletedOnboarding]);

  useEffect(() => {
    if (!user?.id || !hasCompletedOnboarding) return;
    const t = setTimeout(() => {
      Notifications.getLastNotificationResponseAsync().then((response) => {
        if (!navigationRef.isReady()) return;
        const data = response?.notification.request.content.data as
          | Record<string, unknown>
          | undefined;
        if (data) navigateToTripInvitationFromPush(data);
      });
    }, 800);
    return () => clearTimeout(t);
  }, [user?.id, hasCompletedOnboarding]);

  if (authLoading || onboardingLoading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer ref={navigationRef}>
      {user ? (
        !hasCompletedOnboarding ? <OnboardingScreen /> : <TabNavigator />
      ) : (
        <AuthScreen />
      )}
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});

export default AppNavigator;
