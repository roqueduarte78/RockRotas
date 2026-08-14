import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Plus,
  MapPin,
  Trash2,
  ArrowUp,
  ArrowDown,
  Navigation,
  FileSpreadsheet,
  Sparkles,
  Zap,
  CheckCircle2,
  Clock,
  Phone,
  User,
  AlertCircle,
  FileText,
  Search,
  MessageCircle,
  Pencil,
  Crosshair,
  TrendingUp,
  Activity,
  Award,
  ChevronDown,
  ChevronUp,
  History,
  Settings,
  Volume2,
  CloudRain,
  Sun,
  Moon,
  ShieldAlert,
  Battery,
  BatteryCharging,
  BatteryWarning,
  Layers,
} from 'lucide-react';
import { RouteStop, RouteSummary, DriverLocation, GpsApp, MapThemeMode } from '../types';
import {
  getWazeUrl,
  getGoogleMapsUrl,
  getWhatsAppUrl,
  geocodeAddress,
  exportCurrentRouteToExcel,
  computeRoutePerformance,
} from '../utils/routeOptimizer';
import { generateRoutePdfReport } from '../utils/pdfGenerator';
import { speakNextStopAnnouncement } from '../utils/voiceAnnouncement';
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
}) => {
  const [addressInput, setAddressInput] = useState('');
  const [customerInput, setCustomerInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [priorityInput, setPriorityInput] = useState<RouteStop['priority']>('normal');
  const [showAdvancedInputs, setShowAdvancedInputs] = useState(false);
  const [showPerformanceDetails, setShowPerformanceDetails] = useState(true);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [enableLayoutAnimation, setEnableLayoutAnimation] = useState<boolean>(() => {
    const saved = localStorage.getItem('ROTA_EXPRESS_LAYOUT_ANIMATION');
    return saved !== null ? saved === 'true' : true;
  });

  useEffect(() => {
    try {
      localStorage.setItem('ROTA_EXPRESS_LAYOUT_ANIMATION', String(enableLayoutAnimation));
    } catch (e) {
      console.warn('Could not save animation preference:', e);
    }
  }, [enableLayoutAnimation]);

  const battery = useBatteryStatus();
  const [searchResults, setSearchResults] = useState<Array<{ address: string; lat: number; lng: number }>>([]);

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Compute performance metrics
  const performance = computeRoutePerformance(stops);

  const handleSearchSuggestions = (val: string) => {
    setAddressInput(val);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (val.trim().length > 3) {
      searchTimeoutRef.current = setTimeout(async () => {
        setIsSearching(true);
        try {
          const res = await fetch(`/api/geocode?q=${encodeURIComponent(val)}`);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
              setSearchResults(
                data.slice(0, 4).map((item: any) => ({
                  address: item.display_name,
                  lat: parseFloat(item.lat),
                  lng: parseFloat(item.lon),
                }))
              );
            }
          }
        } catch (err) {
          console.warn('Suggestion search error:', err);
        } finally {
          setIsSearching(false);
        }
      }, 400);
    } else {
      setSearchResults([]);
    }
  };

  const handleSelectSuggestion = (item: { address: string; lat: number; lng: number }) => {
    onAddStop({
      address: item.address,
      lat: item.lat,
      lng: item.lng,
      customerName: customerInput || undefined,
      phone: phoneInput || undefined,
      notes: notesInput || undefined,
      priority: priorityInput,
      status: 'pendente',
    });
    setAddressInput('');
    setCustomerInput('');
    setPhoneInput('');
    setNotesInput('');
    setSearchResults([]);
    setShowAdvancedInputs(false);
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addressInput.trim()) return;

    setIsSearching(true);
    const geocoded = await geocodeAddress(addressInput);
    setIsSearching(false);

    onAddStop({
      address: geocoded ? geocoded.formattedAddress : addressInput,
      lat: geocoded?.lat,
      lng: geocoded?.lng,
      customerName: customerInput || undefined,
      phone: phoneInput || undefined,
      notes: notesInput || undefined,
      priority: priorityInput,
      status: 'pendente',
    });

    setAddressInput('');
    setCustomerInput('');
    setPhoneInput('');
    setNotesInput('');
    setSearchResults([]);
    setShowAdvancedInputs(false);
  };

  return (
    <div className="w-full lg:w-96 bg-white border-r border-slate-200/80 flex flex-col h-full shadow-sm z-20 overflow-hidden">
      {/* Header & Quick Import */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/70">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 overflow-hidden mr-2">
            <div className="p-1.5 rounded-xl bg-violet-100 text-violet-700 shrink-0">
              <MapPin className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="font-extrabold text-slate-900 text-sm leading-tight truncate" title={routeName}>
                {routeName}
              </h2>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Itinerário de Entregas</p>
            </div>
          </div>
          <span className="text-xs bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-extrabold px-2.5 py-1 rounded-full shadow-xs shrink-0">
            {stops.length} {stops.length === 1 ? 'parada' : 'paradas'}
          </span>
        </div>

        {/* Route Level Actions: Nova Rota, Histórico, Configurações & Cancelar Rota */}
        <div className="flex items-center gap-2 mb-3">
          {onCreateNewRoute && (
            <button
              type="button"
              onClick={onCreateNewRoute}
              className="flex-1 py-1.5 px-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-black text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Nova
            </button>
          )}
          {onOpenHistoryModal && (
            <button
              type="button"
              onClick={onOpenHistoryModal}
              className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-1"
              title="Abrir Histórico de Rotas Salvas"
            >
              <History className="w-3.5 h-3.5 text-violet-600" />
              Histórico
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowSettingsPanel(!showSettingsPanel)}
            className={`py-1.5 px-2 font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-1 border ${
              showSettingsPanel
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
            }`}
            title="Configurações (GPS Padrão, Voz e Clima)"
          >
            <Settings className="w-3.5 h-3.5 text-indigo-500" />
            Config
          </button>
          {stops.length > 0 && onCancelRoute && (
            <button
              type="button"
              onClick={onCancelRoute}
              className="py-1.5 px-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-1"
              title="Cancelar rota atual e limpar todas as paradas"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              Cancelar
            </button>
          )}
        </div>

        {/* Collapsible Settings Panel */}
        {showSettingsPanel && (
          <div className="mb-3 p-3.5 bg-slate-900 text-white rounded-2xl border border-slate-700 shadow-lg animate-fadeIn text-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-1.5 font-extrabold text-violet-300">
                <Settings className="w-4 h-4 text-violet-400" />
                <span>Painel de Configurações</span>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsPanel(false)}
                className="text-slate-400 hover:text-white font-bold px-1"
              >
                ✕
              </button>
            </div>

            {/* GPS App Selection */}
            <div>
              <label className="block text-slate-300 font-bold mb-1.5">
                App de GPS Padrão ao clicar nas paradas:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onUpdateGpsApp?.('google')}
                  className={`p-2 rounded-xl border text-left flex items-center gap-2 transition-all font-extrabold ${
                    defaultGpsApp === 'google'
                      ? 'bg-blue-600/40 border-blue-400 text-white shadow-xs'
                      : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <span className="text-base">🗺️</span>
                  <div>
                    <span className="block text-xs">Google Maps</span>
                    <span className="text-[9px] text-slate-400 font-normal">Navegação Oficial</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onUpdateGpsApp?.('waze')}
                  className={`p-2 rounded-xl border text-left flex items-center gap-2 transition-all font-extrabold ${
                    defaultGpsApp === 'waze'
                      ? 'bg-cyan-600/40 border-cyan-400 text-white shadow-xs'
                      : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <span className="text-base">🚗</span>
                  <div>
                    <span className="block text-xs">Waze</span>
                    <span className="text-[9px] text-slate-400 font-normal">Trânsito em Tempo Real</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Map Theme & Automatic Local-Time Schedule */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-200 flex items-center gap-1.5">
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  Tema do Mapa & Agendamento por Horário
                </span>
                {scheduleStatusLabel && (
                  <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-violet-950 text-violet-300 border border-violet-700/60">
                    {currentTimeFormatted}
                  </span>
                )}
              </div>

              {/* Mode Selector (Auto, Claro, Escuro) */}
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => onUpdateMapThemeMode?.('auto')}
                  className={`p-2 rounded-xl border text-center transition-all font-extrabold flex flex-col items-center justify-center gap-1 ${
                    mapThemeMode === 'auto'
                      ? 'bg-violet-600/40 border-violet-400 text-white shadow-xs'
                      : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-800'
                  }`}
                  title="Alterna automaticamente entre claro de dia e escuro à noite com base no horário local"
                >
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-violet-400" />
                    <Sparkles className="w-2.5 h-2.5 text-amber-300" />
                  </div>
                  <span className="text-[11px] leading-none">Automático</span>
                  <span className="text-[8px] text-slate-400 font-medium">Por Horário</span>
                </button>

                <button
                  type="button"
                  onClick={() => onUpdateMapThemeMode?.('light')}
                  className={`p-2 rounded-xl border text-center transition-all font-extrabold flex flex-col items-center justify-center gap-1 ${
                    mapThemeMode === 'light'
                      ? 'bg-amber-600/40 border-amber-400 text-white shadow-xs'
                      : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-800'
                  }`}
                  title="Fixa o mapa permanentemente no tema claro"
                >
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[11px] leading-none">Claro</span>
                  <span className="text-[8px] text-slate-400 font-medium">Manual</span>
                </button>

                <button
                  type="button"
                  onClick={() => onUpdateMapThemeMode?.('dark')}
                  className={`p-2 rounded-xl border text-center transition-all font-extrabold flex flex-col items-center justify-center gap-1 ${
                    mapThemeMode === 'dark'
                      ? 'bg-indigo-600/40 border-indigo-400 text-white shadow-xs'
                      : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-800'
                  }`}
                  title="Fixa o mapa permanentemente no tema escuro (noturno)"
                >
                  <Moon className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-[11px] leading-none">Escuro</span>
                  <span className="text-[8px] text-slate-400 font-medium">Manual</span>
                </button>
              </div>

              {/* Status and Detailed Controls for Automatic Mode */}
              {mapThemeMode === 'auto' ? (
                <div className="p-2.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-300 font-bold flex items-center gap-1">
                      {isDarkModeMap ? (
                        <>
                          <Moon className="w-3 h-3 text-indigo-400" />
                          Modo Noturno Ativo (Noite)
                        </>
                      ) : (
                        <>
                          <Sun className="w-3 h-3 text-amber-400" />
                          Modo Diurno Ativo (Dia)
                        </>
                      )}
                    </span>
                    <span className="text-slate-400 font-mono font-bold">
                      {scheduleStatusLabel}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-900 text-[10px]">
                    <div>
                      <label className="block text-slate-400 mb-0.5 font-bold">
                        🌙 Início Noturno:
                      </label>
                      <select
                        value={nightStartHour}
                        onChange={(e) => onUpdateNightStartHour?.(parseInt(e.target.value, 10))}
                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-1 text-xs font-bold outline-none focus:border-violet-500"
                      >
                        {Array.from({ length: 24 }).map((_, h) => (
                          <option key={h} value={h}>
                            {h.toString().padStart(2, '0')}:00h
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-0.5 font-bold">
                        ☀️ Fim Noturno (Dia):
                      </label>
                      <select
                        value={nightEndHour}
                        onChange={(e) => onUpdateNightEndHour?.(parseInt(e.target.value, 10))}
                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-1 text-xs font-bold outline-none focus:border-violet-500"
                      >
                        {Array.from({ length: 24 }).map((_, h) => (
                          <option key={h} value={h}>
                            {h.toString().padStart(2, '0')}:00h
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-2 bg-slate-950/60 border border-slate-800 rounded-xl text-[10px] text-slate-400 flex items-center justify-between">
                  <span>
                    Tema fixo em <strong>{mapThemeMode === 'dark' ? 'Modo Escuro' : 'Modo Claro'}</strong>.
                  </span>
                  <button
                    type="button"
                    onClick={() => onUpdateMapThemeMode?.('auto')}
                    className="text-violet-400 hover:text-violet-300 font-extrabold underline"
                  >
                    Ativar Automático
                  </button>
                </div>
              )}
            </div>

            {/* Framer Motion Layout Reordering Animation Toggle */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-200 block flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  Animações de Reordenação (Framer Motion)
                </span>
                <span className="text-[10px] text-slate-400">Suavizar transição ao otimizar paradas na lista</span>
              </div>
              <button
                type="button"
                onClick={() => setEnableLayoutAnimation(!enableLayoutAnimation)}
                className={`px-3 py-1 rounded-xl text-[11px] font-black transition-all border ${
                  enableLayoutAnimation
                    ? 'bg-indigo-600 text-white border-indigo-400 shadow-xs'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                }`}
              >
                {enableLayoutAnimation ? 'Ativado' : 'Desativado'}
              </button>
            </div>

            {/* Device Battery Status & Low Battery Warning */}
            <div className="pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-slate-200 flex items-center gap-1.5">
                  {battery.isLowBattery ? (
                    <BatteryWarning className="w-4 h-4 text-rose-400" />
                  ) : battery.charging ? (
                    <BatteryCharging className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Battery className="w-4 h-4 text-slate-300" />
                  )}
                  Bateria do Dispositivo
                </span>
                <span
                  className={`font-black px-2 py-0.5 rounded-full text-[10px] ${
                    battery.isLowBattery
                      ? 'bg-rose-500 text-white animate-pulse'
                      : battery.charging
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {battery.level}% {battery.charging ? '(Carregando)' : ''}
                </span>
              </div>

              {battery.isLowBattery && (
                <div className="mt-2 p-2 bg-rose-950/90 border border-rose-600/80 rounded-xl text-rose-200 text-[11px] flex items-start gap-1.5 font-medium leading-snug">
                  <BatteryWarning className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>ALERTA BATERIA CRÍTICA (&lt;20%):</strong> Conecte o dispositivo ao carregador veicular para evitar o encerramento do GPS em rota.
                  </span>
                </div>
              )}
            </div>

            {/* Web Speech Voice Test */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-200 block">Anúncios por Voz (Web Speech)</span>
                <span className="text-[10px] text-slate-400">Anuncia próxima parada no viva-voz</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const firstPending = stops.find((s) => s.status === 'pendente' || s.status === 'em_transito');
                  speakNextStopAnnouncement(
                    firstPending?.customerName || 'Cliente Teste',
                    firstPending?.address || 'Avenida Paulista, 1000'
                  );
                }}
                className="px-2.5 py-1.5 bg-violet-600 hover:bg-violet-500 text-white font-extrabold rounded-xl text-[11px] flex items-center gap-1 transition-all shrink-0"
              >
                <Volume2 className="w-3.5 h-3.5" />
                Testar Voz
              </button>
            </div>
          </div>
        )}

        {/* Add Address Form */}
        <form onSubmit={handleManualAdd} className="space-y-2 relative">
          <div className="relative">
            <input
              type="text"
              value={addressInput}
              onChange={(e) => handleSearchSuggestions(e.target.value)}
              placeholder="Digite o endereço completo..."
              className="w-full pl-9 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all outline-none shadow-2xs"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            {isSearching && (
              <div className="absolute right-3 top-3 w-4 h-4 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
            )}
          </div>

          {/* Autocomplete suggestions dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute top-11 left-0 right-0 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden divide-y divide-slate-100">
              {searchResults.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectSuggestion(item)}
                  className="w-full text-left p-2.5 hover:bg-violet-50/80 text-xs text-slate-700 flex items-start gap-2 transition-colors font-medium"
                >
                  <MapPin className="w-3.5 h-3.5 text-violet-600 mt-0.5 shrink-0" />
                  <span className="line-clamp-2">{item.address}</span>
                </button>
              ))}
            </div>
          )}

          {/* Additional details expandable */}
          {showAdvancedInputs && (
            <div className="p-3 bg-white border border-slate-200 rounded-2xl space-y-2 text-xs animate-fadeIn shadow-inner">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Nome do Cliente</label>
                  <input
                    type="text"
                    value={customerInput}
                    onChange={(e) => setCustomerInput(e.target.value)}
                    placeholder="Ex: Ana Silva"
                    className="w-full p-2 border border-slate-200 rounded-xl bg-slate-50 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Telefone / WhatsApp</label>
                  <input
                    type="text"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    placeholder="11999998888"
                    className="w-full p-2 border border-slate-200 rounded-xl bg-slate-50 font-medium"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Observações</label>
                  <input
                    type="text"
                    value={notesInput}
                    onChange={(e) => setNotesInput(e.target.value)}
                    placeholder="Ex: Deixar na portaria"
                    className="w-full p-2 border border-slate-200 rounded-xl bg-slate-50 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Prioridade</label>
                  <select
                    value={priorityInput}
                    onChange={(e) => setPriorityInput(e.target.value as any)}
                    className="w-full p-2 border border-slate-200 rounded-xl bg-slate-50 font-medium"
                  >
                    <option value="normal">Normal</option>
                    <option value="alta">Alta Prioridade</option>
                    <option value="baixa">Baixa Prioridade</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowAdvancedInputs(!showAdvancedInputs)}
              className="text-xs text-violet-600 hover:text-violet-700 font-bold flex items-center gap-1"
            >
              {showAdvancedInputs ? '- Menos detalhes' : '+ Adicionar Cliente / Notas'}
            </button>
            <button
              type="submit"
              disabled={!addressInput.trim()}
              className="px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-extrabold text-xs rounded-xl transition-all shadow-md shadow-violet-500/20 flex items-center gap-1.5 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Adicionar
            </button>
          </div>
        </form>

        {/* Import & Export Planilha Banner Button */}
        <div className="mt-3 pt-3 border-t border-slate-200 flex gap-2">
          <button
            onClick={onOpenExcelImport}
            className="flex-1 py-2 px-3 bg-emerald-50 hover:bg-emerald-100/80 text-emerald-900 border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Importar Excel
          </button>
          {stops.length > 0 && (
            <button
              onClick={() => exportCurrentRouteToExcel(stops, routeSummary)}
              className="flex-1 py-2 px-3 bg-blue-50 hover:bg-blue-100/80 text-blue-900 border border-blue-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs"
              title="Exportar rota atual ordenada para planilha Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4 text-blue-600" />
              Exportar Excel
            </button>
          )}
        </div>
      </div>

      {/* Route Optimizer Actions Bar */}
      {stops.length > 1 && (
        <div className="px-4 py-2.5 bg-slate-100/90 border-b border-slate-200 space-y-2">
          {/* GPS Origin Optimization Button */}
          <button
            onClick={onOptimizeFromGps || onOptimizeTSP}
            className="w-full py-2 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-extrabold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
            title="Usar minha localização GPS atual como ponto de partida da otimização"
          >
            <Crosshair className="w-4 h-4 text-emerald-200 animate-pulse" />
            <span>Otimizar a partir da Minha Posição Atual (GPS)</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onOptimizeTSP}
              className="flex-1 py-2 px-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-extrabold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
              title="Reordenar paradas pelo algoritmo de menor trajeto"
            >
              <Zap className="w-4 h-4 text-amber-300" />
              Menor Trajeto
            </button>

            <button
              onClick={onOpenGeminiModal}
              className="py-2 px-3 bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white text-xs font-extrabold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
              title="Otimizar com inteligência IA Gemini"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              IA Gemini
            </button>
          </div>
        </div>
      )}

      {/* Route Performance Indicator Section */}
      {stops.length > 0 && (
        <div className="px-4 py-3 bg-slate-900 text-white border-b border-slate-800">
          <div
            onClick={() => setShowPerformanceDetails(!showPerformanceDetails)}
            className="flex items-center justify-between cursor-pointer select-none"
          >
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400">
                <TrendingUp className="w-4 h-4" />
              </div>
              <span className="font-extrabold text-xs text-slate-200 uppercase tracking-wider">
                Performance da Rota
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {performance.efficiencyScorePct}% Eficiência
              </span>
              {showPerformanceDetails ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </div>
          </div>

          {showPerformanceDetails && (
            <div className="mt-3 pt-3 border-t border-slate-800 space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2 text-slate-300">
                <div className="p-2 bg-slate-800/80 rounded-xl border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 block font-bold">Permanência Média</span>
                  <span className="font-extrabold text-sm text-emerald-400">
                    {performance.avgDwellTimeMin} min / parada
                  </span>
                </div>

                <div className="p-2 bg-slate-800/80 rounded-xl border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 block font-bold">Pontualidade</span>
                  <span className="font-extrabold text-sm text-indigo-300">
                    {performance.punctualityStatus}
                  </span>
                </div>
              </div>

              {/* Log de Permanência e Conclusões */}
              {performance.executionLogs.length > 0 && (
                <div className="space-y-1 mt-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Logs de Permanência Registrados ({performance.executionLogs.length})
                  </span>
                  <div className="max-h-28 overflow-y-auto space-y-1">
                    {performance.executionLogs.map((log, idx) => (
                      <div
                        key={idx}
                        className="p-1.5 bg-slate-800/60 rounded-lg text-[11px] flex items-center justify-between border border-slate-700/40"
                      >
                        <div className="truncate max-w-[170px]">
                          <span className="font-bold text-slate-200 block truncate">
                            {log.customerName || log.address}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Chegada: {new Date(log.arrivedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-emerald-400 block">
                            {log.actualMinutes} min
                          </span>
                          <span className="text-[9px] text-slate-400">
                            (prev: {log.plannedMinutes} min)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Summary Card */}
      {stops.length > 0 && (
        <div className="p-3 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between text-xs font-medium border-b border-indigo-900/40 shadow-inner">
          <div className="flex items-center gap-3">
            <div>
              <span className="text-violet-300 block text-[10px] uppercase font-extrabold tracking-wider">
                Distância Total
              </span>
              <span className="text-sm font-extrabold text-white">{routeSummary.totalDistanceKm} km</span>
            </div>
            <div className="border-l border-indigo-800/60 h-6"></div>
            <div>
              <span className="text-violet-300 block text-[10px] uppercase font-extrabold tracking-wider">
                Tempo Estimado
              </span>
              <span className="text-sm font-extrabold text-white">{routeSummary.totalDurationMin} min</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <span className="text-violet-300 block text-[10px] uppercase font-extrabold tracking-wider">
                Progresso
              </span>
              <span className="text-sm font-extrabold text-emerald-400">
                {routeSummary.completedCount}/{routeSummary.totalCount}
              </span>
            </div>
            <button
              onClick={() => exportCurrentRouteToExcel(stops, routeSummary)}
              className="p-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl transition-all shadow-xs"
              title="Exportar rota atual para planilha Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4" />
            </button>
            <button
              onClick={() => generateRoutePdfReport(stops, routeSummary)}
              className="p-2 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white rounded-xl transition-all shadow-xs"
              title="Gerar e baixar relatório de entregas em PDF"
            >
              <FileText className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Stop List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {stops.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <MapPin className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-700 text-sm mb-1">Nenhuma parada adicionada</h3>
            <p className="text-slate-500 text-xs max-w-xs mx-auto mb-4">
              Digite os endereços de entrega acima ou importe uma planilha com seus clientes.
            </p>
            <button
              onClick={onOpenExcelImport}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-all shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              Carregar Planilha Modelo
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
                className={`p-3.5 rounded-2xl border transition-all ${
                  isCompleted
                    ? 'bg-slate-50/80 border-slate-200 opacity-75'
                    : 'bg-white border-slate-200 hover:border-violet-400 hover:shadow-md shadow-xs'
                }`}
              >
                {/* Top Stop Info Header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-6 h-6 rounded-xl text-xs font-black flex items-center justify-center shrink-0 shadow-2xs ${
                        index === 0
                          ? 'bg-emerald-600 text-white'
                          : index === stops.length - 1
                          ? 'bg-rose-600 text-white'
                          : 'bg-gradient-to-tr from-violet-600 to-indigo-600 text-white'
                      }`}
                    >
                      {index + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {stop.priority === 'alta' && (
                          <span className="bg-amber-100 text-amber-900 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-amber-200">
                            Urgente
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
                            isCompleted
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {stop.status.toUpperCase()}
                        </span>
                        {stop.estimatedEta && (
                          <span className="bg-indigo-50 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-200">
                            ETA: {stop.estimatedEta}
                          </span>
                        )}
                        {/* Live Weather Badge from Open-Meteo API */}
                        {stop.weather && (
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                              stop.weather.isAdverse
                                ? 'bg-amber-100 text-amber-950 border-amber-300 font-extrabold shadow-2xs animate-pulse'
                                : 'bg-slate-100 text-slate-800 border-slate-200'
                            }`}
                            title={stop.weather.alertText || `Previsão: ${stop.weather.conditionText} - ${stop.weather.temperature}°C`}
                          >
                            <span>{stop.weather.icon}</span>
                            <span>{stop.weather.temperature}°C</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Move, Voice & Remove Controls */}
                  <div className="flex items-center gap-1">
                    {!isCompleted && (
                      <button
                        onClick={() => speakNextStopAnnouncement(stop.customerName, stop.address)}
                        className="p-1 hover:bg-violet-100 text-slate-400 hover:text-violet-700 rounded-lg transition-colors"
                        title="Ouvir em voz alta (Web Speech)"
                      >
                        <Volume2 className="w-3.5 h-3.5 text-violet-600" />
                      </button>
                    )}
                    <button
                      onClick={() => onEditStop?.(stop)}
                      className="p-1 hover:bg-violet-100 text-slate-400 hover:text-violet-700 rounded-lg transition-colors"
                      title="Editar endereço e dados da parada"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {index > 0 && (
                      <button
                        onClick={() => onReorderStop(index, 'up')}
                        className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
                        title="Mover para cima"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {index < stops.length - 1 && (
                      <button
                        onClick={() => onReorderStop(index, 'down')}
                        className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
                        title="Mover para baixo"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => onRemoveStop(stop.id)}
                      className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                      title="Excluir parada"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Address text - Click opens Default GPS app */}
                <a
                  href={defaultNavUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-slate-900 mb-1 leading-snug hover:text-violet-700 transition-colors block"
                  title={`Clique para navegar via ${defaultGpsApp === 'waze' ? 'Waze' : 'Google Maps'}`}
                >
                  {stop.address}
                </a>

                {/* Adverse Weather Alert Banner */}
                {stop.weather?.isAdverse && (
                  <div className="my-1.5 p-2 bg-amber-50 border border-amber-200/80 rounded-xl text-[11px] text-amber-900 font-medium flex items-start gap-1.5 shadow-2xs">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                    <span>{stop.weather.alertText || 'Clima adverso detectado na região da entrega.'}</span>
                  </div>
                )}

                {/* Optional Customer info */}
                {(stop.customerName || stop.phone || stop.notes || stop.city) && (
                  <div className="my-2 p-2.5 bg-slate-50 border border-slate-100 rounded-xl space-y-1 text-[11px] text-slate-600">
                    {stop.customerName && (
                      <div className="flex items-center justify-between font-bold text-slate-800">
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" />
                          <span>{stop.customerName}</span>
                        </div>
                        <button
                          onClick={() => speakNextStopAnnouncement(stop.customerName, stop.address)}
                          className="text-[10px] text-violet-700 font-extrabold hover:underline flex items-center gap-1"
                          title="Anunciar em voz alta"
                        >
                          <Volume2 className="w-3 h-3" />
                          Anunciar
                        </button>
                      </div>
                    )}
                    {stop.phone && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-slate-600 font-medium">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{stop.phone}</span>
                        </div>
                        <a
                          href={getWhatsAppUrl(
                            stop.phone,
                            `Olá ${stop.customerName || ''}! Seu pedido está com nosso entregador e chegará em breve (Previsão: ${stop.estimatedEta || ''}).`
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-600 hover:text-emerald-700 font-extrabold flex items-center gap-1"
                        >
                          <MessageCircle className="w-3 h-3" />
                          WhatsApp
                        </a>
                      </div>
                    )}
                    {stop.notes && (
                      <div className="flex items-start gap-1 text-slate-500 italic">
                        <FileText className="w-3 h-3 text-slate-400 mt-0.5 shrink-0" />
                        <span>{stop.notes}</span>
                      </div>
                    )}
                    {stop.city && (
                      <div className="text-[10px] text-slate-500">
                        <span>{stop.city} - {stop.state || 'SP'} {stop.cep ? `(CEP: ${stop.cep})` : ''}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Leg Distance & Cumulative Metrics */}
                {index > 0 && stop.distanceFromPrevKm !== undefined && (
                  <div className="text-[10px] text-slate-500 font-medium flex items-center justify-between mb-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200/60">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>
                        +{stop.distanceFromPrevKm} km ({stop.durationFromPrevMin} min est.)
                      </span>
                    </div>
                    {stop.accumulatedDistanceKm !== undefined && (
                      <span className="font-bold text-slate-700">
                        Acumulado: {stop.accumulatedDistanceKm} km
                      </span>
                    )}
                  </div>
                )}

                {/* Waze & Google Maps Direct Nav Action Buttons with Default Highlight */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <a
                    href={wazeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] flex items-center justify-center gap-1 transition-all ${
                      defaultGpsApp === 'waze'
                        ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 font-black shadow-sm ring-2 ring-cyan-400/50'
                        : 'bg-slate-100 hover:bg-cyan-50 text-slate-700 font-bold border border-slate-200'
                    }`}
                    title={defaultGpsApp === 'waze' ? 'Navegar com Waze (Seu GPS Padrão)' : 'Navegar com Waze'}
                  >
                    🚗 Waze {defaultGpsApp === 'waze' && <span className="text-[9px] bg-slate-950/20 px-1 rounded">Padrão</span>}
                  </a>

                  <a
                    href={googleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] flex items-center justify-center gap-1 transition-all ${
                      defaultGpsApp === 'google'
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black shadow-sm ring-2 ring-blue-400/50'
                        : 'bg-slate-100 hover:bg-blue-50 text-slate-700 font-bold border border-slate-200'
                    }`}
                    title={defaultGpsApp === 'google' ? 'Navegar com Google Maps (Seu GPS Padrão)' : 'Navegar com Google Maps'}
                  >
                    🗺️ Google Maps {defaultGpsApp === 'google' && <span className="text-[9px] bg-white/20 px-1 rounded">Padrão</span>}
                  </a>

                  <button
                    onClick={() =>
                      onUpdateStopStatus(
                        stop.id,
                        isCompleted ? 'pendente' : 'concluido'
                      )
                    }
                    className={`p-1.5 rounded-xl text-xs font-bold transition-all ${
                      isCompleted
                        ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                    title={isCompleted ? 'Marcar como Pendente' : 'Marcar como Concluído'}
                  >
                    <CheckCircle2 className="w-4 h-4" />
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
