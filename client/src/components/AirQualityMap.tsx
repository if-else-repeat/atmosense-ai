import L from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import type { AirQualityStation } from '../types/airQuality';
import { MapControls } from './Map/MapControls';
import { findNearestStation, renderStationLayers } from './Map/mapMarkers';

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

  useEffect(() => {
    const markersLayer = markersLayerRef.current;
    const circlesLayer = circlesLayerRef.current;
    if (!markersLayer || !circlesLayer) return;

    renderStationLayers({
      stations,
      selectedStationId: selectedStation.id,
      showRadius,
      markersLayer,
      circlesLayer,
      onSelect: (id) => onSelectRef.current(id),
    });
  }, [stations, selectedStation.id, showRadius]);

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
        const nearest = findNearestStation(stations, pos.coords.latitude, pos.coords.longitude);
        if (nearest) {
          onSelectStation(nearest.id);
          setGeoMessage(`Centered on nearest station: ${nearest.city}.`);
        }
      },
      () => setGeoMessage('Location access denied — select any city marker manually.'),
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

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <MapControls
        stations={stations}
        selectedStation={selectedStation}
        showRadius={showRadius}
        locating={locating}
        geoMessage={geoMessage}
        onToggleRadius={() => setShowRadius((prev) => !prev)}
        onLocateCurrent={handleLocateCurrent}
        onSelectStation={onSelectStation}
        onOpenAssistant={onOpenAssistant}
      />

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
