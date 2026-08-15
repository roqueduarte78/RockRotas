import React from 'react';
import {
  Truck,
  Sparkles,
  MapPin,
  Play,
  FileText,
  Edit3,
  Check,
  Battery,
  BatteryCharging,
  BatteryWarning,
  SlidersHorizontal,
  Maximize2,
} from 'lucide-react';
import { MapEngine, RouteStop, RouteSummary, MapThemeMode } from '../types';
import { useBatteryStatus } from '../hooks/useBatteryStatus';
import { HeaderActionMenu } from './HeaderActionMenu';

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
  onOpenVoiceModal?: () => void;
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
  onOpenVoiceModal,
  stops,
  routeSummary,
  onResetRoute,
  hasGoogleKey,
  onCreateNewRoute,
  onCancelRoute,
}) => {
  const activeStopsCount = stops.length;
  const battery = useBatteryStatus();

  const [isEditingName, setIsEditingName] = React.useState(false);
  const [tempName, setTempName] = React.useState(routeName);
  const [isActionMenuOpen, setIsActionMenuOpen] = React.useState(false);

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
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
        {/* Brand & Route Name */}
        <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-violet-600 via-fuchsia-600 to-pink-500 flex items-center justify-center text-white shadow-md shadow-fuchsia-500/25 shrink-0 ring-2 ring-white/10">
            <Truck className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="font-extrabold text-sm sm:text-base md:text-lg leading-tight flex items-center gap-1 truncate">
                RotaExpress <span className="hidden xs:inline text-[9px] sm:text-[10px] font-extrabold tracking-wider bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-400 text-white px-1.5 py-0.5 rounded-full uppercase shadow-xs">PRO</span>
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
                    className="bg-slate-800 text-white text-xs font-bold px-2 py-0.5 rounded-md border border-violet-500 outline-none w-32 sm:w-48"
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
                  className="group flex items-center gap-1 text-[11px] sm:text-xs text-slate-300 font-bold hover:text-white transition-colors bg-slate-800/80 px-2 py-0.5 rounded-lg border border-slate-700/60 max-w-[120px] sm:max-w-[180px] md:max-w-[240px]"
                  title="Clique para renomear a rota"
                >
                  <FileText className="w-3 h-3 text-violet-400 shrink-0" />
                  <span className="truncate">{routeName}</span>
                  <Edit3 className="w-3 h-3 text-slate-400 opacity-60 group-hover:opacity-100 group-hover:text-amber-400 transition-all shrink-0" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-1.5 sm:space-x-2.5 shrink-0">
          {/* Mode Toggle (Planejamento vs Navegar GPS) */}
          <div className="bg-slate-800/90 p-1 rounded-2xl border border-slate-700/80 flex items-center shadow-inner">
            <button
              onClick={() => setIsNavigationMode(false)}
              className={`px-2.5 sm:px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
                !isNavigationMode
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Modo Planejamento: Adicionar e organizar paradas"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Planejamento</span>
            </button>
            <button
              onClick={() => setIsNavigationMode(true)}
              disabled={activeStopsCount === 0}
              className={`px-2.5 sm:px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
                isNavigationMode
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed'
              }`}
              title={activeStopsCount === 0 ? 'Adicione paradas para navegar' : 'Iniciar navegação GPS'}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Navegar</span>
            </button>
          </div>

          {/* Quick Gemini AI Optimization Button */}
          <button
            onClick={onOpenGeminiModal}
            className="hidden md:flex px-2.5 sm:px-3 py-1.5 bg-gradient-to-r from-fuchsia-600 via-purple-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-purple-600/20 items-center gap-1.5 ring-1 ring-white/10"
            title="Otimizar rota e gerar mensagens com IA Gemini"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
            <span>IA Gemini</span>
          </button>

          {/* Quick Full Map button (desktop) */}
          {onOpenFullMap && (
            <button
              onClick={onOpenFullMap}
              className="hidden lg:flex px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all border border-slate-700 items-center gap-1.5 shadow-xs"
              title="Abrir mapa em tela cheia"
            >
              <Maximize2 className="w-3.5 h-3.5 text-violet-400" />
              <span>Mapa</span>
            </button>
          )}

          {/* Battery Indicator */}
          <div
            className={`px-2 py-1.5 rounded-xl border text-xs font-extrabold flex items-center gap-1 transition-all ${
              battery.isLowBattery
                ? 'bg-rose-950/90 text-rose-300 border-rose-600 shadow-md animate-pulse'
                : battery.charging
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/60'
                : battery.level <= 30
                ? 'bg-amber-950/80 text-amber-300 border-amber-600/60'
                : 'bg-slate-800/90 text-slate-300 border-slate-700 hidden sm:flex'
            }`}
            title={
              battery.isLowBattery
                ? `⚠️ Bateria crítica (${battery.level}%): Conecte ao carregador!`
                : `Bateria: ${battery.level}% ${battery.charging ? '(Carregando)' : ''}`
            }
          >
            {battery.isLowBattery ? (
              <BatteryWarning className="w-3.5 h-3.5 text-rose-400" />
            ) : battery.charging ? (
              <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Battery className="w-3.5 h-3.5 text-slate-300" />
            )}
            <span className="text-[11px] font-black">{battery.level}%</span>
          </div>

          {/* EXCLUSIVE MENU BUTTON (Central de Ações & Ferramentas) */}
          <button
            type="button"
            id="btn-exclusive-actions-menu"
            onClick={() => setIsActionMenuOpen(true)}
            className="px-3 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-black rounded-xl transition-all shadow-md flex items-center gap-1.5 ring-2 ring-violet-400/40"
            title="Abrir Menu com todas as Ações, Importação, Exportação e Configurações"
          >
            <SlidersHorizontal className="w-4 h-4 text-violet-200" />
            <span>Menu</span>
          </button>
        </div>
      </div>

      {/* Exclusive Action Menu Drawer / Modal */}
      <HeaderActionMenu
        isOpen={isActionMenuOpen}
        onClose={() => setIsActionMenuOpen(false)}
        stops={stops}
        routeName={routeName}
        routeSummary={routeSummary}
        mapEngine={mapEngine}
        setMapEngine={setMapEngine}
        isDarkModeMap={isDarkModeMap}
        mapThemeMode={mapThemeMode}
        scheduleStatusLabel={scheduleStatusLabel}
        onToggleDarkModeMap={onToggleDarkModeMap}
        onOpenExcelImport={onOpenExcelImport}
        onOpenGeminiModal={onOpenGeminiModal}
        onOpenGoogleKeyModal={onOpenGoogleKeyModal}
        onOpenHistoryModal={onOpenHistoryModal}
        onOpenFullMap={onOpenFullMap}
        onOpenQuickGuide={onOpenQuickGuide}
        onOpenVoiceModal={onOpenVoiceModal}
        onCreateNewRoute={onCreateNewRoute}
        onCancelRoute={onCancelRoute}
        onResetRoute={onResetRoute}
        hasGoogleKey={hasGoogleKey}
      />
    </header>
  );
};

