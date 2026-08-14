import React, { useState } from 'react';
import { Key, X, Check, ExternalLink, ShieldCheck } from 'lucide-react';

interface GoogleKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  onSaveKey: (key: string) => void;
}

export const GoogleKeyModal: React.FC<GoogleKeyModalProps> = ({
  isOpen,
  onClose,
  apiKey,
  onSaveKey,
}) => {
  const [inputKey, setInputKey] = useState(apiKey);
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveKey(inputKey.trim());
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200">
        <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-indigo-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center font-bold shadow-md shadow-amber-500/20">
              <Key className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h3 className="font-extrabold text-base leading-tight">Configuração Google Maps API</h3>
              <p className="text-xs text-slate-400 font-medium">Opcional para renderização com Google Maps JS SDK</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4 text-slate-700">
          <div className="space-y-2 text-xs">
            <label className="block font-bold text-slate-800">Chave da API Google Maps (GOOGLE_MAPS_PLATFORM_KEY)</label>
            <input
              type="text"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-2xl text-xs space-y-1">
            <strong className="block font-bold flex items-center gap-1 text-blue-950">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              Como obter sua chave gratuita:
            </strong>
            <p>1. Obtenha uma chave na Google Cloud Platform Console.</p>
            <p>2. No AI Studio: Acesse <b>Configurações (⚙️) → Secrets</b> → Adicione <code>GOOGLE_MAPS_PLATFORM_KEY</code>.</p>
            <p className="text-blue-700 font-medium pt-1">
              * O app funciona perfeitamente sem a chave usando OpenStreetMap e links diretos do Waze e Google Maps!
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5"
            >
              {saved ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Salvo!</span>
                </>
              ) : (
                <span>Salvar Chave</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
