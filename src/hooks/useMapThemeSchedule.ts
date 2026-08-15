import { useState, useEffect, useCallback, useMemo } from 'react';
import { MapThemeMode } from '../types';

export interface MapThemeScheduleState {
  mapThemeMode: MapThemeMode;
  nightStartHour: number;
  nightEndHour: number;
  isDarkModeMap: boolean;
  isNightTime: boolean;
  currentTimeFormatted: string;
  scheduleStatusLabel: string;
  setMapThemeMode: (mode: MapThemeMode) => void;
  setNightStartHour: (hour: number) => void;
  setNightEndHour: (hour: number) => void;
  toggleMode: () => void;
  toggleLightDark: () => void;
}

export function useMapThemeSchedule(): MapThemeScheduleState {
  // Load mode from localStorage (default: 'auto')
  const [mapThemeMode, setMapThemeModeState] = useState<MapThemeMode>(() => {
    try {
      const savedMode = localStorage.getItem('ROTA_EXPRESS_MAP_THEME_MODE');
      if (savedMode === 'auto' || savedMode === 'light' || savedMode === 'dark') {
        return savedMode;
      }
      // Backward compatibility with legacy ROTA_EXPRESS_DARK_MAP
      const legacy = localStorage.getItem('ROTA_EXPRESS_DARK_MAP');
      if (legacy !== null) {
        return JSON.parse(legacy) ? 'dark' : 'light';
      }
    } catch (e) {
      console.warn('Failed to load map theme mode:', e);
    }
    return 'auto';
  });

  // Night Start Hour (default: 18 -> 18:00)
  const [nightStartHour, setNightStartHourState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('ROTA_EXPRESS_MAP_NIGHT_START');
      if (saved !== null) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 23) {
          return parsed;
        }
      }
    } catch {}
    return 18;
  });

  // Night End Hour (default: 6 -> 06:00)
  const [nightEndHour, setNightEndHourState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('ROTA_EXPRESS_MAP_NIGHT_END');
      if (saved !== null) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 23) {
          return parsed;
        }
      }
    } catch {}
    return 6;
  });

  // Current time tracker (updated every 15 seconds)
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 15000);

    return () => clearInterval(timer);
  }, []);

  // Compute if local time falls in the night interval
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  const isNightTime = useMemo(() => {
    if (nightStartHour === nightEndHour) return false;
    if (nightStartHour > nightEndHour) {
      // E.g. 18 to 6: Night is >= 18 OR < 6
      return currentHour >= nightStartHour || currentHour < nightEndHour;
    } else {
      // E.g. 20 to 23: Night is >= 20 AND < 23
      return currentHour >= nightStartHour && currentHour < nightEndHour;
    }
  }, [currentHour, nightStartHour, nightEndHour]);

  // Computed effective dark mode boolean
  const isDarkModeMap = useMemo(() => {
    if (mapThemeMode === 'dark') return true;
    if (mapThemeMode === 'light') return false;
    return isNightTime; // 'auto'
  }, [mapThemeMode, isNightTime]);

  // Synchronize HTML element dark class for entire application interface
  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (isDarkModeMap) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [isDarkModeMap]);

  // Setter with persistence
  const setMapThemeMode = useCallback((mode: MapThemeMode) => {
    setMapThemeModeState(mode);
    try {
      localStorage.setItem('ROTA_EXPRESS_MAP_THEME_MODE', mode);
      // Synchronize legacy key for components looking at it
      const computed = mode === 'dark' ? true : mode === 'light' ? false : isNightTime;
      localStorage.setItem('ROTA_EXPRESS_DARK_MAP', JSON.stringify(computed));
    } catch (e) {
      console.warn('Failed to save map theme mode:', e);
    }
  }, [isNightTime]);

  const setNightStartHour = useCallback((hour: number) => {
    const validHour = Math.max(0, Math.min(23, Math.round(hour)));
    setNightStartHourState(validHour);
    try {
      localStorage.setItem('ROTA_EXPRESS_MAP_NIGHT_START', validHour.toString());
    } catch (e) {
      console.warn('Failed to save night start hour:', e);
    }
  }, []);

  const setNightEndHour = useCallback((hour: number) => {
    const validHour = Math.max(0, Math.min(23, Math.round(hour)));
    setNightEndHourState(validHour);
    try {
      localStorage.setItem('ROTA_EXPRESS_MAP_NIGHT_END', validHour.toString());
    } catch (e) {
      console.warn('Failed to save night end hour:', e);
    }
  }, []);

  // Cycle through Auto -> Light -> Dark -> Auto
  const toggleMode = useCallback(() => {
    setMapThemeModeState((prev) => {
      let next: MapThemeMode = 'auto';
      if (prev === 'auto') {
        next = isNightTime ? 'light' : 'dark';
      } else if (prev === 'light') {
        next = 'dark';
      } else if (prev === 'dark') {
        next = 'auto';
      }
      try {
        localStorage.setItem('ROTA_EXPRESS_MAP_THEME_MODE', next);
      } catch {}
      return next;
    });
  }, [isNightTime]);

  // Simple light/dark toggle (sets manual mode)
  const toggleLightDark = useCallback(() => {
    setMapThemeModeState((prev) => {
      let next: MapThemeMode;
      if (prev === 'auto') {
        // If in auto and currently night, switch to manual light; if day, switch to manual dark
        next = isNightTime ? 'light' : 'dark';
      } else {
        next = prev === 'dark' ? 'light' : 'dark';
      }
      try {
        localStorage.setItem('ROTA_EXPRESS_MAP_THEME_MODE', next);
      } catch {}
      return next;
    });
  }, [isNightTime]);

  const pad = (n: number) => n.toString().padStart(2, '0');
  const currentTimeFormatted = `${pad(currentHour)}:${pad(currentMinute)}`;

  const scheduleStatusLabel = useMemo(() => {
    if (mapThemeMode === 'auto') {
      return isNightTime
        ? `Automático (🌙 Modo Noturno das ${pad(nightStartHour)}h às ${pad(nightEndHour)}h)`
        : `Automático (☀️ Modo Diurno das ${pad(nightEndHour)}h às ${pad(nightStartHour)}h)`;
    }
    if (mapThemeMode === 'dark') {
      return 'Manual (🌙 Fixo Escuro)';
    }
    return 'Manual (☀️ Fixo Claro)';
  }, [mapThemeMode, isNightTime, nightStartHour, nightEndHour]);

  return {
    mapThemeMode,
    nightStartHour,
    nightEndHour,
    isDarkModeMap,
    isNightTime,
    currentTimeFormatted,
    scheduleStatusLabel,
    setMapThemeMode,
    setNightStartHour,
    setNightEndHour,
    toggleMode,
    toggleLightDark,
  };
}
