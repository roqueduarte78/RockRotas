export type StopStatus = 'pendente' | 'em_transito' | 'concluido' | 'falha' | 'cancelado';
export type StopPriority = 'alta' | 'normal' | 'baixa';
export type GpsApp = 'google' | 'waze';
export type MapThemeMode = 'auto' | 'light' | 'dark';

export interface MapScheduleConfig {
  mode: MapThemeMode;
  nightStartHour: number; // e.g. 18 (18:00)
  nightEndHour: number;   // e.g. 6 (06:00)
}

export interface WeatherInfo {
  temperature: number;
  weatherCode: number;
  conditionText: string;
  icon: string;
  isAdverse: boolean;
  alertText?: string;
}

export interface AppSettings {
  defaultGpsApp: GpsApp;
  enableVoiceAnnouncements: boolean;
  autoWeatherAlerts: boolean;
}

export interface RouteStop {
  id: string;
  address: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  cep?: string;
  customerName?: string;
  phone?: string;
  notes?: string;
  lat?: number;
  lng?: number;
  priority?: StopPriority;
  timeWindow?: string;
  status: StopStatus;
  arrivedAt?: string; // ISO timestamp when driver arrived / started stop
  completedAt?: string; // ISO timestamp when status became completed or failed
  plannedDwellTimeMin?: number; // Estimated service/unloading time (default 5 min)
  actualDwellTimeMin?: number; // Real measured dwelling time at stop
  distanceFromPrevKm?: number; // Distance for segment from previous stop
  durationFromPrevMin?: number; // Driving + service duration for segment
  accumulatedDistanceKm?: number; // Cumulative total distance from start up to this stop
  accumulatedDurationMin?: number; // Cumulative total duration from start up to this stop
  estimatedEta?: string; // Predicted time of arrival formatted (e.g. "09:45")

  // Mockup 'Personalize' UI fields
  colorTag?: string; // 'Laranja' | 'Azul' | 'Verde' | 'Vermelho' | 'Roxo'
  gateCode?: string; // e.g. "1684" or "Código do portão"
  packageLocation?: string; // e.g. "Grande, Sacola, FDC"
  packagesCount?: number; // default 1
  stopOrderType?: 'primeira' | 'automatica' | 'ultima'; // default 'automatica'
  serviceType?: 'entrega' | 'coleta'; // default 'entrega'
  arrivalTimeWindow?: string; // e.g. "Qualquer momento"

  // Live weather forecast info
  weather?: WeatherInfo;
}

export interface RouteSummary {
  totalDistanceKm: number;
  totalDurationMin: number;
  completedCount: number;
  totalCount: number;
  startTimeFormatted?: string;
}

export interface StopExecutionLog {
  stopId: string;
  address: string;
  customerName?: string;
  arrivedAt: string;
  completedAt: string;
  plannedMinutes: number;
  actualMinutes: number;
  diffMinutes: number; // positive = delay, negative = saved
  status: StopStatus;
}

export interface RoutePerformance {
  efficiencyScorePct: number; // 0 to 100%
  totalPlannedDwellMin: number;
  totalActualDwellMin: number;
  avgDwellTimeMin: number;
  savedOrLostMinutes: number; // difference between actual vs planned
  punctualityStatus: 'Excelente' | 'No Prazo' | 'Com Atrasos';
  executionLogs: StopExecutionLog[];
}

export type MapEngine = 'leaflet' | 'google';

export interface GeminiOptimizationResult {
  optimizedOrder?: number[];
  summary?: string;
  driverTips?: string[];
  customerMessages?: Array<{
    stopIndex: number;
    address: string;
    whatsappText: string;
  }>;
}

export interface ValidatedAddressResult {
  originalAddress: string;
  isValid: boolean;
  addressFormatted: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  cep?: string;
  suggestedLat?: number;
  suggestedLng?: number;
  correctionNotes?: string;
}

export interface DriverLocation {
  lat: number;
  lng: number;
  speed?: number | null;
  heading?: number | null;
  updatedAt: string;
}
