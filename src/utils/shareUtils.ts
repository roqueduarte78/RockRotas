import { RouteStop, RouteSummary } from '../types';
import { getFullRouteGoogleMapsUrl } from './routeOptimizer';

export interface ShareResult {
  success: boolean;
  method: 'native' | 'clipboard';
  message: string;
}

/**
 * Builds a clean, professional text summary of the current route for sharing
 */
export function buildRouteShareText(
  stops: RouteStop[],
  routeSummary?: RouteSummary,
  routeName: string = 'Minha Rota de Entregas'
): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR');
  const fullMapsUrl = getFullRouteGoogleMapsUrl(stops);

  const totalPackages = stops.reduce((acc, s) => acc + (s.packagesCount || (s.packageNumbers?.length || 1)), 0);

  let text = `🚚 *${routeName.toUpperCase()}*\n`;
  text += `📅 Data: ${dateStr}\n`;
  text += `📍 Total de Paradas: ${stops.length}\n`;
  text += `📦 Total de Pacotes/Volumes: ${totalPackages}\n`;

  if (routeSummary) {
    text += `🛣️ Distância Estimada: ${routeSummary.totalDistanceKm} km\n`;
    text += `⏱️ Tempo Estimado: ${routeSummary.totalDurationMin} min\n`;
  }

  text += `\n🗺️ *Link da Rota Completa no Google Maps:*\n${fullMapsUrl !== '#' ? fullMapsUrl : 'Abrir no app'}\n\n`;
  text += `📋 *ITINERÁRIO DETALHADO:*\n`;

  stops.forEach((stop, idx) => {
    const isCompleted = stop.status === 'concluido';
    const statusIcon = isCompleted ? '✅' : '⏳';
    const pkgText = stop.packageNumbers && stop.packageNumbers.length > 0
      ? ` [📦 Pacotes: ${stop.packageNumbers.join(', ')}]`
      : stop.packagesCount && stop.packagesCount > 1
      ? ` [📦 ${stop.packagesCount} pacotes]`
      : '';

    text += `\n${statusIcon} *#${idx + 1}* ${stop.address}${pkgText}`;
    if (stop.customerName) text += `\n   👤 Destinatário: ${stop.customerName}`;
    if (stop.phone) text += `\n   📞 Tel: ${stop.phone}`;
    if (stop.notes) text += `\n   📝 Obs: ${stop.notes}`;
  });

  text += `\n\n_Enviado via RotaExpress PRO_`;
  return text;
}

/**
 * Shares the route using navigator.share if supported, or copies to clipboard
 */
export async function shareRoute(
  stops: RouteStop[],
  routeSummary?: RouteSummary,
  routeName: string = 'Minha Rota de Entregas'
): Promise<ShareResult> {
  if (stops.length === 0) {
    return {
      success: false,
      method: 'clipboard',
      message: 'Nenhuma parada para compartilhar.',
    };
  }

  const shareText = buildRouteShareText(stops, routeSummary, routeName);
  const fullMapsUrl = getFullRouteGoogleMapsUrl(stops);
  const shareUrl = fullMapsUrl !== '#' ? fullMapsUrl : window.location.href;

  // Try Native Navigator.share first
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: `Rota: ${routeName}`,
        text: shareText,
        url: shareUrl,
      });
      return {
        success: true,
        method: 'native',
        message: 'Rota compartilhada com sucesso!',
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return {
          success: false,
          method: 'native',
          message: 'Compartilhamento cancelado.',
        };
      }
      console.warn('Native share failed or declined, falling back to clipboard copy:', err);
    }
  }

  // Fallback to Clipboard Copy
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(shareText);
      return {
        success: true,
        method: 'clipboard',
        message: '📋 Rota e itinerário copiados para a área de transferência!',
      };
    }
  } catch (clipErr) {
    console.warn('Clipboard write failed:', clipErr);
  }

  return {
    success: false,
    method: 'clipboard',
    message: 'Não foi possível compartilhar automaticamente. Copie manualmente os dados.',
  };
}

/**
 * Convenience wrapper for sharing route natively with flexible argument formats
 */
export async function shareRouteNative(
  routeNameOrStops: string | RouteStop[],
  stopsOrSummary?: RouteStop[] | RouteSummary,
  summaryOrName?: RouteSummary | string
): Promise<ShareResult> {
  let routeName = 'Minha Rota de Entregas';
  let stops: RouteStop[] = [];
  let summary: RouteSummary | undefined = undefined;

  if (typeof routeNameOrStops === 'string') {
    routeName = routeNameOrStops;
    if (Array.isArray(stopsOrSummary)) {
      stops = stopsOrSummary;
    }
    if (typeof summaryOrName === 'object') {
      summary = summaryOrName;
    }
  } else if (Array.isArray(routeNameOrStops)) {
    stops = routeNameOrStops;
    if (typeof stopsOrSummary === 'object' && !Array.isArray(stopsOrSummary)) {
      summary = stopsOrSummary as RouteSummary;
    }
    if (typeof summaryOrName === 'string') {
      routeName = summaryOrName;
    }
  }

  return shareRoute(stops, summary, routeName);
}

