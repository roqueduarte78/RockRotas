import { VoicePersona, VoicePersonaInfo, VoiceConfig } from '../types';

export const VOICE_PERSONAS: VoicePersonaInfo[] = [
  {
    id: 'feminino',
    name: 'Feminino Padrão',
    region: 'Brasil (Profissional)',
    tagline: 'Clara, elegante e profissional para navegação',
    emoji: '👩‍💼',
    samplePhrase: 'Atenção motorista. Próxima parada confirmada. Dirija com segurança e bom trabalho!',
    defaultPitch: 1.05,
    defaultRate: 1.0,
  },
  {
    id: 'masculino',
    name: 'Masculino Padrão',
    region: 'Brasil (Executivo)',
    tagline: 'Voz firme, direta e focada na produtividade',
    emoji: '👨‍💼',
    samplePhrase: 'RotaExpress informa. Próxima entrega localizada. Prepare o pacote e a assinatura do cliente.',
    defaultPitch: 0.88,
    defaultRate: 0.98,
  },
  {
    id: 'baiano',
    name: 'Baiano',
    region: 'Bahia (Salvador & Litoral)',
    tagline: 'Ô meu rei! Tranquilidade, axé e direção na paz',
    emoji: '🌴',
    samplePhrase: 'Ô meu rei! Se avexe não, a próxima parada tá logo ali. Vai na manha, com calma e muito axé!',
    defaultPitch: 0.95,
    defaultRate: 0.92,
  },
  {
    id: 'carioca',
    name: 'Carioca',
    region: 'Rio de Janeiro',
    tagline: 'Fala tu, parceiro! Visão total na pista e agilidade',
    emoji: '🏖️',
    samplePhrase: 'Fala tu, meu consagrado! Se liga aí: próxima parada na fita. Visão total no trânsito, tamo junto!',
    defaultPitch: 1.04,
    defaultRate: 1.05,
  },
  {
    id: 'cuiabano',
    name: 'Cuiabano & Pantaneiro',
    region: 'Mato Grosso (Cuiabá / Pantanal)',
    tagline: 'Ê tchô! Caloroso, autêntico e parceiro de estrada',
    emoji: '🐆',
    samplePhrase: 'Êêê tchô! Olha só onde nóis vai agora. Vamo que vamo que o calor tá rachando, guri!',
    defaultPitch: 0.98,
    defaultRate: 0.96,
  },
  {
    id: 'humor',
    name: 'Humor & Zueira',
    region: 'Comediante de Rota',
    tagline: 'Divertido, irreverente e animado pra espantar o sono',
    emoji: '🤣',
    samplePhrase: 'Alô piloto de fuga! Acorda que a próxima entrega tá na mira! Pisa no freio e não vai errar o interfone!',
    defaultPitch: 1.15,
    defaultRate: 1.08,
  },
  {
    id: 'mineiro',
    name: 'Mineiro',
    region: 'Minas Gerais',
    tagline: 'Uai sô! Mansinho, cuidadoso e com cafezinho garantido',
    emoji: '☕',
    samplePhrase: 'Uai, sô! A próxima parada tá logo ali no jeitinho. Vai devagarim no trem da entrega que o pão de queijo tá quentim!',
    defaultPitch: 1.0,
    defaultRate: 0.94,
  },
  {
    id: 'gaucho',
    name: 'Gaúcho',
    region: 'Rio Grande do Sul',
    tagline: 'Buenas, vivente! Firmeza, mate amargo e marcha pesada',
    emoji: '🧉',
    samplePhrase: 'Buenas, vivente! Te apruma que a próxima parada tá no piquete. Mete marcha e toca o barco, tchê!',
    defaultPitch: 0.9,
    defaultRate: 1.0,
  },
  {
    id: 'paulista',
    name: 'Paulista',
    region: 'São Paulo',
    tagline: 'Bora agilizar! Foco no trânsito e máxima produtividade',
    emoji: '🏙️',
    samplePhrase: 'Bora meu querido! Sem perder tempo no trânsito, próxima entrega na agulha. Agiliza aí que o dia rende!',
    defaultPitch: 1.0,
    defaultRate: 1.08,
  },
];

