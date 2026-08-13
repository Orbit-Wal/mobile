import { useEffect, useState } from "react";
import { AppState, AppStateStatus } from "react-native";

const REDACTED_STATES: ReadonlySet<AppStateStatus> = new Set(["inactive", "background"]);

export function useAppStateRedaction(): boolean {
  const [redacted, setRedacted] = useState(REDACTED_STATES.has(AppState.currentState));

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      setRedacted(REDACTED_STATES.has(nextState));
    });
    return () => subscription.remove();
  }, []);

  return redacted;
}
