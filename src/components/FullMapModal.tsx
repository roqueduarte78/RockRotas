import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { RouteStop, DriverLocation, MapThemeMode } from '../types';
import {
  X,
  MapPin,
  Search,
  Maximize2,
  Moon,
  Sun,
  Edit3,
  RefreshCw,
  Check,
  Navigation,
  User,
  Phone,
  AlertCircle,
  Move,
  Layers,
} from 'lucide-react';
import { getWazeUrl, getGoogleMapsUrl, geocodeAddress } from '../utils/routeOptimizer';

interface FullMapModalProps {
  isOpen: boolean;
  stops: RouteStop[];
  driverLocation?: DriverLocation | null;
  isDarkModeMap?: boolean;
  mapThemeMode?: MapThemeMode;
  scheduleStatusLabel?: string;
  onToggleDarkModeMap?: () => void;
  onClose: () => void;
  onUpdateStopLocation: (id: string, lat: number, lng: number) => void;
  onEditStop: (stop: RouteStop) => void;
  onSaveUpdatedStop: (stop: RouteStop) => void;
}

export const FullMapModal: React.FC<FullMapModalProps> = ({
  isOpen,
  stops,
  driverLocation,
  isDarkModeMap = false,
  mapThemeMode = 'auto',
  scheduleStatusLabel = '',
  onToggleDarkModeMap,
  onClose,
  onUpdateStopLocation,
  onEditStop,
  onSaveUpdatedStop,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);

  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [inlineAddressText, setInlineAddressText] = useState<string>('');
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);

  const tileUrl = isDarkModeMap
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  // Selected stop object
  const selectedStop = stops.find((s) => s.id === selectedStopId) || null;

  // Handle ResizeObserver & map invalidation on open
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    const timer = setTimeout(() => {
      if (leafletMapRef.current) {
        leafletMapRef.current.invalidateSize();
        handleFitBounds();
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [isOpen]);

  // Fit bounds to show ALL stops
  const handleFitBounds = () => {
    const map = leafletMapRef.current;
    if (!map) return;

    const validStops = stops.filter((s) => s.lat !== undefined && s.lng !== undefined);
    if (validStops.length === 0) return;

    const coords: L.LatLngExpression[] = validStops.map((s) => [s.lat!, s.lng!]);
    if (driverLocation) {
      coords.push([driverLocation.lat, driverLocation.lng]);
    }

    if (coords.length > 1) {
      const bounds = L.latLngBounds(coords);
      map.fitBounds(bounds, { padding: [80, 80] });
    } else if (coords.length === 1) {
      map.setView(coords[0], 15);
    }
  };

  // Initialize and update Leaflet map inside modal
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    if (!leafletMapRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [-14.235, -51.925],
        zoom: 4,
        zoomControl: false,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      const tileLayer = L.tileLayer(tileUrl, {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
        crossOrigin: true,
      }).addTo(map);

      tileLayerRef.current = tileLayer;
      markersLayerRef.current = L.layerGroup().addTo(map);
      leafletMapRef.current = map;
    } else if (tileLayerRef.current) {
      tileLayerRef.current.setUrl(tileUrl);
    }

    const map = leafletMapRef.current;
    const markersLayer = markersLayerRef.current;

    if (markersLayer) markersLayer.clearLayers();
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    const validStops = stops.filter((s) => s.lat !== undefined && s.lng !== undefined);
    const coordinates: L.LatLngExpression[] = [];

    // Driver location marker
    if (driverLocation) {
      const driverPos: L.LatLngExpression = [driverLocation.lat, driverLocation.lng];
      coordinates.push(driverPos);

      const driverIcon = L.divIcon({
        className: 'custom-driver-pin-full',
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
        .bindPopup('<b>Sua Posição Atual (GPS)</b>')
        .addTo(markersLayer!);
    }

    // Stop markers
    validStops.forEach((stop, idx) => {
      const pos: L.LatLngExpression = [stop.lat!, stop.lng!];
      coordinates.push(pos);

      const isCompleted = stop.status === 'concluido';
      const isSelected = stop.id === selectedStopId;

      let bgColor = 'bg-blue-600';
      if (isCompleted) bgColor = 'bg-slate-500';
      else if (isSelected) bgColor = 'bg-amber-400 text-slate-950 ring-4 ring-amber-300';
      else if (idx === 0) bgColor = 'bg-emerald-600';
      else if (idx === validStops.length - 1) bgColor = 'bg-rose-600';

      const customIcon = L.divIcon({
        className: 'custom-fullmap-stop-pin',
        html: `<div class="relative group cursor-pointer">
                 <div class="w-9 h-9 ${bgColor} text-white font-black rounded-full border-2 border-white flex items-center justify-center shadow-xl text-xs transition-transform transform hover:scale-110">
                   ${idx + 1}
                 </div>
               </div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const wazeUrl = getWazeUrl(stop.lat!, stop.lng!);
      const googleUrl = getGoogleMapsUrl(stop.lat!, stop.lng!, stop.address);

      const popupHtml = `
        <div class="p-2 max-w-xs font-sans text-slate-900">
          <div class="flex items-center gap-1.5 mb-1">
            <span class="px-2 py-0.5 bg-violet-600 text-white rounded font-bold text-xs">Parada ${idx + 1}</span>
            <span class="text-[10px] font-bold text-slate-500 uppercase">${stop.status}</span>
          </div>
          <p class="font-extrabold text-xs mb-1 text-slate-800 leading-snug">${stop.address}</p>
          ${stop.customerName ? `<p class="text-xs text-slate-600 mb-1">👤 <b>${stop.customerName}</b></p>` : ''}
          <div class="p-1.5 bg-amber-50 border border-amber-200 rounded text-[10px] text-amber-900 font-bold mb-2">
            📍 <b>Mover Parada:</b> Arraste este pino no mapa para ajustar as coordenadas exatas!
          </div>
          <div class="flex gap-1">
            <a href="${wazeUrl}" target="_blank" rel="noopener" class="px-2 py-1 bg-cyan-600 text-white rounded font-bold text-xs no-underline flex-1 text-center">🚗 Waze</a>
            <a href="${googleUrl}" target="_blank" rel="noopener" class="px-2 py-1 bg-blue-600 text-white rounded font-bold text-xs no-underline flex-1 text-center">🗺️ Maps</a>
          </div>
        </div>
      `;

      const marker = L.marker(pos, { icon: customIcon, draggable: true })
        .bindPopup(popupHtml)
        .addTo(markersLayer!);

      marker.on('click', () => {
        setSelectedStopId(stop.id);
        setEditingAddressId(null);
      });

      marker.on('dragend', async (e) => {
        const newLatLng = (e.target as L.Marker).getLatLng();
        onUpdateStopLocation(stop.id, newLatLng.lat, newLatLng.lng);
        setSelectedStopId(stop.id);
        setFeedbackMessage(`📍 Posição da Parada ${idx + 1} alterada para (${newLatLng.lat.toFixed(5)}, ${newLatLng.lng.toFixed(5)})!`);
        setTimeout(() => setFeedbackMessage(null), 4000);
      });
    });

    // Draw route polyline
    if (coordinates.length > 1) {
      const polyline = L.polyline(coordinates, {
        color: isDarkModeMap ? '#38bdf8' : '#7c3aed',
        weight: 6,
        opacity: 0.9,
        dashArray: '4, 4',
      }).addTo(map);

      polylineRef.current = polyline;
    }
  }, [isOpen, stops, driverLocation, isDarkModeMap, selectedStopId]);

  if (!isOpen) return null;

  const handleSelectStopCard = (stop: RouteStop) => {
    setSelectedStopId(stop.id);
    if (stop.lat && stop.lng && leafletMapRef.current) {
      leafletMapRef.current.setView([stop.lat, stop.lng], 16);
    }
  };

  const handleStartEditingAddress = (stop: RouteStop) => {
    setEditingAddressId(stop.id);
    setInlineAddressText(stop.address);
  };

  const handleSaveInlineAddress = async (stop: RouteStop) => {
    if (!inlineAddressText.trim()) return;

    setIsGeocoding(true);
    setFeedbackMessage('Geocodificando e buscando novo local no mapa...');

    const res = await geocodeAddress(inlineAddressText.trim());
    setIsGeocoding(false);

    if (res) {
      const updated: RouteStop = {
        ...stop,
        address: res.formattedAddress,
        lat: res.lat,
        lng: res.lng,
      };
      onSaveUpdatedStop(updated);
      setEditingAddressId(null);
      setFeedbackMessage(`✅ Endereço e coordenadas atualizados no mapa!`);

      if (leafletMapRef.current) {
        leafletMapRef.current.setView([res.lat, res.lng], 16);
      }
    } else {
      // Preserve address string even if geocoding didn't find new exact coordinates
      const updated: RouteStop = {
        ...stop,
        address: inlineAddressText.trim(),
      };
      onSaveUpdatedStop(updated);
      setEditingAddressId(null);
      setFeedbackMessage(`⚠️ Endereço salvo! Não foi possível recalcular a coordenada exata automaticamente, você pode arrastar o pino no mapa.`);
    }

    setTimeout(() => setFeedbackMessage(null), 5000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col animate-fadeIn">
      {/* Top Navbar */}
      <header className="h-16 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between shrink-0 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white flex items-center justify-center font-black shadow-md">
            <Maximize2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-extrabold text-sm md:text-base text-white flex items-center gap-2">
              <span>Mapa Completo das Paradas</span>
              <span className="px-2 py-0.5 bg-violet-600/30 text-violet-300 border border-violet-500/40 rounded-full text-xs font-bold">
                {stops.length} {stops.length === 1 ? 'parada' : 'paradas'}
              </span>
            </h2>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Vizualize todas as entregas, clique para editar endereços ou arraste os pinos para reposicionar no mapa.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Fit All Bounds Button */}
          <button
            onClick={handleFitBounds}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-xs"
            title="Ver todas as paradas no mapa simultaneamente"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Centralizar Todas</span>
          </button>

          {/* Map Theme Toggle */}
          {onToggleDarkModeMap && (
            <button
              onClick={onToggleDarkModeMap}
              className={`p-2 rounded-xl border transition-all relative flex items-center justify-center ${
                isDarkModeMap
                  ? 'bg-indigo-950 text-indigo-300 border-indigo-700/80 hover:bg-indigo-900 shadow-xs'
                  : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
              }`}
              title={`Tema do Mapa: ${scheduleStatusLabel || (isDarkModeMap ? 'Modo Escuro' : 'Modo Claro')} (Clique para alternar)`}
            >
              {isDarkModeMap ? (
                <Moon className="w-4 h-4 text-indigo-400 fill-indigo-400" />
              ) : (
                <Sun className="w-4 h-4 text-amber-400" />
              )}
              {mapThemeMode === 'auto' && (
                <span className="absolute -top-1 -right-1 px-1 bg-violet-600 text-white text-[8px] font-black rounded-full leading-tight border border-slate-900 shadow-xs">
                  A
                </span>
              )}
            </button>
          )}

          {/* Toggle Sidebar Panel */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`px-3 py-1.5 font-extrabold text-xs rounded-xl border transition-all ${
              isSidebarOpen
                ? 'bg-violet-600 text-white border-violet-500 shadow-xs'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            {isSidebarOpen ? 'Esconder Lista' : 'Mostrar Lista'}
          </button>

          {/* Close Modal */}
          <button
            onClick={onClose}
            className="p-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold transition-all shadow-md ml-1"
            title="Fechar Mapa Completo"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="relative flex-1 w-full h-full overflow-hidden flex">
        {/* Leaflet Map Canvas */}
        <div ref={mapContainerRef} className="w-full h-full z-10" />

        {/* Floating Toast Notification */}
        {feedbackMessage && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 max-w-md w-11/12 bg-slate-900/95 text-white border border-violet-500/50 p-3 rounded-2xl shadow-2xl backdrop-blur-md text-xs font-bold flex items-center gap-2 animate-bounce">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="flex-1">{feedbackMessage}</span>
          </div>
        )}

        {/* Floating Side Drawer with Stops List & Inline Address Editing */}
        {isSidebarOpen && (
          <div className="absolute top-4 left-4 bottom-4 z-20 w-80 max-w-[calc(100vw-32px)] bg-slate-900/95 border border-slate-800 rounded-3xl shadow-2xl backdrop-blur-md flex flex-col overflow-hidden text-xs">
            <div className="p-3 bg-slate-800/80 border-b border-slate-700/80 flex items-center justify-between">
              <span className="font-black text-slate-200 text-xs flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-violet-400" />
                Itinerário de Paradas ({stops.length})
              </span>
              <span className="text-[10px] text-slate-400 font-bold">Arraste os pinos para mover</span>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {stops.map((stop, idx) => {
                const isSelected = stop.id === selectedStopId;
                const isEditingThis = stop.id === editingAddressId;

                return (
                  <div
                    key={stop.id}
                    onClick={() => handleSelectStopCard(stop)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-800 border-violet-500 shadow-md ring-2 ring-violet-500/40'
                        : 'bg-slate-900/80 hover:bg-slate-800/60 border-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 bg-violet-600 text-white font-black text-[11px] rounded-full flex items-center justify-center">
                          {idx + 1}
                        </span>
                        {stop.customerName && (
                          <span className="font-extrabold text-slate-200 truncate max-w-[140px]">
                            {stop.customerName}
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                        {stop.status}
                      </span>
                    </div>

                    {/* Address Text or Inline Edit Input */}
                    {isEditingThis ? (
                      <div className="space-y-1.5 my-2" onClick={(e) => e.stopPropagation()}>
                        <label className="text-[10px] font-bold text-violet-300 block">
                          Editar Endereço:
                        </label>
                        <textarea
                          value={inlineAddressText}
                          onChange={(e) => setInlineAddressText(e.target.value)}
                          rows={2}
                          className="w-full p-2 bg-slate-950 border border-violet-500 rounded-xl text-xs text-white focus:outline-none"
                          placeholder="Digite o endereço completo com número, bairro e cidade..."
                        />
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => setEditingAddressId(null)}
                            className="flex-1 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg text-[10px]"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            disabled={isGeocoding}
                            onClick={() => handleSaveInlineAddress(stop)}
                            className="flex-1 py-1 bg-violet-600 hover:bg-violet-500 text-white font-extrabold rounded-lg text-[10px] flex items-center justify-center gap-1"
                          >
                            {isGeocoding ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                            Salvar & Buscar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="font-bold text-slate-300 text-[11px] leading-relaxed mb-2">
                        {stop.address}
                      </p>
                    )}

                    {/* Coordinates Indicator */}
                    <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-800/80 pt-2">
                      <span className="flex items-center gap-1">
                        <Move className="w-3 h-3 text-amber-400" />
                        {stop.lat && stop.lng
                          ? `${stop.lat.toFixed(4)}, ${stop.lng.toFixed(4)}`
                          : 'Sem coordenadas'}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEditingAddress(stop);
                          }}
                          className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-violet-300 font-extrabold rounded-lg border border-slate-700 flex items-center gap-1"
                          title="Editar texto do endereço"
                        >
                          <Edit3 className="w-3 h-3" />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditStop(stop);
                          }}
                          className="px-2 py-0.5 bg-violet-600/30 hover:bg-violet-600 text-white font-extrabold rounded-lg border border-violet-500/50"
                          title="Abrir modal completo de edição"
                        >
                          Mais
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
