/**
 * worldBorders.ts
 *
 * Country borders from world-atlas (110m, ~110KB)
 * US state borders from us-atlas (10m, Census Bureau data)
 *
 * Install:
 *   npm install world-atlas us-atlas topojson-client
 *   npm install --save-dev @types/topojson-client
 */

import * as topojson from 'topojson-client';

const worldData = require('world-atlas/countries-110m.json');
const usData = require('us-atlas/states-10m.json');

export type Polyline = [number, number][]; // [lng, lat] pairs

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractPolylines(geometry: any): Polyline[] {
  const lines: Polyline[] = [];
  if (!geometry) return lines;

  const walk = (g: any) => {
    switch (g.type) {
      case 'LineString':
        lines.push(g.coordinates as Polyline);
        break;
      case 'MultiLineString':
        for (const c of g.coordinates) lines.push(c as Polyline);
        break;
      case 'GeometryCollection':
        for (const child of g.geometries) walk(child);
        break;
    }
  };

  walk(geometry.geometry ?? geometry);
  return lines;
}

// ─── Country borders ──────────────────────────────────────────────────────────

let _countryBorders: Polyline[] | null = null;

/**
 * All country borders (coastlines + shared borders).
 * Cached after first call.
 */
export function getAllBorderPolylines(): Polyline[] {
  if (_countryBorders) return _countryBorders;

  const mesh = topojson.mesh(worldData, worldData.objects.countries, () => true);
  _countryBorders = extractPolylines(mesh);
  return _countryBorders;
}

/**
 * Only country-to-country borders (no coastlines).
 * Cleanest look — the globe sphere implies coastlines already.
 */
export function getCountryBorderPolylines(): Polyline[] {
  const mesh = topojson.mesh(
    worldData,
    worldData.objects.countries,
    (a: any, b: any) => a !== b
  );
  return extractPolylines(mesh);
}

// ─── US state borders ─────────────────────────────────────────────────────────

let _stateBorders: Polyline[] | null = null;

/**
 * US state interior borders only (no outer coastline/national border).
 * Use alongside getAllBorderPolylines() for a complete globe.
 * Cached after first call.
 */
export function getUSStateBorderPolylines(): Polyline[] {
  if (_stateBorders) return _stateBorders;

  // us-atlas stores coordinates in a projected pixel space (975×610).
  // We need to unproject back to lng/lat using the inverse Albers USA transform.
  // Easier approach: use the unprojected states-10m topology directly.
  // The us-atlas states-10m file IS in geographic coordinates (lng/lat), not projected.
  const mesh = topojson.mesh(
    usData,
    usData.objects.states,
    (a: any, b: any) => a !== b // interior borders only — no outer US coastline
  );

  _stateBorders = extractPolylines(mesh);
  return _stateBorders;
}

/**
 * Convenience: returns both country borders and US state borders together,
 * ready to be rendered as a single LineSegments object on the globe.
 */
export function getAllPolylines(): Polyline[] {
  return [...getAllBorderPolylines(), ...getUSStateBorderPolylines()];
}
