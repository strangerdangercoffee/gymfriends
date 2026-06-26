import type { NetInfoState } from '@react-native-community/netinfo';

export type NetInfoApi = {
  fetch: () => Promise<NetInfoState>;
  addEventListener: (listener: (state: NetInfoState) => void) => () => void;
};

/**
 * Lazy-load NetInfo so a missing native module (stale dev client) does not crash at import time.
 * Returns null when RNCNetInfo is not linked — rebuild with `npx expo run:ios`.
 */
export function tryLoadNetInfo(): NetInfoApi | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-community/netinfo') as NetInfoApi;
    return mod;
  } catch (error) {
    if (__DEV__) {
      console.warn(
        '[Network] NetInfo native module unavailable — assuming online. Rebuild the dev client: npx expo run:ios',
        error
      );
    }
    return null;
  }
}
