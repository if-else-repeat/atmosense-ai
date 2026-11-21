import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildLocalRoutinePlan, RoutineOptimizer } from '../../components/Routine/RoutineOptimizer';

const server = setupServer(
  http.post('/api/ai/routine', async () =>
    HttpResponse.json({
      routine: {
        summary: 'Midday outdoor exercise is safest with lowest PM2.5 dispersion.',
        safeOutdoorWindows: ['11:30–15:00'],
        maskAdvice: 'Carry a fitted N95 mask for evening commutes.',
        indoorGuidance: 'Run bedroom HEPA purifier overnight.',
        schedule: [
          {
            timeWindow: '11:30–15:00',
            activity: 'Brisk walk or outdoor errands',
            safetyLevel: 'safe',
            notes: 'Lowest particulate concentration of the day.',
          },
        ],
      },
    }),
  ),
);

beforeAll(() => server.listen());
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

describe('RoutineOptimizer Component', () => {
  it('renders zone telemetry context and persona/language selectors', () => {
    render(<RoutineOptimizer zoneName="New Delhi, India" aqi={142} pm25={51.2} />);
    expect(screen.getByText(/Daily Routine Optimizer/i)).toBeInTheDocument();
    expect(screen.getByText(/New Delhi, India/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Profile/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Language/i)).toBeInTheDocument();
  });

  it('fetches and displays Gemini AI routine schedule on submit', async () => {
    render(<RoutineOptimizer zoneName="New Delhi, India" aqi={142} pm25={51.2} />);
    fireEvent.click(screen.getByRole('button', { name: /Optimize Daily Routine/i }));

    expect(await screen.findByText(/Midday outdoor exercise is safest/i)).toBeInTheDocument();
    expect(screen.getAllByText('11:30–15:00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Carry a fitted N95 mask/i)).toBeInTheDocument();
  });

  it('shows disabled loading state while optimization request is pending', async () => {
    server.use(
      http.post('/api/ai/routine', async () => {
        await new Promise((r) => setTimeout(r, 70));
        return HttpResponse.json({ routine: { summary: 'Done' } });
      }),
    );

    render(<RoutineOptimizer zoneName="London, UK" aqi={44} pm25={9.8} />);
    const submitBtn = screen.getByRole('button', { name: /Optimize Daily Routine/i });
    fireEvent.click(submitBtn);

    expect(screen.getByRole('button', { name: /Optimizing/i })).toBeDisabled();
    await waitFor(() => expect(screen.getByText('Done')).toBeInTheDocument());
  });

  it('allows changing persona profile and language prior to submission', async () => {
    let capturedBody: Record<string, unknown> = {};
    server.use(
      http.post('/api/ai/routine', async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ routine: { summary: 'Plan listo' } });
      }),
    );

    render(<RoutineOptimizer zoneName="Madrid, Spain" aqi={88} pm25={29.4} />);
    fireEvent.change(screen.getByLabelText(/Profile/i), { target: { value: 'children' } });
    fireEvent.change(screen.getByLabelText(/Language/i), { target: { value: 'es' } });
    fireEvent.click(screen.getByRole('button', { name: /Optimize Daily Routine/i }));

    await screen.findByText('Plan listo');
    expect(capturedBody.persona).toBe('children');
    expect(capturedBody.language).toBe('es');
  });

  it('falls back cleanly to deterministic heuristic routine on server error', async () => {
    server.use(
      http.post('/api/ai/routine', () =>
        HttpResponse.json({ error: 'Service down' }, { status: 503 }),
      ),
    );

    render(<RoutineOptimizer zoneName="Beijing, China" aqi={168} pm25={88} />);
    fireEvent.click(screen.getByRole('button', { name: /Optimize Daily Routine/i }));

    expect(await screen.findByRole('status')).toHaveTextContent(/deterministic heuristic plan/i);
    expect(screen.getByText(/Fitted N95\/KF94 respirator required/i)).toBeInTheDocument();
  });

  it('generates stricter protective guidance for high-AQI conditions in local fallback helper', () => {
    const lowPlan = buildLocalRoutinePlan('general', 32, 'Zurich');
    const highPlan = buildLocalRoutinePlan('asthmatics', 190, 'Delhi');

    expect(lowPlan.maskRecommendation).toMatch(/No respirator needed/i);
    expect(highPlan.maskRecommendation).toMatch(/N95\/KF94/i);
    expect(highPlan.schedule.some((slot) => slot.status === 'avoid')).toBe(true);
  });
});
