import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthContext } from '@/contexts/AuthContext';
import SEO from '@/components/common/SEO';

const AuthPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, signUp, resetPassword, isLoading: authLoading } = useAuthContext();
  
  const initialMode = searchParams.get('mode') === 'signup' ? 'signup' : 'login';
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    displayName: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (mode === 'signup') {
        if (formData.password !== formData.confirmPassword) {
          return;
        }
        const { error } = await signUp(formData.email, formData.password, formData.displayName);
        if (!error) {
          navigate('/');
        }
      } else {
        const { error } = await signIn(formData.email, formData.password);
        if (!error) {
          navigate('/');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (formData.email) {
      await resetPassword(formData.email);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-warm relative overflow-hidden">
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
      {/* Header */}
      <header className="p-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
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
                : t('profile.noAccount') + ' ' + t('profile.signup')
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={mode} onValueChange={(v) => setMode(v as 'login' | 'signup')}>
              <TabsList className="w-full mb-6">
                <TabsTrigger value="login" className="flex-1">
                  {t('profile.login')}
                </TabsTrigger>
                <TabsTrigger value="signup" className="flex-1">
                  {t('profile.signup')}
                </TabsTrigger>
              </TabsList>

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'signup' && (
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Nombre</Label>
                    <Input
                      id="displayName"
                      type="text"
                      placeholder="Tu nombre"
                      value={formData.displayName}
                      onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    />
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="email">{t('profile.email')}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="tu@email.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="pl-9"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">{t('profile.password')}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="pl-9 pr-9"
                      required
                      minLength={6}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>

                {mode === 'signup' && (
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">{t('profile.confirmPassword')}</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirmPassword"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        className="pl-9"
                        required
                        minLength={6}
                      />
                    </div>
                  </div>
                )}

                {mode === 'login' && (
                  <div className="text-right">
                    <button 
                      type="button"
                      onClick={handleForgotPassword}
                      className="text-sm text-primary hover:underline"
                    >
                      {t('profile.forgotPassword')}
                    </button>
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={isLoading || authLoading}>
                  {isLoading ? t('common.loading') : (mode === 'login' ? t('profile.login') : t('profile.signup'))}
                </Button>
              </form>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AuthPage;
