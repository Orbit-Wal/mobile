import { useEffect } from "react";
import { Alert, Platform } from "react-native";
import {
  addScreenshotListener,
  allowScreenCaptureAsync,
  preventScreenCaptureAsync,
} from "expo-screen-capture";

export function useScreenCaptureProtection(): void {
  useEffect(() => {
    void preventScreenCaptureAsync();

    const subscription =
      Platform.OS === "ios"
        ? addScreenshotListener(() => {
            Alert.alert(
              "Screenshot Detected",
              "This screen contains sensitive wallet information. Do not share screenshots containing your keys."
            );
          })
        : undefined;

    return () => {
      subscription?.remove();
      void allowScreenCaptureAsync();
    };
  }, []);
}
