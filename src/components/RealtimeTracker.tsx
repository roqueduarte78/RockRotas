import React, { useState, useEffect, useRef } from 'react';
import {
  Navigation,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  RotateCcw,
  Phone,
  MessageCircle,
  Clock,
  Compass,
  MapPin,
  ChevronRight,
  Sparkles,
  Bell,
  BellRing,
  FileText,
  Volume2,
} from 'lucide-react';
import { RouteStop, DriverLocation, RouteSummary } from '../types';
import {
  getWazeUrl,
  getGoogleMapsUrl,
  getWhatsAppUrl,
  calculateHaversineDistanceKm,
  estimateDrivingDurationMin,
} from '../utils/routeOptimizer';
import { generateRoutePdfReport } from '../utils/pdfGenerator';

interface RealtimeTrackerProps {
  stops: RouteStop[];
  onUpdateStopStatus: (id: string, status: RouteStop['status']) => void;
  driverLocation: DriverLocation | null;
  setDriverLocation: (loc: DriverLocation | null) => void;
  onExitNavigation: () => void;
  summary: RouteSummary;
}

export const RealtimeTracker: React.FC<RealtimeTrackerProps> = ({
  stops,
  onUpdateStopStatus,
  driverLocation,
  setDriverLocation,
  onExitNavigation,
  summary,
}) => {
  const [isSimulating, setIsSimulating] = useState(false);
  const [alertedStops, setAlertedStops] = useState<Record<string, boolean>>({});
  const [proximityAlert, setProximityAlert] = useState<{
    stopId: string;
    address: string;
    distanceKm: number;
  } | null>(null);

  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'denied'
  );

  // Find next pending stop
  const pendingStops = stops.filter((s) => s.status === 'pendente' || s.status === 'em_transito');
  const currentTargetStop = pendingStops[0] || null;

  // Request Push Notification Permissions
  const handleRequestNotificationPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        new Notification('🔔 Alertas RotaExpress Ativados!', {
          body: 'Você receberá notificações automáticas quando se aproximar das paradas de entrega.',
        });
      }
    }
  };

  // Play audio chime for proximity alert
  const playAlertChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5 note
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3); // A5 note

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
      console.warn('Audio alert play failed:', e);
    }
  };

  // Real GPS Geolocation Watcher
  useEffect(() => {
    if (!('geolocation' in navigator) || isSimulating) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setDriverLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          speed: pos.coords.speed,
          heading: pos.coords.heading,
          updatedAt: new Date().toISOString(),
        });
      },
      (err) => {
        console.warn('Geolocation warning:', err.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 1000,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isSimulating, setDriverLocation]);

  // Live Simulation loop (for testing without moving)
  useEffect(() => {
    if (!isSimulating || !currentTargetStop || !currentTargetStop.lat || !currentTargetStop.lng) return;

    const interval = setInterval(() => {
      setDriverLocation((prev) => {
        const startLat = prev ? prev.lat : currentTargetStop.lat! - 0.012;
        const startLng = prev ? prev.lng : currentTargetStop.lng! - 0.012;

        const targetLat = currentTargetStop.lat!;
        const targetLng = currentTargetStop.lng!;

        // Move 15% closer to target each tick
        const nextLat = startLat + (targetLat - startLat) * 0.15;
        const nextLng = startLng + (targetLng - startLng) * 0.15;

        return {
          lat: nextLat,
          lng: nextLng,
          speed: 45,
          updatedAt: new Date().toISOString(),
        };
      });
    }, 1500);

    return () => clearInterval(interval);
  }, [isSimulating, currentTargetStop, setDriverLocation]);

  // Distance & ETA calculation from driver position to target stop
  let distanceToTargetKm = currentTargetStop?.distanceFromPrevKm || 0;
  let etaMin = currentTargetStop?.durationFromPrevMin || 0;

  if (driverLocation && currentTargetStop?.lat && currentTargetStop?.lng) {
    distanceToTargetKm = calculateHaversineDistanceKm(
      driverLocation.lat,
      driverLocation.lng,
      currentTargetStop.lat,
      currentTargetStop.lng
    );
    etaMin = estimateDrivingDurationMin(distanceToTargetKm);
  }

  // Proximity Alert Trigger (< 0.5 km = 500 meters)
  useEffect(() => {
    if (!currentTargetStop || !driverLocation) return;

    if (distanceToTargetKm <= 0.5 && !alertedStops[currentTargetStop.id]) {
      setAlertedStops((prev) => ({ ...prev, [currentTargetStop.id]: true }));
      setProximityAlert({
        stopId: currentTargetStop.id,
        address: currentTargetStop.address,
        distanceKm: distanceToTargetKm,
      });

      playAlertChime();

      // Trigger Push Notification if allowed
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('📍 Aproximando-se da Parada!', {
          body: `Você está a ${Math.round(distanceToTargetKm * 1000)}m de ${currentTargetStop.address}`,
        });
      }
    }
  }, [distanceToTargetKm, currentTargetStop, driverLocation, alertedStops]);

  const handleCompleteTargetStop = () => {
    if (currentTargetStop) {
      onUpdateStopStatus(currentTargetStop.id, 'concluido');
      setProximityAlert(null);
    }
  };

  const handleFailTargetStop = () => {
    if (currentTargetStop) {
      onUpdateStopStatus(currentTargetStop.id, 'falha');
      setProximityAlert(null);
    }
  };

  const handleGeneratePdf = () => {
    generateRoutePdfReport(stops, summary);
  };

  const wazeUrl = currentTargetStop?.lat && currentTargetStop?.lng
    ? getWazeUrl(currentTargetStop.lat, currentTargetStop.lng)
    : '#';

  const googleUrl = currentTargetStop?.lat && currentTargetStop?.lng
    ? getGoogleMapsUrl(currentTargetStop.lat, currentTargetStop.lng, currentTargetStop.address)
    : '#';

  return (
    <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950 text-white p-4 sm:p-6 border-b border-indigo-900/50 shadow-2xl relative z-20">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Proximity Alert Banner */}
        {proximityAlert && (
          <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-slate-950 p-3.5 rounded-2xl shadow-xl flex items-center justify-between gap-3 animate-pulse border-2 border-amber-300">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-950 text-amber-400 rounded-xl font-bold">
                <BellRing className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-950">
                  🔔 AVISO DE PROXIMIDADE DA PARADA (500M)
                </h4>
                <p className="font-black text-sm text-slate-950 leading-tight">
                  Você está a apenas {Math.round(proximityAlert.distanceKm * 1000)} metros de {proximityAlert.address}!
                </p>
              </div>
            </div>
            <button
              onClick={() => setProximityAlert(null)}
              className="px-3 py-1 bg-slate-950 text-amber-300 hover:text-white rounded-xl text-xs font-bold transition-all shrink-0"
            >
              Entendido
            </button>
          </div>
        )}

        {/* Navigation HUD Status & Controls */}
        <div className="flex flex-col lg:flex-row items-stretch justify-between gap-4">
          <div className="flex-1 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <h3 className="font-black text-sm uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Compass className="w-4 h-4 animate-spin text-emerald-400" />
                  Modo Navegação GPS ao Vivo
                </h3>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Notification Permission Button */}
                {notificationPermission !== 'granted' && (
                  <button
                    onClick={handleRequestNotificationPermission}
                    className="px-3 py-1.5 bg-indigo-900/80 hover:bg-indigo-800 text-cyan-300 border border-indigo-700/80 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
                    title="Ativar Notificações Push do navegador para avisar a aproximação de cada entrega"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>Ativar Alertas Push</span>
                  </button>
                )}

                {/* PDF Report Export Button */}
                <button
                  onClick={handleGeneratePdf}
                  className="px-3 py-1.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md"
                  title="Gerar resumo em PDF com histórico e status de cada entrega"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Baixar Relatório PDF</span>
                </button>

                {/* Simulation Toggle for testing */}
                <button
                  onClick={() => setIsSimulating(!isSimulating)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                    isSimulating
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-xs'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                  }`}
                  title="Ativar/desativar simulação de deslocamento GPS para testes"
                >
                  {isSimulating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{isSimulating ? 'Simulando GPS' : 'Testar com Simulação'}</span>
                </button>

                <button
                  onClick={onExitNavigation}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 transition-all"
                >
                  Sair da Navegação
                </button>
              </div>
            </div>

            {/* Current Target Stop Highlight Card */}
            {currentTargetStop ? (
              <div className="bg-slate-800/90 border border-indigo-500/30 rounded-2xl p-4 space-y-3 shadow-xl backdrop-blur-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-400 flex items-center gap-1 mb-0.5">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                      </span>
                      PRÓXIMA DESTINAÇÃO
                    </span>
                    <h4 className="font-black text-base sm:text-lg text-white leading-tight">
                      {currentTargetStop.address}
                    </h4>
                  </div>
                  <div className="text-right shrink-0 bg-gradient-to-r from-indigo-950 to-purple-950 border border-indigo-800/80 px-3 py-1.5 rounded-xl shadow-inner">
                    <span className="text-lg font-black text-cyan-300">{distanceToTargetKm} km</span>
                    <span className="text-[10px] text-slate-300 block font-medium">ETA: {etaMin} min</span>
                  </div>
                </div>

                {/* Customer Details */}
                {(currentTargetStop.customerName || currentTargetStop.phone || currentTargetStop.notes) && (
                  <div className="p-2.5 bg-slate-900/80 rounded-xl text-xs space-y-1 border border-slate-700/80">
                    {currentTargetStop.customerName && (
                      <div className="font-bold text-slate-200">
                        👤 Cliente: {currentTargetStop.customerName}
                      </div>
                    )}
                    {currentTargetStop.phone && (
                      <div className="text-slate-300 flex items-center gap-2 font-medium">
                        <span>📞 {currentTargetStop.phone}</span>
                        <a
                          href={getWhatsAppUrl(
                            currentTargetStop.phone,
                            `Olá ${currentTargetStop.customerName || ''}! Nosso motorista está a caminho da sua entrega.`
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-400 hover:underline font-extrabold flex items-center gap-1 text-[11px]"
                        >
                          <MessageCircle className="w-3 h-3" />
                          Enviar WhatsApp
                        </a>
                      </div>
                    )}
                    {currentTargetStop.notes && (
                      <div className="text-amber-300 italic text-[11px] font-medium">
                        📝 {currentTargetStop.notes}
                      </div>
                    )}
                  </div>
                )}

                {/* Quick Navigation Launchers */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <a
                    href={wazeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2.5 px-3 bg-gradient-to-r from-cyan-400 to-teal-400 hover:from-cyan-300 hover:to-teal-300 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
                  >
                    🚗 NAVEGAR WAZE
                  </a>

                  <a
                    href={googleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2.5 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
                  >
                    🗺️ GOOGLE MAPS
                  </a>

                  <button
                    onClick={handleCompleteTargetStop}
                    className="py-2.5 px-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4 text-slate-950" />
                    CONCLUIR PARADA
                  </button>

                  <button
                    onClick={handleFailTargetStop}
                    className="py-2.5 px-3 bg-rose-950/90 hover:bg-rose-900 text-rose-300 font-bold text-xs rounded-xl border border-rose-800 transition-all flex items-center justify-center gap-1.5"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    FALHA DE ENTREGA
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-emerald-950/80 border border-emerald-700/80 text-emerald-200 p-6 rounded-2xl text-center space-y-3 shadow-xl">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto animate-bounce" />
                <h4 className="font-black text-lg text-white">Todas as Entregas Concluídas!</h4>
                <p className="text-xs text-emerald-300 font-medium max-w-sm mx-auto">
                  Parabéns! Todas as paradas da sua rota foram visitadas e registradas com sucesso.
                </p>

                <button
                  onClick={handleGeneratePdf}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all inline-flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Gerar e Baixar Relatório PDF
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
