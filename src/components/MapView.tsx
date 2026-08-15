import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { RouteStop, MapEngine, DriverLocation, MapThemeMode } from '../types';
import { getWazeUrl, getGoogleMapsUrl } from '../utils/routeOptimizer';
import {
  preloadMapTilesForRoute,
  getCachedTileCount,
} from '../utils/tileCacheManager';
import {
  Key,
  MapPin,
  AlertCircle,
  Moon,
  Sun,
  Download,
  Wifi,
  WifiOff,
  Sparkles,
  Zap,
  Check,
  RefreshCw,
  Maximize2,
  Maximize,
  Minimize,
} from 'lucide-react';

interface MapViewProps {
  stops: RouteStop[];
  mapEngine: MapEngine;
  driverLocation?: DriverLocation | null;
  isDarkModeMap?: boolean;
  mapThemeMode?: MapThemeMode;
  scheduleStatusLabel?: string;
  onToggleDarkModeMap?: () => void;
  onOpenGoogleKeyModal: () => void;
  hasGoogleKey: boolean;
  onUpdateStopLocation?: (id: string, lat: number, lng: number) => void;
  smartSuggestion?: {
    shouldReorder: boolean;
    suggestedNextStopId?: string;
    reason?: string;
    timeSavingsMin?: number;
    reorderedStopsIndices?: number[];
  } | null;
  onAcceptSmartSuggestion?: () => void;
  onDismissSmartSuggestion?: () => void;
  isAnalyzingTraffic?: boolean;
  onAnalyzeTraffic?: () => void;
  onOpenFullMap?: () => void;
}

