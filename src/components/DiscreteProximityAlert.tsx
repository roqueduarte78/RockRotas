import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Navigation, CheckCircle2, X, Bell } from 'lucide-react';
import { RouteStop, GpsApp } from '../types';
import { getGoogleMapsUrl, getWazeUrl } from '../utils/routeOptimizer';

interface DiscreteProximityAlertProps {
  stop: RouteStop | null;
  distanceMeters: number;
  isOpen: boolean;
  onDismiss: () => void;
  onCompleteStop?: (stopId: string) => void;
  preferredGpsApp?: GpsApp;
}

export const DiscreteProximityAlert: React.FC<DiscreteProximityAlertProps> = ({
  stop,
  distanceMeters,
  isOpen,
  onDismiss,
  onCompleteStop,
  preferredGpsApp = 'google',
}) => {
  if (!isOpen || !stop) return null;

  const cleanAddr = stop.address ? stop.address.split(',')[0].trim() : 'Endereço';
  const navUrl =
    stop.lat && stop.lng
      ? preferredGpsApp === 'waze'
        ? getWazeUrl(stop.lat, stop.lng)
        : getGoogleMapsUrl(stop.lat, stop.lng, stop.address)
      : '#';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -24, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="fixed top-18 right-3 sm:right-6 z-50 max-w-sm w-[calc(100vw-24px)] bg-slate-900/95 text-white border border-amber-400/40 rounded-2xl shadow-2xl backdrop-blur-xl p-3.5 space-y-2.5 overflow-hidden"
      >
        {/* Subtle glowing accent bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-300 animate-pulse" />

        <div className="flex items-start justify-between gap-2.5 pt-0.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative p-2 bg-gradient-to-tr from-amber-500 to-orange-600 rounded-xl text-slate-950 shadow-md shrink-0">
              <Bell className="w-4 h-4 animate-bounce" />
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400"></span>
              </span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                  Próxima Parada a Menos de 500m
                </span>
                <span className="bg-amber-400/20 text-amber-300 text-[10px] font-black px-1.5 py-0.2 rounded-md border border-amber-400/30">
                  {distanceMeters}m
                </span>
              </div>
              <h4 className="font-extrabold text-xs sm:text-sm text-white truncate">
                {stop.customerName || cleanAddr}
              </h4>
              <p className="text-[11px] text-slate-300 truncate">{stop.address}</p>
            </div>
          </div>

          <button
            onClick={onDismiss}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors shrink-0"
            title="Dispensar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 pt-0.5">
          <a
            href={navUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-1.5 px-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-sm"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Navegar ({preferredGpsApp === 'waze' ? 'Waze' : 'Google'})</span>
          </a>

          {onCompleteStop && (
            <button
              onClick={() => onCompleteStop(stop.id)}
              className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-sm shrink-0"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Concluir</span>
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
