import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { ThemeProvider } from 'next-themes';
import i18n from '@/i18n';

// Auth mocks
const signInMock = vi.fn().mockResolvedValue({ error: null });
const signUpMock = vi.fn().mockResolvedValue({ error: null });
const resetMock = vi.fn().mockResolvedValue({ error: null });

vi.mock('@/contexts/AuthContext', () => ({
  useAuthContext: () => ({
    isAuthenticated: false,
    user: null,
    isLoading: false,
    signIn: signInMock,
    signUp: signUpMock,
    resetPassword: resetMock,
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/hooks/useAdmin', () => ({
  useIsAdmin: () => ({ data: false }),
}));

import AuthPage from '@/pages/AuthPage';
import { ThemeSelector } from '@/components/theme/ThemeSelector';

const wrap = (ui: React.ReactNode) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <HelmetProvider>
      <QueryClientProvider client={qc}>
        <I18nextProvider i18n={i18n}>
          <ThemeProvider attribute="class" defaultTheme="system">
            <MemoryRouter initialEntries={['/auth']}>{ui}</MemoryRouter>
          </ThemeProvider>
        </I18nextProvider>
      </QueryClientProvider>
    </HelmetProvider>,
  );
};

beforeAll(async () => {
  await i18n.changeLanguage('es');
});

describe('Sprint UI 8 · AuthPage', () => {
  it('los inputs tienen labels visibles y autocomplete correcto', () => {
    wrap(<AuthPage />);
    const email = screen.getByLabelText(/email/i) as HTMLInputElement;
    const password = screen.getByLabelText(/contraseña/i) as HTMLInputElement;
    expect(email.getAttribute('autocomplete')).toBe('email');
    expect(password.getAttribute('autocomplete')).toBe('current-password');
  });

  it('valida email requerido con role="alert" junto al campo', async () => {
    const user = userEvent.setup();
    wrap(<AuthPage />);
    await user.click(screen.getByRole('button', { name: /iniciar sesión|acceder|entrar/i }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/email/i);
    expect(signInMock).not.toHaveBeenCalled();
  });

  it('toggle de contraseña tiene aria-label descriptivo y aria-pressed', async () => {
    const user = userEvent.setup();
    wrap(<AuthPage />);
    const toggle = screen.getByRole('button', { name: /Mostrar contraseña/i });
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    await user.click(toggle);
    expect(screen.getByRole('button', { name: /Ocultar contraseña/i })).toBeInTheDocument();
  });

  it('bloquea doble envío mediante disabled + aria-busy', async () => {
    const user = userEvent.setup();
    // Simulate slow sign-in
    signInMock.mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(() => resolve({ error: null }), 300)),
    );
    wrap(<AuthPage />);
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/contraseña/i), 'secret1');
    const submit = screen.getByRole('button', { name: /iniciar sesión|acceder|entrar/i });
    await user.click(submit);
    expect(submit).toBeDisabled();
    expect(submit.getAttribute('aria-busy')).toBe('true');
  });
});

describe('Sprint UI 8 · ThemeSelector', () => {
  it('renderiza radiogroup con tres opciones y aria-checked', () => {
    wrap(<ThemeSelector />);
    const group = screen.getByRole('radiogroup', { name: /Apariencia/i });
    const radios = screen.getAllByRole('radio');
    expect(group).toBeInTheDocument();
    expect(radios).toHaveLength(3);
    // exactly one is checked
    const checked = radios.filter((r) => r.getAttribute('aria-checked') === 'true');
    expect(checked.length).toBe(1);
  });

  it('cada opción tiene texto accesible visible (no solo icono)', () => {
    wrap(<ThemeSelector />);
    expect(screen.getByRole('radio', { name: /Sistema/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Claro/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Oscuro/i })).toBeInTheDocument();
  });
});
