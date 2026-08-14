import { WeatherInfo } from '../types';

// In-memory weather cache to prevent unnecessary repeat requests
const weatherCache = new Map<string, { weather: WeatherInfo; timestamp: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes cache

/**
 * Maps WMO Weather Interpretation Codes (Open-Meteo) to human-readable weather info
 */
export function mapWmoCodeToWeather(code: number, temp: number): WeatherInfo {
  let icon = '☀️';
  let conditionText = 'Limpo';
  let isAdverse = false;
  let alertText: string | undefined;

  switch (code) {
    case 0:
      icon = '☀️';
      conditionText = 'Céu Limpo';
      break;
    case 1:
    case 2:
    case 3:
      icon = '⛅';
      conditionText = 'Parcialmente Nublado';
      break;
    case 45:
    case 48:
      icon = '🌫️';
      conditionText = 'Nevoeiro / Neblina';
      isAdverse = true;
      alertText = 'Baixa visibilidade na pista. Reduza a velocidade nas entregas.';
      break;
    case 51:
    case 53:
    case 55:
      icon = '🌧️';
      conditionText = 'Garoa Leve';
      isAdverse = false;
      break;
    case 61:
    case 63:
    case 65:
    case 80:
    case 81:
    case 82:
      icon = '🌧️';
      conditionText = 'Chuva Moderada';
      isAdverse = true;
      alertText = 'Pista molhada e risco de trânsito lento (+5 a 10 min de tolerância).';
      break;
    case 95:
    case 96:
    case 99:
      icon = '🌩️';
      conditionText = 'Tempestade';
      isAdverse = true;
      alertText = 'Alerta de Tempestade: atente para alagamentos e estacionamento seguro.';
      break;
    case 71:
    case 73:
    case 75:
    case 77:
    case 85:
    case 86:
      icon = '❄️';
      conditionText = 'Geada / Frio Intenso';
      isAdverse = true;
      alertText = 'Pista com baixa aderência.';
      break;
    default:
      icon = '🌤️';
      conditionText = 'Tempo Ameno';
      break;
  }

  return {
    temperature: Math.round(temp),
    weatherCode: code,
    conditionText,
    icon,
    isAdverse,
    alertText,
  };
}

/**
 * Fetches current weather forecast from Open-Meteo for a given lat/lng
 */
export async function fetchStopWeather(lat: number, lng: number): Promise<WeatherInfo | null> {
  const cacheKey = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const cached = weatherCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.weather;
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.current_weather) return null;

    const { temperature, weathercode } = data.current_weather;
    const weatherInfo = mapWmoCodeToWeather(weathercode, temperature);

    weatherCache.set(cacheKey, { weather: weatherInfo, timestamp: Date.now() });
    return weatherInfo;
  } catch (err) {
    console.warn('Error fetching weather from Open-Meteo:', err);
    return null;
  }
}
