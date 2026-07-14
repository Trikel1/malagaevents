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
import PageHero from '@/components/common/PageHero';
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
      label: t('profile.adminPanel', 'Panel de administración'),
      to: '/admin',
      requiresAuth: true,
    }] : []),
  ];

  return (
    <div className="min-h-dvh bg-background">
      <SEO
        title={t('seo.profile.title')}
        description={t('seo.profile.description')}
        path="/profile"
        noindex
      />
      <PageHero
        variant="compact"
        icon={<User className="h-5 w-5" aria-hidden />}
        title={t('profile.title')}
      >
        {isLoading ? (
          <div className="h-20 animate-pulse bg-muted rounded-2xl" />
        ) : isAuthenticated && user ? (
          <div className="flex items-center gap-4 rounded-2xl bg-card border border-border shadow-sm p-4">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <User className="h-7 w-7 text-primary" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="font-display font-semibold text-lg tracking-tight truncate">
                {user.user_metadata?.display_name || t('profile.user', 'Usuario')}
              </p>
              <p className="text-sm text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
        ) : (
          <Card className="rounded-2xl bg-card border border-border shadow-sm">
            <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User className="h-6 w-6 text-primary" aria-hidden />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold text-base leading-tight">{t('profile.guestTitle', 'Invitado')}</p>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{t('profile.loginRequiredDesc')}</p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <Button asChild className="min-h-11 font-semibold">
                  <Link to="/auth" aria-label={t('profile.login')}>{t('profile.login')}</Link>
                </Button>
                <Button asChild variant="outline" className="min-h-11">
                  <Link to="/auth?mode=signup" aria-label={t('profile.signup')}>{t('profile.signup')}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </PageHero>

      <main className="mx-auto w-full max-w-[840px] px-4 sm:px-6 lg:px-8 py-6 space-y-4">
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
