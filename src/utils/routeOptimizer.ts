import * as XLSX from 'xlsx';
import { RouteStop, RouteSummary, RoutePerformance, StopExecutionLog, ValidatedAddressResult } from '../types';

// Calculates distance between 2 coordinates in kilometers using Haversine formula with urban road circuity factor
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const directDistance = R * c;
  // Account for Brazilian urban road circuity factor (~1.28x Euclidean distance)
  const roadDistance = directDistance * 1.28;
  return Math.round(roadDistance * 10) / 10;
}

// Estimates driving time in minutes based on distance and average urban traffic speed
export function estimateDrivingDurationMin(distanceKm: number): number {
  if (!distanceKm || distanceKm <= 0) return 0;
  const avgUrbanSpeedKmH = 28; // 28 km/h realistic average speed in Brazilian cities with traffic
  const driveMinutes = (distanceKm / avgUrbanSpeedKmH) * 60;
  return Math.max(1, Math.round(driveMinutes));
}

export interface PlaceSuggestion {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
  lat?: number;
  lng?: number;
  source: 'google' | 'osm';
}

// Fetches real-time address / place suggestions from Google Places API (with OSM fallback)
export async function fetchPlacesAutocomplete(
  input: string
): Promise<PlaceSuggestion[]> {
  if (!input || input.trim().length < 2) return [];

  try {
    const res = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(input.trim())}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        return data;
      }
    }
  } catch (err) {
    console.warn('Autocomplete fetch error:', err);
  }

  return [];
}

