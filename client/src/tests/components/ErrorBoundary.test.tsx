import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '../../components/ErrorBoundary';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ErrorBoundary', () => {
  it('renders children normally when no exception is thrown', () => {
    render(
      <ErrorBoundary>
        <p>Healthy dashboard content</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('Healthy dashboard content')).toBeInTheDocument();
  });

  it('catches rendering errors, displays accessible fallback UI, and recovers on reload click', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let shouldThrow = true;

    function FlakyView() {
      if (shouldThrow) {
        throw new Error('Telemetry canvas failure');
      }
      return <p>Recovered air quality view</p>;
    }

    render(
      <ErrorBoundary>
        <FlakyView />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('heading', { name: /Something went wrong/i })).toBeInTheDocument();
    expect(screen.getByText('Telemetry canvas failure')).toBeInTheDocument();

    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: /Reload view/i }));

    expect(screen.getByText('Recovered air quality view')).toBeInTheDocument();
    errorSpy.mockRestore();
  });
});
