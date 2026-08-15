import React, { useState } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  Sparkles,
  HelpCircle,
  X,
  CheckCircle,
  Radio,
  FileText,
} from 'lucide-react';

interface VoiceCommandButtonProps {
  isListening: boolean;
  transcript: string;
  feedbackMessage: string | null;
  errorMessage?: string | null;
  onToggleListen: () => void;
  isSupported?: boolean;
}

export const VoiceCommandButton: React.FC<VoiceCommandButtonProps> = ({
  isListening,
  transcript,
  feedbackMessage,
  errorMessage,
  onToggleListen,
  isSupported = true,
}) => {
  const [showTips, setShowTips] = useState(false);

  return (
    <>
      {/* Floating Listening Feedback Toast (Center Screen) */}
      {(isListening || transcript || feedbackMessage) && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 max-w-lg w-11/12 animate-bounceIn pointer-events-auto">
          <div
            className={`p-3.5 rounded-2xl shadow-2xl border backdrop-blur-md flex items-center justify-between gap-3 text-xs transition-all ${
              isListening
                ? 'bg-rose-950/95 border-rose-500/60 text-white shadow-rose-950/50'
                : feedbackMessage?.startsWith('⚠️') || errorMessage
                ? 'bg-amber-950/95 border-amber-500/60 text-amber-100 shadow-amber-950/50'
                : 'bg-slate-900/95 border-emerald-500/60 text-white shadow-slate-950/50'
            }`}
          >
            <div className="flex items-center gap-3 flex-1 overflow-hidden">
              <div
                className={`p-2 rounded-xl shrink-0 flex items-center justify-center ${
                  isListening
                    ? 'bg-rose-600 text-white animate-pulse'
                    : 'bg-emerald-600 text-white'
                }`}
              >
                {isListening ? (
                  <Radio className="w-4 h-4 animate-spin" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </div>

              <div className="flex-1 overflow-hidden">
                <div className="font-extrabold flex items-center gap-1.5 truncate">
                  <span>
                    {isListening ? 'Ouvindo Comando de Voz...' : 'Comando de Voz'}
                  </span>
                  {isListening && (
                    <span className="inline-block w-2 h-2 rounded-full bg-rose-400 animate-ping" />
                  )}
                </div>

                <div className="text-[11px] text-slate-300 truncate mt-0.5">
                  {transcript ? (
                    <span className="italic font-mono text-emerald-300">
                      "{transcript}"
                    </span>
                  ) : feedbackMessage ? (
                    <span>{feedbackMessage}</span>
                  ) : (
                    <span>Fale por exemplo: "Marcar parada 1 como concluída"</span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={onToggleListen}
              className={`px-3 py-1.5 rounded-xl font-black text-xs shrink-0 transition-all ${
                isListening
                  ? 'bg-rose-600 hover:bg-rose-500 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              {isListening ? 'Parar' : 'Falar'}
            </button>
          </div>
        </div>
      )}

      {/* Floating Microphone Trigger Pill */}
      <div className="fixed bottom-6 right-6 z-40 flex items-center gap-2">
        {/* Quick Tips Toggle Button */}
        <button
          type="button"
          onClick={() => setShowTips(!showTips)}
          className="p-2.5 bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 rounded-2xl shadow-xl backdrop-blur-md transition-all hover:scale-105"
          title="Ver exemplos de comandos de voz"
        >
          <HelpCircle className="w-4 h-4 text-violet-400" />
        </button>

        {/* Main Microphone Button */}
        <button
          type="button"
          onClick={onToggleListen}
          className={`relative p-3.5 sm:px-4 sm:py-3.5 rounded-2xl font-black text-xs flex items-center gap-2 shadow-2xl transition-all hover:scale-105 active:scale-95 border ${
            isListening
              ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-400 shadow-rose-900/50 ring-4 ring-rose-500/30 animate-pulse'
              : 'bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white border-indigo-400/40 shadow-indigo-950/50'
          }`}
          title={isListening ? 'Parar escuta de voz' : 'Ativar comandos de voz (Web Speech API)'}
        >
          <div className="relative">
            {isListening ? (
              <Mic className="w-5 h-5 text-white animate-bounce" />
            ) : (
              <Mic className="w-5 h-5 text-white" />
            )}
            {isListening && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-white rounded-full animate-ping" />
            )}
          </div>
          <span className="hidden sm:inline font-bold">
            {isListening ? 'Ouvindo...' : 'Comando de Voz'}
          </span>
        </button>
      </div>

      {/* Voice Command Quick Help Modal */}
      {showTips && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-5 text-slate-100 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-violet-600/30 text-violet-400 border border-violet-500/40 rounded-xl">
                  <Mic className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-white">Comandos de Voz do Motorista</h3>
                  <p className="text-[11px] text-slate-400">Web Speech API integrada</p>
                </div>
              </div>
              <button
                onClick={() => setShowTips(false)}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-800/80 border border-slate-700/80 rounded-2xl space-y-1.5">
                <span className="font-extrabold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" />
                  Alterar Status de Entrega:
                </span>
                <ul className="list-disc list-inside text-slate-300 space-y-1 text-[11px] font-mono">
                  <li>"Marcar parada 1 como concluída"</li>
                  <li>"Concluir entrega" (aplica na próxima parada)</li>
                  <li>"Iniciar parada 2" / "Em trânsito parada 3"</li>
                  <li>"Marcar parada 2 como falha" / "Destinatário ausente"</li>
                </ul>
              </div>

              <div className="p-3 bg-slate-800/80 border border-slate-700/80 rounded-2xl space-y-1.5">
                <span className="font-extrabold text-amber-400 flex items-center gap-1.5">
                  <FileText className="w-4 h-4" />
                  Adicionar Notas e Observações:
                </span>
                <ul className="list-disc list-inside text-slate-300 space-y-1 text-[11px] font-mono">
                  <li>"Adicionar nota na parada 2: cliente pediu para ligar no interfone"</li>
                  <li>"Adicionar nota: portão quebrado, deixei com vizinho"</li>
                  <li>"Anotar que o destinatário mudou de horário"</li>
                </ul>
              </div>

              <div className="p-3 bg-slate-800/80 border border-slate-700/80 rounded-2xl space-y-1.5">
                <span className="font-extrabold text-indigo-400 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  Outros Comandos Úteis:
                </span>
                <ul className="list-disc list-inside text-slate-300 space-y-1 text-[11px] font-mono">
                  <li>"Otimizar rota" (calcula melhor ordem)</li>
                  <li>"Qual a próxima parada?" (lê endereço em voz alta)</li>
                  <li>"Ver mapa completo" (abre mapa em tela cheia)</li>
                  <li>"Compartilhar rota"</li>
                </ul>
              </div>
            </div>

            <button
              onClick={() => {
                setShowTips(false);
                onToggleListen();
              }}
              className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-black text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <Mic className="w-4 h-4" />
              <span>Experimentar Agora (Falar)</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};
