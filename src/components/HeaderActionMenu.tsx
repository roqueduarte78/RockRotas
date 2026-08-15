import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Sparkles,
  Plus,
  Trash2,
  FileSpreadsheet,
  FileText,
  Maximize2,
  Navigation,
  Map as MapIcon,
  Key,
  History,
  HelpCircle,
  Sun,
  Moon,
  Clock,
  Battery,
  BatteryCharging,
  BatteryWarning,
  ExternalLink,
  SlidersHorizontal,
  ChevronRight,
  Zap,
  Volume2,
  Compass,
  Share2,
  Check,
} from 'lucide-react';
import { MapEngine, RouteStop, RouteSummary, MapThemeMode } from '../types';
import { getFullRouteGoogleMapsUrl, exportCurrentRouteToExcel } from '../utils/routeOptimizer';
import { generateRoutePdfReport } from '../utils/pdfGenerator';
import { useBatteryStatus } from '../hooks/useBatteryStatus';
import { shareRouteNative } from '../utils/shareUtils';

interface HeaderActionMenuProps {
  isOpen: boolean;
  onClose: () => void;
  stops: RouteStop[];
  routeName?: string;
  routeSummary?: RouteSummary;
  mapEngine: MapEngine;
  setMapEngine: (engine: MapEngine) => void;
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
  onCreateNewRoute?: () => void;
  onCancelRoute?: () => void;
  onResetRoute?: () => void;
  hasGoogleKey: boolean;
}

