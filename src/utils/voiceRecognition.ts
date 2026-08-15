import { RouteStop, StopStatus } from '../types';

export interface ParsedVoiceCommand {
  rawTranscript: string;
  intent: 'change_status' | 'add_note' | 'optimize_route' | 'next_stop' | 'open_map' | 'share_route' | 'unknown';
  targetStopIndex?: number; // 0-based index
  targetStop?: RouteStop;
  status?: StopStatus;
  noteText?: string;
  spokenFeedback: string;
  confidence?: number;
}

// Convert ordinal words in Portuguese to numbers
const ORDINAL_NUMBERS_PT: Record<string, number> = {
  primeira: 1,
  primeiro: 1,
  um: 1,
  '1ª': 1,
  '1º': 1,
  '1': 1,
  segunda: 2,
  segundo: 2,
  dois: 2,
  duas: 2,
  '2ª': 2,
  '2º': 2,
  '2': 2,
  terceira: 3,
  terceiro: 3,
  tres: 3,
  três: 3,
  '3ª': 3,
  '3º': 3,
  '3': 3,
  quarta: 4,
  quarto: 4,
  quatro: 4,
  '4ª': 4,
  '4º': 4,
  '4': 4,
  quinta: 5,
  quinto: 5,
  cinco: 5,
  '5ª': 5,
  '5º': 5,
  '5': 5,
  sexta: 6,
  sexto: 6,
  seis: 6,
  '6ª': 6,
  '6º': 6,
  '6': 6,
  setima: 7,
  sétima: 7,
  setimo: 7,
  sétimo: 7,
  sete: 7,
  '7ª': 7,
  '7º': 7,
  '7': 7,
  oitava: 8,
  oitavo: 8,
  oito: 8,
  '8ª': 8,
  '8º': 8,
  '8': 8,
  nona: 9,
  nono: 9,
  nove: 9,
  '9ª': 9,
  '9º': 9,
  '9': 9,
  decima: 10,
  décima: 10,
  decimo: 10,
  décimo: 10,
  dez: 10,
  '10ª': 10,
  '10º': 10,
  '10': 10,
};

/**
 * Extracts target stop index from speech transcript (e.g. "parada 3", "segunda parada", "parada número 4", "última parada")
 */
export function extractStopIndexFromText(text: string, stops: RouteStop[]): number | undefined {
  const clean = text.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (stops.length === 0) return undefined;

  // Check for "última parada" / "ultima entrega"
  if (clean.includes('ultima parada') || clean.includes('ultimo') || clean.includes('ultima entrega')) {
    return stops.length - 1;
  }

  // Check for "primeira parada" / "primeiro"
  if (clean.includes('primeira parada') || clean.includes('primeira entrega')) {
    return 0;
  }

  // Check patterns: "parada 3", "parada número 3", "entrega 2", "parada nº 4"
  const matchDigits = clean.match(/(?:parada|entrega|numero|nº|ponto)\s*(?:numero\s*)?(\d+)/i);
  if (matchDigits && matchDigits[1]) {
    const num = parseInt(matchDigits[1], 10);
    if (num >= 1 && num <= stops.length) {
      return num - 1;
    }
  }

  // Check word ordinals e.g. "parada dois", "terceira parada", "segunda entrega"
  for (const [word, num] of Object.entries(ORDINAL_NUMBERS_PT)) {
    const cleanWord = word.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const regex1 = new RegExp(`(?:parada|entrega|ponto)\\s+${cleanWord}\\b`, 'i');
    const regex2 = new RegExp(`\\b${cleanWord}\\s+(?:parada|entrega|ponto)`, 'i');
    if (regex1.test(clean) || regex2.test(clean)) {
      if (num >= 1 && num <= stops.length) {
        return num - 1;
      }
    }
  }

  // If no explicit index is mentioned, find currently active or first pending stop
  const currentInTransitIdx = stops.findIndex((s) => s.status === 'em_transito');
  if (currentInTransitIdx !== -1) return currentInTransitIdx;

  const firstPendingIdx = stops.findIndex((s) => s.status === 'pendente');
  if (firstPendingIdx !== -1) return firstPendingIdx;

  return 0;
}

/**
 * Intelligent voice command parser for Portuguese delivery instructions
 */
