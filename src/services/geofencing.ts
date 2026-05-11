import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { locationService } from './location';
import { presenceApi, userAreaVisitsApi } from './api';
import { notificationService } from './notifications';
import { Gym, ClimbingArea } from '../types';

const GEOFENCE_TASK_NAME = 'BACKGROUND_LOCATION_TASK';
const CHECK_IN_RADIUS_METERS = 152.4; // 500 feet in meters
const CHECK_OUT_RADIUS_METERS = 200; // 656 feet - give some buffer before auto check-out
const AREA_LEAVE_BUFFER_METERS = 100; // buffer beyond area radius before considering "left"

export interface GeofenceState {
  userId: string;
  userName?: string;
  currentGymId: string | null;
  lastCheckedGymId: string | null;
  isAutoCheckedIn: boolean;
  currentAreaId: string | null;
}

// In-memory state for geofencing
let geofenceState: GeofenceState = {
  userId: '',
  currentGymId: null,
  lastCheckedGymId: null,
  isAutoCheckedIn: false,
  currentAreaId: null,
};

let cachedClimbingAreas: ClimbingArea[] = [];
/** All climbing areas to check for visits (so we record when user is in any area, not only followed). */
let cachedAllClimbingAreas: ClimbingArea[] = [];

// Define the background location task
TaskManager.defineTask(GEOFENCE_TASK_NAME, async ({ data, error }: any) => {
  if (error) {
    console.error('[Geofence] Background location task error:', error);
    return;
  }

  if (data) {
    const { locations } = data;
    const location = locations[0];

    if (location) {
      const { latitude, longitude } = location.coords;
      if (__DEV__) {
        console.log(`[Geofence] Background location update (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`);
      }
      try {
        await handleLocationUpdate(latitude, longitude);
      } catch (err) {
        console.error('[Geofence] Error handling background location update:', err);
      }
    }
  }
});

