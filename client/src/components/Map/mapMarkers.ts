import L from 'leaflet';
import type { AirQualityStation } from '../../types/airQuality';
import { getAqiTone } from '../../utils/airQuality';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Renders interactive Leaflet station badges and optional 4.2 km dispersion
 * radius circles onto the provided map layer groups with HTML-escaped labels.
 */
export function renderStationLayers(params: {
  stations: readonly AirQualityStation[];
  selectedStationId: string;
  showRadius: boolean;
  markersLayer: L.LayerGroup;
  circlesLayer: L.LayerGroup;
  onSelect: (stationId: string) => void;
}): void {
  const { stations, selectedStationId, showRadius, markersLayer, circlesLayer, onSelect } = params;

  markersLayer.clearLayers();
  circlesLayer.clearLayers();

  for (const station of stations) {
    const tone = getAqiTone(station.category.key);
    const isSelected = station.id === selectedStationId;
    const isCurrentLoc = station.id === 'current-location';
    const rawLabel = isCurrentLoc ? `My Location · ${station.city}` : station.city;
    const safeLabel = escapeHtml(rawLabel);
    const safeAqi = Math.max(0, Math.min(500, Math.round(station.aqi)));

    const html = `
      <button
        type="button"
        aria-label="Inspect ${safeLabel} station, AQI ${safeAqi}"
        style="
          display:flex;align-items:center;gap:6px;padding:4px 9px;border-radius:8px;
          background:${isSelected ? '#0f172a' : isCurrentLoc ? '#ecfeff' : '#ffffff'};
          color:${isSelected ? '#ffffff' : '#0f172a'};
          border:2px solid ${isCurrentLoc ? '#0e7490' : tone.accentHex};
          box-shadow:0 2px 8px rgba(15,23,42,0.18);
          font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:600;
          white-space:nowrap;cursor:pointer;
        "
      >
        <span style="color:${tone.accentHex}">${safeAqi}</span>
        <span style="font-family:'DM Sans',sans-serif;font-weight:500">${safeLabel}</span>
      </button>
    `;

    const icon = L.divIcon({
      className: 'atmosense-marker-icon',
      html,
      iconSize: [isCurrentLoc ? 170 : 110, 30],
      iconAnchor: [isCurrentLoc ? 85 : 55, 15],
    });

    const marker = L.marker([station.latitude, station.longitude], { icon });
    marker.on('click', () => onSelect(station.id));
    marker.addTo(markersLayer);

    if (showRadius) {
      L.circle([station.latitude, station.longitude], {
        radius: 4200,
        color: isCurrentLoc ? '#0e7490' : tone.accentHex,
        fillColor: tone.accentHex,
        fillOpacity: isSelected ? 0.16 : 0.08,
        weight: isSelected ? 1.5 : 1,
      }).addTo(circlesLayer);
    }
  }
}

/**
 * Finds the geographically nearest station using planar Euclidean distance
 * for local fallback geolocation.
 */
export function findNearestStation(
  stations: readonly AirQualityStation[],
  latitude: number,
  longitude: number,
): AirQualityStation | undefined {
  let nearest = stations[0];
  let bestDist = Number.POSITIVE_INFINITY;
  for (const st of stations) {
    const dist = Math.hypot(st.latitude - latitude, st.longitude - longitude);
    if (dist < bestDist) {
      bestDist = dist;
      nearest = st;
    }
  }
  return nearest;
}
