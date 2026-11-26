import { Camera, Send } from 'lucide-react';
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { getAQICategoryLabel } from '../../utils/formatters';
import type { CrowdsourcedReport } from './communityData';

export interface CrowdsourcedReportsPanelProps {
  reports: CrowdsourcedReport[];
  defaultZone: string;
  defaultAqi: number;
  onAddReport: (report: CrowdsourcedReport) => void;
}

export function CrowdsourcedReportsPanel({
  reports,
  defaultZone,
  defaultAqi,
  onAddReport,
}: CrowdsourcedReportsPanelProps) {
  const [reportZone, setReportZone] = useState<string>(defaultZone);
  const [reportAqi, setReportAqi] = useState<string>(String(Math.round(defaultAqi)));
  const [reportVisibility, setReportVisibility] =
    useState<CrowdsourcedReport['visibility']>('Light Haze');
  const [reportNote, setReportNote] = useState<string>('');
  const [photoPreview, setPhotoPreview] = useState<string | undefined>(undefined);
  const [reportStatus, setReportStatus] = useState<string | null>(null);

  const handlePhotoSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoPreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleReportSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedAqi = Number(reportAqi);
    if (!reportZone.trim() || !Number.isFinite(parsedAqi) || parsedAqi < 0 || parsedAqi > 500) {
      return;
    }

    onAddReport({
      id: `rep-${Date.now().toString(36)}`,
      neighborhood: reportZone.trim(),
      reportedAqi: Math.round(parsedAqi),
      visibility: reportVisibility,
      note: reportNote.trim() || 'Community sky condition report submitted.',
      photoDataUrl: photoPreview,
      timestamp: 'Just now',
    });

    setReportNote('');
    setPhotoPreview(undefined);
    setReportStatus('Community observation published to your local zone feed.');
    setTimeout(() => setReportStatus(null), 3500);
  };

  return (
    <section
      aria-labelledby="crowdsource-heading"
      className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-5 dark:border-slate-800 dark:bg-slate-900"
    >
      <h3
        id="crowdsource-heading"
        className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100"
      >
        <Camera className="h-4 w-4 text-cyan-700 dark:text-cyan-400" aria-hidden="true" />
        Crowdsourced AQI &amp; Smog Photo Report
      </h3>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Share ground-level visibility observations or portable monitor readings with neighbors.
      </p>

      <form onSubmit={handleReportSubmit} className="mt-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="crowd-zone"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Neighborhood / Zone
            </label>
            <input
              id="crowd-zone"
              type="text"
              required
              maxLength={100}
              value={reportZone}
              onChange={(e) => setReportZone(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-cyan-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
          <div>
            <label
              htmlFor="crowd-aqi"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Observed AQI (0–500)
            </label>
            <input
              id="crowd-aqi"
              type="number"
              min={0}
              max={500}
              required
              value={reportAqi}
              onChange={(e) => setReportAqi(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-mono text-xs text-slate-900 focus:border-cyan-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="crowd-visibility"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Local Sky Condition
            </label>
            <select
              id="crowd-visibility"
              value={reportVisibility}
              onChange={(e) =>
                setReportVisibility(e.target.value as CrowdsourcedReport['visibility'])
              }
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-cyan-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="Clear">Clear</option>
              <option value="Light Haze">Light Haze</option>
              <option value="Dense Smog">Dense Smog</option>
              <option value="Severe Smoke">Severe Smoke</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="crowd-photo"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Local Smog Photo (Optional)
            </label>
            <input
              id="crowd-photo"
              type="file"
              accept="image/*"
              onChange={handlePhotoSelect}
              className="mt-1 block w-full text-xs text-slate-600 file:mr-2 file:rounded-md file:border file:border-slate-300 file:bg-slate-50 file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-slate-700 dark:text-slate-400 dark:file:border-slate-700 dark:file:bg-slate-900 dark:file:text-slate-200"
            />
          </div>
        </div>

        {photoPreview && (
          <img
            src={photoPreview}
            alt="Preview of uploaded local air quality condition"
            className="h-28 w-full rounded-lg border border-slate-200 object-cover dark:border-slate-800"
          />
        )}

        <div>
          <label
            htmlFor="crowd-note"
            className="block text-xs font-medium text-slate-700 dark:text-slate-300"
          >
            Observation Details
          </label>
          <textarea
            id="crowd-note"
            rows={2}
            maxLength={240}
            value={reportNote}
            onChange={(e) => setReportNote(e.target.value)}
            placeholder="Visible haze along arterial highway, moderate dust near construction..."
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-cyan-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          {reportStatus ? (
            <span
              role="status"
              className="text-xs font-medium text-emerald-700 dark:text-emerald-400"
            >
              {reportStatus}
            </span>
          ) : (
            <span className="text-xs text-slate-400">De-identified local feed</span>
          )}
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-700 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-cyan-800"
          >
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
            Submit Report
          </button>
        </div>
      </form>

      <div className="mt-5 space-y-2.5 border-t border-slate-100 pt-4 dark:border-slate-800">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Recent Local Observations ({reports.length})
        </h4>
        {reports.slice(0, 4).map((rep) => (
          <article
            key={rep.id}
            className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs dark:border-slate-800 dark:bg-slate-950/50"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {rep.neighborhood}
              </span>
              <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                AQI {rep.reportedAqi} ({getAQICategoryLabel(rep.reportedAqi)})
              </span>
            </div>
            <p className="mt-1 text-slate-600 dark:text-slate-400">
              {rep.visibility} · {rep.note}
            </p>
            {rep.photoDataUrl && (
              <img
                src={rep.photoDataUrl}
                alt={`Local smog report in ${rep.neighborhood}`}
                className="mt-2 h-24 w-full rounded-md object-cover"
              />
            )}
            <p className="mt-1 text-[11px] text-slate-400">{rep.timestamp}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
