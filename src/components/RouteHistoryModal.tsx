import React, { useState, useEffect } from 'react';
import {
  History,
  Bookmark,
  FolderOpen,
  Trash2,
  Edit3,
  Check,
  X,
  Plus,
  MapPin,
  Calendar,
  Clock,
  Sparkles,
  BarChart2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { RouteStop } from '../types';
import { computeRouteSummary } from '../utils/routeOptimizer';
import { RoutePerformanceChart } from './RoutePerformanceChart';

export interface SavedRouteItem {
  id: string;
  name: string;
  createdAt: string;
  stops: RouteStop[];
  totalDistanceKm: number;
  totalDurationMin: number;
}

interface RouteHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStops: RouteStop[];
  currentRouteName: string;
  onLoadRoute: (savedStops: RouteStop[], savedName: string) => void;
}

export const RouteHistoryModal: React.FC<RouteHistoryModalProps> = ({
  isOpen,
  onClose,
  currentStops,
  currentRouteName,
  onLoadRoute,
}) => {
  const [history, setHistory] = useState<SavedRouteItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNameText, setEditNameText] = useState<string>('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [expandedChartId, setExpandedChartId] = useState<string | null>(null);
  const [showCurrentChart, setShowCurrentChart] = useState<boolean>(false);

  // Load history from localStorage on open
  useEffect(() => {
    if (isOpen) {
      try {
        const saved = localStorage.getItem('ROTA_EXPRESS_ROUTE_HISTORY');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setHistory(parsed);
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar histórico de rotas:', err);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Save current route to history
  const handleSaveCurrentRoute = () => {
    if (!currentStops || currentStops.length === 0) {
      alert('Não há paradas na rota atual para salvar.');
      return;
    }

    const summary = computeRouteSummary(currentStops);
    const newItem: SavedRouteItem = {
      id: Date.now().toString(),
      name: currentRouteName || `Rota ${new Date().toLocaleDateString('pt-BR')}`,
      createdAt: new Date().toISOString(),
      stops: [...currentStops],
      totalDistanceKm: summary.totalDistanceKm,
      totalDurationMin: summary.totalDurationMin,
    };

    const updated = [newItem, ...history];
    setHistory(updated);
    try {
      localStorage.setItem('ROTA_EXPRESS_ROUTE_HISTORY', JSON.stringify(updated));
    } catch (err) {
      console.warn('Erro ao salvar no localStorage:', err);
    }

    setSaveSuccessMsg('Rota salva com sucesso no Histórico!');
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  // Delete route from history
  const handleDeleteRoute = (id: string, name: string) => {
    const updated = history.filter((item) => item.id !== id);
    setHistory(updated);
    try {
      localStorage.setItem('ROTA_EXPRESS_ROUTE_HISTORY', JSON.stringify(updated));
    } catch (err) {
      console.warn('Erro ao atualizar histórico:', err);
    }
  };

  // Start inline rename
  const handleStartRename = (item: SavedRouteItem) => {
    setEditingId(item.id);
    setEditNameText(item.name);
  };

  // Save inline rename
  const handleSaveRename = (id: string) => {
    if (!editNameText.trim()) return;
    const updated = history.map((item) =>
      item.id === id ? { ...item, name: editNameText.trim() } : item
    );
    setHistory(updated);
    setEditingId(null);
    try {
      localStorage.setItem('ROTA_EXPRESS_ROUTE_HISTORY', JSON.stringify(updated));
    } catch (err) {
      console.warn('Erro ao atualizar nome no histórico:', err);
    }
  };

  // Load selected route into app
  const handleSelectRoute = (item: SavedRouteItem) => {
    onLoadRoute(item.stops, item.name);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="bg-slate-900 text-white rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-800 overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/20">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-white leading-tight">
                Histórico de Rotas Salvas
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Gerencie, compare performance (Recharts) e recarregue itinerários
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Action Bar: Save Current Route & Toggle Chart */}
        <div className="p-4 bg-slate-800/60 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-violet-400 shrink-0" />
            <span className="text-xs font-bold text-slate-300">
              Rota atual: <span className="text-white font-extrabold">{currentRouteName}</span> ({currentStops.length} paradas)
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {currentStops.length > 0 && (
              <button
                onClick={() => setShowCurrentChart(!showCurrentChart)}
                className="flex-1 sm:flex-none px-3.5 py-2 bg-slate-700 hover:bg-slate-600 text-violet-300 font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 border border-slate-600"
              >
                <BarChart2 className="w-4 h-4 text-cyan-400" />
                {showCurrentChart ? 'Ocultar Gráfico' : 'Gráfico Recharts'}
              </button>
            )}
            <button
              onClick={handleSaveCurrentRoute}
              disabled={currentStops.length === 0}
              className="flex-1 sm:flex-none px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Salvar Rota
            </button>
          </div>
        </div>

        {/* Active Route Recharts Visualization */}
        {showCurrentChart && currentStops.length > 0 && (
          <div className="p-4 border-b border-slate-800 bg-slate-950/80">
            <RoutePerformanceChart stops={currentStops} routeName={`${currentRouteName} (Atual)`} />
          </div>
        )}

        {/* Alert Feedback Banner */}
        {saveSuccessMsg && (
          <div className="mx-4 mt-3 p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl text-emerald-300 text-xs font-extrabold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            {saveSuccessMsg}
          </div>
        )}

        {/* History List Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {history.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-slate-800 text-slate-500 flex items-center justify-center mx-auto border border-slate-700/60">
                <FolderOpen className="w-8 h-8" />
              </div>
              <h4 className="font-extrabold text-sm text-slate-300">
                Nenhuma rota salva no histórico
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                Você pode salvar o itinerário de paradas atual para recarregá-lo facilmente a qualquer momento.
              </p>
            </div>
          ) : (
            history.map((item) => {
              const dateFormatted = new Date(item.createdAt).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              const isEditing = editingId === item.id;
              const isChartExpanded = expandedChartId === item.id;

              return (
                <div
                  key={item.id}
                  className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-2xl p-4 transition-all space-y-3 group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    {/* Route Name or Rename Input */}
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editNameText}
                            onChange={(e) => setEditNameText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(item.id)}
                            autoFocus
                            className="bg-slate-900 border border-violet-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl w-full outline-none"
                          />
                          <button
                            onClick={() => handleSaveRename(item.id)}
                            className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-sm text-white truncate">
                            {item.name}
                          </h4>
                          <button
                            onClick={() => handleStartRename(item)}
                            className="p-1 text-slate-400 hover:text-amber-400 transition-colors"
                            title="Renomear rota"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      <div className="flex items-center gap-3 text-[11px] text-slate-400 font-medium mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          {dateFormatted}
                        </span>
                        <span className="flex items-center gap-1 text-violet-300 font-bold">
                          <MapPin className="w-3 h-3 text-violet-400" />
                          {item.stops.length} paradas
                        </span>
                        {item.totalDistanceKm > 0 && (
                          <span className="flex items-center gap-1 text-cyan-300 font-bold">
                            <Clock className="w-3 h-3 text-cyan-400" />
                            {item.totalDistanceKm} km
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons: Recharts, Load, Delete */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setExpandedChartId(isChartExpanded ? null : item.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all border ${
                          isChartExpanded
                            ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                            : 'bg-slate-700/80 hover:bg-slate-700 text-slate-200 border-slate-600'
                        }`}
                        title="Ver gráfico comparativo Recharts"
                      >
                        <BarChart2 className="w-3.5 h-3.5" />
                        <span>Gráfico Tempo</span>
                        {isChartExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        onClick={() => handleSelectRoute(item)}
                        className="px-3.5 py-1.5 bg-violet-600 hover:bg-violet-500 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        Carregar
                      </button>

                      <button
                        onClick={() => handleDeleteRoute(item.id, item.name)}
                        className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors"
                        title="Excluir rota do histórico"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Recharts Bar Chart for this specific saved route item */}
                  {isChartExpanded && (
                    <div className="pt-2">
                      <RoutePerformanceChart stops={item.stops} routeName={item.name} />
                    </div>
                  )}

                  {/* Preview of first 3 addresses */}
                  {!isChartExpanded && (
                    <div className="bg-slate-900/60 rounded-xl p-2.5 text-[11px] text-slate-400 space-y-1">
                      <span className="font-bold text-[10px] text-slate-500 uppercase tracking-wider block mb-1">
                        Amostra do Itinerário:
                      </span>
                      {item.stops.slice(0, 3).map((stop, idx) => (
                        <div key={stop.id || idx} className="truncate flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-slate-800 text-slate-300 text-[9px] font-extrabold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <span className="truncate text-slate-300">{stop.address}</span>
                        </div>
                      ))}
                      {item.stops.length > 3 && (
                        <p className="text-[10px] text-slate-500 font-medium pl-5">
                          ...e mais {item.stops.length - 3} paradas.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 text-right">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
