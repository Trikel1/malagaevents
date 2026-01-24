import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { User, Settings, LogIn, LogOut, Bell, Globe, Ticket, PlusCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import LanguageSelector from '@/components/common/LanguageSelector';

const ProfilePage = () => {
  const { t } = useTranslation();
  const [isLoggedIn] = useState(false); // Will be connected to auth later

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
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground p-6 pb-12 rounded-b-3xl">
        <h1 className="text-xl font-bold mb-4">{t('profile.title')}</h1>
        
        {isLoggedIn ? (
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary-foreground/20 flex items-center justify-center">
              <User className="h-8 w-8" />
            </div>
            <div>
              <p className="font-semibold">Usuario</p>
              <p className="text-sm opacity-80">usuario@ejemplo.com</p>
            </div>
          </div>
        ) : (
          <Card className="bg-white/10 border-0">
            <CardContent className="p-4 text-center">
              <User className="h-12 w-12 mx-auto mb-3 opacity-80" />
              <p className="mb-3 text-sm">{t('profile.loginRequiredDesc')}</p>
              <div className="flex gap-2 justify-center">
                <Button asChild variant="secondary" size="sm">
                  <Link to="/auth">{t('profile.login')}</Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="bg-transparent border-white/30 hover:bg-white/10">
                  <Link to="/auth?mode=signup">{t('profile.signup')}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </header>

      <main className="p-4 -mt-6 space-y-4">
        {/* Language */}
        <Card>
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
        <Card>
          <CardContent className="p-0">
            {menuItems.map((item, index) => (
              <div key={item.to}>
                {item.requiresAuth && !isLoggedIn ? (
                  <Link
                    to="/auth"
                    className="flex items-center gap-3 p-4 hover:bg-muted transition-colors"
                  >
                    <item.icon className="h-5 w-5 text-muted-foreground" />
                    <span>{item.label}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {t('profile.loginRequired')}
                    </span>
                  </Link>
                ) : (
                  <Link
                    to={item.to}
                    className="flex items-center gap-3 p-4 hover:bg-muted transition-colors"
                  >
                    <item.icon className="h-5 w-5 text-muted-foreground" />
                    <span>{item.label}</span>
                  </Link>
                )}
                {index < menuItems.length - 1 && <Separator />}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Logout */}
        {isLoggedIn && (
          <Button variant="outline" className="w-full text-destructive hover:text-destructive">
            <LogOut className="h-4 w-4 mr-2" />
            {t('profile.logout')}
          </Button>
        )}
      </main>
    </div>
  );
};

export default ProfilePage;
