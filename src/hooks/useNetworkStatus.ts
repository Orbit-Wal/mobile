import { useEffect, useState } from "react";
import NetInfo from "@react-native-community/netinfo";

/**
 * True when the device is confirmed offline (isConnected === false).
 * Starts as false (assume online) until the first NetInfo event arrives,
 * so we don't flash an "offline" banner during normal startup.
 */
export function useIsOffline(): boolean {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(state.isConnected === false);
    });
    return unsubscribe;
  }, []);

  return isOffline;
}
