import { afterEach, describe, expect, it, vi } from "vitest";
import { haptic } from "../../../packages/ui/src/lib/haptics";

afterEach(() => vi.unstubAllGlobals());

describe("haptic", () => {
  it("does nothing during server render", () => {
    expect(() => haptic("tap")).not.toThrow();
  });

  it("vibrates 10ms for a tap on browsers that support it", () => {
    const vibrate = vi.fn();
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", { vibrate });
    haptic("tap");
    expect(vibrate).toHaveBeenCalledWith(10);
  });

  it("uses a short pattern for success", () => {
    const vibrate = vi.fn();
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", { vibrate });
    haptic("success");
    expect(vibrate).toHaveBeenCalledWith([10, 30, 10]);
  });

  it("does nothing where vibration is unsupported (iOS Safari, desktop)", () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", {});
    expect(() => haptic("tap")).not.toThrow();
  });

  it("never throws if the browser blocks vibration", () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", {
      vibrate: () => {
        throw new Error("blocked");
      },
    });
    expect(() => haptic("tap")).not.toThrow();
  });

  it("prefers the native Capacitor plugin when running in the app", () => {
    const impact = vi.fn();
    const notification = vi.fn();
    const vibrate = vi.fn();
    vi.stubGlobal("window", {
      Capacitor: {
        isNativePlatform: () => true,
        Plugins: { Haptics: { impact, notification } },
      },
    });
    vi.stubGlobal("navigator", { vibrate });
    haptic("tap");
    haptic("success");
    expect(impact).toHaveBeenCalledWith({ style: "LIGHT" });
    expect(notification).toHaveBeenCalledWith({ type: "SUCCESS" });
    expect(vibrate).not.toHaveBeenCalled();
  });

  it("falls back to the browser when Capacitor is only a web shim", () => {
    const vibrate = vi.fn();
    vi.stubGlobal("window", {
      Capacitor: { isNativePlatform: () => false },
    });
    vi.stubGlobal("navigator", { vibrate });
    haptic("tap");
    expect(vibrate).toHaveBeenCalledWith(10);
  });
});
