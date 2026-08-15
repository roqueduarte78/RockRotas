import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Plus,
  MapPin,
  Trash2,
  ArrowUp,
  ArrowDown,
  FileSpreadsheet,
  Sparkles,
  Zap,
  Check,
  CheckCircle2,
  Clock,
  Phone,
  User,
  FileText,
  Search,
  MessageCircle,
  Pencil,
  Crosshair,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  History,
  Settings,
  Volume2,
  Sun,
  Moon,
  ShieldAlert,
  X,
  ExternalLink,
  Navigation,
  Package,
  Boxes,
  Camera,
  Image as ImageIcon,
} from 'lucide-react';
import { RouteStop, RouteSummary, DriverLocation, GpsApp, MapThemeMode } from '../types';
import {
  getWazeUrl,
  getGoogleMapsUrl,
  getWhatsAppUrl,
  fetchPlacesAutocomplete,
  fetchPlaceDetails,
  geocodeAddress,
  exportCurrentRouteToExcel,
  computeRoutePerformance,
  PlaceSuggestion,
} from '../utils/routeOptimizer';
import { generateRoutePdfReport } from '../utils/pdfGenerator';
import {
  speakNextStopAnnouncement,
  getSavedVoiceConfig,
} from '../utils/voiceAnnouncement';
import { useBatteryStatus } from '../hooks/useBatteryStatus';

