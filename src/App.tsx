import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { WifiOff, Trash2, Plus, BatteryWarning } from 'lucide-react';
import { RouteStop, MapEngine, DriverLocation, GpsApp } from './types';
import { useBatteryStatus } from './hooks/useBatteryStatus';
import { useMapThemeSchedule } from './hooks/useMapThemeSchedule';
import {
  optimizeRouteTSP,
  computeRouteSummary,
  calculateRouteMetrics,
  suggestNextStopWithGemini,
} from './utils/routeOptimizer';
import { playDetourAlertSound, playCompletionSound } from './utils/audioAlerts';
import { fetchStopWeather } from './utils/weather';
import { speakNextStopAnnouncement } from './utils/voiceAnnouncement';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { MapView } from './components/MapView';
import { RealtimeTracker } from './components/RealtimeTracker';
import { GeminiModal } from './components/GeminiModal';
import { ExcelImportModal } from './components/ExcelImportModal';
import { GoogleKeyModal } from './components/GoogleKeyModal';
import { EditStopModal } from './components/EditStopModal';
import { RouteHistoryModal } from './components/RouteHistoryModal';
import { FullMapModal } from './components/FullMapModal';
import { QuickGuideModal } from './components/QuickGuideModal';
import { VoiceSettingsModal } from './components/VoiceSettingsModal';

// Sample initial Brazilian delivery stops fallback
const INITIAL_STOPS: RouteStop[] = [
  {
    id: 'stop-1',
    address: 'Av. Paulista, 1000 - Bela Vista, São Paulo - SP',
    customerName: 'Ana Silva',
    phone: '11999998888',
    notes: 'Entregar na recepção do edifício comercial',
    lat: -23.5652,
    lng: -46.6512,
    priority: 'alta',
    status: 'pendente',
  },
  {
    id: 'stop-2',
    address: 'Rua Augusta, 1500 - Consolação, São Paulo - SP',
    customerName: 'Carlos Eduardo',
    phone: '11988887777',
    notes: 'Deixar com o porteiro Sr. João',
    lat: -23.5552,
    lng: -46.6582,
    priority: 'normal',
    status: 'pendente',
  },
  {
    id: 'stop-3',
    address: 'Av. Brigadeiro Faria Lima, 2000 - Pinheiros, São Paulo - SP',
    customerName: 'Tech Solutions Ltda',
    phone: '11977776666',
    notes: 'Recebimento no 5º andar com Amanda',
    lat: -23.5782,
    lng: -46.6902,
    priority: 'normal',
    status: 'pendente',
  },
  {
    id: 'stop-4',
    address: 'Rua Cantareira, 306 - Centro, São Paulo - SP (Mercado Municipal)',
    customerName: 'Empório Central',
    phone: '11966665555',
    notes: 'Carga e descarga nos fundos',
    lat: -23.5418,
    lng: -46.6292,
    priority: 'normal',
    status: 'pendente',
  },
];

