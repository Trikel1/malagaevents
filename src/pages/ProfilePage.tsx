import { useTranslation } from 'react-i18next';
import { User, Globe, LogOut, Bell, Ticket, PlusCircle, Shield, Palette, ChevronRight, Lock } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import LanguageSelector from '@/components/common/LanguageSelector';
import { ThemeSelector } from '@/components/theme/ThemeSelector';
import { useAuthContext } from '@/contexts/AuthContext';
import { useIsAdmin } from '@/hooks/useAdmin';
import SEO from '@/components/common/SEO';
import { cn } from '@/lib/utils';


const ProfilePage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading, signOut } = useAuthContext();
  const { data: isAdmin } = useIsAdmin();

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const menuItems = [
    {
      icon: Ticket,
      label: t('tickets.title'),
      to: '/tickets',
      requiresAuth: true,
    },
    {
      icon: PlusCircle,
      label: t('submitEvent.title'),
      to: '/submit-event',
      requiresAuth: false,
    },
    {
      icon: Bell,
      label: t('profile.notifications'),
      to: '/profile/notifications',
      requiresAuth: true,
    },
    ...(isAdmin ? [{
      icon: Shield,
      label: 'Panel de administración',
      to: '/admin',
      requiresAuth: true,
    }] : []),
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={t('seo.profile.title')}
        description={t('seo.profile.description')}
        path="/profile"
        noindex
      />
      {/* Header */}
      <header className="bg-gradient-hero text-white p-6 pb-10 rounded-b-3xl shadow-card">
        <h1 className="text-2xl font-bold tracking-tight mb-4">{t('profile.title')}</h1>
        
        {isLoading ? (
          <div className="h-20 animate-pulse bg-white/10 rounded-lg" />
        ) : isAuthenticated && user ? (
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary-foreground/20 flex items-center justify-center">
              <User className="h-8 w-8" />
            </div>
            <div>
              <p className="font-semibold">{user.user_metadata?.display_name || 'Usuario'}</p>
              <p className="text-sm opacity-80">{user.email}</p>
            </div>
          </div>
        ) : (
          <Card className="bg-white/10 border-white/15 text-white">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-white/15 flex items-center justify-center shrink-0">
                <User className="h-6 w-6" aria-hidden />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold leading-tight">{t('profile.guestTitle', 'Invitado')}</p>
                <p className="text-xs text-white/85 mt-0.5">{t('profile.loginRequiredDesc')}</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                <Button asChild variant="secondary" size="sm" className="min-h-11">
                  <Link to="/auth" aria-label={t('profile.login')}>{t('profile.login')}</Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="min-h-11 bg-transparent border-white/40 text-white hover:bg-white/10">
                  <Link to="/auth?mode=signup" aria-label={t('profile.signup')}>{t('profile.signup')}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

      </header>

      <main className="p-4 -mt-6 space-y-4">
        {/* Appearance - Theme */}
        <Card className="rounded-2xl shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Palette className="h-4 w-4" />
              {t('profile.appearance')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ThemeSelector />
          </CardContent>
        </Card>

        {/* Language */}
        <Card className="rounded-2xl shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4" />
              {t('profile.language')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LanguageSelector />
          </CardContent>
        </Card>

        {/* Menu Items */}
        <Card className="rounded-2xl shadow-soft">
          <CardContent className="p-0">
            {menuItems.map((item, index) => {
              const needsLogin = item.requiresAuth && !isAuthenticated;
              return (
                <div key={item.to}>
                  <Link
                    to={needsLogin ? '/auth' : item.to}
                    className="flex items-center gap-3 p-4 min-h-[56px] hover:bg-muted focus-visible:bg-muted focus-visible:outline-none transition-colors"
                    aria-label={needsLogin ? `${item.label} — ${t('profile.loginRequired')}` : item.label}
                  >
                    <span className={cn(
                      'h-9 w-9 rounded-full flex items-center justify-center shrink-0',
                      needsLogin ? 'bg-primary/10 text-primary' : 'bg-muted text-foreground'
                    )}>
                      <item.icon className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="font-medium">{item.label}</span>
                    {needsLogin ? (
                      <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 rounded-full px-2 py-1">
                        <Lock className="h-3 w-3" aria-hidden />
                        {t('profile.loginRequired')}
                      </span>
                    ) : (
                      <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" aria-hidden />
                    )}
                  </Link>
                  {index < menuItems.length - 1 && <Separator />}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Logout */}
        {isAuthenticated && (
          <Button
            variant="outline"
            className="w-full min-h-11 text-destructive hover:text-destructive"
            onClick={handleLogout}
            aria-label={t('profile.logout')}
          >
            <LogOut className="h-4 w-4 mr-2" aria-hidden />
            {t('profile.logout')}
          </Button>
        )}
      </main>
    </div>

  );
};

export default ProfilePage;