export const MapView: React.FC<MapViewProps> = ({
  stops,
  mapEngine,
  driverLocation,
  isDarkModeMap = false,
  mapThemeMode = 'auto',
  scheduleStatusLabel = '',
  onToggleDarkModeMap,
  onOpenGoogleKeyModal,
  hasGoogleKey,
  onUpdateStopLocation,
  smartSuggestion,
  onAcceptSmartSuggestion,
  onDismissSmartSuggestion,
  isAnalyzingTraffic,
  onAnalyzeTraffic,
  onOpenFullMap,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapWrapperRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);

  // Fullscreen API State & Handlers
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFull = Boolean(
        document.fullscreenElement ||
          (document as any).webkitFullscreenElement ||
          (document as any).mozFullScreenElement ||
          (document as any).msFullscreenElement
      );
      setIsFullscreen(isFull);
      if (leafletMapRef.current) {
        setTimeout(() => leafletMapRef.current?.invalidateSize(), 200);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    const elem = mapWrapperRef.current || document.documentElement;

    if (!isFullscreen) {
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(() => setIsFullscreen(true));
      } else if ((elem as any).webkitRequestFullscreen) {
        (elem as any).webkitRequestFullscreen();
      } else if ((elem as any).mozRequestFullScreen) {
        (elem as any).mozRequestFullScreen();
      } else if ((elem as any).msRequestFullscreen) {
        (elem as any).msRequestFullscreen();
      } else {
        setIsFullscreen(true);
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => setIsFullscreen(false));
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        (document as any).mozCancelFullScreen();
      } else if ((document as any).msExitFullscreen) {
        (document as any).msExitFullscreen();
      } else {
        setIsFullscreen(false);
      }
    }

    setTimeout(() => {
      if (leafletMapRef.current) {
        leafletMapRef.current.invalidateSize();
      }
    }, 250);
  };

  // Offline Tile Cache State
  const [cachedTileCount, setCachedTileCount] = useState<number>(0);
  const [isCachingTiles, setIsCachingTiles] = useState<boolean>(false);
  const [cacheProgress, setCacheProgress] = useState<{ downloaded: number; total: number } | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // Tile URL based on dark mode preference
  const tileUrl = isDarkModeMap
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  const tileAttribution = isDarkModeMap
    ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
    : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  // Monitor Online / Offline Network Status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    getCachedTileCount().then(setCachedTileCount);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Handle ResizeObserver to fix Leaflet map container zero-height / cut-off tiles bug
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const observer = new ResizeObserver(() => {
      if (leafletMapRef.current) {
        leafletMapRef.current.invalidateSize();
      }
    });

    observer.observe(mapContainerRef.current);

    return () => observer.disconnect();
  }, []);

  // Initialize and update Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!leafletMapRef.current) {
      // Default initial center: Brazil general view
      const map = L.map(mapContainerRef.current, {
        center: [-14.235, -51.925],
        zoom: 4,
        zoomControl: false,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Clean, fast tile layer with offline fallback
      const tileLayer = L.tileLayer(tileUrl, {
        attribution: tileAttribution,
        maxZoom: 19,
        crossOrigin: true,
      }).addTo(map);

      tileLayerRef.current = tileLayer;
      markersLayerRef.current = L.layerGroup().addTo(map);
      leafletMapRef.current = map;

      // Invalidate size shortly after mounting to fix layout shifts
      setTimeout(() => {
        map.invalidateSize();
      }, 250);
    } else if (tileLayerRef.current) {
      // Update tile layer URL on dark mode toggle
      tileLayerRef.current.setUrl(tileUrl);
    }

    const map = leafletMapRef.current;
    const markersLayer = markersLayerRef.current;

    if (markersLayer) {
      markersLayer.clearLayers();
    }
    if (routePolylineRef.current) {
      routePolylineRef.current.remove();
      routePolylineRef.current = null;
    }

    // Filter valid stops with lat & lng
    const validStops = stops.filter((s) => s.lat !== undefined && s.lng !== undefined);
    const coordinates: L.LatLngExpression[] = [];

    // Find next pending stop to apply pulse animation
    const nextTargetStop = validStops.find((s) => s.status === 'pendente' || s.status === 'em_transito');

    // Add driver position marker if available
    if (driverLocation) {
      const driverPos: L.LatLngExpression = [driverLocation.lat, driverLocation.lng];
      coordinates.push(driverPos);

      const driverIcon = L.divIcon({
        className: 'custom-driver-pin',
        html: `<div class="relative flex items-center justify-center">
                 <span class="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-cyan-400 opacity-75"></span>
                 <div class="relative w-8 h-8 bg-cyan-500 rounded-full border-2 border-white text-slate-950 flex items-center justify-center shadow-lg font-black text-xs">
                   🚗
                 </div>
               </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      L.marker(driverPos, { icon: driverIcon })
        .bindPopup(`<b>Sua Posição Atual (GPS)</b><br/>Velocidade: ${driverLocation.speed ? Math.round(driverLocation.speed) + ' km/h' : '0 km/h'}<br/>Atualizado: ${new Date(driverLocation.updatedAt).toLocaleTimeString('pt-BR')}`)
        .addTo(markersLayer!);
    }

    // Add Stop markers
    validStops.forEach((stop, idx) => {
      const pos: L.LatLngExpression = [stop.lat!, stop.lng!];
      coordinates.push(pos);

      const isStart = idx === 0;
      const isEnd = idx === validStops.length - 1;
      const isCompleted = stop.status === 'concluido';
      const isNextTarget = nextTargetStop && stop.id === nextTargetStop.id;
      const isSuggestedNext = smartSuggestion?.suggestedNextStopId === stop.id;

      let bgColor = 'bg-blue-600';
      if (isCompleted) bgColor = 'bg-slate-500';
      else if (isSuggestedNext) bgColor = 'bg-gradient-to-tr from-amber-400 to-yellow-400 text-slate-950 font-black';
      else if (isNextTarget) bgColor = 'bg-gradient-to-tr from-cyan-400 to-emerald-400 text-slate-950 font-black';
      else if (isStart) bgColor = 'bg-emerald-600';
      else if (isEnd) bgColor = 'bg-rose-600';

      let markerHtml = '';

      if (isSuggestedNext) {
        // High visibility glowing amber marker for AI suggested detour stop
        markerHtml = `
          <div class="relative flex items-center justify-center">
            <span class="animate-ping absolute inline-flex h-12 w-12 rounded-full bg-amber-400 opacity-90"></span>
            <div class="relative w-9 h-9 ${bgColor} text-slate-950 font-black rounded-full border-2 border-white flex items-center justify-center shadow-2xl text-xs ring-4 ring-amber-400/60">
              💡 ${idx + 1}
            </div>
          </div>
        `;
      } else if (isNextTarget) {
        // High visibility pulse animation for the NEXT stop on route
        markerHtml = `
          <div class="relative flex items-center justify-center">
            <span class="animate-ping absolute inline-flex h-10 w-10 rounded-full bg-cyan-400 opacity-80"></span>
            <div class="relative w-8 h-8 ${bgColor} text-slate-950 font-black rounded-full border-2 border-white flex items-center justify-center shadow-xl text-xs ring-4 ring-cyan-400/50">
              ${idx + 1}
            </div>
          </div>
        `;
      } else {
        markerHtml = `
          <div class="w-8 h-8 ${bgColor} text-white font-bold rounded-full border-2 border-white flex items-center justify-center shadow-md text-xs">
            ${idx + 1}
          </div>
        `;
      }

      const customIcon = L.divIcon({
        className: 'custom-stop-pin',
        html: markerHtml,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const wazeUrl = getWazeUrl(stop.lat!, stop.lng!);
      const googleUrl = getGoogleMapsUrl(stop.lat!, stop.lng!, stop.address);

      const popupContent = `
        <div class="p-1 max-w-xs font-sans">
          <div class="flex items-center gap-1.5 mb-1">
            <span class="px-2 py-0.5 rounded font-bold text-xs text-white ${bgColor}">Parada ${idx + 1} ${isNextTarget ? '★ PRÓXIMA' : ''}</span>
            <span class="text-xs font-semibold text-slate-500 uppercase">${stop.status}</span>
          </div>
          <p class="font-bold text-xs text-slate-800 mb-1">${stop.address}</p>
          ${stop.customerName ? `<p class="text-xs text-slate-600">👤 <b>Cliente:</b> ${stop.customerName}</p>` : ''}
          ${stop.notes ? `<p class="text-xs text-slate-500 italic mb-2">📝 ${stop.notes}</p>` : ''}
          <p class="text-[10px] text-violet-600 font-bold mb-2">💡 Arraste o pino no mapa para ajustar a localização!</p>
          <div class="flex gap-1.5 mt-2">
            <a href="${wazeUrl}" target="_blank" rel="noopener" class="px-2 py-1 bg-cyan-600 text-white rounded font-bold text-xs no-underline flex-1 text-center">🚗 Waze</a>
            <a href="${googleUrl}" target="_blank" rel="noopener" class="px-2 py-1 bg-blue-600 text-white rounded font-bold text-xs no-underline flex-1 text-center">🗺️ Maps</a>
          </div>
        </div>
      `;

      const marker = L.marker(pos, { icon: customIcon, draggable: true })
        .bindPopup(popupContent)
        .addTo(markersLayer!);

      marker.on('dragend', (e) => {
        const newLatLng = (e.target as L.Marker).getLatLng();
        if (onUpdateStopLocation) {
          onUpdateStopLocation(stop.id, newLatLng.lat, newLatLng.lng);
        }
      });
    });

    // Draw Polyline route
    if (coordinates.length > 1) {
      const polyline = L.polyline(coordinates, {
        color: isDarkModeMap ? '#38bdf8' : '#8b5cf6',
        weight: 5,
        opacity: 0.9,
        dashArray: '2, 2',
      }).addTo(map);

      routePolylineRef.current = polyline;
      map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
    } else if (coordinates.length === 1) {
      map.setView(coordinates[0], 14);
    }
  }, [stops, driverLocation, mapEngine, isDarkModeMap, smartSuggestion]);

  // Preload Offline Map Tiles Action
  const handlePreloadTiles = async () => {
    if (stops.length === 0) return;
    setIsCachingTiles(true);
    setCacheProgress({ downloaded: 0, total: 100 });

    const result = await preloadMapTilesForRoute(stops, isDarkModeMap, (downloaded, total) => {
      setCacheProgress({ downloaded, total });
    });

    setIsCachingTiles(false);
    setCacheProgress(null);

    const newCount = await getCachedTileCount();
    setCachedTileCount(newCount);
  };

  return (
    <div
      ref={mapWrapperRef}
      className={`relative w-full h-full min-h-[420px] flex-1 bg-slate-900 overflow-hidden transition-all ${
        isFullscreen ? 'fixed inset-0 z-50 w-screen h-screen' : ''
      }`}
    >
      {/* Map Engine Canvas */}
      <div ref={mapContainerRef} className="w-full h-full z-10" />

      {/* Gemini Smart Reorder Suggestion Banner Overlay */}
      {smartSuggestion && smartSuggestion.shouldReorder && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 w-11/12 max-w-xl bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 text-slate-950 p-3.5 sm:p-4 rounded-3xl shadow-2xl border-2 border-amber-300 animate-fadeIn backdrop-blur-md">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-slate-950 text-amber-300 rounded-2xl shrink-0 mt-0.5 shadow-md">
                <Sparkles className="w-5 h-5 animate-spin" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider bg-slate-950 text-amber-300 px-2 py-0.5 rounded-full">
                    💡 SUGESTÃO INTELIGENTE DE ROTA IA
                  </span>
                  {smartSuggestion.timeSavingsMin && (
                    <span className="text-[10px] font-black bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/40">
                      Economiza ~{smartSuggestion.timeSavingsMin} min
                    </span>
                  )}
                </div>
                <p className="font-extrabold text-xs sm:text-sm text-slate-950 leading-snug">
                  {smartSuggestion.reason}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-slate-950/20">
            <button
              onClick={onDismissSmartSuggestion}
              className="px-3 py-1.5 bg-slate-950/20 hover:bg-slate-950/30 text-slate-950 text-xs font-extrabold rounded-xl transition-all"
            >
              Ignorar
            </button>
            <button
              onClick={onAcceptSmartSuggestion}
              className="px-4 py-1.5 bg-slate-950 hover:bg-slate-900 text-amber-300 hover:text-white text-xs font-black rounded-xl transition-all shadow-lg flex items-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              Aplicar Reordenação Mais Rápida
            </button>
          </div>
        </div>
      )}

      {/* Floating Map Info Overlay & Controls */}
      <div className="absolute top-4 left-3 sm:left-4 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 p-2.5 sm:p-3 rounded-2xl shadow-xl flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 sm:gap-3 max-w-[calc(100vw-1.5rem)] sm:max-w-xl">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-tr from-violet-600 via-fuchsia-600 to-pink-500 text-white flex items-center justify-center font-bold text-xs shadow-md shadow-fuchsia-500/20 shrink-0">
            <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 truncate">
              <h4 className="font-extrabold text-[11px] sm:text-xs text-slate-900 dark:text-white truncate">
                {mapEngine === 'google' ? 'Google Maps' : 'OpenStreetMap'}
              </h4>
              {isOnline ? (
                <span className="flex items-center gap-1 text-[9px] sm:text-[10px] text-emerald-600 font-extrabold bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200 shrink-0">
                  <Wifi className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-600" />
                  Online
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[9px] sm:text-[10px] text-amber-600 font-extrabold bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200 shrink-0">
                  <WifiOff className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-600" />
                  Offline
                </span>
              )}
            </div>
            <p className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">
              {stops.length} paradas no trajeto
            </p>
          </div>
        </div>

        {/* Fullscreen, Night Mode & Offline Cache Controls */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 ml-auto">
          {/* Fullscreen API Toggle Button for Android, iOS & Desktop */}
          <button
            onClick={toggleFullscreen}
            className={`px-3 py-2 text-xs font-black rounded-xl transition-all shadow-md flex items-center gap-1.5 border ${
              isFullscreen
                ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-400 animate-pulse'
                : 'bg-slate-900 hover:bg-slate-800 text-white border-slate-700'
            }`}
            title={isFullscreen ? 'Sair do modo Tela Cheia' : 'Modo Tela Cheia Imersivo (Android / iOS / PWA)'}
          >
            {isFullscreen ? (
              <>
                <Minimize className="w-3.5 h-3.5 text-rose-200" />
                <span className="hidden sm:inline">Sair Fullscreen</span>
              </>
            ) : (
              <>
                <Maximize className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">Tela Cheia</span>
              </>
            )}
          </button>

          {onOpenFullMap && (
            <button
              onClick={onOpenFullMap}
              className="px-3 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-extrabold rounded-xl text-xs transition-all shadow-md flex items-center gap-1.5 ring-2 ring-violet-500/30"
              title="Abrir Mapa em Tela Cheia com edição de endereços e pinos arrastáveis"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Mapa Completo</span>
            </button>
          )}

          {onAnalyzeTraffic && (
            <button
              onClick={onAnalyzeTraffic}
              disabled={isAnalyzingTraffic}
              className="p-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-xl text-xs transition-all shadow-xs flex items-center gap-1 disabled:opacity-50"
              title="Analisar tráfego e velocidade com IA Gemini"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzingTraffic ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Tráfego IA</span>
            </button>
          )}

          {stops.length > 0 && (
            <button
              onClick={handlePreloadTiles}
              disabled={isCachingTiles}
              className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 disabled:opacity-50"
              title={`Pré-carregar mapa offline para entregas (${cachedTileCount} tiles em cache)`}
            >
              <Download className={`w-3.5 h-3.5 text-violet-600 ${isCachingTiles ? 'animate-bounce' : ''}`} />
              <span className="hidden sm:inline">
                {isCachingTiles
                  ? `${cacheProgress ? Math.round((cacheProgress.downloaded / cacheProgress.total) * 100) : 0}%`
                  : `Tiles (${cachedTileCount})`}
              </span>
            </button>
          )}

          {onToggleDarkModeMap && (
            <button
              onClick={onToggleDarkModeMap}
              className={`p-2 rounded-xl border transition-all flex items-center justify-center relative gap-1 text-xs font-bold ${
                isDarkModeMap
                  ? 'bg-indigo-950 text-indigo-300 border-indigo-700/80 hover:bg-indigo-900 shadow-xs'
                  : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
              }`}
              title={`Tema do Mapa: ${scheduleStatusLabel || (isDarkModeMap ? 'Modo Escuro' : 'Modo Claro')} (Clique para alternar)`}
            >
              {isDarkModeMap ? (
                <Moon className="w-4 h-4 text-indigo-400 fill-indigo-400" />
              ) : (
                <Sun className="w-4 h-4 text-amber-500 fill-amber-500" />
              )}
              {mapThemeMode === 'auto' && (
                <span className="absolute -top-1 -right-1 px-1 bg-violet-600 text-white text-[8px] font-black rounded-full leading-tight border border-slate-900 shadow-xs">
                  A
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Google Maps Key Banner if selected and key missing */}
      {mapEngine === 'google' && !hasGoogleKey && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 bg-slate-900/95 text-white p-4 rounded-3xl shadow-2xl border border-slate-700 max-w-md text-center backdrop-blur-md">
          <AlertCircle className="w-6 h-6 text-amber-400 mx-auto mb-2" />
          <h4 className="font-bold text-sm mb-1">Chave Google Maps Não Detectada</h4>
          <p className="text-xs text-slate-300 mb-3">
            O mapa interativo baseline com Waze e rotas está ativo via OpenStreetMap. Para ativar tiles nativos do Google Maps, insira sua chave API.
          </p>
          <button
            onClick={onOpenGoogleKeyModal}
            className="px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 mx-auto"
          >
            <Key className="w-4 h-4" />
            Inserir Google Maps API Key
          </button>
        </div>
      )}
    </div>
  );
};
