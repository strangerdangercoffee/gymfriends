import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { locationService } from './location';
import { presenceApi } from './api';
import { Gym } from '../types';

const GEOFENCE_TASK_NAME = 'BACKGROUND_LOCATION_TASK';
const CHECK_IN_RADIUS_METERS = 152.4; // 500 feet in meters
const CHECK_OUT_RADIUS_METERS = 200; // 656 feet - give some buffer before auto check-out

export interface GeofenceState {
  userId: string;
  currentGymId: string | null;
  lastCheckedGymId: string | null;
  isAutoCheckedIn: boolean;
}

// In-memory state for geofencing
let geofenceState: GeofenceState = {
  userId: '',
  currentGymId: null,
  lastCheckedGymId: null,
  isAutoCheckedIn: false,
};

// Define the background location task
TaskManager.defineTask(GEOFENCE_TASK_NAME, async ({ data, error }: any) => {
  if (error) {
    console.error('Background location task error:', error);
    return;
  }

  if (data) {
    const { locations } = data;
    const location = locations[0];

    if (location) {
      try {
        await handleLocationUpdate(
          location.coords.latitude,
          location.coords.longitude
        );
      } catch (err) {
        console.error('Error handling background location update:', err);
      }
    }
  }
});

// Handle location updates and check for geofence triggers
async function handleLocationUpdate(latitude: number, longitude: number): Promise<void> {
  if (!geofenceState.userId) {
    console.log('No user ID set for geofencing');
    return;
  }

  // Get user's followed gyms (this should be cached or passed in)
  const followedGyms = await getFollowedGyms();
  
  if (!followedGyms || followedGyms.length === 0) {
    return;
  }

  // Find nearby gyms within check-in radius
  const nearbyGyms = locationService.findNearbyGyms(
    latitude,
    longitude,
    followedGyms,
    CHECK_IN_RADIUS_METERS
  );

  const nearestGym = (await nearbyGyms)[0];

  // Handle auto check-in
  if (nearestGym && !geofenceState.isAutoCheckedIn) {
    // User entered a gym's geofence
    try {
      await presenceApi.checkIn(geofenceState.userId, nearestGym.id, {
        latitude,
        longitude,
      });
      
      geofenceState.currentGymId = nearestGym.id;
      geofenceState.isAutoCheckedIn = true;
      geofenceState.lastCheckedGymId = nearestGym.id;
      
      console.log(`Auto checked in to gym: ${nearestGym.id}`);
      
      // TODO: Send notification to user
    } catch (error) {
      console.error('Error auto checking in:', error);
    }
  } 
  // Handle auto check-out
  else if (geofenceState.isAutoCheckedIn && geofenceState.currentGymId) {
    // Check if user is still near the gym they're checked into
    const currentGym = followedGyms.find(g => g.id === geofenceState.currentGymId);
    
    if (currentGym) {
      const distance = locationService.calculateDistance(
        latitude,
        longitude,
        currentGym.latitude,
        currentGym.longitude
      );

      // User left the gym's geofence (with buffer)
      if (distance > CHECK_OUT_RADIUS_METERS) {
        try {
          await presenceApi.checkOut(geofenceState.userId, geofenceState.currentGymId);
          
          console.log(`Auto checked out from gym: ${geofenceState.currentGymId}`);
          
          geofenceState.currentGymId = null;
          geofenceState.isAutoCheckedIn = false;
          
          // TODO: Send notification to user
        } catch (error) {
          console.error('Error auto checking out:', error);
        }
      }
    }
  }
}

// Placeholder for getting followed gyms - should be implemented based on your data flow
let cachedFollowedGyms: Gym[] = [];

async function getFollowedGyms(): Promise<Gym[]> {
  return cachedFollowedGyms;
}

export class GeofencingService {
  private static instance: GeofencingService;
  private isRunning = false;

  static getInstance(): GeofencingService {
    if (!GeofencingService.instance) {
      GeofencingService.instance = new GeofencingService();
    }
    return GeofencingService.instance;
  }

  async startGeofencing(userId: string, followedGyms: Gym[]): Promise<void> {
    try {
      // Check if we have background location permissions
      const { status } = await Location.getBackgroundPermissionsAsync();
      
      if (status !== 'granted') {
        throw new Error('Background location permission not granted');
      }

      // Update geofence state
      geofenceState.userId = userId;
      cachedFollowedGyms = followedGyms;

      // Check if task is already registered
      const isRegistered = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK_NAME);
      
      if (isRegistered) {
        await Location.stopLocationUpdatesAsync(GEOFENCE_TASK_NAME);
      }

      // Start background location updates
      await Location.startLocationUpdatesAsync(GEOFENCE_TASK_NAME, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 30000, // Check every 30 seconds
        distanceInterval: 50, // Or when user moves 50 meters
        foregroundService: {
          notificationTitle: 'GymFriends is tracking your location',
          notificationBody: 'This allows us to automatically check you in when you arrive at the gym.',
        },
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
      });

      this.isRunning = true;
      console.log('Geofencing started');
    } catch (error) {
      console.error('Error starting geofencing:', error);
      throw error;
    }
  }

  async stopGeofencing(): Promise<void> {
    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK_NAME);
      
      if (isRegistered) {
        await Location.stopLocationUpdatesAsync(GEOFENCE_TASK_NAME);
      }

      // Reset geofence state
      geofenceState = {
        userId: '',
        currentGymId: null,
        lastCheckedGymId: null,
        isAutoCheckedIn: false,
      };

      this.isRunning = false;
      console.log('Geofencing stopped');
    } catch (error) {
      console.error('Error stopping geofencing:', error);
      throw error;
    }
  }

  isGeofencingRunning(): boolean {
    return this.isRunning;
  }

  updateFollowedGyms(gyms: Gym[]): void {
    cachedFollowedGyms = gyms;
  }

  getGeofenceState(): GeofenceState {
    return { ...geofenceState };
  }

  // Manual override - in case user manually checks in/out
  setManualCheckInState(gymId: string | null, isCheckedIn: boolean): void {
    geofenceState.currentGymId = gymId;
    geofenceState.isAutoCheckedIn = isCheckedIn;
    if (gymId) {
      geofenceState.lastCheckedGymId = gymId;
    }
  }
}

export const geofencingService = GeofencingService.getInstance();


