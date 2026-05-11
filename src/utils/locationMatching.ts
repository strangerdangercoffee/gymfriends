import { City, State } from 'country-state-city';
import { ClimbingArea, Gym } from '../types';

export interface LocationOption {
  label: string;
  key: string;
}

const normalizeToken = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

const parseCityAndRegion = (raw: string): { city: string; region?: string } | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (!trimmed.includes(',')) {
    return { city: trimmed };
  }

  const parts = trimmed.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  const city = parts[0];
  const regionToken = parts[1]?.split(/\s+/)[0]?.trim();

  return { city, region: regionToken || undefined };
};

export const makeCanonicalCityKey = (raw: string): string => {
  const parsed = parseCityAndRegion(raw);
  if (!parsed) return '';

  const city = normalizeToken(parsed.city);
  const region = parsed.region ? normalizeToken(parsed.region) : '';
  return region ? `${city}|${region}` : city;
};

export const makeCanonicalLocationKey = (
  value: string,
  type: 'gym' | 'city' | 'crag'
): string => {
  if (type === 'city') {
    return makeCanonicalCityKey(value);
  }
  return normalizeToken(value);
};

let cachedCityOptions: LocationOption[] | null = null;

export const getCanonicalCityOptions = (): LocationOption[] => {
  if (cachedCityOptions) {
    return cachedCityOptions;
  }

  const map = new Map<string, string>();
  const stateNameByKey = new Map<string, string>();

  State.getAllStates().forEach((state) => {
    stateNameByKey.set(`${state.countryCode}:${state.isoCode}`, state.name);
  });

  City.getAllCities().forEach((city) => {
    const cityName = city.name?.trim();
    if (!cityName) return;

    const subdivisionName = city.stateCode
      ? stateNameByKey.get(`${city.countryCode}:${city.stateCode}`)
      : '';
    const subdivisionOrCountry = subdivisionName || city.countryCode || '';
    const label = subdivisionOrCountry ? `${cityName}, ${subdivisionOrCountry}` : cityName;
    const key = makeCanonicalCityKey(label);

    if (key && !map.has(key)) {
      map.set(key, label);
    }
  });

  cachedCityOptions = Array.from(map.entries())
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return cachedCityOptions;
};

export const buildGymOptions = (gyms: Gym[]): LocationOption[] =>
  gyms
    .map((gym) => ({ key: gym.id, label: gym.name }))
    .sort((a, b) => a.label.localeCompare(b.label));

export const buildCragOptions = (areas: ClimbingArea[]): LocationOption[] =>
  areas
    .map((area) => ({ key: normalizeToken(area.name), label: area.name }))
    .sort((a, b) => a.label.localeCompare(b.label));