const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  persona: 'feminino',
  enabled: true,
  autoAnnounceNextStop: true,
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
};

/**
 * Load saved voice configuration from localStorage
 */
export function getSavedVoiceConfig(): VoiceConfig {
  if (typeof window === 'undefined') return DEFAULT_VOICE_CONFIG;
  try {
    const saved = localStorage.getItem('ROTA_EXPRESS_VOICE_CONFIG');
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_VOICE_CONFIG, ...parsed };
    }
  } catch (e) {
    console.warn('Failed to load voice config:', e);
  }
  return DEFAULT_VOICE_CONFIG;
}

/**
 * Save voice configuration to localStorage
 */
export function saveVoiceConfig(config: VoiceConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('ROTA_EXPRESS_VOICE_CONFIG', JSON.stringify(config));
  } catch (e) {
    console.warn('Failed to save voice config:', e);
  }
}

/**
 * Build dynamic phrase for announcing a delivery stop according to the selected persona
 */
export function formatNextStopPhrase(
  persona: VoicePersona,
  customerName?: string,
  address?: string,
  reason?: string
): string {
  const cleanAddr = address ? address.split(',')[0].trim() : '';
  const client = customerName ? customerName.trim() : 'o cliente';

  switch (persona) {
    case 'baiano':
      if (customerName && cleanAddr) {
        return `Ô meu rei! Se avexe não. Próxima parada tá chegando: cliente ${client}, lá na ${cleanAddr}. Vai na manha e com fé!`;
      }
      return cleanAddr
        ? `Ô meu querido, próxima parada é na ${cleanAddr}. Vai com calma e com axé!`
        : `Ô meu rei, próxima entrega na área!`;

    case 'carioca':
      if (customerName && cleanAddr) {
        return `Fala tu, parceiro! Se liga aí: próxima parada na fita é com ${client}, no endereço ${cleanAddr}. Visão total na pista, meu consagrado!`;
      }
      return cleanAddr
        ? `Fala tu! Próxima parada na ${cleanAddr}. Tamo junto, se liga no trânsito!`
        : `Visão, meu consagrado! Próxima entrega chegando!`;

    case 'cuiabano':
      if (customerName && cleanAddr) {
        return `Êêê tchô! Olha só onde nóis vai agora: na casa de ${client}, lá no ${cleanAddr}. Vamo que vamo que o calor tá rachando!`;
      }
      return cleanAddr
        ? `Ê tchô, próxima parada é lá no ${cleanAddr}. Bora ligeiro!`
        : `Xô mano, próxima entrega na agulha!`;

    case 'humor':
      if (customerName && cleanAddr) {
        return `Alô piloto de fuga! Acorda que o cliente ${client} tá esperando a encomenda lá na ${cleanAddr}. Pisa no freio e não vai errar o interfone hein!`;
      }
      return cleanAddr
        ? `Alô motorista nota 10! Próxima parada na ${cleanAddr}. Não vai dar ré no poste!`
        : `Atenção terra chamando piloto, próxima parada na pista!`;

    case 'mineiro':
      if (customerName && cleanAddr) {
        return `Uai, sô! Próxima parada logo ali na ${cleanAddr}, pro ${client}. Cê vai devagarim que o trem da entrega tá bonito!`;
      }
      return cleanAddr
        ? `Uai, próxima entrega é logo ali na ${cleanAddr}. Vai na calma sô!`
        : `Nossa senhora, bora pra próxima entrega!`;

    case 'gaucho':
      if (customerName && cleanAddr) {
        return `Buenas, vivente! Te apruma que a próxima parada é com o patrão ${client}, lá na ${cleanAddr}. Toca o minuano e mete marcha, tchê!`;
      }
      return cleanAddr
        ? `Buenas, vivente! Próxima parada na ${cleanAddr}. Mete bronca, tchê!`
        : `Te apruma vivente, próxima entrega no piquete!`;

    case 'paulista':
      if (customerName && cleanAddr) {
        return `Bora meu querido! Sem perder tempo: próxima entrega é pro ${client}, na ${cleanAddr}. Agiliza aí que o horário tá rendendo!`;
      }
      return cleanAddr
        ? `Bora agilizar! Próxima parada na ${cleanAddr}. Foco no trânsito!`
        : `Bora que o tempo ruge, próxima entrega!`;

    case 'masculino':
      if (customerName && cleanAddr) {
        return `RotaExpress informa. Próxima entrega confirmada: cliente ${client}, endereço ${cleanAddr}.`;
      }
      return cleanAddr
        ? `Atenção. Próxima parada no endereço ${cleanAddr}.`
        : `Atenção. Próxima parada confirmada.`;

    case 'feminino':
    default:
      if (customerName && cleanAddr) {
        return `Atenção motorista. Próxima parada: cliente ${client}, no endereço ${cleanAddr}. Dirija com cuidado!`;
      }
      return cleanAddr
        ? `Atenção motorista. Próxima parada no endereço ${cleanAddr}.`
        : `Atenção. Próxima parada confirmada.`;
  }
}