interface SidebarProps {
  routeName?: string;
  onUpdateRouteName?: (name: string) => void;
  stops: RouteStop[];
  onAddStop: (stop: Partial<RouteStop>) => void;
  onRemoveStop: (id: string) => void;
  onEditStop?: (stop: RouteStop) => void;
  onReorderStop: (index: number, direction: 'up' | 'down') => void;
  onOptimizeTSP: () => void;
  onOptimizeFromGps?: () => void;
  onOpenGeminiModal: () => void;
  onOpenExcelImport: () => void;
  onOpenHistoryModal?: () => void;
  onOpenVoiceModal?: () => void;
  onUpdateStopStatus: (id: string, status: RouteStop['status']) => void;
  routeSummary: RouteSummary;
  driverLocation?: DriverLocation | null;
  isSearching: boolean;
  setIsSearching: (searching: boolean) => void;
  onCreateNewRoute?: () => void;
  onCancelRoute?: () => void;
  defaultGpsApp?: GpsApp;
  onUpdateGpsApp?: (app: GpsApp) => void;
  mapThemeMode?: MapThemeMode;
  onUpdateMapThemeMode?: (mode: MapThemeMode) => void;
  nightStartHour?: number;
  onUpdateNightStartHour?: (hour: number) => void;
  nightEndHour?: number;
  onUpdateNightEndHour?: (hour: number) => void;
  currentTimeFormatted?: string;
  scheduleStatusLabel?: string;
  isDarkModeMap?: boolean;
  onViewProofPhoto?: (stop: RouteStop) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  routeName = 'Minha Rota de Entregas',
  onUpdateRouteName,
  stops,
  onAddStop,
  onRemoveStop,
  onEditStop,
  onReorderStop,
  onOptimizeTSP,
  onOptimizeFromGps,
  onOpenGeminiModal,
  onOpenExcelImport,
  onOpenHistoryModal,
  onOpenVoiceModal,
  onUpdateStopStatus,
  routeSummary,
  driverLocation,
  isSearching,
  setIsSearching,
  onCreateNewRoute,
  onCancelRoute,
  defaultGpsApp = 'google',
  onUpdateGpsApp,
  mapThemeMode = 'auto',
  onUpdateMapThemeMode,
  nightStartHour = 18,
  onUpdateNightStartHour,
  nightEndHour = 6,
  onUpdateNightEndHour,
  currentTimeFormatted = '12:00',
  scheduleStatusLabel = '',
  isDarkModeMap = false,
  onViewProofPhoto,
}) => {
  const [addressInput, setAddressInput] = useState('');
  const [customerInput, setCustomerInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [priorityInput, setPriorityInput] = useState<RouteStop['priority']>('normal');
  const [showAdvancedInputs, setShowAdvancedInputs] = useState(false);
  const [showPerformanceDetails, setShowPerformanceDetails] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const [enableLayoutAnimation, setEnableLayoutAnimation] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('ROTA_EXPRESS_LAYOUT_ANIMATION');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('ROTA_EXPRESS_LAYOUT_ANIMATION', String(enableLayoutAnimation));
    } catch (e) {
      console.warn('Could not save animation preference:', e);
    }
  }, [enableLayoutAnimation]);

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Compute performance metrics
  const performance = computeRoutePerformance(stops);

  // Handle outside click to close suggestions dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Real-time Autocomplete with Google Places API
  const handleInputChange = (val: string) => {
    setAddressInput(val);
    setSelectedIndex(-1);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (val.trim().length >= 2) {
      setIsSearching(true);
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const results = await fetchPlacesAutocomplete(val);
          setSuggestions(results);
          setIsDropdownOpen(results.length > 0);
        } catch (err) {
          console.warn('Places Autocomplete error:', err);
        } finally {
          setIsSearching(false);
        }
      }, 250);
    } else {
      setSuggestions([]);
      setIsDropdownOpen(false);
      setIsSearching(false);
    }
  };

  // Select place from Google Places autocomplete dropdown
  const handleSelectPlace = async (place: PlaceSuggestion) => {
    setIsSearching(true);
    setIsDropdownOpen(false);

    try {
      const resolved = await fetchPlaceDetails(place);
      const finalAddress = resolved?.formattedAddress || place.description || place.mainText;

      onAddStop({
        address: finalAddress,
        lat: resolved?.lat,
        lng: resolved?.lng,
        customerName: customerInput.trim() || undefined,
        phone: phoneInput.trim() || undefined,
        notes: notesInput.trim() || undefined,
        priority: priorityInput,
        status: 'pendente',
      });

      // Clear input fields
      setAddressInput('');
      setCustomerInput('');
      setPhoneInput('');
      setNotesInput('');
      setSuggestions([]);
      setShowAdvancedInputs(false);
    } catch (err) {
      console.warn('Error resolving place details:', err);
    } finally {
      setIsSearching(false);
    }
  };

  // Keyboard navigation for autocomplete list
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isDropdownOpen || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        handleSelectPlace(suggestions[selectedIndex]);
      } else if (suggestions.length > 0) {
        handleSelectPlace(suggestions[0]);
      } else {
        handleManualAdd(e);
      }
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
    }
  };

  // Manual fallback add
  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addressInput.trim()) return;

    setIsSearching(true);
    setIsDropdownOpen(false);

    const geocoded = await geocodeAddress(addressInput);
    setIsSearching(false);

    onAddStop({
      address: geocoded ? geocoded.formattedAddress : addressInput.trim(),
      lat: geocoded?.lat,
      lng: geocoded?.lng,
      customerName: customerInput.trim() || undefined,
      phone: phoneInput.trim() || undefined,
      notes: notesInput.trim() || undefined,
      priority: priorityInput,
      status: 'pendente',
    });

    setAddressInput('');
    setCustomerInput('');
    setPhoneInput('');
    setNotesInput('');
    setSuggestions([]);
    setShowAdvancedInputs(false);
  };

  return (
    <div className="w-full lg:w-96 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col h-full shadow-xs z-20 overflow-hidden text-slate-800 dark:text-slate-100">
      {/* 1. Header & Route Actions */}
      <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-xl bg-violet-600/10 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="font-extrabold text-slate-900 dark:text-white text-xs leading-tight truncate" title={routeName}>
                {routeName}
              </h2>
              <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                {stops.length} {stops.length === 1 ? 'parada' : 'paradas'} na rota
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {onCreateNewRoute && (
              <button
                type="button"
                onClick={onCreateNewRoute}
                className="p-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1"
                title="Nova Rota"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="text-[11px] pr-0.5">Nova</span>
              </button>
            )}
            {onOpenHistoryModal && (
              <button
                type="button"
                onClick={onOpenHistoryModal}
                className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
                title="Histórico de Rotas"
              >
                <History className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowSettingsPanel(!showSettingsPanel)}
              className={`p-1.5 rounded-lg transition-colors ${
                showSettingsPanel
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
              title="Configurações (Tema, GPS, Voz)"
            >
              <Settings className="w-4 h-4" />
            </button>
            {stops.length > 0 && onCancelRoute && (
              <button
                type="button"
                onClick={onCancelRoute}
                className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                title="Limpar Rota"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Collapsible Settings Panel */}
        {showSettingsPanel && (
          <div className="mb-3 p-3 bg-slate-900 dark:bg-slate-950 text-white rounded-2xl border border-slate-800 shadow-lg text-xs space-y-2.5 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <span className="font-bold text-violet-300 flex items-center gap-1">
                <Settings className="w-3.5 h-3.5 text-violet-400" />
                Configurações da Rota
              </span>
              <button
                type="button"
                onClick={() => setShowSettingsPanel(false)}
                className="text-slate-400 hover:text-white p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* GPS Preference */}
            <div>
              <span className="text-[10px] text-slate-400 font-bold block mb-1">Navegador Padrão:</span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => onUpdateGpsApp?.('google')}
                  className={`p-1.5 rounded-lg border text-left flex items-center gap-1.5 transition-all text-xs font-bold ${
                    defaultGpsApp === 'google'
                      ? 'bg-blue-600/40 border-blue-400 text-white'
                      : 'bg-slate-800/80 border-slate-700 text-slate-400'
                  }`}
                >
                  <span>🗺️</span>
                  <span>Google Maps</span>
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateGpsApp?.('waze')}
                  className={`p-1.5 rounded-lg border text-left flex items-center gap-1.5 transition-all text-xs font-bold ${
                    defaultGpsApp === 'waze'
                      ? 'bg-cyan-600/40 border-cyan-400 text-white'
                      : 'bg-slate-800/80 border-slate-700 text-slate-400'
                  }`}
                >
                  <span>🚗</span>
                  <span>Waze</span>
                </button>
              </div>
            </div>

            {/* Theme Schedule Mode */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-bold block">Tema do Mapa:</span>
                <span className="text-[10px] text-slate-300">{scheduleStatusLabel || currentTimeFormatted}</span>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => onUpdateMapThemeMode?.('auto')}
                  className={`px-2 py-1 rounded-md text-[10px] font-bold ${
                    mapThemeMode === 'auto' ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  Auto
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateMapThemeMode?.('light')}
                  className={`p-1 rounded-md ${
                    mapThemeMode === 'light' ? 'bg-amber-500 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                  title="Claro"
                >
                  <Sun className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateMapThemeMode?.('dark')}
                  className={`p-1 rounded-md ${
                    mapThemeMode === 'dark' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                  title="Escuro"
                >
                  <Moon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Voice Accents */}
            {onOpenVoiceModal && (
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-bold">Voz & Sotaques PT-BR:</span>
                <button
                  type="button"
                  onClick={onOpenVoiceModal}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-violet-300 font-bold rounded-lg text-[10px] flex items-center gap-1"
                >
                  <Volume2 className="w-3 h-3 text-violet-400" />
                  <span>Ajustar Voz</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* 2. Top Google Places Autocomplete Search Bar */}
        <form onSubmit={handleManualAdd} className="relative space-y-1.5">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-violet-600 dark:text-violet-400 absolute left-3 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={addressInput}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                if (suggestions.length > 0) setIsDropdownOpen(true);
              }}
              placeholder="Buscar endereço no Google Places..."
              className="w-full pl-9 pr-20 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none shadow-2xs transition-all"
            />

            <div className="absolute right-2 flex items-center gap-1">
              {isSearching ? (
                <div className="w-3.5 h-3.5 border-2 border-violet-600 border-t-transparent rounded-full animate-spin mr-1" />
              ) : addressInput ? (
                <button
                  type="button"
                  onClick={() => {
                    setAddressInput('');
                    setSuggestions([]);
                    setIsDropdownOpen(false);
                  }}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => setShowAdvancedInputs(!showAdvancedInputs)}
                className={`text-[10px] font-bold px-1.5 py-1 rounded-md transition-colors ${
                  showAdvancedInputs
                    ? 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300'
                    : 'text-slate-500 hover:text-violet-600 dark:text-slate-400 dark:hover:text-violet-300'
                }`}
                title="Adicionar cliente, telefone e observações"
              >
                {showAdvancedInputs ? 'Menos' : '+ Info'}
              </button>
            </div>
          </div>

          {/* Autocomplete Dropdown List */}
          {isDropdownOpen && suggestions.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute left-0 right-0 top-11 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-700/60 max-h-64 overflow-y-auto animate-fadeIn"
            >
              <div className="px-3 py-1 bg-slate-50 dark:bg-slate-900 text-[10px] font-bold text-slate-400 dark:text-slate-500 flex items-center justify-between">
                <span>Sugestões Google Places</span>
                <span className="text-[9px]">Enter para adicionar</span>
              </div>
              {suggestions.map((item, idx) => (
                <button
                  key={item.placeId || idx}
                  type="button"
                  onClick={() => handleSelectPlace(item)}
                  className={`w-full text-left p-2.5 flex items-start gap-2.5 transition-colors ${
                    selectedIndex === idx
                      ? 'bg-violet-50 dark:bg-violet-950/60 text-violet-900 dark:text-violet-200'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-xs block truncate text-slate-900 dark:text-white">
                      {item.mainText}
                    </span>
                    {item.secondaryText && (
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                        {item.secondaryText}
                      </span>
                    )}
                  </div>
                  {item.source === 'google' && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-300 rounded shrink-0">
                      Places
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Optional Expanded Stop Info (Customer, Phone, Notes, Priority) */}
          {showAdvancedInputs && (
            <div className="p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs animate-fadeIn shadow-2xs">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Nome do cliente"
                  value={customerInput}
                  onChange={(e) => setCustomerInput(e.target.value)}
                  className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium outline-none"
                />
                <input
                  type="tel"
                  placeholder="Telefone / WhatsApp"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Observação (ex: portaria)"
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium outline-none"
                />
                <select
                  value={priorityInput}
                  onChange={(e) => setPriorityInput(e.target.value as any)}
                  className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none"
                >
                  <option value="normal">Prioridade Normal</option>
                  <option value="alta">🚨 Alta (Urgente)</option>
                  <option value="baixa">Baixa Prioridade</option>
                </select>
              </div>
            </div>
          )}
        </form>

        {/* Quick Excel Action */}
        <div className="mt-2.5 flex items-center gap-2">
          <button
            onClick={onOpenExcelImport}
            className="flex-1 py-1.5 px-2 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Importar Planilha</span>
          </button>
        </div>
      </div>

      {/* 3. Simplified & Clean Route Metrics Bar */}
      {stops.length > 0 && (
        <div className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs">
            <div>
              <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">
                Distância
              </span>
              <span className="font-extrabold text-slate-900 dark:text-white">
                {routeSummary.totalDistanceKm} km
              </span>
            </div>
            <div className="w-px h-5 bg-slate-200 dark:bg-slate-800" />
            <div>
              <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">
                Tempo
              </span>
              <span className="font-extrabold text-slate-900 dark:text-white">
                {routeSummary.totalDurationMin} min
              </span>
            </div>
            <div className="w-px h-5 bg-slate-200 dark:bg-slate-800" />
            <div>
              <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">
                Entregas
              </span>
              <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                {routeSummary.completedCount}/{routeSummary.totalCount}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => exportCurrentRouteToExcel(stops, routeSummary)}
              className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-emerald-600 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title="Exportar Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4" />
            </button>
            <button
              onClick={() => generateRoutePdfReport(stops, routeSummary)}
              className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-rose-600 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title="Exportar Relatório PDF"
            >
              <FileText className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 4. Route Optimizer Bar */}
      {stops.length > 1 && (
        <div className="px-3.5 py-2 bg-slate-100/70 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex items-center gap-1.5">
          <button
            onClick={onOptimizeFromGps || onOptimizeTSP}
            className="flex-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-2xs flex items-center justify-center gap-1"
            title="Otimizar rota a partir da sua posição GPS atual"
          >
            <Crosshair className="w-3.5 h-3.5 text-emerald-200" />
            <span>Otimizar GPS</span>
          </button>

          <button
            onClick={onOptimizeTSP}
            className="flex-1 py-1.5 px-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-xl transition-all shadow-2xs flex items-center justify-center gap-1"
            title="Calcular Menor Trajeto (TSP)"
          >
            <Zap className="w-3.5 h-3.5 text-amber-300" />
            <span>Menor Trajeto</span>
          </button>

          <button
            onClick={onOpenGeminiModal}
            className="py-1.5 px-2.5 bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs font-bold rounded-xl transition-all shadow-2xs flex items-center justify-center gap-1"
            title="Otimização Inteligente com IA Gemini"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>IA</span>
          </button>
        </div>
      )}

      {/* 5. Clean Stops List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {stops.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="w-10 h-10 bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400 rounded-2xl flex items-center justify-center mx-auto mb-2.5">
              <MapPin className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-xs mb-1">
              Nenhuma parada adicionada
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] max-w-xs mx-auto mb-3">
              Pesquise qualquer endereço acima no Google Places ou importe sua planilha.
            </p>
            <button
              onClick={onOpenExcelImport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-xs font-bold transition-all shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
              <span>Importar Planilha Modelo</span>
            </button>
          </div>
        ) : (
          stops.map((stop, index) => {
            const wazeUrl = stop.lat && stop.lng ? getWazeUrl(stop.lat, stop.lng) : '#';
            const googleUrl = getGoogleMapsUrl(stop.lat!, stop.lng!, stop.address);
            const defaultNavUrl = defaultGpsApp === 'waze' ? wazeUrl : googleUrl;
            const isCompleted = stop.status === 'concluido';

            return (
              <motion.div
                key={stop.id}
                layout={enableLayoutAnimation ? true : false}
                transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                className={`p-3 rounded-2xl border transition-all ${
                  isCompleted
                    ? 'bg-slate-50/70 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-70'
                    : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:border-violet-400 dark:hover:border-violet-500 shadow-2xs'
                }`}
              >
                {/* Card Top Header */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-5 h-5 rounded-lg text-[11px] font-black flex items-center justify-center shrink-0 ${
                        isCompleted
                          ? 'bg-emerald-500 text-white'
                          : index === 0
                          ? 'bg-violet-600 text-white shadow-2xs'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {index + 1}
                    </span>

                    <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                      {stop.customerName || stop.address.split(',')[0]}
                    </span>

                    {stop.priority === 'alta' && !isCompleted && (
                      <span className="bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 text-[9px] font-extrabold px-1.5 py-0.2 rounded shrink-0">
                        Urgente
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-0.5 shrink-0">
                    {stop.estimatedEta && (
                      <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mr-1">
                        {stop.estimatedEta}
                      </span>
                    )}
                    {index > 0 && (
                      <button
                        onClick={() => onReorderStop(index, 'up')}
                        className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded"
                        title="Subir"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                    )}
                    {index < stops.length - 1 && (
                      <button
                        onClick={() => onReorderStop(index, 'down')}
                        className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded"
                        title="Descer"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      onClick={() => onEditStop?.(stop)}
                      className="p-1 text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 rounded"
                      title="Editar"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onRemoveStop(stop.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded"
                      title="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Address Link */}
                <a
                  href={defaultNavUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-slate-600 dark:text-slate-300 hover:text-violet-600 dark:hover:text-violet-400 block line-clamp-2 leading-relaxed mb-1.5 transition-colors font-medium"
                  title={`Abrir navegação em ${defaultGpsApp === 'waze' ? 'Waze' : 'Google Maps'}`}
                >
                  {stop.address}
                </a>

                {/* Package Numbers & Grouping Info */}
                {((stop.packagesCount && stop.packagesCount > 1) || (stop.packageNumbers && stop.packageNumbers.length > 0)) && (
                  <div className="mb-2 p-1.5 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/80 rounded-xl space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                        <Package className="w-3 h-3 text-indigo-500" />
                        <span>
                          {stop.packagesCount && stop.packagesCount > 1
                            ? `${stop.packagesCount} pacotes agrupados neste endereço`
                            : 'Pacote associado'}
                        </span>
                      </span>
                    </div>

                    {stop.packageNumbers && stop.packageNumbers.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {stop.packageNumbers.map((pkgNum, pIdx) => (
                          <span
                            key={pIdx}
                            className="px-1.5 py-0.2 bg-white dark:bg-indigo-900/90 text-indigo-900 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-700 rounded-md font-mono text-[9px] font-bold shadow-2xs"
                          >
                            {pkgNum}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Adverse Weather Alert if any */}
                {stop.weather?.isAdverse && (
                  <div className="mb-2 p-1.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-[10px] text-amber-900 dark:text-amber-200 font-medium flex items-center gap-1.5">
                    <ShieldAlert className="w-3 h-3 text-amber-600 shrink-0" />
                    <span className="truncate">{stop.weather.alertText || 'Alerta de chuva/clima adverso'}</span>
                  </div>
                )}

                {/* Proof of Delivery Photo Thumbnail Badge */}
                {stop.deliveryProofPhoto && (
                  <div className="mb-2 p-2 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/80 rounded-xl flex items-center justify-between gap-2 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => onViewProofPhoto?.(stop)}
                      className="flex items-center gap-2 text-left min-w-0 flex-1 group"
                      title="Clique para ver o comprovante em tamanho real"
                    >
                      <div className="relative w-8 h-8 rounded-lg overflow-hidden shrink-0 border border-emerald-500/50 bg-black">
                        <img
                          src={stop.deliveryProofPhoto}
                          alt="Comprovante de entrega"
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="font-extrabold text-[10px] text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                          <Camera className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          <span>Comprovante Registrado</span>
                        </span>
                        <span className="text-[9px] text-slate-500 dark:text-slate-400 block truncate">
                          {stop.deliveryProofTimestamp || 'Foto salva'}
                          {stop.deliveryProofNotes ? ` • "${stop.deliveryProofNotes}"` : ''}
                        </span>
                      </div>
                    </button>
                  </div>
                )}

                {/* Customer Contact & Notes Row */}
                {(stop.phone || stop.notes) && (
                  <div className="mb-2 pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] gap-2">
                    {stop.phone ? (
                      <a
                        href={getWhatsAppUrl(
                          stop.phone,
                          `Olá ${stop.customerName || ''}, sua entrega está a caminho!`
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 hover:underline truncate"
                      >
                        <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">WhatsApp: {stop.phone}</span>
                      </a>
                    ) : (
                      <span className="text-slate-400 text-[10px]">Sem telefone</span>
                    )}

                    {stop.notes && (
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 italic truncate max-w-[140px]" title={stop.notes}>
                        {stop.notes}
                      </span>
                    )}
                  </div>
                )}

                {/* Card Action Footer */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  {/* Voice + GPS Apps */}
                  <div className="flex items-center gap-1.5">
                    {!isCompleted && (
                      <button
                        onClick={() => speakNextStopAnnouncement(stop.customerName, stop.address)}
                        className="p-1 text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 rounded-md transition-colors"
                        title="Ouvir parada com voz"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <a
                      href={wazeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`text-[10px] px-1.5 py-0.5 rounded font-bold transition-colors ${
                        defaultGpsApp === 'waze'
                          ? 'bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 font-extrabold'
                          : 'text-slate-400 hover:text-cyan-600'
                      }`}
                    >
                      Waze
                    </a>

                    <a
                      href={googleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`text-[10px] px-1.5 py-0.5 rounded font-bold transition-colors ${
                        defaultGpsApp === 'google'
                          ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-extrabold'
                          : 'text-slate-400 hover:text-blue-600'
                      }`}
                    >
                      Maps
                    </a>
                  </div>

                  {/* Completion Toggle */}
                  <button
                    onClick={() =>
                      onUpdateStopStatus(stop.id, isCompleted ? 'pendente' : 'concluido')
                    }
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all flex items-center gap-1 ${
                      isCompleted
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xs'
                    }`}
                  >
                    <Check className="w-3 h-3" />
                    <span>{isCompleted ? 'Concluída' : 'Entregar'}</span>
                  </button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
};
