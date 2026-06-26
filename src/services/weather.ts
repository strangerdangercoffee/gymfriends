export interface WeatherData {
  temp: number;
  description: string;
  windSpeed: number;
  humidity: number;
  isDry: boolean;
}

export function wmoToDesc(code: number): string {
  if (code === 0) return 'Clear sky';
  if (code <= 3) return 'Partly cloudy';
  if (code <= 9) return 'Foggy';
  if (code <= 29) return 'Drizzle';
  if (code <= 39) return 'Rain';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Rain showers';
  if (code <= 86) return 'Snow showers';
  if (code <= 99) return 'Thunderstorm';
  return 'Unknown';
}

export async function fetchWeather(
  latitude: number,
  longitude: number
): Promise<WeatherData | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${latitude}&longitude=${longitude}` +
      `&current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m` +
      `&temperature_unit=fahrenheit&wind_speed_unit=mph`;
    const res = await fetch(url);
    const data = await res.json();
    const c = data?.current;
    if (!c) return null;
    const humidity = Math.round(c.relative_humidity_2m ?? 0);
    const windSpeed = Math.round(c.wind_speed_10m ?? 0);
    return {
      temp: Math.round(c.temperature_2m ?? 0),
      description: wmoToDesc(c.weather_code ?? 0),
      windSpeed,
      humidity,
      isDry: humidity < 60 && (c.weather_code ?? 0) < 51,
    };
  } catch {
    return null;
  }
}
