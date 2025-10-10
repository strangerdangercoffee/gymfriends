import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import * as Location from 'expo-location';
import { locationService } from '../services/location';
import { geofencingService } from '../services/geofencing';
import { LocationData, LocationContextType, Gym } from '../types';

const LocationContext = createContext<LocationContextType | undefined>(undefined);

interface LocationProviderProps {
  children: ReactNode;
}

export const LocationProvider: React.FC<LocationProviderProps> = ({ children }) => {
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [isGeofencingActive, setIsGeofencingActive] = useState(false);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [hasBackgroundPermission, setHasBackgroundPermission] = useState(false);

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    const permissions = await locationService.hasPermissions();
    setHasPermissions(permissions);
    
    // Check background permission separately
    const { status } = await Location.getBackgroundPermissionsAsync();
    setHasBackgroundPermission(status === 'granted');
  };

  const requestPermissions = async (): Promise<boolean> => {
    try {
      const granted = await locationService.requestPermissions();
      setHasPermissions(granted);
      
      // Update background permission status
      const { status } = await Location.getBackgroundPermissionsAsync();
      setHasBackgroundPermission(status === 'granted');
      
      return granted;
    } catch (error) {
      console.error('Error requesting location permissions:', error);
      return false;
    }
  };

  const startTracking = async (): Promise<void> => {
    try {
      if (!hasPermissions) {
        const granted = await requestPermissions();
        if (!granted) {
          throw new Error('Location permissions not granted');
        }
      }

      await locationService.startTracking((location) => {
        setCurrentLocation(location);
      });

      setIsTracking(true);

      // Get initial location
      const initialLocation = await locationService.getCurrentLocation();
      if (initialLocation) {
        setCurrentLocation(initialLocation);
      }
    } catch (error) {
      console.error('Error starting location tracking:', error);
      throw error;
    }
  };

  const stopTracking = (): void => {
    locationService.stopTracking();
    setIsTracking(false);
  };

  const startGeofencing = async (userId: string, followedGyms: Gym[]): Promise<void> => {
    try {
      if (!hasBackgroundPermission) {
        const granted = await requestPermissions();
        if (!granted) {
          throw new Error('Background location permission not granted');
        }
      }

      await geofencingService.startGeofencing(userId, followedGyms);
      setIsGeofencingActive(true);
    } catch (error) {
      console.error('Error starting geofencing:', error);
      throw error;
    }
  };

  const stopGeofencing = async (): Promise<void> => {
    try {
      await geofencingService.stopGeofencing();
      setIsGeofencingActive(false);
    } catch (error) {
      console.error('Error stopping geofencing:', error);
      throw error;
    }
  };

  const value: LocationContextType = {
    currentLocation,
    isTracking,
    isGeofencingActive,
    startTracking,
    stopTracking,
    startGeofencing,
    stopGeofencing,
    requestPermissions,
    hasPermissions,
    hasBackgroundPermission,
  };

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = (): LocationContextType => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};

