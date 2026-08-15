import React from 'react';
import { X, Camera, Calendar, Clock, MapPin, Trash2, Download, User } from 'lucide-react';
import { RouteStop } from '../types';

interface ProofPhotoViewerModalProps {
  isOpen: boolean;
  stop: RouteStop | null;
  onClose: () => void;
  onRetakePhoto?: (stop: RouteStop) => void;
  onDeletePhoto?: (stopId: string) => void;
}

export const ProofPhotoViewerModal: React.FC<ProofPhotoViewerModalProps> = ({
  isOpen,
  stop,
  onClose,
  onRetakePhoto,
  onDeletePhoto,
}) => {
  if (!isOpen || !stop || !stop.deliveryProofPhoto) return null;

  const handleDownload = () => {
    if (!stop.deliveryProofPhoto) return;
    const a = document.createElement('a');
    a.href = stop.deliveryProofPhoto;
    a.download = `comprovante-parada-${stop.id}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl flex flex-col text-slate-100 max-h-[95vh]">
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white">Comprovante de Entrega</h3>
              <p className="text-[11px] text-slate-400">
                {stop.deliveryProofTimestamp || 'Capturado no app'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Image Full Size Container */}
        <div className="p-3 bg-black flex-1 overflow-hidden flex items-center justify-center min-h-[260px] max-h-[58vh]">
          <img
            src={stop.deliveryProofPhoto}
            alt="Comprovante de Entrega"
            className="w-full h-full object-contain rounded-xl"
          />
        </div>

        {/* Details & Notes */}
        <div className="p-4 bg-slate-900/90 border-t border-slate-800 space-y-2 text-xs">
          <div className="flex items-start gap-1.5 text-slate-300">
            <MapPin className="w-3.5 h-3.5 text-violet-400 shrink-0 mt-0.5" />
            <span className="font-medium">{stop.address}</span>
          </div>

          {stop.customerName && (
            <div className="flex items-center gap-1.5 text-slate-400">
              <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>Cliente: <b>{stop.customerName}</b></span>
            </div>
          )}

          {stop.deliveryProofNotes && (
            <div className="p-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-emerald-300">
              <span className="font-bold text-[11px] text-slate-400 block mb-0.5">Observação registrada:</span>
              <span>{stop.deliveryProofNotes}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-2">
          {onDeletePhoto && (
            <button
              type="button"
              onClick={() => {
                if (confirm('Deseja remover esta foto de comprovante?')) {
                  onDeletePhoto(stop.id);
                  onClose();
                }
              }}
              className="px-3 py-1.5 text-rose-400 hover:bg-rose-950/40 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Excluir Foto</span>
            </button>
          )}

          <div className="flex items-center gap-2 ml-auto">
            {onRetakePhoto && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRetakePhoto(stop);
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Tirar Outra</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleDownload}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar Foto</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
