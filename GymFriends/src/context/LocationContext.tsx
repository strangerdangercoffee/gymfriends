import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { locationService } from '../services/location';
import { LocationData, LocationContextType } from '../types';

const LocationContext = createContext<LocationContextType | undefined>(undefined);

interface LocationProviderProps {
  children: ReactNode;
}

export const LocationProvider: React.FC<LocationProviderProps> = ({ children }) => {
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [hasPermissions, setHasPermissions] = useState(false);

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    const permissions = await locationService.hasPermissions();
    setHasPermissions(permissions);
  };

  const requestPermissions = async (): Promise<boolean> => {
    try {
      const granted = await locationService.requestPermissions();
      setHasPermissions(granted);
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

  const value: LocationContextType = {
    currentLocation,
    isTracking,
    startTracking,
    stopTracking,
    requestPermissions,
    hasPermissions,
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

