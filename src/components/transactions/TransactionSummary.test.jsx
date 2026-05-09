import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TransactionSummary from './TransactionSummary';

describe('TransactionSummary', () => {
  const baseSummary = {
    total_outflow: 5000,
    total_inflow: 2000,
    net: -3000,
    count: 15,
    transfer_count: 0,
    transfer_amount: 0,
    investment_count: 0,
    investment_amount: 0,
  };

  it('shows loading message when loading without summary', () => {
    render(<TransactionSummary summary={null} isLoading={true} splitMode="my_share" onSplitModeChange={() => {}} />);
    expect(screen.getByText(/Calculating totals/i)).toBeInTheDocument();
  });

  it('renders nothing when summary is null and not loading', () => {
    const { container } = render(
      <TransactionSummary summary={null} isLoading={false} splitMode="my_share" onSplitModeChange={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders stat values from the summary', () => {
    render(<TransactionSummary summary={baseSummary} isLoading={false} splitMode="my_share" onSplitModeChange={() => {}} />);
    expect(screen.getByText('Spent')).toBeInTheDocument();
    expect(screen.getByText('Received')).toBeInTheDocument();
    expect(screen.getByText('Net')).toBeInTheDocument();
    expect(screen.getByText('Count')).toBeInTheDocument();
  });

  it('calls onSplitModeChange when toggling split mode', async () => {
    const onSplitModeChange = vi.fn();
    const user = userEvent.setup();

    render(
      <TransactionSummary
        summary={baseSummary}
        isLoading={false}
        splitMode="my_share"
        onSplitModeChange={onSplitModeChange}
      />
    );

    await user.click(screen.getByRole('button', { name: /Full amount/i }));
    expect(onSplitModeChange).toHaveBeenCalledWith('total_amount');

    await user.click(screen.getByRole('button', { name: /My share/i }));
    expect(onSplitModeChange).toHaveBeenCalledWith('my_share');
  });

  it('shows transfer exclusion when transfer_count > 0', () => {
    const summary = { ...baseSummary, transfer_count: 3, transfer_amount: 15000 };
    render(<TransactionSummary summary={summary} isLoading={false} splitMode="my_share" onSplitModeChange={() => {}} />);
    expect(screen.getByText(/3 transfers excluded/i)).toBeInTheDocument();
  });

  it('pluralizes transfer label correctly for single transfer', () => {
    const summary = { ...baseSummary, transfer_count: 1, transfer_amount: 5000 };
    render(<TransactionSummary summary={summary} isLoading={false} splitMode="my_share" onSplitModeChange={() => {}} />);
    expect(screen.getByText(/1 transfer excluded/i)).toBeInTheDocument();
  });

  it('shows investment exclusion when investment_count > 0', () => {
    const summary = { ...baseSummary, investment_count: 4, investment_amount: 25000 };
    render(<TransactionSummary summary={summary} isLoading={false} splitMode="my_share" onSplitModeChange={() => {}} />);
    expect(screen.getByText(/4 investments excluded/i)).toBeInTheDocument();
  });

  it('pluralizes investment label correctly for single investment', () => {
    const summary = { ...baseSummary, investment_count: 1, investment_amount: 8000 };
    render(<TransactionSummary summary={summary} isLoading={false} splitMode="my_share" onSplitModeChange={() => {}} />);
    expect(screen.getByText(/1 investment excluded/i)).toBeInTheDocument();
  });

  it('shows both transfer and investment exclusions together', () => {
    const summary = {
      ...baseSummary,
      transfer_count: 2, transfer_amount: 10000,
      investment_count: 3, investment_amount: 18000,
    };
    render(<TransactionSummary summary={summary} isLoading={false} splitMode="my_share" onSplitModeChange={() => {}} />);
    expect(screen.getByText(/2 transfers excluded/i)).toBeInTheDocument();
    expect(screen.getByText(/3 investments excluded/i)).toBeInTheDocument();
  });

  it('hides exclusion section when both counts are zero', () => {
    render(<TransactionSummary summary={baseSummary} isLoading={false} splitMode="my_share" onSplitModeChange={() => {}} />);
    expect(screen.queryByText(/excluded/i)).not.toBeInTheDocument();
  });
});
