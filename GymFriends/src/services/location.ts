import * as Location from 'expo-location';
import { LocationData } from '../types';

export class LocationService {
  private static instance: LocationService;
  private watchId: Location.LocationSubscription | null = null;
  private isTracking = false;

  static getInstance(): LocationService {
    if (!LocationService.instance) {
      LocationService.instance = new LocationService();
    }
    return LocationService.instance;
  }

  async requestPermissions(): Promise<boolean> {
    try {
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      
      if (foregroundStatus !== 'granted') {
        return false;
      }

      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      
      return backgroundStatus === 'granted';
    } catch (error) {
      console.error('Error requesting location permissions:', error);
      return false;
    }
  }

  async hasPermissions(): Promise<boolean> {
    try {
      const { status: foregroundStatus } = await Location.getForegroundPermissionsAsync();
      const { status: backgroundStatus } = await Location.getBackgroundPermissionsAsync();
      
      return foregroundStatus === 'granted' && backgroundStatus === 'granted';
    } catch (error) {
      console.error('Error checking location permissions:', error);
      return false;
    }
  }

  async getCurrentLocation(): Promise<LocationData | null> {
    try {
      const hasPermissions = await this.hasPermissions();
      if (!hasPermissions) {
        throw new Error('Location permissions not granted');
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || undefined,
        timestamp: location.timestamp,
      };
    } catch (error) {
      console.error('Error getting current location:', error);
      return null;
    }
  }

  async startTracking(
    onLocationUpdate: (location: LocationData) => void,
    options: {
      accuracy?: Location.Accuracy;
      timeInterval?: number;
      distanceInterval?: number;
    } = {}
  ): Promise<void> {
    try {
      const hasPermissions = await this.hasPermissions();
      if (!hasPermissions) {
        throw new Error('Location permissions not granted');
      }

      if (this.isTracking) {
        this.stopTracking();
      }

      this.watchId = await Location.watchPositionAsync(
        {
          accuracy: options.accuracy || Location.Accuracy.High,
          timeInterval: options.timeInterval || 10000, // 10 seconds
          distanceInterval: options.distanceInterval || 10, // 10 meters
        },
        (location) => {
          const locationData: LocationData = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy || undefined,
            timestamp: location.timestamp,
          };
          onLocationUpdate(locationData);
        }
      );

      this.isTracking = true;
    } catch (error) {
      console.error('Error starting location tracking:', error);
      throw error;
    }
  }

  stopTracking(): void {
    if (this.watchId) {
      this.watchId.remove();
      this.watchId = null;
    }
    this.isTracking = false;
  }

  isCurrentlyTracking(): boolean {
    return this.isTracking;
  }

  calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  isWithinRadius(
    userLat: number,
    userLon: number,
    gymLat: number,
    gymLon: number,
    radiusMeters: number = 100
  ): boolean {
    const distance = this.calculateDistance(userLat, userLon, gymLat, gymLon);
    return distance <= radiusMeters;
  }

  async findNearbyGyms(
    userLat: number,
    userLon: number,
    gyms: Array<{ latitude: number; longitude: number; id: string }>,
    radiusMeters: number = 1000
  ): Promise<Array<{ id: string; distance: number }>> {
    const nearbyGyms = gyms
      .map((gym) => ({
        id: gym.id,
        distance: this.calculateDistance(userLat, userLon, gym.latitude, gym.longitude),
      }))
      .filter((gym) => gym.distance <= radiusMeters)
      .sort((a, b) => a.distance - b.distance);

    return nearbyGyms;
  }
}

export const locationService = LocationService.getInstance();