/**
 * Format stop completion announcement
 */
export function formatStopCompletedPhrase(
  persona: VoicePersona,
  completedCustomer?: string,
  nextCustomer?: string,
  nextAddress?: string
): string {
  const cleanNextAddr = nextAddress ? nextAddress.split(',')[0].trim() : '';

  switch (persona) {
    case 'baiano':
      return nextCustomer && cleanNextAddr
        ? `Show de bola, entrega finalizada! Agora rumo a ${nextCustomer}, na ${cleanNextAddr}. Axé!`
        : `Massa demais, parada concluída! Rota seguindo tranquila.`;

    case 'carioca':
      return nextCustomer && cleanNextAddr
        ? `Entrega no bolso, fechamento! Agora partiu ${nextCustomer}, lá na ${cleanNextAddr}. Dale!`
        : `Finalizado com sucesso, chefia! Próxima na mira.`;

    case 'cuiabano':
      return nextCustomer && cleanNextAddr
        ? `Tá bonito! Essa já foi. Agora vamo lá no ${nextCustomer}, na ${cleanNextAddr}!`
        : `Ê tchô, mais uma entrega concluída nos trinks!`;

    case 'humor':
      return nextCustomer && cleanNextAddr
        ? `Mais um cliente feliz e alimentado! Próxima parada com ${nextCustomer}, na ${cleanNextAddr}. Segura o volante!`
        : `Missão cumprida! Sobrevivemos a mais uma parada.`;

    case 'mineiro':
      return nextCustomer && cleanNextAddr
        ? `Trem bão demais, essa tá entregue! Agora vamo lá pro ${nextCustomer}, na ${cleanNextAddr}.`
        : `Tudo certim, entrega finalizada!`;

    case 'gaucho':
      return nextCustomer && cleanNextAddr
        ? `Feito o carreto! Agora toca o barco pro ${nextCustomer}, na ${cleanNextAddr}, tchê!`
        : `Entrega despachada com sucesso, vivente!`;

    case 'paulista':
      return nextCustomer && cleanNextAddr
        ? `Finalizada com sucesso! Próxima parada: ${nextCustomer}, na ${cleanNextAddr}. Bora produzir!`
        : `Entrega concluída. Rota em andamento.`;

    case 'masculino':
    case 'feminino':
    default:
      return nextCustomer && cleanNextAddr
        ? `Entrega concluída. Próxima parada: ${nextCustomer}, no endereço ${cleanNextAddr}.`
        : `Parada concluída com sucesso.`;
  }
}

/**
 * Detect probable voice gender from voice name / attributes
 */
export function detectVoiceGender(voice: SpeechSynthesisVoice): 'feminino' | 'masculino' | 'desconhecido' {
  const name = voice.name.toLowerCase();
  if (
    name.includes('female') ||
    name.includes('maria') ||
    name.includes('luciana') ||
    name.includes('francisca') ||
    name.includes('leticia') ||
    name.includes('fernanda') ||
    name.includes('heloisa') ||
    name.includes('vitoria') ||
    name.includes('mulher')
  ) {
    return 'feminino';
  }
  if (
    name.includes('male') ||
    name.includes('felipe') ||
    name.includes('daniel') ||
    name.includes('antonio') ||
    name.includes('ricardo') ||
    name.includes('luciano') ||
    name.includes('homem')
  ) {
    return 'masculino';
  }
  return 'desconhecido';
}

