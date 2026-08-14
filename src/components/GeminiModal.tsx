import React, { useState } from 'react';
import {
  Sparkles,
  X,
  MessageCircle,
  Copy,
  Check,
  AlertCircle,
  ListOrdered,
  Lightbulb,
  Truck,
} from 'lucide-react';
import { RouteStop, GeminiOptimizationResult } from '../types';
import { getWhatsAppUrl } from '../utils/routeOptimizer';

interface GeminiModalProps {
  isOpen: boolean;
  onClose: () => void;
  stops: RouteStop[];
  onApplyAIOrder: (newOrder: number[]) => void;
}

export const GeminiModal: React.FC<GeminiModalProps> = ({
  isOpen,
  onClose,
  stops,
  onApplyAIOrder,
}) => {
  const [driverName, setDriverName] = useState('Carlos Eduardo');
  const [preferences, setPreferences] = useState(
    'Priorizar entregas comerciais antes das 17h, evitar avenidas de pico no final da tarde e otimizar combustível.'
  );
  const [isLoading, setIsLoading] = useState(false);
  const [aiResult, setAiResult] = useState<GeminiOptimizationResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleRunGeminiOptimization = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/gemini/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stops: stops.map((s, idx) => ({
            originalIndex: idx,
            address: s.address,
            customerName: s.customerName,
            phone: s.phone,
            notes: s.notes,
            priority: s.priority,
          })),
          userPreferences: preferences,
          driverName,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Falha ao conectar com Gemini API');
      }

      setAiResult(data);
    } catch (err: any) {
      console.error('Gemini error:', err);
      setErrorMessage(
        err.message ||
          'Não foi possível gerar análise com a IA. Verifique se a chave GEMINI_API_KEY está configurada no painel Secrets.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyMessage = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
        {/* Modal Header */}
        <div className="p-5 bg-gradient-to-r from-violet-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between border-b border-indigo-800/40 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-fuchsia-600 to-violet-600 flex items-center justify-center text-white shadow-md shadow-fuchsia-500/20">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg leading-tight">Otimização com IA Gemini</h3>
              <p className="text-xs text-violet-200 font-medium">Inteligência logística para rotas e mensagens automatizadas</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-xl text-slate-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-slate-700">
          {/* Controls Form */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nome do Motorista / Entregador</label>
                <input
                  type="text"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-medium"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Preferências Especiais da Rota</label>
                <input
                  type="text"
                  value={preferences}
                  onChange={(e) => setPreferences(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-medium"
                />
              </div>
            </div>

            <button
              onClick={handleRunGeminiOptimization}
              disabled={isLoading || stops.length === 0}
              className="w-full py-3 bg-gradient-to-r from-fuchsia-600 via-purple-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 text-white font-extrabold text-sm rounded-xl transition-all shadow-md shadow-purple-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Analisando rota com Gemini...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Gerar Otimização & Dicas com IA</span>
                </>
              )}
            </button>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl text-xs flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold mb-0.5">Nota sobre IA Gemini:</strong>
                {errorMessage}
              </div>
            </div>
          )}

          {/* AI Optimization Results */}
          {aiResult && (
            <div className="space-y-4 animate-fadeIn">
              {/* Summary card */}
              {aiResult.summary && (
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl">
                  <h4 className="font-bold text-purple-900 text-xs uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-purple-600" />
                    Resumo do Diagnóstico Gemini
                  </h4>
                  <p className="text-xs text-purple-950 font-medium leading-relaxed">
                    {aiResult.summary}
                  </p>
                </div>
              )}

              {/* Driver Tips */}
              {aiResult.driverTips && aiResult.driverTips.length > 0 && (
                <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl">
                  <h4 className="font-bold text-indigo-900 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Lightbulb className="w-4 h-4 text-amber-500" />
                    Dicas Práticas para o Motorista
                  </h4>
                  <ul className="space-y-1.5 text-xs text-indigo-950">
                    {aiResult.driverTips.map((tip, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-indigo-600 font-bold">•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Auto Customer WhatsApp Messages */}
              {aiResult.customerMessages && aiResult.customerMessages.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <MessageCircle className="w-4 h-4 text-emerald-600" />
                    Mensagens WhatsApp para os Clientes
                  </h4>
                  <div className="space-y-2">
                    {aiResult.customerMessages.map((msg, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-start justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1">
                          <p className="font-bold text-slate-800">{msg.address}</p>
                          <p className="text-slate-600 italic">"{msg.whatsappText}"</p>
                        </div>
                        <button
                          onClick={() => handleCopyMessage(msg.whatsappText, idx)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1"
                        >
                          {copiedIndex === idx ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copiar</span>
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Apply AI Order Button */}
              {aiResult.optimizedOrder && aiResult.optimizedOrder.length > 0 && (
                <button
                  onClick={() => {
                    onApplyAIOrder(aiResult.optimizedOrder!);
                    onClose();
                  }}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <ListOrdered className="w-4 h-4" />
                  Aplicar Sequência Recomendada pela IA na Rota
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
