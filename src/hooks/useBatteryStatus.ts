import { useState, useEffect } from 'react';

export interface BatteryState {
  level: number; // 0 to 100
  charging: boolean;
  isSupported: boolean;
  isLowBattery: boolean; // level <= 20 and not charging
}

export function useBatteryStatus(): BatteryState {
  const [batteryState, setBatteryState] = useState<BatteryState>({
    level: 100,
    charging: true,
    isSupported: false,
    isLowBattery: false,
  });

  useEffect(() => {
    let batteryObj: any = null;

    const handleUpdate = () => {
      if (!batteryObj) return;
      const level = Math.round((batteryObj.level ?? 1) * 100);
      const charging = Boolean(batteryObj.charging);
      setBatteryState({
        level,
        charging,
        isSupported: true,
        isLowBattery: level <= 20 && !charging,
      });
    };

    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      (navigator as any)
        .getBattery()
        .then((b: any) => {
          batteryObj = b;
          handleUpdate();

          b.addEventListener('levelchange', handleUpdate);
          b.addEventListener('chargingchange', handleUpdate);
        })
        .catch((err: any) => {
          console.warn('Battery status API not accessible:', err);
        });
    }

    return () => {
      if (batteryObj) {
        try {
          batteryObj.removeEventListener('levelchange', handleUpdate);
          batteryObj.removeEventListener('chargingchange', handleUpdate);
        } catch (_) {}
      }
    };
  }, []);

  return batteryState;
}
