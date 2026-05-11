import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ProjectCreateModal } from '../../../src/dashboard/components/ProjectCreateModal';
import { mockBrowser } from '../../__mocks__/browser';

describe('ProjectCreateModal', () => {
  beforeEach(() => {
    const { mock } = mockBrowser();
    vi.mocked(mock.runtime.sendMessage).mockResolvedValue({
      id: 'proj-123',
      name: 'Test Project',
      color: 'blue',
      archived: false,
      createdAt: Date.now(),
    });
  });

  it('does not render when closed', () => {
    const onClose = vi.fn();
    const onCreated = vi.fn();
    render(<ProjectCreateModal open={false} onClose={onClose} onCreated={onCreated} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders dialog when open', () => {
    const onClose = vi.fn();
    const onCreated = vi.fn();
    render(<ProjectCreateModal open={true} onClose={onClose} onCreated={onCreated} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Nuevo proyecto')).toBeInTheDocument();
  });

  it('shows error when name is empty on submit', () => {
    const onClose = vi.fn();
    const onCreated = vi.fn();
    render(<ProjectCreateModal open={true} onClose={onClose} onCreated={onCreated} />);
    fireEvent.click(screen.getByText('Crear'));
    expect(screen.getByText('El nombre es obligatorio.')).toBeInTheDocument();
  });

  it('shows error when name exceeds 80 chars', () => {
    const onClose = vi.fn();
    const onCreated = vi.fn();
    render(<ProjectCreateModal open={true} onClose={onClose} onCreated={onCreated} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'a'.repeat(81) } });
    fireEvent.click(screen.getByText('Crear'));
    expect(screen.getByText('Máximo 80 caracteres.')).toBeInTheDocument();
  });

  it('renders all 6 color swatches', () => {
    const onClose = vi.fn();
    const onCreated = vi.fn();
    render(<ProjectCreateModal open={true} onClose={onClose} onCreated={onCreated} />);
    const swatches = screen.getAllByRole('radio');
    expect(swatches).toHaveLength(6);
  });

  it('blue is selected by default', () => {
    const onClose = vi.fn();
    const onCreated = vi.fn();
    render(<ProjectCreateModal open={true} onClose={onClose} onCreated={onCreated} />);
    const blue = screen.getByRole('radio', { name: 'blue' });
    expect(blue).toHaveAttribute('aria-checked', 'true');
  });

  it('selects a different color on click', () => {
    const onClose = vi.fn();
    const onCreated = vi.fn();
    render(<ProjectCreateModal open={true} onClose={onClose} onCreated={onCreated} />);
    const amber = screen.getByRole('radio', { name: 'orange' });
    fireEvent.click(amber);
    expect(amber).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'blue' })).toHaveAttribute('aria-checked', 'false');
  });

  it('closes on Cancel button', () => {
    const onClose = vi.fn();
    const onCreated = vi.fn();
    render(<ProjectCreateModal open={true} onClose={onClose} onCreated={onCreated} />);
    fireEvent.click(screen.getByText('Cancelar'));
    expect(onClose).toHaveBeenCalled();
  });

  it('submits form and calls onCreated with project', async () => {
    const onClose = vi.fn();
    const onCreated = vi.fn();
    render(<ProjectCreateModal open={true} onClose={onClose} onCreated={onCreated} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'My Project' } });
    fireEvent.click(screen.getByText('Crear'));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(onCreated).toHaveBeenCalledWith({
      id: 'proj-123',
      name: 'Test Project',
      color: 'blue',
      archived: false,
      createdAt: expect.any(Number),
    });
  });

  it('closes on overlay click', () => {
    const onClose = vi.fn();
    const onCreated = vi.fn();
    render(<ProjectCreateModal open={true} onClose={onClose} onCreated={onCreated} />);
    fireEvent.click(screen.getByRole('dialog').parentElement!);
    expect(onClose).toHaveBeenCalled();
  });

  it('resets state when reopened after close', () => {
    const onClose = vi.fn();
    const onCreated = vi.fn();
    const { rerender } = render(<ProjectCreateModal open={true} onClose={onClose} onCreated={onCreated} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Old Name' } });
    fireEvent.click(screen.getByRole('radio', { name: 'green' }));

    rerender(<ProjectCreateModal open={false} onClose={onClose} onCreated={onCreated} />);
    rerender(<ProjectCreateModal open={true} onClose={onClose} onCreated={onCreated} />);

    expect(screen.getByRole('textbox')).toHaveValue('');
    expect(screen.getByRole('radio', { name: 'blue' })).toHaveAttribute('aria-checked', 'true');
  });
});
