import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { ToastProvider, useToast } from './ToastContext';

function ToastTrigger({ message = 'Saved!', variant = 'success' }) {
  const toast = useToast();
  return <button onClick={() => toast[variant](message)}>fire</button>;
}

describe('ToastContext', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a toast when fired', () => {
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('fire'));
    expect(screen.getByText('Saved!')).toBeInTheDocument();
  });

  it('auto-dismisses after the default duration', () => {
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('fire'));
    expect(screen.getByText('Saved!')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(4000); });
    expect(screen.queryByText('Saved!')).not.toBeInTheDocument();
  });

  it('stacks multiple toasts simultaneously', () => {
    function MultiTrigger() {
      const toast = useToast();
      return (
        <>
          <button onClick={() => toast.success('First')}>a</button>
          <button onClick={() => toast.error('Second')}>b</button>
        </>
      );
    }
    render(
      <ToastProvider>
        <MultiTrigger />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('a'));
    fireEvent.click(screen.getByText('b'));
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });

  it('allows manual dismiss via the close button', () => {
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('fire'));
    expect(screen.getByText('Saved!')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Dismiss notification'));
    expect(screen.queryByText('Saved!')).not.toBeInTheDocument();
  });

  it('useToast throws outside a provider', () => {
    // Suppress React's error logging for this expected error
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<ToastTrigger />)).toThrow(/ToastProvider/);
    spy.mockRestore();
  });
});
