/**
 * @module healthPdfAndCorrelations
 * Deterministic symptom-to-AQI correlation engine and pure PDF 1.4 generator for clinician visits.
 */

import {
  SEVERITY_SCORE,
  SYMPTOM_FIELD_LABELS,
  type CorrelationStrength,
  type FamilyHealthInsight,
  type FamilyMember,
  type SymptomFieldKey,
  type SymptomLogEntry,
} from '../types/family';

/** Deterministic symptom-to-AQI correlation engine (works offline and supplements Gemini AI). */
export function analyzeSymptomCorrelations(
  member: FamilyMember,
  logs: SymptomLogEntry[],
): FamilyHealthInsight[] {
  if (logs.length === 0) return [];

  const symptomKeys: SymptomFieldKey[] = [
    'coughing',
    'wheezing',
    'eyeIrritation',
    'shortnessOfBreath',
    'headache',
  ];

  const insights: FamilyHealthInsight[] = [];
  const relationSubject =
    member.relationship.toLowerCase() === 'self'
      ? 'Your'
      : `Your ${member.relationship.toLowerCase()}'s`;

  for (const key of symptomKeys) {
    const activeLogs = logs.filter((entry) => SEVERITY_SCORE[entry[key]] > 0);
    if (activeLogs.length === 0) continue;

    const avgAqiActive =
      activeLogs.reduce((sum, entry) => sum + entry.aqiAtLog, 0) / activeLogs.length;
    const morningHits = activeLogs.filter((entry) => {
      const hour = new Date(entry.timestamp).getHours();
      return hour >= 5 && hour <= 11;
    }).length;
    const highAqiHits = activeLogs.filter((entry) => entry.aqiAtLog >= 100).length;
    const ratio = highAqiHits / activeLogs.length;

    let strength: CorrelationStrength = 'weak';
    if (avgAqiActive >= 115 || (activeLogs.length >= 2 && ratio >= 0.65)) {
      strength = 'strong';
    } else if (avgAqiActive >= 75 || ratio >= 0.4) {
      strength = 'moderate';
    }

    const timeNote =
      morningHits / activeLogs.length >= 0.5
        ? 'morning AQI spikes'
        : avgAqiActive >= 100
          ? 'elevated AQI episodes (100+)'
          : 'moderate ambient particulate days';

    const label = SYMPTOM_FIELD_LABELS[key].toLowerCase();
    const pattern = `${relationSubject} ${label} correlates with ${timeNote} (avg AQI ${Math.round(avgAqiActive)} across ${activeLogs.length} log${activeLogs.length === 1 ? '' : 's'}).`;

    let recommendation = `Track ${label} closely when AQI rises above ${member.sensitivityLevel === 'high' ? 75 : 100} and keep indoor HEPA filtration active.`;
    if (key === 'wheezing' || key === 'shortnessOfBreath') {
      recommendation =
        'Limit outdoor exertion during peak traffic hours, wear a well-fitted N95/KF94 respirator when AQI > 100, and keep prescribed rescue medication accessible.';
    } else if (key === 'coughing') {
      recommendation =
        'Shift outdoor commutes or school drop-offs away from early-morning inversion windows and close bedroom windows overnight.';
    } else if (key === 'eyeIrritation') {
      recommendation =
        'Use wraparound eyewear outdoors on hazy days and rinse eyes with preservative-free saline after high-PM exposure.';
    }

    insights.push({
      id: `local-${member.id}-${key}`,
      pattern,
      recommendation,
      correlationStrength: strength,
      affectedSymptom: SYMPTOM_FIELD_LABELS[key],
      averageAqiWhenReported: Math.round(avgAqiActive),
      source: 'local-correlation',
    });
  }

  return insights.sort((a, b) => b.averageAqiWhenReported - a.averageAqiWhenReported);
}

function escapePdfText(input: string): string {
  return input
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

/** Generates a valid, self-contained PDF 1.4 binary document for clinician visits. */
export function buildDoctorVisitPdf(
  member: FamilyMember,
  logs: SymptomLogEntry[],
  insights: FamilyHealthInsight[],
): Uint8Array {
  const lines: string[] = [
    'ATMOSENSE AI - CLINICAL AIR QUALITY & SYMPTOM SUMMARY',
    `Generated: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`,
    '----------------------------------------------------------------------',
    `Patient Profile: ${member.name} (${member.relationship}, Age ${member.age})`,
    `Sensitivity Level: ${member.sensitivityLevel.toUpperCase()}`,
    `Conditions: ${member.healthConditions.length > 0 ? member.healthConditions.join(', ') : 'None listed'}`,
    `Activity Patterns: ${member.activityPatterns.length > 0 ? member.activityPatterns.join(', ') : 'General'}`,
    '',
    'CORRELATION INSIGHTS:',
    ...(insights.length > 0
      ? insights
          .slice(0, 6)
          .flatMap((ins, idx) => [
            `${idx + 1}. [${ins.correlationStrength.toUpperCase()}] ${ins.pattern.slice(0, 88)}`,
            `   Advice: ${ins.recommendation.slice(0, 86)}`,
          ])
      : ['No correlation patterns calculated yet.']),
    '',
    `RECENT SYMPTOM LOGS (${logs.length} total):`,
    ...logs.slice(0, 12).map((log) => {
      const dateStr = new Date(log.timestamp).toISOString().slice(0, 16).replace('T', ' ');
      const active = (
        ['coughing', 'wheezing', 'eyeIrritation', 'shortnessOfBreath', 'headache'] as const
      )
        .filter((k) => log[k] !== 'none')
        .map((k) => `${SYMPTOM_FIELD_LABELS[k]}:${log[k]}`)
        .join(', ');
      return `- ${dateStr} | AQI ${log.aqiAtLog} | ${active || 'No symptoms'}`;
    }),
  ];

  const streamLines = ['BT', '/F1 10 Tf', '42 756 Td', '14 TL'];
  lines.slice(0, 48).forEach((line, index) => {
    const escaped = escapePdfText(line);
    streamLines.push(index === 0 ? `(${escaped}) Tj` : `T* (${escaped}) Tj`);
  });
  streamLines.push('ET');
  const streamContent = streamLines.join('\n');

  const objects: string[] = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return new TextEncoder().encode(pdf);
}

/** Triggers a browser download of the generated clinician visit PDF report. */
export function downloadDoctorVisitPdf(
  member: FamilyMember,
  logs: SymptomLogEntry[],
  insights: FamilyHealthInsight[],
): Blob {
  const bytes = buildDoctorVisitPdf(member, logs, insights);
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const safeName = member.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'member';
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `atmosense-health-report-${safeName}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return blob;
}
