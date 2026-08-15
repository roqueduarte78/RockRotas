import React, { useState, useEffect } from 'react';
import {
  Volume2,
  VolumeX,
  Sparkles,
  Play,
  Square,
  Check,
  Radio,
  Sliders,
  Settings2,
  BellRing,
  HelpCircle,
  X,
} from 'lucide-react';
import { VoicePersona, VoiceConfig } from '../types';
import {
  VOICE_PERSONAS,
  getSavedVoiceConfig,
  saveVoiceConfig,
  speakText,
  stopVoiceAnnouncement,
  getAvailableBrowserVoices,
} from '../utils/voiceAnnouncement';

interface VoiceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVoiceConfigChange?: (config: VoiceConfig) => void;
}

export const VoiceSettingsModal: React.FC<VoiceSettingsModalProps> = ({
  isOpen,
  onClose,
  onVoiceConfigChange,
}) => {
  const [config, setConfig] = useState<VoiceConfig>(getSavedVoiceConfig);
  const [isPlayingPersona, setIsPlayingPersona] = useState<VoicePersona | null>(null);
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [testCustomer, setTestCustomer] = useState('Mariana Silva');
  const [testAddress, setTestAddress] = useState('Av. Paulista, 1578 - Bela Vista');

  useEffect(() => {
    if (isOpen) {
      const current = getSavedVoiceConfig();
      setConfig(current);
      setBrowserVoices(getAvailableBrowserVoices());

      // On Chrome/Edge voices may load asynchronously
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const handleVoicesChanged = () => {
          setBrowserVoices(getAvailableBrowserVoices());
        };
        window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
        return () => {
          window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
        };
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectPersona = (personaId: VoicePersona) => {
    const updated = { ...config, persona: personaId };
    setConfig(updated);
    saveVoiceConfig(updated);
    onVoiceConfigChange?.(updated);
  };

  const handleTestSample = (personaId: VoicePersona) => {
    const p = VOICE_PERSONAS.find((item) => item.id === personaId);
    if (!p) return;

    setIsPlayingPersona(personaId);
    stopVoiceAnnouncement();

    speakText(p.samplePhrase, {
      persona: personaId,
      rate: config.rate,
      pitch: config.pitch,
      volume: config.volume,
      voiceURI: config.voiceURI,
    });

    setTimeout(() => {
      setIsPlayingPersona(null);
    }, 4500);
  };

  const handleTestCustomAnnouncement = () => {
    setIsPlayingPersona(config.persona);
    stopVoiceAnnouncement();

    const p = VOICE_PERSONAS.find((item) => item.id === config.persona);
    const sample = p
      ? `Atenção. Próxima entrega para ${testCustomer}, no endereço ${testAddress}.`
      : 'Atenção. Próxima parada confirmada.';

    speakText(sample, {
      persona: config.persona,
      rate: config.rate,
      pitch: config.pitch,
      volume: config.volume,
      voiceURI: config.voiceURI,
    });

    setTimeout(() => {
      setIsPlayingPersona(null);
    }, 5000);
  };

  const handleToggleEnabled = () => {
    const updated = { ...config, enabled: !config.enabled };
    setConfig(updated);
    saveVoiceConfig(updated);
    onVoiceConfigChange?.(updated);
  };

  const handleToggleAutoAnnounce = () => {
    const updated = { ...config, autoAnnounceNextStop: !config.autoAnnounceNextStop };
    setConfig(updated);
    saveVoiceConfig(updated);
    onVoiceConfigChange?.(updated);
  };

  const handleRateChange = (rate: number) => {
    const updated = { ...config, rate };
    setConfig(updated);
    saveVoiceConfig(updated);
    onVoiceConfigChange?.(updated);
  };

  const handlePitchChange = (pitch: number) => {
    const updated = { ...config, pitch };
    setConfig(updated);
    saveVoiceConfig(updated);
    onVoiceConfigChange?.(updated);
  };

  const handleVolumeChange = (volume: number) => {
    const updated = { ...config, volume };
    setConfig(updated);
    saveVoiceConfig(updated);
    onVoiceConfigChange?.(updated);
  };

  const handleVoiceURIChange = (voiceURI: string) => {
    const updated = { ...config, voiceURI: voiceURI || undefined };
    setConfig(updated);
    saveVoiceConfig(updated);
    onVoiceConfigChange?.(updated);
  };

  const selectedPersonaInfo =
    VOICE_PERSONAS.find((p) => p.id === config.persona) || VOICE_PERSONAS[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden text-slate-900 dark:text-white transition-all">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-violet-600/10 via-purple-600/10 to-pink-600/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-violet-600 to-fuchsia-600 flex items-center justify-center text-white shadow-md shadow-violet-500/25">
              <Volume2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg">
                  Voz e Sotaques de Navegação (PT-BR)
                </h3>
                <span className="bg-gradient-to-r from-violet-600 to-pink-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                  9 Sotaques
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Personalize quem anuncia suas entregas durante a rota (Baiano, Carioca, Humor, Cuiabano, Gaúcho e mais).
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              stopVoiceAnnouncement();
              onClose();
            }}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Quick Controls Bar */}
          <div className="p-3.5 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70 rounded-2xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleToggleEnabled}
                className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-xs ${
                  config.enabled
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                {config.enabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                <span>{config.enabled ? 'Voz Ativada' : 'Voz Desativada'}</span>
              </button>

              <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={config.autoAnnounceNextStop}
                  onChange={handleToggleAutoAnnounce}
                  className="rounded text-violet-600 focus:ring-violet-500 w-4 h-4"
                />
                <span>Anunciar parada automaticamente no GPS</span>
              </label>
            </div>

            <button
              type="button"
              onClick={stopVoiceAnnouncement}
              className="px-3 py-1.5 text-xs font-extrabold text-slate-500 dark:text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors flex items-center gap-1"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Parar Áudio</span>
            </button>
          </div>

          {/* Voice Personas Grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-500" />
                Escolha o Sotaque e Estilo da Voz:
              </h4>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Ativo: <strong>{selectedPersonaInfo.name}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {VOICE_PERSONAS.map((p) => {
                const isSelected = config.persona === p.id;
                const isPlaying = isPlayingPersona === p.id;

                return (
                  <div
                    key={p.id}
                    className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between gap-2.5 relative ${
                      isSelected
                        ? 'bg-gradient-to-b from-violet-500/10 to-indigo-500/10 border-violet-500 ring-2 ring-violet-500/30 shadow-md'
                        : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600 shadow-xs'
                    }`}
                  >
                    {/* Top Row: Avatar & Name */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-2xl shrink-0 p-1 bg-slate-100 dark:bg-slate-700/60 rounded-xl">
                          {p.emoji}
                        </span>
                        <div className="min-w-0">
                          <h5 className="font-black text-xs text-slate-900 dark:text-white truncate flex items-center gap-1">
                            {p.name}
                            {isSelected && (
                              <Check className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 shrink-0" />
                            )}
                          </h5>
                          <span className="text-[10px] text-violet-600 dark:text-violet-400 font-bold block truncate">
                            {p.region}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSelectPersona(p.id)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all ${
                          isSelected
                            ? 'bg-violet-600 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                        }`}
                      >
                        {isSelected ? 'Selecionado' : 'Usar'}
                      </button>
                    </div>

                    {/* Tagline */}
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 italic line-clamp-2 leading-relaxed">
                      "{p.tagline}"
                    </p>

                    {/* Action Button: Hear Sample */}
                    <div className="pt-1.5 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => handleTestSample(p.id)}
                        className={`w-full py-1.5 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                          isPlaying
                            ? 'bg-amber-500 text-slate-950 font-black animate-pulse shadow-sm'
                            : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        {isPlaying ? (
                          <>
                            <Square className="w-3 h-3 fill-current" />
                            <span>Falando...</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3 fill-current text-violet-600 dark:text-violet-400" />
                            <span>Ouvir Exemplo</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Voice Tuning & Sound Adjustments */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-2xl space-y-4">
            <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-indigo-500" />
              Ajustes de Áudio (Velocidade, Tom e Volume)
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              {/* Rate / Speed */}
              <div>
                <div className="flex items-center justify-between mb-1 text-slate-600 dark:text-slate-400 font-bold">
                  <span>Velocidade da Fala:</span>
                  <span className="font-mono text-violet-600 dark:text-violet-400 font-black">
                    {config.rate.toFixed(2)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.75"
                  max="1.35"
                  step="0.05"
                  value={config.rate}
                  onChange={(e) => handleRateChange(parseFloat(e.target.value))}
                  className="w-full accent-violet-600"
                />
                <div className="flex justify-between text-[9px] text-slate-400">
                  <span>Mais Lenta</span>
                  <span>Normal</span>
                  <span>Mais Rápida</span>
                </div>
              </div>

              {/* Pitch */}
              <div>
                <div className="flex items-center justify-between mb-1 text-slate-600 dark:text-slate-400 font-bold">
                  <span>Tom da Voz:</span>
                  <span className="font-mono text-violet-600 dark:text-violet-400 font-black">
                    {config.pitch.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.7"
                  max="1.4"
                  step="0.05"
                  value={config.pitch}
                  onChange={(e) => handlePitchChange(parseFloat(e.target.value))}
                  className="w-full accent-violet-600"
                />
                <div className="flex justify-between text-[9px] text-slate-400">
                  <span>Mais Grave</span>
                  <span>Equilibrado</span>
                  <span>Mais Agudo</span>
                </div>
              </div>

              {/* Volume */}
              <div>
                <div className="flex items-center justify-between mb-1 text-slate-600 dark:text-slate-400 font-bold">
                  <span>Volume:</span>
                  <span className="font-mono text-violet-600 dark:text-violet-400 font-black">
                    {Math.round(config.volume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={config.volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-full accent-violet-600"
                />
                <div className="flex justify-between text-[9px] text-slate-400">
                  <span>Baixo</span>
                  <span>50%</span>
                  <span>Máximo</span>
                </div>
              </div>
            </div>

            {/* System Synthesizer Voice selection (if multiple browser voices available) */}
            {browserVoices.length > 1 && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60">
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Motor de Voz do Navegador (Opcional):
                </label>
                <select
                  value={config.voiceURI || ''}
                  onChange={(e) => handleVoiceURIChange(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-white rounded-xl p-2 text-xs font-medium outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="">Automático (Melhor voz PT-BR instalada)</option>
                  {browserVoices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Test Custom Delivery Stop Announcement */}
          <div className="p-4 bg-gradient-to-r from-violet-600/5 via-fuchsia-600/5 to-pink-600/5 border border-violet-500/20 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-extrabold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                <BellRing className="w-3.5 h-3.5 text-violet-600" />
                Simular Anúncio de Entrega Real com o Sotaque Escolhido:
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <input
                type="text"
                value={testCustomer}
                onChange={(e) => setTestCustomer(e.target.value)}
                placeholder="Nome do Cliente..."
                className="p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-violet-500 text-xs font-semibold"
              />
              <input
                type="text"
                value={testAddress}
                onChange={(e) => setTestAddress(e.target.value)}
                placeholder="Endereço da entrega..."
                className="p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-violet-500 text-xs font-semibold"
              />
            </div>

            <button
              type="button"
              onClick={handleTestCustomAnnouncement}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-extrabold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
            >
              <Volume2 className="w-4 h-4 text-amber-300 animate-pulse" />
              <span>Ouvir Anúncio Completo com Sotaque {selectedPersonaInfo.name}</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/90 shrink-0">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Sotaque ativo: <strong>{selectedPersonaInfo.name}</strong> ({selectedPersonaInfo.emoji})
          </span>

          <button
            onClick={() => {
              stopVoiceAnnouncement();
              onClose();
            }}
            className="px-5 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-black rounded-xl text-xs hover:opacity-90 transition-opacity shadow-sm"
          >
            Salvar e Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
