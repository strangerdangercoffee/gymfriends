import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import type { NetInfoState } from '@react-native-community/netinfo';
import { tryLoadNetInfo } from '../services/netInfo';

export interface NetworkContextValue {
  /** True when NetInfo reports not connected OR not internet-reachable. */
  isOffline: boolean;
  /** True when NetInfo reports a network connection exists (may or may not have internet). */
  isConnected: boolean;
  /** Unix timestamp (ms) of the last time the device was online, or null if never seen online. */
  lastOnlineAt: number | null;
}

const NetworkContext = createContext<NetworkContextValue>({
  isOffline: false,
  isConnected: true,
  lastOnlineAt: null,
});

interface NetworkProviderProps {
  children: ReactNode;
}

const DEBOUNCE_MS = 1500; // avoid banner flicker on connectivity flaps

function applyNetInfoState(
  state: NetInfoState,
  setIsConnected: (v: boolean) => void,
  setIsOffline: (v: boolean) => void,
  setLastOnlineAt: (v: number | null | ((prev: number | null) => number | null)) => void
) {
  const connected = state.isConnected === true;
  const reachable = state.isInternetReachable !== false;
  const offline = !connected || !reachable;
  setIsConnected(connected);
  setIsOffline(offline);
  if (connected) setLastOnlineAt(Date.now());
}

export const NetworkProvider: React.FC<NetworkProviderProps> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [lastOnlineAt, setLastOnlineAt] = useState<number | null>(null);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingStateRef = useRef<{ connected: boolean; offline: boolean } | null>(null);

  const commitPending = () => {
    if (!pendingStateRef.current) return;
    const { connected, offline } = pendingStateRef.current;
    pendingStateRef.current = null;

    setIsConnected(connected);
    setIsOffline(offline);
    if (connected) {
      setLastOnlineAt(Date.now());
    }
  };

  const handleNetInfoChange = (state: NetInfoState) => {
    const connected = state.isConnected === true;
    const reachable = state.isInternetReachable !== false;
    const offline = !connected || !reachable;

    pendingStateRef.current = { connected, offline };

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(commitPending, DEBOUNCE_MS);
  };

  useEffect(() => {
    const NetInfo = tryLoadNetInfo();
    if (!NetInfo) {
      return;
    }

    NetInfo.fetch().then((state) => {
      applyNetInfoState(state, setIsConnected, setIsOffline, setLastOnlineAt);
    });

    const unsubscribe = NetInfo.addEventListener(handleNetInfoChange);

    return () => {
      unsubscribe();
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  return (
    <NetworkContext.Provider value={{ isOffline, isConnected, lastOnlineAt }}>
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = (): NetworkContextValue => {
  return useContext(NetworkContext);
};
