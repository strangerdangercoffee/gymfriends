import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { NotificationData } from '../types';
import { supabase } from './supabase';
import { notificationPreferencesApi } from './api';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export class NotificationService {
  private static instance: NotificationService;
  private expoPushToken: string | null = null;

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async requestPermissions(): Promise<boolean> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        return false;
      }

      // For Android, we need to set the notification channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }

      return true;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  }

  async getExpoPushToken(): Promise<string | null> {
    try {
      if (this.expoPushToken) {
        return this.expoPushToken;
      }

      const hasPermissions = await this.requestPermissions();
      if (!hasPermissions) {
        throw new Error('Notification permissions not granted');
      }

      const token = await Notifications.getExpoPushTokenAsync({
        projectId: 'c3fc518d-924a-4c63-9af5-1b37f6535479',
      });

      this.expoPushToken = token.data;
      return this.expoPushToken;
    } catch (error) {
      console.error('Error getting Expo push token:', error);
      return null;
    }
  }

  async scheduleLocalNotification(
    notification: NotificationData,
    trigger?: Notifications.NotificationTriggerInput
  ): Promise<string> {
    try {
      const hasPermissions = await this.requestPermissions();
      if (!hasPermissions) {
        throw new Error('Notification permissions not granted');
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: notification.title,
          body: notification.body,
          data: notification.data || {},
        },
        trigger: trigger || null,
      });

      return notificationId;
    } catch (error) {
      console.error('Error scheduling notification:', error);
      throw error;
    }
  }

  async scheduleWorkoutReminder(
    scheduleId: string,
    gymName: string,
    startTime: Date,
    minutesBefore: number = 30
  ): Promise<string> {
    const reminderTime = new Date(startTime.getTime() - minutesBefore * 60 * 1000);
    
    return this.scheduleLocalNotification(
      {
        title: 'Workout Reminder',
        body: `Your workout at ${gymName} starts in ${minutesBefore} minutes!`,
        data: { scheduleId, type: 'workout_reminder' },
      },
      { type: 'date', date: reminderTime } as any
    );
  }

  async scheduleFriendAtGymNotification(
    friendName: string,
    gymName: string
  ): Promise<string> {
    return this.scheduleLocalNotification(
      {
        title: 'Friend at Gym',
        body: `${friendName} is at ${gymName}`,
        data: { type: 'friend_at_gym', friendName, gymName },
      }
    );
  }

  async cancelNotification(notificationId: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch (error) {
      console.error('Error canceling notification:', error);
    }
  }

  async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('Error canceling all notifications:', error);
    }
  }

  addNotificationReceivedListener(
    listener: (notification: Notifications.Notification) => void
  ): Notifications.Subscription {
    return Notifications.addNotificationReceivedListener(listener);
  }

  addNotificationResponseReceivedListener(
    listener: (response: Notifications.NotificationResponse) => void
  ): Notifications.Subscription {
    return Notifications.addNotificationResponseReceivedListener(listener);
  }

  removeNotificationSubscription(subscription: Notifications.Subscription): void {
    subscription.remove();
  }

  // Send push notification to a specific user
  async sendPushNotification(
    expoPushToken: string,
    notification: NotificationData
  ): Promise<void> {
    try {
      const message = {
        to: expoPushToken,
        sound: 'default',
        title: notification.title,
        body: notification.body,
        data: notification.data || {},
      };

      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        throw new Error('Failed to send push notification');
      }
    } catch (error) {
      console.error('Error sending push notification:', error);
      throw error;
    }
  }

  // Save or update push token for a user
  async savePushToken(userId: string, token: string, platform?: string): Promise<void> {
    const doUpsert = async (): Promise<boolean> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user || session.user.id !== userId) {
        return false; // Session not ready or mismatch — RLS would fail
      }
      const { error } = await (supabase as any)
        .from('user_push_tokens')
        .upsert({
          user_id: userId,
          expo_push_token: token,
          platform: platform || Platform.OS,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,expo_push_token',
        });
      if (error) throw error;
      console.log(`Push token saved for user ${userId}`);
      return true;
    };

    try {
      if (await doUpsert()) return;
      await new Promise((r) => setTimeout(r, 2000));
      if (await doUpsert()) return;
    } catch (error: any) {
      if (error?.code === '42501') {
        await new Promise((r) => setTimeout(r, 1500));
        try {
          await doUpsert();
          return;
        } catch (retryError: any) {
          console.error('Error saving push token (RLS):', retryError);
          throw retryError;
        }
      }
      console.error('Error saving push token:', error);
      throw error;
    }
  }

  // Check if notification should be sent based on user preferences
  private shouldSendNotification(
    notificationType?: string,
    preferences?: any
  ): boolean {
    if (!preferences || !notificationType) return true; // Default to sending

    switch (notificationType) {
      case 'workout_invitation':
        return preferences.workoutInvitations ?? true;
      case 'workout_invitation_response':
        return preferences.workoutResponses ?? true;
      case 'workout_bail':
        return preferences.workoutBails ?? true;
      case 'workout_reminder':
        return preferences.workoutReminders ?? true;
      case 'friend_at_gym':
        return preferences.friendAtGym ?? true;
      case 'friend_at_crag':
        return preferences.friendAtCrag ?? true;
      case 'group_message':
        return preferences.groupMessages ?? true;
      case 'belayer_request':
        return preferences.belayerRequests ?? true;
      case 'belayer_response':
        return preferences.belayerResponses ?? true;
      case 'friend_trip_announcement':
        return preferences.friendTripAnnouncements ?? true;
      default:
        return true;
    }
  }

  // Generic notification sender - sends push notifications to users
  async sendNotification(
    userId: string,
    notification: NotificationData
  ): Promise<void> {
    try {
      // Check user's notification preferences
      const preferences = await notificationPreferencesApi.getNotificationPreferences(userId);
      
      // Determine if we should send based on notification type
      const shouldSend = this.shouldSendNotification(notification.data?.type, preferences);
      if (!shouldSend) {
        console.log(`Notification skipped for user ${userId} due to preferences`);
        return;
      }

      // Get user's push token(s)
      const { data: tokens, error: tokenError } = await (supabase as any)
        .from('user_push_tokens')
        .select('expo_push_token')
        .eq('user_id', userId);

      if (tokenError) {
        console.error('Error fetching push tokens:', tokenError);
        throw tokenError;
      }

      if (!tokens || tokens.length === 0) {
        console.log(`No push token found for user ${userId}`);
        return;
      }

      // Send notification to all user's devices
      for (const tokenData of tokens) {
        try {
          await this.sendPushNotification(tokenData.expo_push_token, notification);
          console.log(`Push notification sent to user ${userId}`);
        } catch (error) {
          console.error(`Error sending push to token ${tokenData.expo_push_token}:`, error);
        }
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      throw error;
    }
  }
}

export const notificationService = NotificationService.getInstance();