export default function App() {
  // Route Name State
  const [routeName, setRouteName] = useState<string>(() => {
    return localStorage.getItem('ROTA_EXPRESS_ROUTE_NAME') || 'Minha Rota de Entregas';
  });

  // Action Confirmation Modal state ('cancel' | 'new' | null)
  const [confirmAction, setConfirmAction] = useState<'cancel' | 'new' | null>(null);

  // LocalStorage cached stops & settings
  const [stops, setStops] = useState<RouteStop[]>(() => {
    try {
      const saved = localStorage.getItem('ROTA_EXPRESS_STOPS');
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return calculateRouteMetrics(parsed);
        }
      }
    } catch (e) {
      console.warn('Failed to load saved stops from localStorage:', e);
    }
    return calculateRouteMetrics(INITIAL_STOPS);
  });

  const [mapEngine, setMapEngine] = useState<MapEngine>(() => {
    return (localStorage.getItem('ROTA_EXPRESS_MAP_ENGINE') as MapEngine) || 'leaflet';
  });

  // Map Theme & Automatic Local-Time Schedule Manager
  const {
    mapThemeMode,
    nightStartHour,
    nightEndHour,
    isDarkModeMap,
    currentTimeFormatted,
    scheduleStatusLabel,
    setMapThemeMode,
    setNightStartHour,
    setNightEndHour,
    toggleMode,
  } = useMapThemeSchedule();

  const [isNavigationMode, setIsNavigationMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('ROTA_EXPRESS_NAV_MODE');
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  // Preferred GPS App ('google' | 'waze') state
  const [defaultGpsApp, setDefaultGpsApp] = useState<GpsApp>(() => {
    return (localStorage.getItem('ROTA_EXPRESS_DEFAULT_GPS') as GpsApp) || 'google';
  });

  const battery = useBatteryStatus();

  useEffect(() => {
    try {
      localStorage.setItem('ROTA_EXPRESS_DEFAULT_GPS', defaultGpsApp);
    } catch (err) {
      console.warn('Could not save GPS preference:', err);
    }
  }, [defaultGpsApp]);

  // Weather query effect for stops with coordinates
  useEffect(() => {
    let active = true;
    const loadWeather = async () => {
      let changed = false;
      const updatedStops = await Promise.all(
        stops.map(async (stop) => {
          if (stop.lat !== undefined && stop.lng !== undefined && !stop.weather) {
            const w = await fetchStopWeather(stop.lat, stop.lng);
            if (w) {
              changed = true;
              return { ...stop, weather: w };
            }
          }
          return stop;
        })
      );
      if (active && changed) {
        setStops(updatedStops);
      }
    };

    if (stops.some((s) => s.lat !== undefined && s.lng !== undefined && !s.weather)) {
      loadWeather();
    }

    return () => {
      active = false;
    };
  }, [stops]);

  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  // Edit stop modal state
  const [editingStop, setEditingStop] = useState<RouteStop | null>(null);

  // Gemini Smart Traffic Reorder Suggestion state
  const [smartSuggestion, setSmartSuggestion] = useState<{
    shouldReorder: boolean;
    suggestedNextStopId?: string;
    reason?: string;
    timeSavingsMin?: number;
    reorderedStopsIndices?: number[];
  } | null>(null);
  const [isAnalyzingTraffic, setIsAnalyzingTraffic] = useState(false);

  // Modals
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isGeminiModalOpen, setIsGeminiModalOpen] = useState(false);
  const [isGoogleKeyModalOpen, setIsGoogleKeyModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isFullMapOpen, setIsFullMapOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isQuickGuideOpen, setIsQuickGuideOpen] = useState<boolean>(() => {
    try {
      const hasSeen = localStorage.getItem('ROTA_EXPRESS_HAS_SEEN_GUIDE');
      return hasSeen !== 'true';
    } catch (e) {
      return true;
    }
  });

  const handleLoadRouteFromHistory = (savedStops: RouteStop[], savedRouteName: string) => {
    const recalculated = calculateRouteMetrics(savedStops);
    setStops(recalculated);
    setRouteName(savedRouteName);
    setSmartSuggestion(null);
    localStorage.setItem('ROTA_EXPRESS_ROUTE_NAME', savedRouteName);
  };

  // Google Maps Key storage
  const [googleKey, setGoogleKey] = useState<string>(() => {
    return (
      process.env.GOOGLE_MAPS_PLATFORM_KEY ||
      localStorage.getItem('GOOGLE_MAPS_KEY') ||
      ''
    );
  });

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Save route name to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('ROTA_EXPRESS_ROUTE_NAME', routeName);
    } catch (err) {
      console.warn('Could not save route name to localStorage:', err);
    }
  }, [routeName]);

  // Save stops to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('ROTA_EXPRESS_STOPS', JSON.stringify(stops));
    } catch (err) {
      console.warn('Could not save stops to localStorage:', err);
    }
  }, [stops]);

  // Save map engine to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('ROTA_EXPRESS_MAP_ENGINE', mapEngine);
    } catch (err) {
      console.warn('Could not save map engine preference:', err);
    }
  }, [mapEngine]);

  // Save dark mode map state
  useEffect(() => {
    try {
      localStorage.setItem('ROTA_EXPRESS_DARK_MAP', JSON.stringify(isDarkModeMap));
    } catch (err) {
      console.warn('Could not save dark map preference:', err);
    }
  }, [isDarkModeMap]);

  // Save navigation mode state
  useEffect(() => {
    try {
      localStorage.setItem('ROTA_EXPRESS_NAV_MODE', JSON.stringify(isNavigationMode));
    } catch (err) {
      console.warn('Could not save nav mode preference:', err);
    }
  }, [isNavigationMode]);

  const handleSaveGoogleKey = (key: string) => {
    setGoogleKey(key);
    localStorage.setItem('GOOGLE_MAPS_KEY', key);
  };

  // Route Metrics Summary
  const routeSummary = useMemo(() => computeRouteSummary(stops), [stops]);

  // Add stop
  const handleAddStop = (newStop: Partial<RouteStop>) => {
    const created: RouteStop = {
      id: `stop-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      address: newStop.address || 'Novo Endereço',
      customerName: newStop.customerName,
      phone: newStop.phone,
      notes: newStop.notes,
      priority: newStop.priority || 'normal',
      lat: newStop.lat,
      lng: newStop.lng,
      status: 'pendente',
    };

    setStops((prev) => calculateRouteMetrics([...prev, created]));
  };

  // Save edited stop
  const handleSaveUpdatedStop = (updated: RouteStop) => {
    setStops((prev) => {
      const updatedStops = prev.map((s) => (s.id === updated.id ? updated : s));
      return calculateRouteMetrics(updatedStops);
    });
  };

  // Update stop GPS location (e.g. from map pin dragging)
  const handleUpdateStopLocation = (id: string, lat: number, lng: number) => {
    setStops((prev) => {
      const updatedStops = prev.map((s) => (s.id === id ? { ...s, lat, lng } : s));
      return calculateRouteMetrics(updatedStops);
    });
  };

  // Remove stop
  const handleRemoveStop = (id: string) => {
    setStops((prev) => calculateRouteMetrics(prev.filter((s) => s.id !== id)));
  };

  // Reorder stop manually
  const handleReorderStop = (index: number, direction: 'up' | 'down') => {
    setStops((prev) => {
      const updated = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= updated.length) return prev;

      const temp = updated[index];
      updated[index] = updated[targetIndex];
      updated[targetIndex] = temp;

      return calculateRouteMetrics(updated);
    });
  };

  // Optimize TSP Nearest Neighbor
  const handleOptimizeTSP = () => {
    const startPos = driverLocation ? { lat: driverLocation.lat, lng: driverLocation.lng } : undefined;
    const optimized = optimizeRouteTSP(stops, startPos);
    setStops(optimized);
  };

  // Request GPS Location and Optimize from current driver position
  const handleOptimizeFromGps = () => {
    if (navigator.geolocation) {
      setIsSearching(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const newLoc: DriverLocation = {
            lat: latitude,
            lng: longitude,
            updatedAt: new Date().toISOString(),
          };
          setDriverLocation(newLoc);
          const optimized = optimizeRouteTSP(stops, { lat: latitude, lng: longitude });
          setStops(optimized);
          setIsSearching(false);
        },
        (error) => {
          console.warn('Geolocation error:', error);
          handleOptimizeTSP();
          setIsSearching(false);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      handleOptimizeTSP();
    }
  };

  // Apply Gemini AI Order
  const handleApplyAIOrder = (newOrder: number[]) => {
    setStops((prev) => {
      if (!newOrder || newOrder.length === 0) return prev;
      const reordered: RouteStop[] = [];
      newOrder.forEach((idx) => {
        if (prev[idx]) {
          reordered.push(prev[idx]);
        }
      });
      // Append any missing ones
      prev.forEach((s, idx) => {
        if (!newOrder.includes(idx)) {
          reordered.push(s);
        }
      });
      return calculateRouteMetrics(reordered);
    });
  };

  // Import stops from Excel (REPLACES existing stops so no leftover/ghost addresses remain on the map)
  const handleImportExcelStops = (newStops: RouteStop[], suggestedRouteName?: string) => {
    setStops(calculateRouteMetrics(newStops));
    if (suggestedRouteName && suggestedRouteName.trim()) {
      setRouteName(suggestedRouteName.trim());
    }
    setSmartSuggestion(null);
  };

  // Analyze speed and traffic with Gemini AI for smart next stop suggestions
  const handleAnalyzeTrafficAndSuggest = async () => {
    setIsAnalyzingTraffic(true);
    const loc = driverLocation ? { lat: driverLocation.lat, lng: driverLocation.lng } : undefined;
    const speed = driverLocation?.speed;
    const res = await suggestNextStopWithGemini(stops, loc, speed);
    setIsAnalyzingTraffic(false);
    if (res.shouldReorder) {
      setSmartSuggestion(res);
      // Play Web Audio sound alert to notify driver immediately in traffic
      playDetourAlertSound();
    } else {
      setSmartSuggestion(null);
    }
  };

  // Accept and apply smart detour recommendation
  const handleAcceptSmartSuggestion = () => {
    if (smartSuggestion && smartSuggestion.suggestedNextStopId) {
      const targetStop = stops.find((s) => s.id === smartSuggestion.suggestedNextStopId);
      if (targetStop) {
        // Announce out loud via Web Speech API (SpeechSynthesis)
        speakNextStopAnnouncement(
          targetStop.customerName,
          targetStop.address,
          smartSuggestion.reason
        );
      }

      setStops((prev) => {
        const pending = prev.filter((s) => s.status === 'pendente' || s.status === 'em_transito');
        const completed = prev.filter((s) => s.status === 'concluido' || s.status === 'falha');

        const targetIndex = pending.findIndex((s) => s.id === smartSuggestion.suggestedNextStopId);
        if (targetIndex > 0) {
          const targetStop = pending.splice(targetIndex, 1)[0];
          pending.unshift(targetStop);
        }
        return calculateRouteMetrics([...completed, ...pending]);
      });
    }
    setSmartSuggestion(null);
  };

  // Update stop status & calculate dwell time log
  const handleUpdateStopStatus = (id: string, status: RouteStop['status']) => {
    const nowIso = new Date().toISOString();

    if (status === 'concluido') {
      playCompletionSound();
    }

    setStops((prev) => {
      const updated = prev.map((s) => {
        if (s.id === id) {
          let arrivedAt = s.arrivedAt;
          let completedAt = s.completedAt;
          let actualDwellTimeMin = s.actualDwellTimeMin;

          if (status === 'em_transito' && !arrivedAt) {
            arrivedAt = nowIso;
          }

          if (status === 'concluido' || status === 'falha') {
            completedAt = nowIso;
            if (!arrivedAt) {
              // Assume default arrival 4-6 minutes prior if not explicitly set
              arrivedAt = new Date(Date.now() - 4 * 60 * 1000).toISOString();
              actualDwellTimeMin = s.plannedDwellTimeMin || 4;
            } else {
              const startMs = new Date(arrivedAt).getTime();
              const endMs = new Date(nowIso).getTime();
              actualDwellTimeMin = Math.max(1, Math.round((endMs - startMs) / (1000 * 60)));
            }
          }

          return {
            ...s,
            status,
            arrivedAt,
            completedAt,
            actualDwellTimeMin,
          };
        }
        return s;
      });
      return calculateRouteMetrics(updated);
    });
  };

  // Execute cancel route
  const executeCancelRoute = () => {
    setStops([]);
    setRouteName('Nova Rota');
    setSmartSuggestion(null);
    localStorage.setItem('ROTA_EXPRESS_STOPS', JSON.stringify([]));
    setConfirmAction(null);
  };

  // Execute create new route
  const executeCreateNewRoute = () => {
    setStops([]);
    setRouteName(`Nova Rota ${new Date().toLocaleDateString('pt-BR')}`);
    setSmartSuggestion(null);
    localStorage.setItem('ROTA_EXPRESS_STOPS', JSON.stringify([]));
    setConfirmAction(null);
  };

  // Cancel current active route button click
  const handleCancelRoute = () => {
    if (stops.length > 0) {
      setConfirmAction('cancel');
    } else {
      executeCancelRoute();
    }
  };

  // Create new blank route button click
  const handleCreateNewRoute = () => {
    if (stops.length > 0) {
      setConfirmAction('new');
    } else {
      executeCreateNewRoute();
    }
  };

  // Reset entire route
  const handleResetRoute = () => {
    handleCancelRoute();
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col font-sans text-slate-800 antialiased selection:bg-blue-500 selection:text-white">
      {/* Header */}
      <Header
        routeName={routeName}
        onUpdateRouteName={setRouteName}
        mapEngine={mapEngine}
        setMapEngine={setMapEngine}
        isNavigationMode={isNavigationMode}
        setIsNavigationMode={setIsNavigationMode}
        isDarkModeMap={isDarkModeMap}
        mapThemeMode={mapThemeMode}
        scheduleStatusLabel={scheduleStatusLabel}
        onToggleDarkModeMap={toggleMode}
        onOpenExcelImport={() => setIsExcelModalOpen(true)}
        onOpenGeminiModal={() => setIsGeminiModalOpen(true)}
        onOpenGoogleKeyModal={() => setIsGoogleKeyModalOpen(true)}
        onOpenHistoryModal={() => setIsHistoryModalOpen(true)}
        onOpenFullMap={() => setIsFullMapOpen(true)}
        onOpenQuickGuide={() => setIsQuickGuideOpen(true)}
        onOpenVoiceModal={() => setIsVoiceModalOpen(true)}
        stops={stops}
        routeSummary={routeSummary}
        onResetRoute={handleResetRoute}
        hasGoogleKey={Boolean(googleKey)}
        onCreateNewRoute={handleCreateNewRoute}
        onCancelRoute={handleCancelRoute}
      />

      {/* Offline Status Bar Warning Banner */}
      {!isOnline && (
        <div className="bg-amber-950/90 text-amber-200 px-4 py-2 text-xs font-bold flex items-center justify-center gap-2 border-b border-amber-800/50 backdrop-blur-md z-30 shadow-md">
          <WifiOff className="w-4 h-4 text-amber-400 animate-pulse shrink-0" />
          <span>Sem conexão com a internet. Modo Offline Ativo: Todas as suas paradas e estado do mapa estão armazenados localmente!</span>
        </div>
      )}

      {/* Driver Low Battery Warning Banner (< 20%) */}
      {battery.isLowBattery && (
        <div className="bg-rose-950/95 text-rose-100 px-4 py-2 text-xs font-bold flex items-center justify-center gap-2 border-b border-rose-700 backdrop-blur-md z-30 shadow-lg animate-pulse">
          <BatteryWarning className="w-4 h-4 text-rose-400 shrink-0" />
          <span>
            <strong>ALERTA DE BATERIA CRÍTICA ({battery.level}%):</strong> Conecte o carregador ao veículo para evitar o desligamento do celular e a perda de navegação GPS em rota.
          </span>
        </div>
      )}

      {/* Smooth Animated Navigation Mode HUD Banner */}
      <AnimatePresence mode="wait">
        {isNavigationMode && (
          <motion.div
            key="realtime-tracker"
            initial={{ opacity: 0, height: 0, y: -20 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -20 }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <RealtimeTracker
              stops={stops}
              onUpdateStopStatus={handleUpdateStopStatus}
              driverLocation={driverLocation}
              setDriverLocation={setDriverLocation}
              onExitNavigation={() => setIsNavigationMode(false)}
              summary={routeSummary}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main App Grid Area */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Sidebar */}
        <Sidebar
          routeName={routeName}
          onUpdateRouteName={setRouteName}
          stops={stops}
          onAddStop={handleAddStop}
          onRemoveStop={handleRemoveStop}
          onEditStop={setEditingStop}
          onReorderStop={handleReorderStop}
          onOptimizeTSP={handleOptimizeTSP}
          onOptimizeFromGps={handleOptimizeFromGps}
          onOpenGeminiModal={() => setIsGeminiModalOpen(true)}
          onOpenExcelImport={() => setIsExcelModalOpen(true)}
          onOpenHistoryModal={() => setIsHistoryModalOpen(true)}
          onOpenVoiceModal={() => setIsVoiceModalOpen(true)}
          onUpdateStopStatus={handleUpdateStopStatus}
          routeSummary={routeSummary}
          driverLocation={driverLocation}
          isSearching={isSearching}
          setIsSearching={setIsSearching}
          onCreateNewRoute={handleCreateNewRoute}
          onCancelRoute={handleCancelRoute}
          defaultGpsApp={defaultGpsApp}
          onUpdateGpsApp={setDefaultGpsApp}
          mapThemeMode={mapThemeMode}
          onUpdateMapThemeMode={setMapThemeMode}
          nightStartHour={nightStartHour}
          onUpdateNightStartHour={setNightStartHour}
          nightEndHour={nightEndHour}
          onUpdateNightEndHour={setNightEndHour}
          currentTimeFormatted={currentTimeFormatted}
          scheduleStatusLabel={scheduleStatusLabel}
          isDarkModeMap={isDarkModeMap}
        />

        {/* Map View Canvas */}
        <MapView
          stops={stops}
          mapEngine={mapEngine}
          driverLocation={driverLocation}
          isDarkModeMap={isDarkModeMap}
          mapThemeMode={mapThemeMode}
          scheduleStatusLabel={scheduleStatusLabel}
          onToggleDarkModeMap={toggleMode}
          onOpenGoogleKeyModal={() => setIsGoogleKeyModalOpen(true)}
          hasGoogleKey={Boolean(googleKey)}
          onUpdateStopLocation={handleUpdateStopLocation}
          smartSuggestion={smartSuggestion}
          onAcceptSmartSuggestion={handleAcceptSmartSuggestion}
          onDismissSmartSuggestion={() => setSmartSuggestion(null)}
          isAnalyzingTraffic={isAnalyzingTraffic}
          onAnalyzeTraffic={handleAnalyzeTrafficAndSuggest}
          onOpenFullMap={() => setIsFullMapOpen(true)}
        />
      </div>

      {/* Modals */}
      <FullMapModal
        isOpen={isFullMapOpen}
        stops={stops}
        routeName={routeName}
        routeSummary={routeSummary}
        driverLocation={driverLocation}
        isDarkModeMap={isDarkModeMap}
        mapThemeMode={mapThemeMode}
        scheduleStatusLabel={scheduleStatusLabel}
        onToggleDarkModeMap={toggleMode}
        onClose={() => setIsFullMapOpen(false)}
        onUpdateStopLocation={handleUpdateStopLocation}
        onEditStop={(stop) => setEditingStop(stop)}
        onSaveUpdatedStop={handleSaveUpdatedStop}
      />
      <EditStopModal
        isOpen={Boolean(editingStop)}
        stop={editingStop}
        onClose={() => setEditingStop(null)}
        onSave={handleSaveUpdatedStop}
      />

      <GeminiModal
        isOpen={isGeminiModalOpen}
        onClose={() => setIsGeminiModalOpen(false)}
        stops={stops}
        onApplyAIOrder={handleApplyAIOrder}
      />

      <ExcelImportModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        onImportStops={handleImportExcelStops}
        setIsSearching={setIsSearching}
        currentStops={stops}
        summary={routeSummary}
      />

      <GoogleKeyModal
        isOpen={isGoogleKeyModalOpen}
        onClose={() => setIsGoogleKeyModalOpen(false)}
        apiKey={googleKey}
        onSaveKey={handleSaveGoogleKey}
      />

      <RouteHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        currentStops={stops}
        currentRouteName={routeName}
        onLoadRoute={handleLoadRouteFromHistory}
      />

      <QuickGuideModal
        isOpen={isQuickGuideOpen}
        onClose={() => setIsQuickGuideOpen(false)}
      />

      <VoiceSettingsModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
      />

      {/* Confirmation Modal for Cancel or New Route */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 text-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-800 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/30">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-extrabold text-lg text-white">
                {confirmAction === 'cancel' ? 'Cancelar Rota Atual?' : 'Iniciar Nova Rota?'}
              </h3>
              <p className="text-xs text-slate-300 font-medium leading-relaxed">
                {confirmAction === 'cancel'
                  ? 'Todas as paradas do itinerário atual serão limpas. Deseja continuar?'
                  : 'A rota atual será limpa para você iniciar um novo itinerário em branco.'}
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="flex-1 py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 transition-all"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={confirmAction === 'cancel' ? executeCancelRoute : executeCreateNewRoute}
                className="flex-1 py-2.5 px-3 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-extrabold text-xs rounded-xl shadow-md transition-all"
              >
                {confirmAction === 'cancel' ? 'Sim, Cancelar' : 'Sim, Nova Rota'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
