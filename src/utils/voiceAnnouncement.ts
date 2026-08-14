/**
 * Web Speech API helper to announce the next delivery stop out loud in Portuguese (pt-BR).
 */
export function speakNextStopAnnouncement(
  customerName?: string,
  address?: string,
  reason?: string
): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.warn('SpeechSynthesis API not supported in this browser environment.');
    return false;
  }

  try {
    // Cancel any ongoing speech to avoid overlapping voice prompts
    window.speechSynthesis.cancel();

    let textToSpeak = 'Atenção. Próxima parada confirmada.';

    if (customerName && address) {
      const cleanAddr = address.split(',')[0] || address;
      textToSpeak = `Atenção motorista. Próxima parada: Cliente ${customerName}, no endereço ${cleanAddr}.`;
    } else if (address) {
      const cleanAddr = address.split(',')[0] || address;
      textToSpeak = `Atenção motorista. Próxima parada no endereço ${cleanAddr}.`;
    } else if (customerName) {
      textToSpeak = `Atenção motorista. Próxima parada para o cliente ${customerName}.`;
    }

    if (reason) {
      textToSpeak += ` Observação do trajeto: ${reason}`;
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = 'pt-BR';
    utterance.rate = 0.95; // Slightly measured rate for clear driving announcements
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Try finding a Portuguese voice if available
    const voices = window.speechSynthesis.getVoices();
    const ptVoice = voices.find((v) => v.lang.startsWith('pt'));
    if (ptVoice) {
      utterance.voice = ptVoice;
    }

    window.speechSynthesis.speak(utterance);
    return true;
  } catch (err) {
    console.error('Error in speakNextStopAnnouncement:', err);
    return false;
  }
}

/**
 * Stop any current speech synthesis
 */
export function stopVoiceAnnouncement(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
