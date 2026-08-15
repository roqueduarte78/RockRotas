import { useState, useEffect, useRef, useCallback } from 'react';
import { RouteStop, StopStatus } from '../types';
import { parseVoiceCommand, isSpeechRecognitionSupported, ParsedVoiceCommand } from '../utils/voiceRecognition';
import { speakText } from '../utils/voiceAnnouncement';
import { playCompletionSound } from '../utils/audioAlerts';

interface UseVoiceCommandsProps {
  stops: RouteStop[];
  onUpdateStatus: (stopId: string, status: StopStatus) => void;
  onAddNote: (stopId: string, noteText: string) => void;
  onOptimizeRoute?: () => void;
  onOpenMap?: () => void;
  onShareRoute?: () => void;
}

export function useVoiceCommands({
  stops,
  onUpdateStatus,
  onAddNote,
  onOptimizeRoute,
  onOpenMap,
  onShareRoute,
}: UseVoiceCommandsProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [lastCommand, setLastCommand] = useState<ParsedVoiceCommand | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const stopsRef = useRef<RouteStop[]>(stops);
  const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Keep stopsRef updated
  useEffect(() => {
    stopsRef.current = stops;
  }, [stops]);

  useEffect(() => {
    setIsSupported(isSpeechRecognitionSupported());
  }, []);

  const showFeedback = (msg: string, durationMs: number = 4000) => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    setFeedbackMessage(msg);
    feedbackTimerRef.current = setTimeout(() => {
      setFeedbackMessage(null);
    }, durationMs);
  };

  const handleCommandExecution = useCallback(
    (command: ParsedVoiceCommand) => {
      setLastCommand(command);

      switch (command.intent) {
        case 'change_status': {
          if (command.targetStop && command.status) {
            onUpdateStatus(command.targetStop.id, command.status);
            showFeedback(`🎤 ${command.spokenFeedback}`);
            speakText(command.spokenFeedback);
          } else {
            const fallback = 'Nenhuma parada encontrada para alterar status.';
            showFeedback(`⚠️ ${fallback}`);
            speakText(fallback);
          }
          break;
        }

        case 'add_note': {
          if (command.targetStop && command.noteText) {
            onAddNote(command.targetStop.id, command.noteText);
            playCompletionSound();
            showFeedback(`📝 ${command.spokenFeedback}`);
            speakText(command.spokenFeedback);
          } else {
            const fallback = 'Nenhuma parada identificada para adicionar a nota.';
            showFeedback(`⚠️ ${fallback}`);
            speakText(fallback);
          }
          break;
        }

        case 'optimize_route': {
          if (onOptimizeRoute) {
            onOptimizeRoute();
            showFeedback('🚀 Rota otimizada por comando de voz!');
            speakText(command.spokenFeedback);
          }
          break;
        }

        case 'next_stop': {
          showFeedback(`📍 ${command.spokenFeedback}`);
          speakText(command.spokenFeedback);
          break;
        }

        case 'open_map': {
          if (onOpenMap) {
            onOpenMap();
            showFeedback('🗺️ Mapa aberto por comando de voz!');
            speakText(command.spokenFeedback);
          }
          break;
        }

        case 'share_route': {
          if (onShareRoute) {
            onShareRoute();
            showFeedback('📲 Compartilhando rota...');
            speakText(command.spokenFeedback);
          }
          break;
        }

        default: {
          showFeedback(`❓ ${command.spokenFeedback}`);
          speakText(command.spokenFeedback);
          break;
        }
      }
    },
    [onUpdateStatus, onAddNote, onOptimizeRoute, onOpenMap, onShareRoute]
  );

  const startListening = useCallback(() => {
    if (!isSpeechRecognitionSupported()) {
      setIsSupported(false);
      showFeedback('Reconhecimento de voz não suportado neste navegador.');
      return;
    }

    setErrorMessage(null);

    try {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // ignore
        }
      }

      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setTranscript('');
        setErrorMessage(null);
        showFeedback('🎙️ Ouvindo comando de voz... (Fale agora)');
      };

      recognition.onresult = (event: any) => {
        let currentInterim = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            currentInterim += event.results[i][0].transcript;
          }
        }

        const displayTranscript = finalTranscript || currentInterim;
        setTranscript(displayTranscript);

        if (finalTranscript) {
          const parsed = parseVoiceCommand(finalTranscript, stopsRef.current);
          handleCommandExecution(parsed);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setErrorMessage('Permissão de microfone negada. Permita o acesso ao microfone.');
          showFeedback('⚠️ Permissão de microfone necessária.');
        } else if (event.error === 'no-speech') {
          showFeedback('Nenhum comando detectado. Clique no microfone e tente novamente.');
        } else if (event.error !== 'aborted') {
          setErrorMessage(`Erro no microfone: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error('Error starting speech recognition:', err);
      setIsListening(false);
      setErrorMessage(err.message || 'Falha ao iniciar microfone.');
    }
  }, [handleCommandExecution]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
      setIsListening(false);
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    transcript,
    feedbackMessage,
    lastCommand,
    isSupported,
    errorMessage,
    startListening,
    stopListening,
    toggleListening,
  };
}