export function parseVoiceCommand(transcript: string, stops: RouteStop[]): ParsedVoiceCommand {
  const rawTranscript = transcript.trim();
  const clean = rawTranscript
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (!clean) {
    return {
      rawTranscript,
      intent: 'unknown',
      spokenFeedback: 'Nenhum comando de voz reconhecido.',
    };
  }

  const targetIndex = extractStopIndexFromText(clean, stops);
  const targetStop = targetIndex !== undefined && stops[targetIndex] ? stops[targetIndex] : undefined;
  const stopNumberDisplay = targetIndex !== undefined ? targetIndex + 1 : 1;

  // 1. ADD NOTE COMMANDS
  // Examples: "adicionar nota na parada 2: cliente não estava", "anotar portão com defeito", "adicionar observação cliente pediu para ligar"
  const isAddNote =
    clean.includes('nota') ||
    clean.includes('observacao') ||
    clean.includes('observacoes') ||
    clean.includes('anotar') ||
    clean.includes('adicionar recado') ||
    clean.includes('colocar recado') ||
    clean.includes('comentario');

  if (isAddNote) {
    // Extract actual note text removing command triggers
    let noteText = rawTranscript
      .replace(/^(?:por\s+favor\s+)?(?:adicionar|adiciona|anotar|anota|colocar|coloca|gravar|grava)?\s*(?:uma\s+)?(?:nota|observação|observacao|obs|recado|comentário|comentario)\s*(?:na|da|para\s+a|sobre\s+a|para)?\s*(?:parada|entrega|ponto)?\s*(?:\d+|primeira|segunda|terceira|quarta|quinta|sexta|sétima|oitava|nona|décima)?\s*[:,-]?\s*/i, '')
      .replace(/^[:\-\s]+/, '')
      .trim();

    if (!noteText) {
      noteText = rawTranscript;
    }

    // Capitalize first letter
    noteText = noteText.charAt(0).toUpperCase() + noteText.slice(1);

    return {
      rawTranscript,
      intent: 'add_note',
      targetStopIndex: targetIndex,
      targetStop,
      noteText,
      spokenFeedback: targetStop
        ? `Nota adicionada à parada ${stopNumberDisplay}: "${noteText}".`
        : `Nota registrada: "${noteText}".`,
    };
  }

  // 2. CHANGE STATUS COMMANDS

  // 2.1 CONCLUDED / COMPLETED
  // Examples: "marcar parada como concluída", "concluir entrega", "concluir parada 3", "parada 2 entregue", "finalizar entrega", "dar baixa na parada 1"
  if (
    clean.includes('conclui') ||
    clean.includes('concluida') ||
    clean.includes('concluido') ||
    clean.includes('entregue') ||
    clean.includes('entregou') ||
    clean.includes('finalizar') ||
    clean.includes('finalizada') ||
    clean.includes('finalizado') ||
    clean.includes('dar baixa') ||
    clean.includes('deu baixa') ||
    clean.includes('feito') ||
    clean.includes('terminada') ||
    clean.includes('terminado')
  ) {
    return {
      rawTranscript,
      intent: 'change_status',
      targetStopIndex: targetIndex,
      targetStop,
      status: 'concluido',
      spokenFeedback: targetStop
        ? `Parada ${stopNumberDisplay} marcada como concluída! Tirando comprovante...`
        : `Parada marcada como concluída!`,
    };
  }

  // 2.2 IN TRANSIT / STARTED
  // Examples: "iniciar parada 2", "em trânsito para parada 3", "indo para parada", "a caminho da parada 1"
  if (
    clean.includes('transito') ||
    clean.includes('iniciar') ||
    clean.includes('iniciada') ||
    clean.includes('a caminho') ||
    clean.includes('indo para') ||
    clean.includes('partindo para') ||
    clean.includes('comecar') ||
    clean.includes('começar')
  ) {
    return {
      rawTranscript,
      intent: 'change_status',
      targetStopIndex: targetIndex,
      targetStop,
      status: 'em_transito',
      spokenFeedback: targetStop
        ? `Parada ${stopNumberDisplay} iniciada. Em trânsito para o destino!`
        : `Em trânsito para a próxima parada.`,
    };
  }

  // 2.3 FAILED / AUSENT / NOT DELIVERED
  // Examples: "marcar parada como falha", "destinatário ausente na parada 2", "não entregue parada 3", "recusada"
  if (
    clean.includes('falha') ||
    clean.includes('ausente') ||
    clean.includes('nao entregue') ||
    clean.includes('não entregue') ||
    clean.includes('recusou') ||
    clean.includes('recusado') ||
    clean.includes('recusada') ||
    clean.includes('ninguem em casa') ||
    clean.includes('ninguém em casa') ||
    clean.includes('nao encontrado') ||
    clean.includes('endereço incorreto')
  ) {
    return {
      rawTranscript,
      intent: 'change_status',
      targetStopIndex: targetIndex,
      targetStop,
      status: 'falha',
      spokenFeedback: targetStop
        ? `Parada ${stopNumberDisplay} registrada com status de falha ou ausência.`
        : `Parada registrada como falha.`,
    };
  }

  // 2.4 CANCELLED
  if (clean.includes('cancelar parada') || clean.includes('cancela parada') || clean.includes('parada cancelada')) {
    return {
      rawTranscript,
      intent: 'change_status',
      targetStopIndex: targetIndex,
      targetStop,
      status: 'cancelado',
      spokenFeedback: targetStop
        ? `Parada ${stopNumberDisplay} cancelada.`
        : `Parada cancelada.`,
    };
  }

  // 2.5 PENDING / REOPEN
  if (clean.includes('reabrir') || clean.includes('pendente') || clean.includes('desfazer')) {
    return {
      rawTranscript,
      intent: 'change_status',
      targetStopIndex: targetIndex,
      targetStop,
      status: 'pendente',
      spokenFeedback: targetStop
        ? `Parada ${stopNumberDisplay} reaberta como pendente.`
        : `Parada reaberta.`,
    };
  }

  // 3. ROUTE OPTIMIZATION
  // Examples: "otimizar rota", "reorganizar paradas", "melhor caminho", "calcular rota mais rápida"
  if (
    clean.includes('otimizar') ||
    clean.includes('otimiza') ||
    clean.includes('reorganizar') ||
    clean.includes('melhor caminho') ||
    clean.includes('recalcular')
  ) {
    return {
      rawTranscript,
      intent: 'optimize_route',
      spokenFeedback: 'Otimizando ordem das paradas para menor tempo e distância!',
    };
  }

  // 4. NEXT STOP / ANNOUNCE
  // Examples: "qual a próxima parada", "próxima entrega", "ler endereço", "onde é a próxima"
  if (
    clean.includes('proxima parada') ||
    clean.includes('proxima entrega') ||
    clean.includes('qual a proxima') ||
    clean.includes('qual o proximo') ||
    clean.includes('onde e a proxima') ||
    clean.includes('ler parada')
  ) {
    return {
      rawTranscript,
      intent: 'next_stop',
      targetStopIndex: targetIndex,
      targetStop,
      spokenFeedback: targetStop
        ? `Próxima parada: ${targetStop.address}${targetStop.customerName ? `, para ${targetStop.customerName}` : ''}.`
        : 'Não há paradas pendentes no momento.',
    };
  }

  // 5. OPEN FULL MAP
  if (clean.includes('abrir mapa') || clean.includes('ver mapa') || clean.includes('mostrar mapa') || clean.includes('mapa completo')) {
    return {
      rawTranscript,
      intent: 'open_map',
      spokenFeedback: 'Abrindo visualização em tela cheia do mapa!',
    };
  }

  // 6. SHARE ROUTE
  if (clean.includes('compartilhar') || clean.includes('enviar rota') || clean.includes('mandar no whatsapp')) {
    return {
      rawTranscript,
      intent: 'share_route',
      spokenFeedback: 'Preparando compartilhamento da rota!',
    };
  }

  return {
    rawTranscript,
    intent: 'unknown',
    spokenFeedback: `Comando "${rawTranscript}" não reconhecido. Diga por exemplo: "Marcar parada 1 como concluída" ou "Adicionar nota: cliente não estava".`,
  };
}

/**
 * Check if Web Speech Recognition is supported in the current browser
 */
export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
}
