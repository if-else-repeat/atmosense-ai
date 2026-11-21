import L from 'leaflet';
import { Compass, Layers, Navigation } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { AirQualityStation } from '../types/airQuality';
import { getAqiTone } from '../utils/airQuality';

interface AirQualityMapProps {
  stations: readonly AirQualityStation[];
  selectedStation: AirQualityStation;
  onSelectStation: (stationId: string) => void;
  onOpenAssistant: () => void;
  onDetectLocation?: () => void;
  locating?: boolean;
}

export function AirQualityMap({
  stations,
  selectedStation,
  onSelectStation,
  onOpenAssistant,
  onDetectLocation,
  locating = false,
}: AirQualityMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const circlesLayerRef = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelectStation);
  onSelectRef.current = onSelectStation;

  const [showRadius, setShowRadius] = useState(true);
  const [geoMessage, setGeoMessage] = useState<string | null>(null);

  useEffect(() => {
    const el = mapContainerRef.current;
    if (!el || mapInstanceRef.current) return;

    const map = L.map(el, {
      center: [selectedStation.latitude, selectedStation.longitude],
      zoom: 11,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    circlesLayerRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
      circlesLayerRef.current = null;
    };
  }, []);

  // Re-render markers and exposure circles when stations, selection, or layer toggle changes
  useEffect(() => {
    const markersLayer = markersLayerRef.current;
    const circlesLayer = circlesLayerRef.current;
    if (!markersLayer || !circlesLayer) return;

    markersLayer.clearLayers();
    circlesLayer.clearLayers();

    for (const station of stations) {
      const tone = getAqiTone(station.category.key);
      const isSelected = station.id === selectedStation.id;
      const isCurrentLoc = station.id === 'current-location';
      const label = isCurrentLoc ? `My Location · ${station.city}` : station.city;

      const html = `
        <button
          type="button"
          aria-label="Inspect ${label} station, AQI ${station.aqi}"
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
          <span style="color:${tone.accentHex}">${station.aqi}</span>
          <span style="font-family:'DM Sans',sans-serif;font-weight:500">${label}</span>
        </button>
      `;

      const icon = L.divIcon({
        className: 'atmosense-marker-icon',
        html,
        iconSize: [isCurrentLoc ? 170 : 110, 30],
        iconAnchor: [isCurrentLoc ? 85 : 55, 15],
      });

      const marker = L.marker([station.latitude, station.longitude], { icon });
      marker.on('click', () => onSelectRef.current(station.id));
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
  }, [stations, selectedStation.id, showRadius]);

  // Fly smoothly to selected station
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.setView([selectedStation.latitude, selectedStation.longitude], 11, {
      animate: true,
      duration: 0.45,
    });
  }, [selectedStation.id, selectedStation.latitude, selectedStation.longitude]);

  const handleLocateCurrent = () => {
    if (onDetectLocation) {
      setGeoMessage('Detecting your exact location and fetching live air quality...');
      onDetectLocation();
      return;
    }
    if (!navigator.geolocation) {
      setGeoMessage('Geolocation is unavailable in this browser.');
      return;
    }
    setGeoMessage('Locating nearest urban sensor...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        let nearest = stations[0];
        let bestDist = Number.POSITIVE_INFINITY;
        for (const st of stations) {
          const dist = Math.hypot(st.latitude - latitude, st.longitude - longitude);
          if (dist < bestDist) {
            bestDist = dist;
            nearest = st;
          }
        }
        if (nearest) {
          onSelectStation(nearest.id);
          setGeoMessage(`Centered on nearest station: ${nearest.city}.`);
        }
      },
      () => {
        setGeoMessage('Location access denied — select any city marker manually.');
      },
      { timeout: 6000 },
    );
  };

  useEffect(() => {
    if (!locating && selectedStation.id === 'current-location') {
      setGeoMessage(
        `Centered on your live location: ${selectedStation.city}, ${selectedStation.country}.`,
      );
    }
  }, [locating, selectedStation.id, selectedStation.city, selectedStation.country]);

  const tone = getAqiTone(selectedStation.category.key);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Station Directory & Layer Controls */}
      <aside className="flex flex-col gap-4 lg:col-span-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              OpenStreetMap Station Network
            </h1>
            <button
              type="button"
              onClick={() => setShowRadius((prev) => !prev)}
              aria-pressed={showRadius}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              <Layers className="h-3.5 w-3.5" aria-hidden="true" />
              {showRadius ? 'Hide Radius' : 'Show Radius'}
            </button>
          </div>

          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            Zero-API-key Leaflet map tiles with live AQI dispersion overlays.
          </p>

          <button
            type="button"
            disabled={locating}
            onClick={handleLocateCurrent}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-700/40 bg-cyan-50 px-3 py-2 text-xs font-medium text-cyan-900 transition-colors hover:bg-cyan-100 disabled:opacity-60 dark:border-cyan-500/40 dark:bg-cyan-950/50 dark:text-cyan-200 dark:hover:bg-cyan-900/60"
          >
            <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
            {locating ? 'Detecting Current Location...' : 'Use My Current Location'}
          </button>

          {geoMessage && (
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">{geoMessage}</p>
          )}
        </div>

        {/* Active Station Inspector */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {selectedStation.id === 'current-location'
                  ? `${selectedStation.city} (My Location)`
                  : selectedStation.city}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {selectedStation.district} <span aria-hidden="true">·</span>{' '}
                {selectedStation.country}
              </p>
            </div>
            <div className="text-right">
              <span className="font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
                {selectedStation.aqi}
              </span>
              <p className={`text-xs font-medium ${tone.textClass}`}>
                {tone.glyph} {selectedStation.category.shortLabel}
              </p>
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-xs dark:border-slate-800">
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Coordinates</dt>
              <dd className="mt-0.5 font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {selectedStation.latitude.toFixed(3)}, {selectedStation.longitude.toFixed(3)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Dominant</dt>
              <dd className="mt-0.5 font-mono text-slate-900 dark:text-slate-100">
                {selectedStation.dominantPollutant}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">PM2.5 / PM10</dt>
              <dd className="mt-0.5 font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {selectedStation.metrics.pm25} / {selectedStation.metrics.pm10} µg/m³
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Wind &amp; Temp</dt>
              <dd className="mt-0.5 font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {selectedStation.windKph} km/h · {selectedStation.temperatureC}°C
              </dd>
            </div>
          </dl>

          <button
            type="button"
            onClick={onOpenAssistant}
            className="mt-4 w-full rounded-lg bg-cyan-700 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-cyan-800"
          >
            Generate Health Brief for {selectedStation.city}
          </button>
        </div>

        {/* Station Quick Switch List */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="mb-2.5 flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
            <Compass className="h-3.5 w-3.5" aria-hidden="true" />
            Jump to Station
          </p>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {stations.map((st) => {
              const stTone = getAqiTone(st.category.key);
              const active = st.id === selectedStation.id;
              return (
                <li key={st.id}>
                  <button
                    type="button"
                    onClick={() => onSelectStation(st.id)}
                    className={`flex w-full items-center justify-between py-2 text-left text-xs transition-colors ${
                      active
                        ? 'font-semibold text-cyan-800 dark:text-cyan-300'
                        : 'text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white'
                    }`}
                  >
                    <span className="truncate pr-2">
                      {st.id === 'current-location' ? `My Location · ${st.city}` : st.city} ·{' '}
                      <span className="text-slate-500 dark:text-slate-400">{st.district}</span>
                    </span>
                    <span className={`font-mono tabular-nums shrink-0 ${stTone.textClass}`}>
                      {st.aqi}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>

      {/* Main Leaflet Map Viewport */}
      <section
        aria-label="Interactive urban air quality map"
        className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:col-span-8"
      >
        <div
          ref={mapContainerRef}
          data-testid="leaflet-map-container"
          className="h-[460px] w-full flex-1 lg:min-h-[720px]"
        />
      </section>
    </div>
  );
}
