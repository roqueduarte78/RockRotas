import React from 'react';
import {
  Truck,
  Navigation,
  FileSpreadsheet,
  Sparkles,
  MapPin,
  Map as MapIcon,
  Key,
  ExternalLink,
  Play,
  RotateCcw,
  Moon,
  Sun,
  FileText,
  Plus,
  Trash2,
  Edit3,
  Check,
  History,
  Battery,
  BatteryCharging,
  BatteryWarning,
  Zap,
  Maximize2,
  HelpCircle,
  Clock,
} from 'lucide-react';
import { MapEngine, RouteStop, RouteSummary, MapThemeMode } from '../types';
import { getFullRouteGoogleMapsUrl, exportCurrentRouteToExcel } from '../utils/routeOptimizer';
import { generateRoutePdfReport } from '../utils/pdfGenerator';
import { useBatteryStatus } from '../hooks/useBatteryStatus';

interface HeaderProps {
  routeName?: string;
  onUpdateRouteName?: (name: string) => void;
  mapEngine: MapEngine;
  setMapEngine: (engine: MapEngine) => void;
  isNavigationMode: boolean;
  setIsNavigationMode: (nav: boolean) => void;
  isDarkModeMap?: boolean;
  mapThemeMode?: MapThemeMode;
  scheduleStatusLabel?: string;
  onToggleDarkModeMap?: () => void;
  onOpenExcelImport: () => void;
  onOpenGeminiModal: () => void;
  onOpenGoogleKeyModal: () => void;
  onOpenHistoryModal?: () => void;
  onOpenFullMap?: () => void;
  onOpenQuickGuide?: () => void;
  stops: RouteStop[];
  routeSummary?: RouteSummary;
  onResetRoute: () => void;
  hasGoogleKey: boolean;
  onCreateNewRoute?: () => void;
  onCancelRoute?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  routeName = 'Minha Rota de Entregas',
  onUpdateRouteName,
  mapEngine,
  setMapEngine,
  isNavigationMode,
  setIsNavigationMode,
  isDarkModeMap = false,
  mapThemeMode = 'auto',
  scheduleStatusLabel = '',
  onToggleDarkModeMap,
  onOpenExcelImport,
  onOpenGeminiModal,
  onOpenGoogleKeyModal,
  onOpenHistoryModal,
  onOpenFullMap,
  onOpenQuickGuide,
  stops,
  routeSummary,
  onResetRoute,
  hasGoogleKey,
  onCreateNewRoute,
  onCancelRoute,
}) => {
  const fullGoogleMapsRouteUrl = getFullRouteGoogleMapsUrl(stops);
  const activeStopsCount = stops.length;
  const battery = useBatteryStatus();

  const [isEditingName, setIsEditingName] = React.useState(false);
  const [tempName, setTempName] = React.useState(routeName);

  React.useEffect(() => {
    setTempName(routeName);
  }, [routeName]);

  const handleSaveRouteName = () => {
    if (tempName.trim() && onUpdateRouteName) {
      onUpdateRouteName(tempName.trim());
    }
    setIsEditingName(false);
  };

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800/80 sticky top-0 z-30 shadow-lg backdrop-blur-md bg-slate-900/95">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand & Route Name */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-violet-600 via-fuchsia-600 to-pink-500 flex items-center justify-center text-white shadow-md shadow-fuchsia-500/25 shrink-0 ring-2 ring-white/10">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-base sm:text-lg leading-tight flex items-center gap-1.5">
                RotaExpress <span className="text-[10px] font-extrabold tracking-wider bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-400 text-white px-2 py-0.5 rounded-full uppercase shadow-xs">PRO GPS</span>
              </h1>
            </div>

            {/* Editable Route Name Pill */}
            <div className="flex items-center gap-1 mt-0.5">
              {isEditingName ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    onBlur={handleSaveRouteName}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveRouteName()}
                    autoFocus
                    className="bg-slate-800 text-white text-xs font-bold px-2 py-0.5 rounded-md border border-violet-500 outline-none w-40 sm:w-56"
                  />
                  <button
                    onClick={handleSaveRouteName}
                    className="p-1 bg-emerald-600 text-white rounded-md hover:bg-emerald-500"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsEditingName(true)}
                  className="group flex items-center gap-1.5 text-xs text-slate-300 font-bold hover:text-white transition-colors bg-slate-800/80 px-2 py-0.5 rounded-lg border border-slate-700/60"
                  title="Clique para renomear a rota"
                >
                  <FileText className="w-3 h-3 text-violet-400" />
                  <span className="max-w-[140px] sm:max-w-[220px] truncate">{routeName}</span>
                  <Edit3 className="w-3 h-3 text-slate-400 opacity-60 group-hover:opacity-100 group-hover:text-amber-400 transition-all" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Mode Toggle */}
          <div className="bg-slate-800/90 p-1 rounded-2xl border border-slate-700/80 flex items-center shadow-inner">
            <button
              onClick={() => setIsNavigationMode(false)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
                !isNavigationMode
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Planejamento</span>
            </button>
            <button
              onClick={() => setIsNavigationMode(true)}
              disabled={activeStopsCount === 0}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
                isNavigationMode
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed'
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Navegar GPS</span>
            </button>
          </div>

          {/* Gemini AI Optimization */}
          <button
            onClick={onOpenGeminiModal}
            className="px-3 py-1.5 bg-gradient-to-r from-fuchsia-600 via-purple-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-purple-600/20 flex items-center gap-1.5 ring-1 ring-white/10"
            title="Otimizar rota e gerar mensagens com IA Gemini"
          >
            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
            <span className="hidden sm:inline">IA Gemini</span>
          </button>

          {/* Export Route Excel & PDF */}
          {activeStopsCount > 0 && routeSummary && (
            <>
              <button
                onClick={() => exportCurrentRouteToExcel(stops, routeSummary)}
                className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5"
                title="Exportar rota otimizada atual para planilha Excel (.xlsx)"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
                <span className="hidden lg:inline">Excel</span>
              </button>

              <button
                onClick={() => generateRoutePdfReport(stops, routeSummary)}
                className="px-3 py-1.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5"
                title="Gerar resumo em PDF da rota"
              >
                <FileText className="w-4 h-4" />
                <span className="hidden lg:inline">PDF</span>
              </button>
            </>
          )}

          {/* Full Map Modal Button */}
          {onOpenFullMap && (
            <button
              onClick={onOpenFullMap}
              className="px-3 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-extrabold rounded-xl transition-all shadow-md flex items-center gap-1.5 ring-2 ring-violet-500/30"
              title="Abrir mapa em tela cheia com todas as paradas e edição de endereço/posição"
            >
              <Maximize2 className="w-4 h-4 text-violet-200" />
              <span>Mapa Completo</span>
            </button>
          )}

          {/* Map Theme Toggle (Auto Schedule / Manual) */}
          {onToggleDarkModeMap && (
            <button
              onClick={onToggleDarkModeMap}
              className={`p-2 rounded-xl border transition-all relative flex items-center justify-center ${
                isDarkModeMap
                  ? 'bg-indigo-950 text-indigo-300 border-indigo-700/80 hover:bg-indigo-900 shadow-xs'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
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

          {/* Quick Guide Modal Button */}
          {onOpenQuickGuide && (
            <button
              onClick={onOpenQuickGuide}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all border border-slate-700 flex items-center gap-1.5 shadow-xs"
              title="Abrir Guia Rápido de Uso"
            >
              <HelpCircle className="w-4 h-4 text-emerald-400" />
              <span className="hidden md:inline">Guia Rápido</span>
            </button>
          )}

          {/* History Modal Button */}
          {onOpenHistoryModal && (
            <button
              onClick={onOpenHistoryModal}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all border border-slate-700 flex items-center gap-1.5 shadow-xs"
              title="Histórico de Rotas Salvas"
            >
              <History className="w-4 h-4 text-violet-400" />
              <span className="hidden sm:inline">Histórico</span>
            </button>
          )}

          {/* Import Excel */}
          <button
            onClick={onOpenExcelImport}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all border border-slate-700 flex items-center gap-1.5 shadow-xs"
            title="Importar planilha Excel ou CSV"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span className="hidden lg:inline">Importar</span>
          </button>

          {/* Full Route Link in Google Maps */}
          {activeStopsCount > 0 && (
            <a
              href={fullGoogleMapsRouteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-cyan-950/80 text-cyan-300 hover:bg-cyan-900/80 border border-cyan-700/60 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-xs"
              title="Abrir rota completa de entregas no Google Maps App"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Abrir no Maps</span>
              <ExternalLink className="w-3 h-3 text-cyan-400" />
            </a>
          )}

          {/* Map Engine Toggle */}
          <button
            onClick={() => {
              if (mapEngine === 'leaflet') {
                setMapEngine('google');
              } else {
                setMapEngine('leaflet');
              }
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 ${
              mapEngine === 'google'
                ? 'bg-blue-950/80 text-cyan-300 border-cyan-500/40 shadow-xs'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
            title="Alternar motor do mapa entre OpenStreetMap/Leaflet e Google Maps"
          >
            <MapIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {mapEngine === 'google' ? 'Google Maps' : 'Leaflet / OSM'}
            </span>
          </button>

          {/* Battery Status Indicator & Low Battery Warning */}
          <div
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-extrabold flex items-center gap-1.5 transition-all ${
              battery.isLowBattery
                ? 'bg-rose-950/90 text-rose-300 border-rose-600 shadow-md animate-pulse ring-2 ring-rose-500/50'
                : battery.charging
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/60'
                : battery.level <= 30
                ? 'bg-amber-950/80 text-amber-300 border-amber-600/60'
                : 'bg-slate-800/90 text-slate-300 border-slate-700'
            }`}
            title={
              battery.isLowBattery
                ? `⚠️ ALERTA DE BATERIA CRÍTICA (${battery.level}%): Conecte o carregador para não perder o GPS durante a rota!`
                : battery.charging
                ? `Bateria: ${battery.level}% (Carregando)`
                : `Bateria do Dispositivo: ${battery.level}%`
            }
          >
            {battery.isLowBattery ? (
              <BatteryWarning className="w-4 h-4 text-rose-400" />
            ) : battery.charging ? (
              <BatteryCharging className="w-4 h-4 text-emerald-400" />
            ) : (
              <Battery className="w-4 h-4 text-slate-300" />
            )}
            <span className="text-[11px] font-black">{battery.level}%</span>
            {battery.isLowBattery && (
              <span className="hidden xl:inline text-[10px] bg-rose-600 text-white px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide">
                Bateria Fraca
              </span>
            )}
          </div>

          {/* Google Key Config */}
          <button
            onClick={onOpenGoogleKeyModal}
            className={`p-2 rounded-xl border transition-all ${
              hasGoogleKey
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
            }`}
            title="Configurar Chave Google Maps API"
          >
            <Key className="w-4 h-4 text-amber-400" />
          </button>

          {/* Nova Rota Button */}
          {onCreateNewRoute && (
            <button
              onClick={onCreateNewRoute}
              className="px-3 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-black rounded-xl transition-all shadow-md flex items-center gap-1.5"
              title="Iniciar nova rota em branco"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Nova Rota</span>
            </button>
          )}

          {/* Cancelar Rota Button */}
          {activeStopsCount > 0 && (
            <button
              onClick={onCancelRoute || onResetRoute}
              className="px-3 py-1.5 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-700/60 text-xs font-black rounded-xl transition-all flex items-center gap-1.5 shadow-xs"
              title="Cancelar e limpar rota atual"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">Cancelar Rota</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
