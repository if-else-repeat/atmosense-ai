import { Bookmark, MapPin, Search, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useWorkspace } from '../context/AuthContext';
import type { AirQualityStation } from '../types/airQuality';
import {
  filterAndSortStations,
  getAqiTone,
  type StationFilterBand,
  type StationSortKey,
} from '../utils/airQuality';
import { PollutantRadarSvg } from './PollutantRadarSvg';
import { TrendChartSvg } from './TrendChartSvg';

interface MonitorDashboardProps {
  stations: readonly AirQualityStation[];
  selectedStation: AirQualityStation;
  onSelectStation: (stationId: string) => void;
  onNavigateMap: () => void;
  onNavigateAssistant: () => void;
}

export function MonitorDashboard({
  stations,
  selectedStation,
  onSelectStation,
  onNavigateMap,
  onNavigateAssistant,
}: MonitorDashboardProps) {
  const { savedLocations, saveStation, removeSavedStation } = useWorkspace();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBand, setFilterBand] = useState<StationFilterBand>('all');
  const [sortKey, setSortKey] = useState<StationSortKey>('aqi-desc');
  const [bookmarkBusy, setBookmarkBusy] = useState(false);

  const tone = getAqiTone(selectedStation.category.key);
  const isSaved = savedLocations.some((loc) => loc.stationId === selectedStation.id);
  const visibleStations = filterAndSortStations(stations, searchQuery, filterBand, sortKey);

  const handleToggleBookmark = async () => {
    setBookmarkBusy(true);
    try {
      if (isSaved) {
        await removeSavedStation(selectedStation.id);
      } else {
        await saveStation(selectedStation, 'Monitored Zone');
      }
    } finally {
      setBookmarkBusy(false);
    }
  };

  const kpiMetrics = [
    {
      label: 'Fine Particulate PM2.5',
      value: selectedStation.metrics.pm25.toFixed(1),
      unit: 'µg/m³',
      note: `${selectedStation.whoPm25Ratio}× WHO 24h limit`,
    },
    {
      label: 'Coarse Particulate PM10',
      value: selectedStation.metrics.pm10.toFixed(1),
      unit: 'µg/m³',
      note: selectedStation.metrics.pm10 <= 45 ? 'Within WHO 24h ceiling' : 'Above WHO 45 µg/m³',
    },
    {
      label: 'Nitrogen Dioxide NO₂',
      value: selectedStation.metrics.no2.toFixed(1),
      unit: 'µg/m³',
      note: selectedStation.metrics.no2 <= 25 ? 'Low traffic corridor load' : 'Elevated urban NO₂',
    },
    {
      label: 'Ground-Level Ozone O₃',
      value: selectedStation.metrics.o3.toFixed(1),
      unit: 'µg/m³',
      note: selectedStation.metrics.o3 <= 100 ? 'Below WHO 8h ceiling' : 'Photochemical peak',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Dominant Hero Telemetry Section */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 lg:p-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="space-y-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {selectedStation.country} <span aria-hidden="true">/</span> {selectedStation.district}{' '}
              <span aria-hidden="true">·</span>{' '}
              <span className="font-mono tabular-nums">
                {selectedStation.latitude.toFixed(3)}°N, {selectedStation.longitude.toFixed(3)}°E
              </span>
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl">
              {selectedStation.city} Air Quality
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {selectedStation.category.guidance} Cleanest 3-hour window today:{' '}
              <span className="font-mono font-medium text-slate-900 dark:text-slate-100">
                {selectedStation.bestOutdoorWindow} UTC
              </span>
              .
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 lg:justify-end">
            <div>
              <div className="flex items-baseline gap-2.5">
                <span
                  data-testid="hero-aqi-value"
                  className="font-mono text-5xl font-bold tracking-tight tabular-nums text-slate-900 dark:text-slate-100"
                >
                  {selectedStation.aqi}
                </span>
                <span className="font-mono text-xs text-slate-400">US EPA AQI</span>
              </div>
              <p className={`mt-1 text-sm font-semibold ${tone.textClass}`}>
                {tone.glyph} {selectedStation.category.label}
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Dominant: {selectedStation.dominantPollutant} · Wind {selectedStation.windKph} km/h
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={onNavigateAssistant}
                className="inline-flex items-center gap-2 rounded-lg bg-cyan-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-cyan-800 whitespace-nowrap shrink-0"
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Ask Health AI
              </button>
              <button
                type="button"
                disabled={bookmarkBusy}
                onClick={() => void handleToggleBookmark()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
              >
                <Bookmark
                  className={`h-4 w-4 ${isSaved ? 'fill-cyan-700 text-cyan-700 dark:fill-cyan-400 dark:text-cyan-400' : ''}`}
                  aria-hidden="true"
                />
                {isSaved ? 'Saved Zone' : 'Save Zone'}
              </button>
              <button
                type="button"
                onClick={onNavigateMap}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
              >
                <MapPin className="h-4 w-4" aria-hidden="true" />
                Inspect Map
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Full-Width 4-Column Pollutant KPI Strip */}
      <section aria-label="Primary urban pollutant concentrations">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpiMetrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
            >
              <p className="text-xs text-slate-500 dark:text-slate-400">{metric.label}</p>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {metric.value}
                </span>
                <span className="font-mono text-xs text-slate-400">{metric.unit}</span>
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{metric.note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Analytical Split: 24-Hour SVG Curve + 6-Axis SVG Radar */}
      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <TrendChartSvg hourly={selectedStation.hourly} city={selectedStation.city} />
        </div>
        <div className="lg:col-span-4">
          <PollutantRadarSvg metrics={selectedStation.metrics} city={selectedStation.city} />
        </div>
      </div>

      {/* High-Density Urban Station Comparison Grid */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Monitored Urban Stations
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Select any city row to inspect 24-hour dispersion telemetry and respiratory guidance.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <label htmlFor="station-search-input" className="sr-only">
                Filter monitoring stations by city or district
              </label>
              <input
                id="station-search-input"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search city or district..."
                className="w-52 rounded-lg border border-slate-300 bg-white py-1.5 pr-3 pl-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-cyan-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'good', label: 'Good' },
                  { id: 'moderate', label: 'Moderate' },
                  { id: 'elevated', label: 'Elevated' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterBand(tab.id)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    filterBand === tab.id
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <label htmlFor="station-sort-select" className="sr-only">
              Sort stations
            </label>
            <select
              id="station-sort-select"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as StationSortKey)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            >
              <option value="aqi-desc">Highest AQI</option>
              <option value="aqi-asc">Cleanest Air</option>
              <option value="pm25-desc">Highest PM2.5</option>
              <option value="city-asc">City A–Z</option>
            </select>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th className="py-2.5 pr-4 font-medium">City &amp; District</th>
                <th className="px-3 py-2.5 text-right font-medium">US EPA AQI</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 text-right font-medium">PM2.5 (µg/m³)</th>
                <th className="px-3 py-2.5 text-right font-medium">NO₂ (µg/m³)</th>
                <th className="px-3 py-2.5 text-right font-medium">O₃ (µg/m³)</th>
                <th className="py-2.5 pl-3 text-right font-medium">Best Window</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {visibleStations.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-8 text-center text-sm text-slate-500 dark:text-slate-400"
                  >
                    No monitoring stations match your current filter.
                  </td>
                </tr>
              ) : (
                visibleStations.map((st) => {
                  const rowTone = getAqiTone(st.category.key);
                  const isSelected = st.id === selectedStation.id;
                  return (
                    <tr
                      key={st.id}
                      className={`transition-colors ${
                        isSelected
                          ? 'bg-cyan-50/60 dark:bg-cyan-950/30'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <td className="py-3 pr-4">
                        <button
                          type="button"
                          onClick={() => onSelectStation(st.id)}
                          className="text-left focus-visible:outline-2 focus-visible:outline-cyan-700"
                        >
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {st.city}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {st.district}
                          </div>
                        </button>
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                        {st.aqi}
                      </td>
                      <td className={`px-3 py-3 font-medium ${rowTone.textClass}`}>
                        {rowTone.glyph} {st.category.shortLabel}
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {st.metrics.pm25.toFixed(1)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {st.metrics.no2.toFixed(1)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {st.metrics.o3.toFixed(1)}
                      </td>
                      <td className="py-3 pl-3 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        {st.bestOutdoorWindow}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