/**
 * Announce proximity to next stop discreetly
 */
export function speakProximityAnnouncement(
  customerName?: string,
  address?: string,
  distanceMeters: number = 500
): boolean {
  const config = getSavedVoiceConfig();
  if (!config.enabled) return false;

  const cleanAddr = address ? address.split(',')[0].trim() : '';
  const client = customerName ? customerName.trim() : '';

  let message = `Atenção: a quinhentos metros da parada`;
  if (client) {
    message += ` de ${client}`;
  } else if (cleanAddr) {
    message += ` na ${cleanAddr}`;
  }

  return speakText(message, {
    persona: config.persona,
    pitch: config.persona === 'masculino' ? 0.88 : (config.persona === 'feminino' ? 1.05 : config.pitch),
  });
}

/**
 * Web Speech API synthesizer core
 */
export function speakText(
  text: string,
  options?: {
    persona?: VoicePersona;
    rate?: number;
    pitch?: number;
    volume?: number;
    voiceURI?: string;
  }
): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.warn('SpeechSynthesis API not supported in this browser.');
    return false;
  }

  try {
    window.speechSynthesis.cancel();

    const config = getSavedVoiceConfig();
    const personaId = options?.persona || config.persona || 'feminino';
    const personaInfo = VOICE_PERSONAS.find((p) => p.id === personaId) || VOICE_PERSONAS[0];

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';

    // Apply persona default pitch/rate or custom overrides
    const effectiveRate = options?.rate ?? (config.rate !== 1.0 ? config.rate : personaInfo.defaultRate);
    const effectivePitch = options?.pitch ?? (config.pitch !== 1.0 ? config.pitch : personaInfo.defaultPitch);
    const effectiveVolume = options?.volume ?? config.volume ?? 1.0;

    utterance.rate = Math.max(0.6, Math.min(1.8, effectiveRate));
    utterance.pitch = Math.max(0.5, Math.min(1.8, effectivePitch));
    utterance.volume = Math.max(0, Math.min(1.0, effectiveVolume));

    // Choose best matching PT voice
    const voices = window.speechSynthesis.getVoices();
    let selectedVoice = voices.find((v) => v.voiceURI === (options?.voiceURI || config.voiceURI));

    if (!selectedVoice) {
      // Find Portuguese voices prioritizing pt-BR
      const ptBrVoices = voices.filter((v) => v.lang === 'pt-BR' || v.lang === 'pt_BR');
      const anyPtVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('pt'));
      const pool = ptBrVoices.length > 0 ? ptBrVoices : anyPtVoices;

      if (personaId === 'masculino') {
        selectedVoice = pool.find((v) => detectVoiceGender(v) === 'masculino') || pool[0];
      } else if (personaId === 'feminino') {
        selectedVoice = pool.find((v) => detectVoiceGender(v) === 'feminino') || pool[0];
      } else {
        selectedVoice = pool[0];
      }
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    window.speechSynthesis.speak(utterance);
    return true;
  } catch (err) {
    console.error('Error speaking text:', err);
    return false;
  }
}

/**
 * Announce next stop using current voice persona
 */
export function speakNextStopAnnouncement(
  customerName?: string,
  address?: string,
  reason?: string,
  customPersona?: VoicePersona
): boolean {
  const config = getSavedVoiceConfig();
  if (!config.enabled && !customPersona) return false;

  const persona = customPersona || config.persona || 'feminino';
  let text = formatNextStopPhrase(persona, customerName, address, reason);
  if (reason) {
    text += ` Dica do trajeto: ${reason}`;
  }

  return speakText(text, { persona });
}

/**
 * Stop any running voice synthesis
 */
export function stopVoiceAnnouncement(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Retrieve list of all available Web Speech browser voices
 */
export function getAvailableBrowserVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  return window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('pt'));
}
