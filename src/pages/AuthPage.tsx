import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, Mail, Lock, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthContext } from '@/contexts/AuthContext';
import SEO from '@/components/common/SEO';

type Errors = Partial<Record<'email' | 'password' | 'confirmPassword' | 'displayName' | 'form', string>>;

const AuthPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, signUp, resetPassword, isLoading: authLoading } = useAuthContext();

  const initialMode = searchParams.get('mode') === 'signup' ? 'signup' : 'login';
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [resetInfo, setResetInfo] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    displayName: '',
  });

  const setField = (name: keyof typeof formData, value: string) => {
    setFormData((f) => ({ ...f, [name]: value }));
    // Clear per-field error as user types
    setErrors((prev) => (prev[name as keyof Errors] ? { ...prev, [name]: undefined } : prev));
  };

  const validate = (): Errors => {
    const next: Errors = {};
    if (!formData.email.trim()) next.email = t('auth.errors.emailRequired', 'Introduce tu email');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      next.email = t('auth.errors.emailInvalid', 'Email no válido');
    if (!formData.password) next.password = t('auth.errors.passwordRequired', 'Introduce tu contraseña');
    else if (formData.password.length < 6)
      next.password = t('auth.errors.passwordShort', 'Mínimo 6 caracteres');
    if (mode === 'signup') {
      if (!formData.confirmPassword)
        next.confirmPassword = t('auth.errors.confirmRequired', 'Confirma tu contraseña');
      else if (formData.password !== formData.confirmPassword)
        next.confirmPassword = t('auth.errors.confirmMismatch', 'Las contraseñas no coinciden');
    }
    return next;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return; // block double submit
    setResetInfo(null);

    const eMap = validate();
    if (Object.keys(eMap).length > 0) {
      setErrors(eMap);
      // Focus first invalid field
      const first = Object.keys(eMap)[0];
      const el = document.getElementById(first);
      el?.focus();
      return;
    }

    setErrors({});
    setIsLoading(true);
    try {
      if (mode === 'signup') {
        const { error } = await signUp(formData.email, formData.password, formData.displayName);
        if (error) {
          setErrors({ form: error.message ?? t('auth.errors.signupFailed', 'No se pudo crear la cuenta') });
        } else {
          navigate('/');
        }
      } else {
        const { error } = await signIn(formData.email, formData.password);
        if (error) {
          setErrors({ form: error.message ?? t('auth.errors.loginFailed', 'Email o contraseña incorrectos') });
        } else {
          navigate('/');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setResetInfo(null);
    if (!formData.email.trim()) {
      setErrors((prev) => ({ ...prev, email: t('auth.errors.emailRequiredForReset', 'Introduce tu email para recuperar la contraseña') }));
      document.getElementById('email')?.focus();
      return;
    }
    const { error } = await resetPassword(formData.email);
    if (error) {
      setErrors((prev) => ({ ...prev, form: error.message }));
    } else {
      setResetInfo(t('auth.resetSent', 'Te hemos enviado un correo con instrucciones para recuperar la contraseña.'));
    }
  };

  const submitLabel = mode === 'login' ? t('profile.login') : t('profile.signup');
  const pwToggleLabel = showPassword
    ? t('auth.hidePassword', 'Ocultar contraseña')
    : t('auth.showPassword', 'Mostrar contraseña');

  const busy = isLoading || authLoading;

  return (
    <div className="min-h-dvh bg-gradient-warm relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-16 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute top-40 -right-16 h-72 w-72 rounded-full bg-secondary/25 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-accent/15 blur-3xl" />
      </div>
      <div className="relative">
        <SEO
          title="Acceder a MalagaEvents"
          description="Inicia sesión o crea una cuenta para guardar favoritos, gestionar entradas y recibir alertas de eventos en Málaga."
          path="/auth"
          noindex
        />
        <header className="p-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-11 w-11"
            aria-label={t('common.back', 'Volver')}
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Button>
          <h1 className="text-xl font-bold">
            {mode === 'login' ? t('profile.login') : t('profile.signup')}
          </h1>
        </header>

        <main className="p-4 max-w-md mx-auto">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Málaga Events</CardTitle>
              <CardDescription>
                {mode === 'login'
                  ? t('profile.hasAccount') + ' ' + t('profile.login')
                  : t('profile.noAccount') + ' ' + t('profile.signup')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs
                value={mode}
                onValueChange={(v) => {
                  setMode(v as 'login' | 'signup');
                  setErrors({});
                  setResetInfo(null);
                }}
              >
                <TabsList className="w-full mb-6 h-11">
                  <TabsTrigger value="login" className="flex-1">
                    {t('profile.login')}
                  </TabsTrigger>
                  <TabsTrigger value="signup" className="flex-1">
                    {t('profile.signup')}
                  </TabsTrigger>
                </TabsList>

                {/* Form-level error / info live region */}
                {(errors.form || resetInfo) && (
                  <div
                    role="alert"
                    aria-live="assertive"
                    className={
                      errors.form
                        ? 'mb-4 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive'
                        : 'mb-4 flex items-start gap-2 rounded-md border border-primary/30 bg-primary/10 p-3 text-sm text-foreground'
                    }
                  >
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
                    <span>{errors.form ?? resetInfo}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} noValidate className="space-y-4" aria-busy={busy}>
                  {mode === 'signup' && (
                    <div className="space-y-1.5">
                      <Label htmlFor="displayName">{t('auth.displayName', 'Nombre')}</Label>
                      <Input
                        id="displayName"
                        type="text"
                        autoComplete="name"
                        placeholder={t('auth.displayNamePlaceholder', 'Tu nombre')}
                        value={formData.displayName}
                        onChange={(e) => setField('displayName', e.target.value)}
                        className="min-h-11"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="email">{t('profile.email')}</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
                      <Input
                        id="email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        placeholder="tu@email.com"
                        value={formData.email}
                        onChange={(e) => setField('email', e.target.value)}
                        aria-invalid={!!errors.email}
                        aria-describedby={errors.email ? 'email-error' : undefined}
                        className="pl-9 min-h-11"
                      />
                    </div>
                    {errors.email && (
                      <p id="email-error" role="alert" className="text-xs text-destructive">
                        {errors.email}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="password">{t('profile.password')}</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={(e) => setField('password', e.target.value)}
                        aria-invalid={!!errors.password}
                        aria-describedby={errors.password ? 'password-error' : undefined}
                        className="pl-9 pr-11 min-h-11"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9"
                        onClick={() => setShowPassword((s) => !s)}
                        aria-label={pwToggleLabel}
                        aria-pressed={showPassword}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" aria-hidden />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" aria-hidden />
                        )}
                      </Button>
                    </div>
                    {errors.password && (
                      <p id="password-error" role="alert" className="text-xs text-destructive">
                        {errors.password}
                      </p>
                    )}
                  </div>

                  {mode === 'signup' && (
                    <div className="space-y-1.5">
                      <Label htmlFor="confirmPassword">{t('profile.confirmPassword')}</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
                        <Input
                          id="confirmPassword"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          placeholder="••••••••"
                          value={formData.confirmPassword}
                          onChange={(e) => setField('confirmPassword', e.target.value)}
                          aria-invalid={!!errors.confirmPassword}
                          aria-describedby={errors.confirmPassword ? 'confirm-error' : undefined}
                          className="pl-9 min-h-11"
                        />
                      </div>
                      {errors.confirmPassword && (
                        <p id="confirm-error" role="alert" className="text-xs text-destructive">
                          {errors.confirmPassword}
                        </p>
                      )}
                    </div>
                  )}

                  {mode === 'login' && (
                    <div className="text-right">
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        className="text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                      >
                        {t('profile.forgotPassword')}
                      </button>
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full min-h-11"
                    disabled={busy}
                    aria-busy={busy}
                  >
                    {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden />}
                    {busy ? t('common.loading') : submitLabel}
                  </Button>
                </form>
              </Tabs>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
};

export default AuthPage;
