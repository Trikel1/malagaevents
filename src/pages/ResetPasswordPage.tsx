import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import SEO from '@/components/common/SEO';

const ResetPasswordPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Supabase JS parses the recovery tokens from the URL hash and fires
    // a PASSWORD_RECOVERY event once the session is established.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setReady(true);
      }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: 'Error', description: 'La contraseña debe tener al menos 6 caracteres', variant: 'destructive' });
      return;
    }
    if (password !== confirm) {
      toast({ title: 'Error', description: 'Las contraseñas no coinciden', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Contraseña actualizada', description: 'Ya puedes acceder con tu nueva contraseña' });
    navigate('/');
  };

  return (
    <div className="min-h-dvh bg-background">
      <SEO title={t('seo.reset.title')} description={t('seo.reset.description')} path="/auth/reset" noindex />
      <header className="p-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/auth')} aria-label={t('common.back', 'Volver')}>
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Button>
        <h1 className="font-display text-2xl font-bold tracking-tight">{t('auth.resetTitle', 'Restablecer contraseña')}</h1>
      </header>
      <main className="p-4 max-w-md mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>{t('auth.newPassword', 'Nueva contraseña')}</CardTitle>
            <CardDescription>
              {ready ? t('auth.newPasswordHelp', 'Introduce tu nueva contraseña.') : t('auth.verifyingLink', 'Verificando el enlace de recuperación…')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">{t('auth.newPassword', 'Nueva contraseña')}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id="password"
                    type={show ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 pr-11"
                    required
                    minLength={6}
                    disabled={!ready}
                    autoComplete="new-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full min-h-11 min-w-11 px-3"
                    onClick={() => setShow(!show)}
                    aria-label={show ? t('auth.hidePassword', 'Ocultar contraseña') : t('auth.showPassword', 'Mostrar contraseña')}
                    aria-pressed={show}
                  >
                    {show ? <EyeOff className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> : <Eye className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">{t('auth.confirmPassword', 'Confirmar contraseña')}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id="confirm"
                    type={show ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="pl-9"
                    required
                    minLength={6}
                    disabled={!ready}
                    autoComplete="new-password"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full min-h-11" disabled={!ready || loading}>
                {loading ? t('auth.saving', 'Guardando…') : t('auth.updatePassword', 'Actualizar contraseña')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ResetPasswordPage;