export const HeaderActionMenu: React.FC<HeaderActionMenuProps> = ({
  isOpen,
  onClose,
  stops,
  routeName = 'Minha Rota de Entregas',
  routeSummary,
  mapEngine,
  setMapEngine,
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
  onCreateNewRoute,
  onCancelRoute,
  onResetRoute,
  hasGoogleKey,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const battery = useBatteryStatus();
  const activeStopsCount = stops.length;
  const fullGoogleMapsRouteUrl = getFullRouteGoogleMapsUrl(stops);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleAction = (actionFn?: () => void) => {
    if (actionFn) {
      actionFn();
      onClose();
    }
  };

  const handleShare = async () => {
    const result = await shareRouteNative(routeName, stops, routeSummary);
    setShareFeedback(result.message);
    setTimeout(() => {
      setShareFeedback(null);
      onClose();
    }, 2000);
  };

  const menuContent = (
    <div
      id="exclusive-action-menu-backdrop"
      className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-xs flex justify-end animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="menu-title"
      onClick={(e) => {
        // Close if clicking directly on backdrop
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={menuRef}
        id="exclusive-action-menu-drawer"
        className="w-full sm:w-96 max-w-full bg-slate-900 border-l border-slate-800 text-white h-full shadow-2xl flex flex-col justify-between overflow-hidden animate-slideLeft relative z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Menu Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/95 sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-violet-600/20 text-violet-400 border border-violet-500/30">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h3 id="menu-title" className="font-extrabold text-sm text-white leading-tight">
                Menu de Ações & Ferramentas
              </h3>
              <p className="text-[10px] text-slate-400 font-medium">
                {activeStopsCount} {activeStopsCount === 1 ? 'parada' : 'paradas'} na rota
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl border border-slate-700 transition-colors"
            title="Fechar menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Menu Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {/* Share Feedback Toast inside Menu */}
          {shareFeedback && (
            <div className="p-3 bg-emerald-950/90 border border-emerald-500/60 rounded-xl text-emerald-200 text-xs font-bold flex items-center gap-2 animate-bounce">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{shareFeedback}</span>
            </div>
          )}

          {/* Section 1: Gestão da Rota */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-1">
              📍 Gestão da Rota
            </span>
            <div className="grid grid-cols-1 gap-1.5">
              {/* Native Share Route Button */}
              {activeStopsCount > 0 && (
                <button
                  type="button"
                  onClick={handleShare}
                  className="w-full p-2.5 bg-gradient-to-r from-emerald-600/20 via-teal-600/20 to-cyan-600/20 hover:from-emerald-600/30 hover:to-cyan-600/30 border border-emerald-500/40 rounded-xl text-left transition-all flex items-center justify-between group shadow-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-emerald-600 text-white rounded-lg shadow-sm">
                      <Share2 className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-extrabold text-emerald-200 group-hover:text-white flex items-center gap-1.5">
                        Compartilhar Rota
                        <span className="text-[9px] bg-emerald-500/40 text-emerald-100 px-1.5 py-0.2 rounded font-black">
                          Link / WhatsApp
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400">Enviar link com itinerário e mapa completo</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
                </button>
              )}

              {onCreateNewRoute && (
                <button
                  type="button"
                  onClick={() => handleAction(onCreateNewRoute)}
                  className="w-full p-2.5 bg-gradient-to-r from-violet-600/20 to-indigo-600/20 hover:from-violet-600/30 hover:to-indigo-600/30 border border-violet-500/30 rounded-xl text-left transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-violet-600 text-white rounded-lg">
                      <Plus className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-extrabold text-white group-hover:text-violet-300">
                        Nova Rota
                      </div>
                      <div className="text-[10px] text-slate-400">Criar novo itinerário do zero</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
                </button>
              )}

              {onOpenFullMap && (
                <button
                  type="button"
                  onClick={() => handleAction(onOpenFullMap)}
                  className="w-full p-2.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-left transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 rounded-lg">
                      <Maximize2 className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-extrabold text-white group-hover:text-indigo-300">
                        Mapa em Tela Cheia
                      </div>
                      <div className="text-[10px] text-slate-400">Editar endereços e pinos arrastáveis</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
                </button>
              )}

              {activeStopsCount > 0 && (
                <a
                  href={fullGoogleMapsRouteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onClose}
                  className="w-full p-2.5 bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-700/40 rounded-xl text-left transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 rounded-lg">
                      <Navigation className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-extrabold text-cyan-200 group-hover:text-cyan-100 flex items-center gap-1">
                        Abrir Rota no Google Maps <ExternalLink className="w-3 h-3 text-cyan-400" />
                      </div>
                      <div className="text-[10px] text-cyan-300/70">Lançar navegação multiparadas no Maps</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-cyan-400 group-hover:text-white transition-colors" />
                </a>
              )}

              {activeStopsCount > 0 && (onCancelRoute || onResetRoute) && (
                <button
                  type="button"
                  onClick={() => handleAction(onCancelRoute || onResetRoute)}
                  className="w-full p-2.5 bg-rose-950/30 hover:bg-rose-900/50 border border-rose-800/40 rounded-xl text-left transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-rose-600/30 text-rose-400 border border-rose-500/30 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-extrabold text-rose-300 group-hover:text-rose-200">
                        Cancelar e Limpar Rota
                      </div>
                      <div className="text-[10px] text-rose-400/70">Remover todas as paradas atuais</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-rose-400 group-hover:text-white transition-colors" />
                </button>
              )}
            </div>
          </div>

          {/* Section 2: Inteligência Artificial */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-1">
              🤖 Inteligência Artificial & Otimização
            </span>
            <button
              type="button"
              onClick={() => handleAction(onOpenGeminiModal)}
              className="w-full p-2.5 bg-gradient-to-r from-fuchsia-600/20 via-purple-600/20 to-indigo-600/20 hover:from-fuchsia-600/30 hover:to-indigo-600/30 border border-purple-500/40 rounded-xl text-left transition-all flex items-center justify-between group shadow-xs"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-gradient-to-tr from-fuchsia-600 to-purple-600 text-white rounded-lg shadow-sm">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                </div>
                <div>
                  <div className="text-xs font-extrabold text-purple-200 group-hover:text-white flex items-center gap-1.5">
                    Otimizador Gemini IA
                    <span className="text-[9px] bg-purple-500/40 text-purple-200 px-1.5 py-0.2 rounded font-black border border-purple-400/30">
                      PRO
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Otimizar trajeto, estimar tempo e gerar mensagens
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
            </button>
          </div>

          {/* Section 3: Importar & Exportar */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-1">
              📁 Importação & Exportação
            </span>
            <div className="grid grid-cols-1 gap-1.5">
              <button
                type="button"
                onClick={() => handleAction(onOpenExcelImport)}
                className="w-full p-2.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-left transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-lg">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-white group-hover:text-emerald-300 flex items-center gap-1.5">
                      <span>Importar Romaneios / Listas</span>
                      <span className="text-[9px] bg-emerald-500/30 text-emerald-300 px-1 rounded font-bold">
                        XLSX / CSV / PDF
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400">Carregar de Excel, CSV ou documentos PDF com IA</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
              </button>

              {activeStopsCount > 0 && routeSummary && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      exportCurrentRouteToExcel(stops, routeSummary);
                      onClose();
                    }}
                    className="w-full p-2.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-left transition-all flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 bg-teal-600/30 text-teal-400 border border-teal-500/30 rounded-lg">
                        <FileSpreadsheet className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-extrabold text-white group-hover:text-teal-300">
                          Exportar Planilha Excel (.xlsx)
                        </div>
                        <div className="text-[10px] text-slate-400">Baixar rota otimizada e pacotes agrupados</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      generateRoutePdfReport(stops, routeSummary);
                      onClose();
                    }}
                    className="w-full p-2.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-left transition-all flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 bg-pink-600/30 text-pink-400 border border-pink-500/30 rounded-lg">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-extrabold text-white group-hover:text-pink-300">
                          Exportar Relatório PDF
                        </div>
                        <div className="text-[10px] text-slate-400">Resumo executivo formatado para impressão</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Section 4: Áudio, Voz & Sotaques */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-1">
              🎙️ Áudio, Voz & Sotaques PT-BR
            </span>
            {onOpenVoiceModal && (
              <button
                type="button"
                onClick={() => handleAction(onOpenVoiceModal)}
                className="w-full p-2.5 bg-gradient-to-r from-violet-600/20 via-purple-600/20 to-pink-600/20 hover:from-violet-600/30 hover:to-pink-600/30 border border-violet-500/40 rounded-xl text-left transition-all flex items-center justify-between group shadow-xs"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-gradient-to-tr from-violet-600 to-pink-600 text-white rounded-lg shadow-sm">
                    <Volume2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-violet-200 group-hover:text-white flex items-center gap-1.5">
                      Voz & Sotaques PT-BR
                      <span className="text-[9px] bg-gradient-to-r from-violet-500 to-pink-500 text-white px-1.5 py-0.2 rounded font-black">
                        9 Vozes
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Baiano, Carioca, Humor, Cuiabano, Gaúcho, Mineiro e mais
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
              </button>
            )}
          </div>

          {/* Section 5: Configurações do Mapa & Motor */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-1">
              ⚙️ Configurações do Mapa & Motor
            </span>

            {/* Map Theme Toggle */}
            <div className="p-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-amber-500/20 text-amber-400 rounded-md">
                    {isDarkModeMap ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">Tema do Mapa</div>
                    <div className="text-[9px] text-slate-400">{scheduleStatusLabel || 'Claro / Escuro'}</div>
                  </div>
                </div>
                {onToggleDarkModeMap && (
                  <button
                    type="button"
                    onClick={onToggleDarkModeMap}
                    className="px-2.5 py-1 text-xs font-extrabold bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg border border-slate-600 transition-colors"
                  >
                    Alternar
                  </button>
                )}
              </div>
            </div>

            {/* Map Engine Toggle */}
            <div className="p-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1 bg-cyan-500/20 text-cyan-400 rounded-md">
                  <MapIcon className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Motor do Mapa</div>
                  <div className="text-[9px] text-slate-400">
                    {mapEngine === 'google' ? 'Google Maps JavaScript API' : 'OpenStreetMap / Leaflet'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMapEngine(mapEngine === 'leaflet' ? 'google' : 'leaflet')}
                className="px-2.5 py-1 text-xs font-extrabold bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg border border-slate-600 transition-colors"
              >
                {mapEngine === 'google' ? 'Usar Leaflet' : 'Usar Google'}
              </button>
            </div>

            {/* Google Key Configuration */}
            <button
              type="button"
              onClick={() => handleAction(onOpenGoogleKeyModal)}
              className="w-full p-2.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-left transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-amber-600/30 text-amber-400 border border-amber-500/30 rounded-lg">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-extrabold text-white group-hover:text-amber-300 flex items-center gap-1.5">
                    Chave Google Maps API
                    {hasGoogleKey && (
                      <span className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1 rounded font-bold">
                        Configurada
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400">Gerenciar credencial Google Cloud</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
            </button>
          </div>

          {/* Section 6: Histórico & Ajuda */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-1">
              📖 Histórico & Ajuda
            </span>
            <div className="grid grid-cols-1 gap-1.5">
              {onOpenHistoryModal && (
                <button
                  type="button"
                  onClick={() => handleAction(onOpenHistoryModal)}
                  className="w-full p-2.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-left transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-violet-600/30 text-violet-400 border border-violet-500/30 rounded-lg">
                      <History className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-extrabold text-white group-hover:text-violet-300">
                        Histórico de Rotas Salvas
                      </div>
                      <div className="text-[10px] text-slate-400">Recuperar itinerários anteriores</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
                </button>
              )}

              {onOpenQuickGuide && (
                <button
                  type="button"
                  onClick={() => handleAction(onOpenQuickGuide)}
                  className="w-full p-2.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-left transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-lg">
                      <HelpCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-extrabold text-white group-hover:text-emerald-300">
                        Guia Rápido de Uso
                      </div>
                      <div className="text-[10px] text-slate-400">Instruções, atalhos e dicas de rota</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Menu Footer / Device Status */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            {battery.isLowBattery ? (
              <BatteryWarning className="w-4 h-4 text-rose-400 animate-pulse" />
            ) : battery.charging ? (
              <BatteryCharging className="w-4 h-4 text-emerald-400" />
            ) : (
              <Battery className="w-4 h-4 text-slate-400" />
            )}
            <span className="text-[11px] font-bold text-slate-300">
              Bateria: {battery.level}% {battery.charging && '(Carregando)'}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">RotaExpress v2.5</span>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(menuContent, document.body) : menuContent;
};