// Handle location updates and check for geofence triggers
async function handleLocationUpdate(latitude: number, longitude: number): Promise<void> {
  if (!geofenceState.userId) {
    if (__DEV__) console.log('[Geofence] Skipping location check — no user ID');
    return;
  }

  if (__DEV__) {
    console.log(`[Geofence] Checking location (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`);
  }

  const gymsForProximity = await getGymsForProximity();

  const areasToCheck = cachedAllClimbingAreas.length > 0 ? cachedAllClimbingAreas : cachedClimbingAreas;
  const areasForDistance = areasToCheck.map((a) => ({
    id: a.id,
    latitude: a.latitude,
    longitude: a.longitude,
    geofenceRadiusM: a.geofenceRadiusM,
  }));

  const hasGyms = gymsForProximity.length > 0;
  const hasAreas = areasForDistance.length > 0;

  /** One haversine pass per tick for all gyms (auto check-in) + outdoor areas (same coordinates). */
  let nearbyGymsSorted: Array<{ id: string; distance: number }> = [];
  let nearbyAreas: Array<{ id: string; distance: number }> = [];
  if (hasGyms || hasAreas) {
    const result = locationService.findGymAndAreaProximity(
      latitude,
      longitude,
      hasGyms ? gymsForProximity : [],
      CHECK_IN_RADIUS_METERS,
      hasAreas ? areasForDistance : []
    );
    nearbyGymsSorted = result.nearbyGymsSorted;
    nearbyAreas = result.nearbyAreasSorted;
  }

  // 1) Gym geofence (same location tick as area visit check below)
  if (hasGyms) {
    const nearestGym = nearbyGymsSorted[0];

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
      // Check if user is still near the gym they're checked into (any gym, not only followed)
      const currentGym = gymsForProximity.find((g) => g.id === geofenceState.currentGymId);

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

  // 2) Climbing area geofence — uses nearbyAreas from the same findGymAndAreaProximity pass above
  if (__DEV__ && areasToCheck.length > 0) {
    console.log(`[Geofence] Area check: ${areasToCheck.length} areas, currentAreaId=${geofenceState.currentAreaId ?? 'none'}`);
  }
  if (areasToCheck.length > 0) {
    const nearestArea = nearbyAreas[0];

    if (nearestArea && nearestArea.id !== geofenceState.currentAreaId) {
      try {
        const areaName = areasToCheck.find((a) => a.id === nearestArea.id)?.name ?? nearestArea.id;
        console.log(`[Geofence] Recording area visit: ${areaName} (${nearestArea.id})`);
        const { visit, shouldNotify } = await userAreaVisitsApi.recordVisit(geofenceState.userId, nearestArea.id);
        geofenceState.currentAreaId = nearestArea.id;
        if (shouldNotify) {
          const friendIds = await userAreaVisitsApi.getFriendsAtArea(geofenceState.userId, nearestArea.id);
          const userName = geofenceState.userName ?? 'A friend';
          const nameForNotification = areasToCheck.find((a) => a.id === nearestArea.id)?.name ?? 'the crag';
          for (const friendId of friendIds) {
            try {
              await notificationService.sendNotification(friendId, {
                title: 'Friend at the crag',
                body: `Yo ${userName} just rolled up to ${nameForNotification}`,
                data: { type: 'friend_at_crag', userName, areaName: nameForNotification, areaId: nearestArea.id },
              });
            } catch (e) {
              console.error('Error sending friend_at_crag notification:', e);
            }
          }
        }
      } catch (error) {
        console.error('Error recording area visit:', error);
      }
    } else if (geofenceState.currentAreaId && !nearestArea) {
      const currentArea = areasToCheck.find((a) => a.id === geofenceState.currentAreaId);
      const distance = currentArea
        ? locationService.calculateDistance(latitude, longitude, currentArea.latitude, currentArea.longitude)
        : Infinity;
      if (distance > (currentArea?.geofenceRadiusM ?? 400) + AREA_LEAVE_BUFFER_METERS) {
        try {
          console.log(`[Geofence] Leaving area: ${geofenceState.currentAreaId}`);
          await userAreaVisitsApi.leaveArea(geofenceState.userId, geofenceState.currentAreaId);
          geofenceState.currentAreaId = null;
        } catch (error) {
          console.error('Error leaving area:', error);
        }
      }
    }
  }
}

/** All gyms loaded from the app — used for auto check-in within CHECK_IN_RADIUS_METERS (~500 ft). */
let cachedGymsForProximity: Gym[] = [];

async function getGymsForProximity(): Promise<Gym[]> {
  return cachedGymsForProximity;
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

  async startGeofencing(
    userId: string,
    gymsForProximity: Gym[],
    options?: { userName?: string; followedAreas?: ClimbingArea[]; allClimbingAreas?: ClimbingArea[] }
  ): Promise<void> {
    try {
      const { status } = await Location.getBackgroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Background location permission not granted');
      }
      geofenceState.userId = userId;
      geofenceState.userName = options?.userName;
      cachedGymsForProximity = gymsForProximity;
      cachedClimbingAreas = options?.followedAreas ?? [];
      cachedAllClimbingAreas = options?.allClimbingAreas ?? [];

      // Try to start background location updates (requires UIBackgroundModes location in Info.plist).
      // On Expo Go this often fails; we still enable foreground-only checks below.
      try {
        const isRegistered = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK_NAME);
        if (isRegistered) {
          await Location.stopLocationUpdatesAsync(GEOFENCE_TASK_NAME);
        }
        await Location.startLocationUpdatesAsync(GEOFENCE_TASK_NAME, {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 30000, // 30 seconds
          distanceInterval: 50, // 50 meters
          foregroundService: {
            notificationTitle: 'GymFriends is tracking your location',
            notificationBody: 'This allows us to automatically check you in when you arrive at the gym.',
          },
          pausesUpdatesAutomatically: false,
          showsBackgroundLocationIndicator: true,
        });
        if (__DEV__) console.log('[Geofence] Background location updates started');
      } catch (bgError: any) {
        const msg = bgError?.message ?? String(bgError);
        if (msg.includes('UIBackgroundModes') || msg.includes('Background location')) {
          console.warn(
            '[Geofence] Background location not available (e.g. Expo Go or missing UIBackgroundModes). Using foreground checks only.'
          );
        } else {
          throw bgError;
        }
      }

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

      geofenceState = {
        userId: '',
        currentGymId: null,
        lastCheckedGymId: null,
        isAutoCheckedIn: false,
        currentAreaId: null,
      };
      cachedGymsForProximity = [];
      cachedClimbingAreas = [];
      cachedAllClimbingAreas = [];

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

  updateGymsForProximity(gyms: Gym[]): void {
    cachedGymsForProximity = gyms;
  }

  updateFollowedAreas(areas: ClimbingArea[]): void {
    cachedClimbingAreas = areas;
  }

  updateAllClimbingAreas(areas: ClimbingArea[]): void {
    cachedAllClimbingAreas = areas;
  }

  /**
   * Run a one-off location check (e.g. from foreground). Gets current position and updates
   * area visit state. Call at a reasonable interval (e.g. every 90s) when app is active.
   */
  async checkLocationForAreaVisit(): Promise<void> {
    if (!geofenceState.userId) return;
    if (__DEV__) console.log('[Geofence] Foreground area-visit check running');
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (__DEV__) console.log(`[Geofence] Foreground location: (${loc.coords.latitude.toFixed(5)}, ${loc.coords.longitude.toFixed(5)})`);
      await handleLocationUpdate(loc.coords.latitude, loc.coords.longitude);
    } catch (e) {
      // Expected when permission denied or location unavailable
      if (__DEV__) console.debug('[Geofence] Foreground area-visit check failed:', e);
    }
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


