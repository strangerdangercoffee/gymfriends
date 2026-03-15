/**
 * Major world roads for globe overlay when zoomed in.
 * Polyline format: [lng, lat][] (same as worldBorders).
 * Uses a simplified set; for full coverage, replace with Natural Earth 110m roads
 * (e.g. ne_110m_roads GeoJSON filtered to scalerank <= 4).
 */

import type { Polyline } from './worldBorders';

let _roadPolylines: Polyline[] | null = null;

/**
 * Major road polylines (cached). Sample set of major highways;
 * replace or extend with Natural Earth 110m roads for full coverage.
 */
export function getRoadPolylines(): Polyline[] {
  if (_roadPolylines) return _roadPolylines;

  // Simplified major highways (sample segments) - [lng, lat][]
  // Full dataset: use Natural Earth 110m or 50m roads, filter by scalerank
  const roads: Polyline[] = [
    // US I-5 (West Coast) - segment
    [[-122.42, 37.77], [-118.24, 34.05], [-117.16, 32.72], [-122.33, 47.61]],
    // US I-95 (East Coast) - segment
    [[-71.06, 42.36], [-75.17, 39.95], [-77.04, 38.91], [-80.19, 25.76]],
    // US I-80 (transcontinental) - segment
    [[-122.42, 37.77], [-104.99, 39.74], [-87.63, 41.88], [-74.01, 40.71]],
    // Europe - Paris to Berlin (simplified)
    [[2.35, 48.86], [4.35, 50.85], [8.54, 47.38], [13.41, 52.52]],
    // Europe - Madrid to Rome
    [[-3.70, 40.42], [2.17, 41.39], [9.19, 45.46], [12.50, 41.90]],
    // UK - London to Edinburgh
    [[-0.13, 51.51], [-2.24, 53.48], [-1.55, 53.80], [-3.19, 55.95]],
    // China - Beijing to Shanghai
    [[116.41, 39.90], [114.31, 30.59], [121.47, 31.23]],
    // Japan - Tokyo to Osaka
    [[139.69, 35.69], [136.91, 35.18], [135.50, 34.69]],
    // India - Delhi to Mumbai
    [[77.10, 28.70], [72.88, 19.08]],
    // India - Delhi to Kolkata
    [[77.10, 28.70], [88.36, 22.57]],
    // Australia - Sydney to Melbourne
    [[151.21, -33.87], [144.96, -37.81]],
    // Brazil - São Paulo to Rio
    [[-46.63, -23.55], [-43.20, -22.91]],
    // Mexico - Mexico City to Guadalajara
    [[-99.13, 19.43], [-103.35, 20.67]],
    // Canada - Toronto to Montreal
    [[-79.38, 43.65], [-73.57, 45.50]],
    // Russia - Moscow to St Petersburg
    [[37.62, 55.76], [30.31, 59.93]],
    // Egypt - Cairo to Alexandria (approx)
    [[31.24, 30.04], [29.92, 31.20]],
    // South Africa - Johannesburg to Cape Town (approx)
    [[28.04, -26.20], [18.42, -33.92]],
    // Nigeria - Lagos to Abuja (approx)
    [[3.39, 6.45], [7.49, 9.08]],
    // Argentina - Buenos Aires to Córdoba
    [[-58.38, -34.60], [-64.19, -31.42]],
    // Chile - Santiago to Valparaíso
    [[-70.67, -33.45], [-71.62, -33.05]],
  ];

  _roadPolylines = roads;
  return _roadPolylines;
}
