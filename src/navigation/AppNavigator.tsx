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
import { RootTabParamList, ScheduleStackParamList, GroupsStackParamList, MapStackParamList } from '../types';
import { colors } from '../theme/colors';

// Import screens
import AuthScreen from '../screens/AuthScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import ScheduleScreen from '../screens/ScheduleScreen';
import AddScheduleScreen from '../screens/AddScheduleScreen';
import ConnectionsScreen from '../screens/ConnectionsScreen';
import GroupChatScreen from '../screens/GroupChatScreen';
import ProfileScreen from '../screens/ProfileScreen';
import FeedScreen from '../screens/FeedScreen';
import AreaFeedScreen from '../screens/AreaFeedScreen';
import AreaDetailScreen from '../screens/AreaDetailScreen';
import AreaFriendCalendarScreen from '../screens/AreaFriendCalendarScreen';
import AreasMapScreen from '../screens/AreasMapScreen';
import GymDetailScreen from '../screens/GymDetailScreen';
import FindTimeScreen from '../screens/FindTimeScreen';

const Tab = createBottomTabNavigator<RootTabParamList>();

export const navigationRef = createNavigationContainerRef();

function navigateToTripInvitationFromPush(data: Record<string, unknown>) {
  if (data?.type !== 'trip_invitation' || typeof data.areaId !== 'string') return;
  if (!navigationRef.isReady()) return;
  const invitationId =
    typeof data.invitationId === 'string' ? data.invitationId : undefined;
  navigationRef.navigate('Friends' as never, {
    screen: 'AreaDetail',
    params: {
      areaId: data.areaId,
      highlightTripInvitationId: invitationId,
    },
  } as never);
}
const ScheduleStack = createStackNavigator<ScheduleStackParamList>();
const GroupsStack = createStackNavigator<GroupsStackParamList>();
const MapStack = createStackNavigator<MapStackParamList>();

const LoadingScreen: React.FC = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color={colors.primary} />
  </View>
);

const ScheduleStackNavigator: React.FC = () => {
  return (
    <ScheduleStack.Navigator
      screenOptions={{
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
      }}
    >
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
};

const GroupsStackNavigator: React.FC = () => {
  return (
    <GroupsStack.Navigator
      screenOptions={{
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
      }}
    >
      <GroupsStack.Screen 
        name="GroupsMain" 
        component={ConnectionsScreen}
        options={{ title: 'Connections', headerShown: false }}
      />
      <GroupsStack.Screen 
        name="GroupChat" 
        component={GroupChatScreen}
        options={({ route }) => ({ title: route.params.groupName })}
      />
      <GroupsStack.Screen 
        name="AreaFeed" 
        component={AreaFeedScreen}
        options={{ title: 'Area Feeds' }}
      />
      <GroupsStack.Screen 
        name="AreasMap" 
        component={AreasMapScreen}
        options={{ title: 'Areas Map', headerShown: false }}
      />
      <GroupsStack.Screen 
        name="AreaDetail" 
        component={AreaDetailScreen}
        options={({ route }) => ({ title: route.params.areaId ? 'Area' : 'Area' })}
      />
      <GroupsStack.Screen
        name="AreaFriendCalendar"
        component={AreaFriendCalendarScreen}
        options={({ route }) => ({
          title: route.params.areaName ? `${route.params.areaName} · Trips` : 'Trip calendar',
        })}
      />
      <GroupsStack.Screen
        name="GymDetail"
        component={GymDetailScreen}
        options={({ route }) => ({ title: route.params?.gymId ? 'Gym' : 'Gym' })}
      />
      <GroupsStack.Screen
        name="FriendSchedule"
        component={FindTimeScreen}
        options={({ route }) => ({ title: (route.params as any)?.userName ?? 'Schedule' })}
      />
      <GroupsStack.Screen
        name="GroupSchedule"
        component={FindTimeScreen}
        options={({ route }) => ({ title: (route.params as any)?.groupName ?? 'Group Schedule' })}
      />
    </GroupsStack.Navigator>
  );
};

const MapStackNavigator: React.FC = () => {
  return (
    <MapStack.Navigator
      screenOptions={{
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
      }}
    >
      <MapStack.Screen 
        name="MapMain" 
        component={AreasMapScreen}
        options={{ title: 'Map', headerShown: false }}
      />
      <MapStack.Screen 
        name="AreaDetail" 
        component={AreaDetailScreen}
        options={({ route }) => ({ title: route.params.areaId ? 'Area' : 'Area' })}
      />
      <MapStack.Screen
        name="AreaFriendCalendar"
        component={AreaFriendCalendarScreen}
        options={({ route }) => ({
          title: route.params.areaName ? `${route.params.areaName} · Trips` : 'Trip calendar',
        })}
      />
      <MapStack.Screen 
        name="GymDetail" 
        component={GymDetailScreen}
        options={({ route }) => ({ title: route.params?.gymId ? 'Gym' : 'Gym' })}
      />
    </MapStack.Navigator>
  );
};

const TabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      initialRouteName="Map"
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === 'Schedule') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'Friends') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'Map') {
            iconName = focused ? 'globe' : 'globe-outline';
          } else if (route.name === 'Feed') {
            iconName = focused ? 'newspaper' : 'newspaper-outline';
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
        name="Schedule" 
        component={ScheduleStackNavigator}
        options={{ title: 'Schedule', headerShown: false }}
      />
      <Tab.Screen 
        name="Friends" 
        component={GroupsStackNavigator}
        options={{ title: 'Connections', headerShown: false }}
      />
      <Tab.Screen 
        name="Map" 
        component={MapStackNavigator}
        options={{ title: 'Map', headerShown: false }}
      />
      <Tab.Screen 
        name="Feed" 
        component={FeedScreen}
        options={{ title: 'Feed', headerShown: false }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
    </Tab.Navigator>
  );
};

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
        const data = response.notification.request.content.data as Record<
          string,
          unknown
        >;
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
