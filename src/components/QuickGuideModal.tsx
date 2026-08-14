import React, { useState } from 'react';
import {
  X,
  FileSpreadsheet,
  Cpu,
  Navigation,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  MapPin,
  Smartphone,
  Info,
  ExternalLink,
} from 'lucide-react';

interface QuickGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSpreadsheetDemo?: () => void;
}

export const QuickGuideModal: React.FC<QuickGuideModalProps> = ({
  isOpen,
  onClose,
  onOpenSpreadsheetDemo,
}) => {
  const [currentTab, setCurrentTab] = useState<number>(0);
  const [dontShowAgain, setDontShowAgain] = useState<boolean>(true);

  if (!isOpen) return null;

  const handleClose = () => {
    if (dontShowAgain) {
      try {
        localStorage.setItem('ROTA_EXPRESS_HAS_SEEN_GUIDE', 'true');
      } catch (e) {
        console.warn('Could not save guide preference:', e);
      }
    }
    onClose();
  };

  const steps = [
    {
      id: 'import',
      title: '1. Importar Planilhas & Endereços',
      icon: FileSpreadsheet,
      color: 'from-emerald-600 to-teal-600',
      badge: 'Excel / CSV / Texto',
      description:
        'Carregue sua lista de entregas rapidamente de múltiplas formas sem digitar endereço por endereço:',
      points: [
        '📂 Importe arquivos Excel (.xlsx) ou CSV com colunas de cliente, endereço e telefone.',
        '📋 Copie e cole um bloco de texto com múltiplos endereços separados por linha.',
        '📍 Digite na barra de busca com autocompletar e validação imediata no mapa.',
      ],
      tip: 'Dica: Se a planilha tiver números de celular, os botões do WhatsApp serão gerados automaticamente!',
    },
    {
      id: 'optimize',
      title: '2. Otimização Inteligente por IA (TSP)',
      icon: Cpu,
      color: 'from-violet-600 to-indigo-600',
      badge: 'Algoritmo & Gemini IA',
      description:
        'Economize até 40% de combustível e tempo eliminando trajetos ziguezagueantes:',
      points: [
        '⚡ Clique em "Otimizar Rota (TSP)" para calcular matematicamente o menor trajeto entre todas as paradas.',
        '🤖 Use o botão "Agente IA Gemini" para solicitar reorganizações inteligentes com base no trânsito e restrições.',
        '💬 A IA gera avisos personalizados no WhatsApp para avisar cada cliente sobre o horário estimado de chegada.',
      ],
      tip: 'O sistema inclui fallback local caso a conexão com a nuvem caia ou esteja instável.',
    },
    {
      id: 'navigate',
      title: '3. Iniciar Navegação no Celular (GPS)',
      icon: Navigation,
      color: 'from-blue-600 to-cyan-600',
      badge: 'Waze / Google Maps / PWA',
      description:
        'Modo focado no motorista durante a condução no trânsito:',
      points: [
        '🚗 Clique em "Modo Navegação" para atuar como um painel HUD veicular com texto ampliado.',
        '📲 Toque no botão "Waze" ou "Maps" da próxima parada para abrir o aplicativo de GPS nativo com 1 clique.',
        '🔊 Ative o "Aviso por Voz (TTS)" para que o aplicativo anuncie o próximo endereço pelo alto-falante.',
        '🌙 Agendamento Automático: O mapa alterna sozinho entre Claro (dia) e Escuro (noite) conforme o horário local.',
        '🔋 O indicador de bateria alerta se a carga cair abaixo de 20% para não perder o GPS no caminho.',
      ],
      tip: 'Instale como PWA no Android/iOS para usar em tela cheia sem barras do navegador!',
    },
  ];

  const currentStep = steps[currentTab];
  const StepIcon = currentStep.icon;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col text-white max-h-[90vh]">
        {/* Header */}
        <div className={`p-5 bg-gradient-to-r ${currentStep.color} flex items-center justify-between shrink-0 shadow-md`}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20">
              <StepIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="px-2.5 py-0.5 bg-black/20 text-white rounded-full text-[10px] font-black uppercase tracking-wider">
                Guia Rápido RotaExpress
              </span>
              <h2 className="font-black text-lg text-white leading-snug">
                {currentStep.title}
              </h2>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 bg-black/20 hover:bg-black/40 text-white rounded-xl transition-all"
            title="Fechar guia"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 p-2 gap-1 overflow-x-auto shrink-0">
          {steps.map((s, idx) => {
            const Icon = s.icon;
            const isActive = idx === currentTab;
            return (
              <button
                key={s.id}
                onClick={() => setCurrentTab(idx)}
                className={`flex-1 min-w-[120px] py-2 px-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition-all border ${
                  isActive
                    ? 'bg-slate-800 text-white border-violet-500 shadow-xs'
                    : 'bg-transparent text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-violet-400' : ''}`} />
                <span className="truncate">Etapa {idx + 1}</span>
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs leading-relaxed">
          <p className="text-slate-300 font-medium text-sm">
            {currentStep.description}
          </p>

          <div className="space-y-2.5 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
            {currentStep.points.map((pt, i) => (
              <div key={i} className="flex items-start gap-2.5 text-slate-200 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{pt}</span>
              </div>
            ))}
          </div>

          <div className="p-3 bg-amber-950/50 border border-amber-600/40 rounded-2xl text-amber-200 flex items-start gap-2 font-medium">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>{currentStep.tip}</span>
          </div>
        </div>

        {/* Footer Controls */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <label className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-slate-200 text-xs font-bold">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-violet-600 focus:ring-violet-500 w-4 h-4 cursor-pointer"
            />
            <span>Não mostrar este guia ao iniciar</span>
          </label>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {currentTab > 0 && (
              <button
                onClick={() => setCurrentTab(currentTab - 1)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-extrabold rounded-xl transition-all flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </button>
            )}

            {currentTab < steps.length - 1 ? (
              <button
                onClick={() => setCurrentTab(currentTab + 1)}
                className="px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white font-extrabold rounded-xl transition-all flex items-center gap-1 shadow-md"
              >
                Próximo
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleClose}
                className="px-6 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black rounded-xl transition-all flex items-center gap-2 shadow-lg"
              >
                <CheckCircle2 className="w-4 h-4" />
                Entendi! Começar a usar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