// Resolves exact coordinates and formatted address for a selected place
export async function fetchPlaceDetails(
  place: PlaceSuggestion
): Promise<{ lat: number; lng: number; formattedAddress: string } | null> {
  // If coordinates are already present in suggestion
  if (place.lat !== undefined && place.lng !== undefined) {
    return {
      lat: place.lat,
      lng: place.lng,
      formattedAddress: place.description || place.mainText,
    };
  }

  try {
    const params = new URLSearchParams();
    if (place.placeId) params.append('place_id', place.placeId);
    if (place.description) params.append('address', place.description);

    const res = await fetch(`/api/places/details?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.lat === 'number' && typeof data.lng === 'number') {
        return {
          lat: data.lat,
          lng: data.lng,
          formattedAddress: data.formattedAddress || place.description,
        };
      }
    }
  } catch (err) {
    console.warn('Place details fetch error:', err);
  }

  return geocodeAddress(place.description);
}

// Geocodes an address string using backend server proxy with caching and rate limiting
export async function geocodeAddress(
  address: string
): Promise<{ lat: number; lng: number; formattedAddress: string } | null> {
  if (!address || !address.trim()) return null;

  try {
    const res = await fetch(`/api/places/details?address=${encodeURIComponent(address.trim())}`);
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.lat === 'number' && typeof data.lng === 'number') {
        return {
          lat: data.lat,
          lng: data.lng,
          formattedAddress: data.formattedAddress || address,
        };
      }
    }
  } catch (err) {
    console.warn('Geocode proxy request error:', err);
  }

  return null;
}

// Validates and standardizes addresses with Gemini AI
export async function validateAddressesWithGemini(
  stops: RouteStop[]
): Promise<ValidatedAddressResult[]> {
  try {
    const itemsToValidate = stops.map((s) => ({
      originalAddress: s.address,
      city: s.city,
      state: s.state,
      cep: s.cep,
    }));

    const res = await fetch('/api/gemini/validate-addresses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: itemsToValidate }),
    });

    if (!res.ok) throw new Error('Falha ao comunicar com API Gemini');
    const data = await res.json();
    if (data.success && Array.isArray(data.results)) {
      return data.results;
    }
  } catch (err) {
    console.warn('Error in validateAddressesWithGemini:', err);
  }
  return [];
}

// Nearest Neighbor Route Optimization (TSP) starting from driver's current position if available
export function optimizeRouteTSP(
  stops: RouteStop[],
  startPosition?: { lat: number; lng: number }
): RouteStop[] {
  // Filter stops that have valid coordinates
  const validStops = stops.filter((s) => s.lat !== undefined && s.lng !== undefined);
  const unpositionedStops = stops.filter((s) => s.lat === undefined || s.lng === undefined);

  if (validStops.length <= 1) {
    return calculateRouteMetrics(stops);
  }

  // Separate high priority stops from normal/low
  const highPriorityStops = validStops.filter((s) => s.priority === 'alta');
  const otherStops = validStops.filter((s) => s.priority !== 'alta');

  const ordered: RouteStop[] = [];

  let currentLat: number;
  let currentLng: number;

  if (startPosition) {
    currentLat = startPosition.lat;
    currentLng = startPosition.lng;
  } else {
    // Start at origin/first stop
    const first = validStops[0];
    currentLat = first.lat!;
    currentLng = first.lng!;
  }

  // Helper to run pure nearest neighbor algorithm on a pool of stops
  const runNearestNeighbor = (pool: RouteStop[]) => {
    const unvisited = [...pool];
    while (unvisited.length > 0) {
      let nearestIdx = -1;
      let minDistance = Infinity;

      for (let i = 0; i < unvisited.length; i++) {
        const dist = calculateHaversineDistanceKm(
          currentLat,
          currentLng,
          unvisited[i].lat!,
          unvisited[i].lng!
        );
        if (dist < minDistance) {
          minDistance = dist;
          nearestIdx = i;
        }
      }

      if (nearestIdx !== -1) {
        const nextStop = unvisited.splice(nearestIdx, 1)[0];
        ordered.push(nextStop);
        currentLat = nextStop.lat!;
        currentLng = nextStop.lng!;
      } else {
        break;
      }
    }
  };

  // If high priority stops exist, visit high priority cluster first, then remaining
  if (highPriorityStops.length > 0) {
    runNearestNeighbor(highPriorityStops);
    runNearestNeighbor(otherStops);
  } else {
    runNearestNeighbor(validStops);
  }

  const fullList = [...ordered, ...unpositionedStops];
  return calculateRouteMetrics(fullList);
}

// Calculates distance, duration, cumulative distance/duration, and estimated ETAs between sequential stops
export function calculateRouteMetrics(stops: RouteStop[], startHour = 8): RouteStop[] {
  let prevLat: number | null = null;
  let prevLng: number | null = null;
  let runningDistanceKm = 0;
  let runningDurationMin = 0;

  // Assume route starts today at 08:00 AM (or current hour if already past)
  const now = new Date();
  const startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startHour, 0, 0);

  return stops.map((stop) => {
    let segmentDist = 0;
    let segmentDuration = 0;

    if (stop.lat !== undefined && stop.lng !== undefined) {
      if (prevLat !== null && prevLng !== null) {
        segmentDist = calculateHaversineDistanceKm(prevLat, prevLng, stop.lat, stop.lng);
        const driveDuration = estimateDrivingDurationMin(segmentDist);
        // Drive duration + planned dwell/unloading time per stop (default 4 mins)
        const plannedDwell = stop.plannedDwellTimeMin ?? 4;
        segmentDuration = driveDuration + plannedDwell;
      }
      prevLat = stop.lat;
      prevLng = stop.lng;
    }

    runningDistanceKm += segmentDist;
    runningDurationMin += segmentDuration;

    // Calculate predicted ETA time string
    const etaDate = new Date(startTime.getTime() + runningDurationMin * 60 * 1000);
    const etaFormatted = etaDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    return {
      ...stop,
      plannedDwellTimeMin: stop.plannedDwellTimeMin ?? 4,
      distanceFromPrevKm: Math.round(segmentDist * 10) / 10,
      durationFromPrevMin: segmentDuration,
      accumulatedDistanceKm: Math.round(runningDistanceKm * 10) / 10,
      accumulatedDurationMin: Math.round(runningDurationMin),
      estimatedEta: etaFormatted,
    };
  });
}

// Computes summary metrics for the whole route
export function computeRouteSummary(stops: RouteStop[]): RouteSummary {
  let totalDistanceKm = 0;
  let totalDurationMin = 0;
  let completedCount = 0;

  stops.forEach((stop) => {
    if (stop.status === 'concluido') {
      completedCount++;
    }
    if (typeof stop.distanceFromPrevKm === 'number') {
      totalDistanceKm += stop.distanceFromPrevKm;
    }
    if (typeof stop.durationFromPrevMin === 'number') {
      totalDurationMin += stop.durationFromPrevMin;
    }
  });

  return {
    totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
    totalDurationMin: Math.round(totalDurationMin),
    completedCount,
    totalCount: stops.length,
    startTimeFormatted: '08:00',
  };
}

// Computes Route Performance metrics comparing actual dwell time vs planned time
export function computeRoutePerformance(stops: RouteStop[]): RoutePerformance {
  const completedStops = stops.filter((s) => s.status === 'concluido' || s.status === 'falha');

  let totalPlannedDwellMin = 0;
  let totalActualDwellMin = 0;
  const executionLogs: StopExecutionLog[] = [];

  completedStops.forEach((stop) => {
    const planned = stop.plannedDwellTimeMin ?? 4;
    totalPlannedDwellMin += planned;

    let actual = stop.actualDwellTimeMin;
    if (actual === undefined || actual === null) {
      if (stop.arrivedAt && stop.completedAt) {
        const start = new Date(stop.arrivedAt).getTime();
        const end = new Date(stop.completedAt).getTime();
        actual = Math.max(1, Math.round((end - start) / (1000 * 60)));
      } else {
        // Default actual time if timestamp wasn't logged
        actual = planned;
      }
    }

    totalActualDwellMin += actual;
    const diff = actual - planned;

    executionLogs.push({
      stopId: stop.id,
      address: stop.address,
      customerName: stop.customerName,
      arrivedAt: stop.arrivedAt || new Date().toISOString(),
      completedAt: stop.completedAt || new Date().toISOString(),
      plannedMinutes: planned,
      actualMinutes: actual,
      diffMinutes: diff,
      status: stop.status,
    });
  });

  const avgDwellTimeMin =
    completedStops.length > 0 ? Math.round((totalActualDwellMin / completedStops.length) * 10) / 10 : 0;
  const savedOrLostMinutes = totalActualDwellMin - totalPlannedDwellMin;

  let punctualityStatus: 'Excelente' | 'No Prazo' | 'Com Atrasos' = 'Excelente';
  if (savedOrLostMinutes > 15) {
    punctualityStatus = 'Com Atrasos';
  } else if (savedOrLostMinutes > 5) {
    punctualityStatus = 'No Prazo';
  }

  // Calculate efficiency score (100% ideal)
  let efficiencyScorePct = 100;
  if (totalPlannedDwellMin > 0 && totalActualDwellMin > 0) {
    const ratio = totalPlannedDwellMin / totalActualDwellMin;
    efficiencyScorePct = Math.min(100, Math.max(30, Math.round(ratio * 100)));
  }

  return {
    efficiencyScorePct,
    totalPlannedDwellMin,
    totalActualDwellMin,
    avgDwellTimeMin,
    savedOrLostMinutes,
    punctualityStatus,
    executionLogs,
  };
}

// Waze Navigation URLs
export function getWazeUrl(lat: number, lng: number): string {
  return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
}

// Google Maps Navigation URLs
export function getGoogleMapsUrl(lat: number, lng: number, address?: string): string {
  if (lat && lng) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    address || ''
  )}&travelmode=driving`;
}

// Multi-stop Google Maps full route launcher URL
export function getFullRouteGoogleMapsUrl(stops: RouteStop[]): string {
  if (!stops || stops.length === 0) return '#';

  const validWithCoords = stops.filter((s) => s.lat !== undefined && s.lng !== undefined);

  if (validWithCoords.length === 0) {
    // Fallback using address strings if coordinates are not geocoded yet
    const validAddrs = stops.filter((s) => s.address && s.address.trim().length > 0);
    if (validAddrs.length === 0) return '#';
    if (validAddrs.length === 1) {
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(validAddrs[0].address)}&travelmode=driving`;
    }

    const origin = encodeURIComponent(validAddrs[0].address);
    const destination = encodeURIComponent(validAddrs[validAddrs.length - 1].address);
    const waypoints = validAddrs
      .slice(1, -1)
      .slice(0, 8) // Limit to 8 intermediate waypoints for web URL reliability
      .map((s) => encodeURIComponent(s.address))
      .join('|');

    if (waypoints) {
      return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoints}&travelmode=driving`;
    }
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
  }

  if (validWithCoords.length === 1) {
    return getGoogleMapsUrl(validWithCoords[0].lat!, validWithCoords[0].lng!, validWithCoords[0].address);
  }

  const origin = `${validWithCoords[0].lat},${validWithCoords[0].lng}`;
  const destination = `${validWithCoords[validWithCoords.length - 1].lat},${validWithCoords[validWithCoords.length - 1].lng}`;

  // Limit intermediate waypoints to max 9 to prevent Google Maps 400 Bad Request URL length errors
  const waypoints = validWithCoords
    .slice(1, -1)
    .slice(0, 9)
    .map((s) => `${s.lat},${s.lng}`)
    .join('|');

  if (waypoints) {
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${encodeURIComponent(
      waypoints
    )}&travelmode=driving`;
  }

  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
}

// WhatsApp messaging helper
export function getWhatsAppUrl(phone?: string, text?: string): string {
  if (!phone) return '#';
  const cleanPhone = phone.replace(/\D/g, '');
  const encodedText = text ? encodeURIComponent(text) : '';
  return `https://wa.me/${cleanPhone}?text=${encodedText}`;
}

// Parse Spreadsheet (XLSX / CSV) extracting city, state, cep, neighborhood
export async function parseSpreadsheetFile(file: File): Promise<Partial<RouteStop>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        const parsedStops: Partial<RouteStop>[] = json
          .map((row) => {
            const keys = Object.keys(row);
            const findValue = (...names: string[]) => {
              const foundKey = keys.find((k) =>
                names.some((name) => k.toLowerCase().trim().includes(name.toLowerCase()))
              );
              return foundKey ? String(row[foundKey]).trim() : '';
            };

            const address = findValue('endereço', 'endereco', 'rua', 'address', 'local', 'logradouro');
            const city = findValue('cidade', 'city', 'municipio', 'município');
            const state = findValue('estado', 'state', 'uf');
            const cep = findValue('cep', 'zipcode', 'zip');
            const neighborhood = findValue('bairro', 'neighborhood', 'suburb');
            const customerName = findValue('cliente', 'nome', 'customer', 'destinatario', 'recebedor');
            const phone = findValue('telefone', 'celular', 'phone', 'whatsapp', 'contato');
            const notes = findValue('observacao', 'observações', 'obs', 'notas', 'nota');
            const priorityVal = findValue('prioridade', 'priority');
            const timeWindow = findValue('horario', 'janela', 'hora', 'time');
            const latStr = findValue('latitude', 'lat');
            const lngStr = findValue('longitude', 'lng', 'lon');

            let priority: 'alta' | 'normal' | 'baixa' = 'normal';
            if (
              priorityVal.toLowerCase().includes('alt') ||
              priorityVal.toLowerCase().includes('urgente')
            ) {
              priority = 'alta';
            } else if (priorityVal.toLowerCase().includes('baix')) {
              priority = 'baixa';
            }

            let lat: number | undefined = undefined;
            let lng: number | undefined = undefined;
            if (latStr && !isNaN(parseFloat(latStr))) lat = parseFloat(latStr);
            if (lngStr && !isNaN(parseFloat(lngStr))) lng = parseFloat(lngStr);

            // Compose full address if fields were split
            let fullAddress = address || '';
            if (neighborhood && !fullAddress.toLowerCase().includes(neighborhood.toLowerCase())) {
              fullAddress += `, ${neighborhood}`;
            }
            if (city && !fullAddress.toLowerCase().includes(city.toLowerCase())) {
              fullAddress += ` - ${city}`;
            }
            if (state && !fullAddress.toLowerCase().includes(state.toLowerCase())) {
              fullAddress += ` - ${state}`;
            }

            return {
              address: fullAddress || address || 'Endereço não especificado',
              city: city || undefined,
              state: state || undefined,
              cep: cep || undefined,
              neighborhood: neighborhood || undefined,
              customerName: customerName || undefined,
              phone: phone || undefined,
              notes: notes || undefined,
              priority,
              timeWindow: timeWindow || undefined,
              lat,
              lng,
              status: 'pendente' as const,
            };
          })
          .filter((s) => s.address && s.address !== 'Endereço não especificado');

        resolve(parsedStops);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

// Download Sample Blank Spreadsheet with full Brazilian geographic fields
export function downloadSampleExcel() {
  const sampleData = [
    {
      Endereço: 'Av. Paulista, 1000',
      Bairro: 'Bela Vista',
      Cidade: 'São Paulo',
      Estado: 'SP',
      CEP: '01310-100',
      Cliente: 'Ana Silva',
      Telefone: '11999998888',
      Observações: 'Entregar na recepção comercial',
      Prioridade: 'Alta',
      Horário: '09:00 - 12:00',
    },
    {
      Endereço: 'Rua Augusta, 1500',
      Bairro: 'Consolação',
      Cidade: 'São Paulo',
      Estado: 'SP',
      CEP: '01305-100',
      Cliente: 'Carlos Eduardo',
      Telefone: '11988887777',
      Observações: 'Deixar com o porteiro Sr. João',
      Prioridade: 'Normal',
      Horário: '13:00 - 17:00',
    },
    {
      Endereço: 'Av. Brigadeiro Faria Lima, 2000',
      Bairro: 'Pinheiros',
      Cidade: 'São Paulo',
      Estado: 'SP',
      CEP: '01451-000',
      Cliente: 'Tech Solutions Ltda',
      Telefone: '11977776666',
      Observações: 'Recebimento no 5º andar',
      Prioridade: 'Normal',
      Horário: '10:00 - 16:00',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Modelo_Entregas');
  XLSX.writeFile(wb, 'modelo_rotas_entregas_completo.xlsx');
}

// Derives Brazilian State (UF) abbreviation from CEP prefix
export function getUfFromCep(cep?: string): string | null {
  if (!cep) return null;
  const clean = cep.replace(/\D/g, '');
  if (clean.length < 5) return null;
  const prefix = parseInt(clean.substring(0, 5), 10);

  if (prefix >= 1000 && prefix <= 19999) return 'SP';
  if (prefix >= 20000 && prefix <= 28999) return 'RJ';
  if (prefix >= 29000 && prefix <= 29999) return 'ES';
  if (prefix >= 30000 && prefix <= 39999) return 'MG';
  if (prefix >= 40000 && prefix <= 48999) return 'BA';
  if (prefix >= 49000 && prefix <= 49999) return 'SE';
  if (prefix >= 50000 && prefix <= 56999) return 'PE';
  if (prefix >= 57000 && prefix <= 57999) return 'AL';
  if (prefix >= 58000 && prefix <= 58999) return 'PB';
  if (prefix >= 59000 && prefix <= 59999) return 'RN';
  if (prefix >= 60000 && prefix <= 63999) return 'CE';
  if (prefix >= 64000 && prefix <= 64999) return 'PI';
  if (prefix >= 65000 && prefix <= 65999) return 'MA';
  if (prefix >= 66000 && prefix <= 68899) return 'PA';
  if (prefix >= 68900 && prefix <= 68999) return 'AP';
  if ((prefix >= 69000 && prefix <= 69299) || (prefix >= 69400 && prefix <= 69899)) return 'AM';
  if (prefix >= 69300 && prefix <= 69399) return 'RR';
  if (prefix >= 69900 && prefix <= 69999) return 'AC';
  if ((prefix >= 70000 && prefix <= 72799) || (prefix >= 73000 && prefix <= 73699)) return 'DF';
  if ((prefix >= 72800 && prefix <= 72999) || (prefix >= 73700 && prefix <= 76799)) return 'GO';
  if ((prefix >= 76800 && prefix <= 76999) || (prefix >= 78900 && prefix <= 78999)) return 'RO';
  if (prefix >= 77000 && prefix <= 77999) return 'TO';
  if (prefix >= 78000 && prefix <= 78899) return 'MT';
  if (prefix >= 79000 && prefix <= 79999) return 'MS';
  if (prefix >= 80000 && prefix <= 87999) return 'PR';
  if (prefix >= 88000 && prefix <= 89999) return 'SC';
  if (prefix >= 90000 && prefix <= 99999) return 'RS';

  return null;
}

// Derives Brazilian State (UF) from coordinates bounding ranges
export function getUfFromLatLng(lat?: number, lng?: number): string | null {
  if (lat === undefined || lng === undefined) return null;

  // Approximate Brazilian states coordinate bounds
  if (lat >= -25.3 && lat <= -19.7 && lng >= -53.2 && lng <= -44.1) return 'SP';
  if (lat >= -23.4 && lat <= -20.7 && lng >= -44.9 && lng <= -40.9) return 'RJ';
  if (lat >= -22.9 && lat <= -14.2 && lng >= -51.1 && lng <= -39.8) return 'MG';
  if (lat >= -21.3 && lat <= -17.8 && lng >= -41.9 && lng <= -39.6) return 'ES';
  if (lat >= -26.7 && lat <= -22.5 && lng >= -54.6 && lng <= -48.0) return 'PR';
  if (lat >= -29.4 && lat <= -25.9 && lng >= -53.8 && lng <= -48.3) return 'SC';
  if (lat >= -33.7 && lat <= -27.1 && lng >= -57.6 && lng <= -49.7) return 'RS';
  if (lat >= -18.3 && lat <= -8.5 && lng >= -46.6 && lng <= -37.3) return 'BA';
  if (lat >= -19.5 && lat <= -12.4 && lng >= -53.2 && lng <= -45.9) return 'GO';
  if (lat >= -16.1 && lat <= -15.4 && lng >= -48.3 && lng <= -47.3) return 'DF';
  if (lat >= -9.8 && lat <= -2.7 && lng >= -41.4 && lng <= -37.2) return 'CE';
  if (lat >= -9.5 && lat <= -7.0 && lng >= -41.3 && lng <= -34.8) return 'PE';

  return null;
}

// Export Current Optimized Route to Excel (.XLSX) with complete geographic and performance columns
export function exportCurrentRouteToExcel(stops: RouteStop[], summary?: RouteSummary) {
  if (!stops || stops.length === 0) return;

  const exportData = stops.map((stop, index) => {
    let statusText = 'Pendente';
    if (stop.status === 'concluido') statusText = 'Concluído';
    if (stop.status === 'falha') statusText = 'Falha';
    if (stop.status === 'em_transito') statusText = 'Em Trânsito';

    return {
      Ordem: index + 1,
      'Endereço Completo': stop.address,
      Bairro: stop.neighborhood || '-',
      Cidade: stop.city || '-',
      Estado: stop.state || '-',
      CEP: stop.cep || '-',
      Cliente: stop.customerName || '',
      Telefone: stop.phone || '',
      Observações: stop.notes || '',
      Prioridade: (stop.priority || 'normal').toUpperCase(),
      Status: statusText,
      'Distância Trecho (km)': stop.distanceFromPrevKm ?? 0,
      'Distância Acumulada (km)': stop.accumulatedDistanceKm ?? 0,
      'Tempo Estimado Trecho (min)': stop.durationFromPrevMin ?? 0,
      'Tempo Estimado Acumulado (min)': stop.accumulatedDurationMin ?? 0,
      'Horário Estimado de Chegada (ETA)': stop.estimatedEta || '-',
      'Tempo de Permanência Real (min)': stop.actualDwellTimeMin ?? (stop.plannedDwellTimeMin || 4),
      'Horário Chegada': stop.arrivedAt ? new Date(stop.arrivedAt).toLocaleTimeString('pt-BR') : '-',
      'Horário Conclusão': stop.completedAt ? new Date(stop.completedAt).toLocaleTimeString('pt-BR') : '-',
      Latitude: stop.lat ?? '',
      Longitude: stop.lng ?? '',
    };
  });

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Rota_Otimizada');

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Rota_Otimizada_RotaExpress_${dateStr}.xlsx`);
}

// Calls Gemini AI to analyze speed and traffic for smart next stop suggestions
export async function suggestNextStopWithGemini(
  stops: RouteStop[],
  currentLocation?: { lat: number; lng: number },
  currentSpeed?: number
): Promise<{
  shouldReorder: boolean;
  suggestedNextStopId?: string;
  reason?: string;
  timeSavingsMin?: number;
  reorderedStopsIndices?: number[];
}> {
  const pending = stops.filter((s) => s.status === 'pendente' || s.status === 'em_transito');
  if (pending.length < 2) {
    return { shouldReorder: false, reason: 'Paradas pendentes insuficientes para reordenação' };
  }

  try {
    const res = await fetch('/api/gemini/suggest-next-stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentLocation,
        currentSpeed,
        stops: pending.map((s) => ({
          id: s.id,
          address: s.address,
          customerName: s.customerName,
          lat: s.lat,
          lng: s.lng,
          priority: s.priority,
        })),
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        return {
          shouldReorder: Boolean(data.shouldReorder),
          suggestedNextStopId: data.suggestedNextStopId,
          reason: data.reason,
          timeSavingsMin: data.timeSavingsMin,
          reorderedStopsIndices: data.reorderedStopsIndices,
        };
      }
    }
  } catch (err) {
    console.warn('suggestNextStopWithGemini network error:', err);
  }

  // Fallback local geometric calculation if Gemini offline/unavailable:
  if (currentLocation && pending.length >= 2) {
    const firstDist = pending[0].lat && pending[0].lng
      ? calculateHaversineDistanceKm(currentLocation.lat, currentLocation.lng, pending[0].lat, pending[0].lng)
      : Infinity;

    for (let i = 1; i < pending.length; i++) {
      const other = pending[i];
      if (other.lat && other.lng) {
        const otherDist = calculateHaversineDistanceKm(currentLocation.lat, currentLocation.lng, other.lat, other.lng);
        // If an alternative stop is substantially closer (< 1.5km vs > 4km for current stop), suggest it!
        if (otherDist < 1.5 && firstDist - otherDist > 2.5) {
          const savings = Math.round((firstDist - otherDist) * 2.5);
          return {
            shouldReorder: true,
            suggestedNextStopId: other.id,
            reason: `A parada em "${other.address}" está a apenas ${otherDist} km da sua posição GPS atual, enquanto a próxima parada agendada está a ${firstDist} km.`,
            timeSavingsMin: Math.max(3, savings),
          };
        }
      }
    }
  }

  return { shouldReorder: false };
}

