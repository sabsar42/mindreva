export type HapticKind = "tap" | "success" | "warning";

interface CapacitorHaptics {
  impact?: (options: { style: "LIGHT" | "MEDIUM" | "HEAVY" }) => unknown;
  notification?: (options: {
    type: "SUCCESS" | "WARNING" | "ERROR";
  }) => unknown;
}
interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  Plugins?: { Haptics?: CapacitorHaptics };
}

/**
 * A short tap of feedback for key actions: starting or stopping a recording,
 * flipping a toggle, saving.
 *
 * In the native (Capacitor) app it uses the Haptics plugin; on supported
 * Android browsers it uses `navigator.vibrate`; everywhere else (iOS Safari,
 * desktop, server render) it quietly does nothing. The native plugin is read
 * from the global Capacitor object, so the web build needs no extra package.
 */
export function haptic(kind: HapticKind = "tap"): void {
  if (typeof window === "undefined") return;
  try {
    const capacitor = (window as unknown as { Capacitor?: CapacitorGlobal })
      .Capacitor;
    const native = capacitor?.isNativePlatform?.()
      ? capacitor.Plugins?.Haptics
      : undefined;
    if (native) {
      if (kind === "tap") void native.impact?.({ style: "LIGHT" });
      else
        void native.notification?.({
          type: kind === "success" ? "SUCCESS" : "WARNING",
        });
      return;
    }
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(
        kind === "tap" ? 10 : kind === "success" ? [10, 30, 10] : [20, 40, 20],
      );
    }
  } catch {
    // Unsupported or blocked: feedback is a nicety, never an error.
  }
}
