import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { NotificationData } from '../types';

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
    Notifications.removeNotificationSubscription(subscription);
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
}

export const notificationService = NotificationService.getInstance();
