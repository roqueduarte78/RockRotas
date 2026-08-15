import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  X,
  RefreshCw,
  Check,
  Upload,
  Image as ImageIcon,
  AlertCircle,
  Clock,
  MapPin,
  User,
  Package,
  Sparkles,
  SwitchCamera,
} from 'lucide-react';
import { RouteStop } from '../types';

interface DeliveryProofModalProps {
  isOpen: boolean;
  stop: RouteStop | null;
  onClose: () => void;
  onConfirmProof: (stopId: string, photoDataUrl: string, timestamp: string, notes?: string) => void;
  onSkipProof: (stopId: string) => void;
}

export const DeliveryProofModal: React.FC<DeliveryProofModalProps> = ({
  isOpen,
  stop,
  onClose,
  onConfirmProof,
  onSkipProof,
}) => {
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [notes, setNotes] = useState('');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Stop camera helper
  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Start Camera Stream
  const startCamera = async (mode: 'environment' | 'user' = 'environment') => {
    setCameraError(null);
    stopCameraStream();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Câmera não suportada diretamente neste navegador. Use o envio de arquivo.');
      }

      // Check available video devices
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === 'videoinput');
        setHasMultipleCameras(videoDevices.length > 1);
      } catch (e) {
        // ignore device listing error
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err: any) {
      console.warn('Camera stream error:', err);
      // Fallback try without specific facingMode
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        streamRef.current = fallbackStream;
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          await videoRef.current.play();
        }
        setIsCameraActive(true);
      } catch (fbErr: any) {
        console.error('Camera fallback error:', fbErr);
        setCameraError(
          fbErr.name === 'NotAllowedError'
            ? 'Acesso à câmera bloqueado. Permita a câmera ou envie foto da galeria.'
            : 'Não foi possível inicializar a câmera ao vivo. Use o botão de upload abaixo.'
        );
        setIsCameraActive(false);
      }
    }
  };

  // Switch camera between front and back
  const handleToggleCamera = () => {
    const newMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newMode);
    startCamera(newMode);
  };

  // Clean setup / teardown on modal open/close
  useEffect(() => {
    if (isOpen && stop) {
      setPhotoPreview(null);
      setNotes('');
      setCameraError(null);
      startCamera(facingMode);
    } else {
      stopCameraStream();
    }

    return () => {
      stopCameraStream();
    };
  }, [isOpen, stop]);

  // Capture frame from video canvas
  const handleCapturePhoto = () => {
    if (!videoRef.current) return;

    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Watermark timestamp & address at bottom
        const now = new Date();
        const timestampStr = `${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR')}`;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, canvas.height - 60, canvas.width, 60);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText(`📍 ${stop?.address || 'Entrega'} | 🕒 ${timestampStr}`, 20, canvas.height - 24);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setPhotoPreview(dataUrl);
        stopCameraStream();
      }
    } catch (err) {
      console.error('Error capturing canvas photo:', err);
    }
  };

  // Handle file input upload as fallback
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        setPhotoPreview(event.target.result);
        stopCameraStream();
      }
    };
    reader.readAsDataURL(file);
  };

  // Retake photo
  const handleRetake = () => {
    setPhotoPreview(null);
    startCamera(facingMode);
  };

  // Confirm and save proof
  const handleConfirm = () => {
    if (!stop || !photoPreview) return;
    const now = new Date();
    const timestampStr = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    onConfirmProof(stop.id, photoPreview, timestampStr, notes.trim() || undefined);
    onClose();
  };

  // Skip proof photo and finish
  const handleSkip = () => {
    if (!stop) return;
    onSkipProof(stop.id);
    onClose();
  };

  if (!isOpen || !stop) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col text-slate-100 max-h-[95vh]">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-b border-indigo-800/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-white flex items-center gap-2">
                <span>Comprovante de Entrega</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold">
                  Foto Local
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                Tire uma foto do pacote entregue, fachada ou comprovante assinado.
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

        {/* Stop Info Summary Pill */}
        <div className="px-4 py-2.5 bg-slate-800/60 border-b border-slate-700/60 flex flex-col gap-1 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-slate-200 truncate">
            <MapPin className="w-3.5 h-3.5 text-violet-400 shrink-0" />
            <span className="truncate">{stop.address}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
            {stop.customerName && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3 text-slate-500" />
                <span>{stop.customerName}</span>
              </span>
            )}
            {stop.packageNumbers && stop.packageNumbers.length > 0 && (
              <span className="flex items-center gap-1 text-indigo-300 font-mono">
                <Package className="w-3 h-3 text-indigo-400" />
                <span>{stop.packageNumbers.join(', ')}</span>
              </span>
            )}
          </div>
        </div>

        {/* Body Area: Live Camera or Photo Preview */}
        <div className="p-4 flex-1 overflow-y-auto space-y-4 custom-scrollbar">
          {photoPreview ? (
            /* PREVIEW MODE */
            <div className="space-y-3">
              <div className="relative rounded-2xl overflow-hidden border-2 border-emerald-500/60 bg-black aspect-4/3 flex items-center justify-center shadow-lg">
                <img
                  src={photoPreview}
                  alt="Comprovante de Entrega"
                  className="w-full h-full object-contain"
                />
                <div className="absolute top-2 left-2 px-2.5 py-1 bg-emerald-900/90 border border-emerald-500/60 text-emerald-200 text-[10px] font-bold rounded-lg flex items-center gap-1 shadow-md">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Foto Capturada</span>
                </div>
              </div>

              {/* Optional Notes / Recipient Observation */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Observação do comprovante (Opcional):
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Entregue para o porteiro Sr. Carlos / Deixado na caixa de correio"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          ) : (
            /* CAMERA LIVE VIEW MODE */
            <div className="space-y-3">
              <div className="relative rounded-2xl overflow-hidden border border-slate-700 bg-black aspect-4/3 flex items-center justify-center shadow-inner">
                {cameraError ? (
                  <div className="p-4 text-center space-y-3">
                    <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
                    <p className="text-xs text-slate-300 leading-relaxed font-medium">
                      {cameraError}
                    </p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl inline-flex items-center gap-2 shadow-md transition-all"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Selecionar Foto da Galeria / Câmera</span>
                    </button>
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      autoPlay
                      className="w-full h-full object-cover"
                    />

                    {/* Viewfinder Target Overlay */}
                    <div className="absolute inset-4 border-2 border-dashed border-white/40 rounded-xl pointer-events-none flex flex-col justify-between p-3">
                      <div className="flex justify-between">
                        <span className="w-4 h-4 border-t-2 border-l-2 border-emerald-400" />
                        <span className="w-4 h-4 border-t-2 border-r-2 border-emerald-400" />
                      </div>
                      <div className="text-center">
                        <span className="bg-black/60 text-white/90 text-[10px] px-2 py-0.5 rounded-full font-bold backdrop-blur-xs">
                          Enquadre o pacote ou comprovante
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="w-4 h-4 border-b-2 border-l-2 border-emerald-400" />
                        <span className="w-4 h-4 border-b-2 border-r-2 border-emerald-400" />
                      </div>
                    </div>

                    {/* Switch Camera Button if supported */}
                    {hasMultipleCameras && (
                      <button
                        type="button"
                        onClick={handleToggleCamera}
                        className="absolute top-3 right-3 p-2 bg-slate-900/80 hover:bg-slate-800 text-white rounded-xl border border-slate-700 shadow-md transition-all"
                        title="Alternar câmera frontal / traseira"
                      >
                        <SwitchCamera className="w-4 h-4 text-slate-300" />
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Alternative upload trigger */}
              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-slate-400">Prefere enviar arquivo?</span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 transition-colors"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Escolher da Galeria</span>
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileInputChange}
                className="hidden"
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
          {photoPreview ? (
            /* PREVIEW CONTROLS */
            <>
              <button
                type="button"
                onClick={handleRetake}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Tirar Outra Foto</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSkip}
                  className="px-3 py-2 text-slate-400 hover:text-white font-bold text-xs rounded-xl transition-colors"
                >
                  Pular Foto
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-900/30 transition-all hover:scale-102"
                >
                  <Check className="w-4 h-4" />
                  <span>Confirmar e Concluir</span>
                </button>
              </div>
            </>
          ) : (
            /* CAPTURE CONTROLS */
            <>
              <button
                type="button"
                onClick={handleSkip}
                className="px-3 py-2 text-slate-400 hover:text-slate-200 font-bold text-xs rounded-xl transition-colors flex items-center gap-1"
                title="Concluir parada sem registrar foto"
              >
                <span>Pular Foto (Concluir direto)</span>
              </button>

              <button
                type="button"
                onClick={handleCapturePhoto}
                disabled={!isCameraActive}
                className={`px-5 py-2.5 font-black text-xs rounded-xl flex items-center gap-2 transition-all ${
                  isCameraActive
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/40 hover:scale-105 active:scale-95'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Camera className="w-4 h-4" />
                <span>Tirar Foto do Comprovante</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
