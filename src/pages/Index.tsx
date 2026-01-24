import { useTranslation } from 'react-i18next';
import { Search, MapPin, Calendar, Pill, Heart } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { languages } from '@/i18n';
import { EVENT_CATEGORIES } from '@/types';

const Index = () => {
  const { t, i18n } = useTranslation();

  const quickActions = [
    { icon: Calendar, label: t('common.today'), color: 'bg-primary' },
    { icon: Calendar, label: t('common.thisWeekend'), color: 'bg-secondary' },
    { icon: MapPin, label: t('common.nearby'), color: 'bg-accent' },
    { icon: Pill, label: t('home.pharmaciesGuard'), color: 'bg-green-500' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground p-6 pb-12 rounded-b-3xl">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Málaga Events</h1>
          <select
            value={i18n.language}
            onChange={(e) => i18n.changeLanguage(e.target.value)}
            className="bg-primary-foreground/20 text-primary-foreground rounded-lg px-3 py-1 text-sm"
          >
            {languages.map((lang) => (
              <option key={lang.code} value={lang.code} className="text-foreground">
                {lang.flag} {lang.name}
              </option>
            ))}
          </select>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder={t('home.searchPlaceholder')}
            className="pl-10 bg-background text-foreground h-12 rounded-xl"
          />
        </div>
      </header>

      <main className="px-4 -mt-6 pb-24 space-y-6">
        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action, i) => (
            <Button
              key={i}
              variant="outline"
              className="h-auto py-4 flex flex-col gap-2 bg-card hover:bg-muted"
            >
              <action.icon className="h-6 w-6 text-primary" />
              <span className="text-sm font-medium">{action.label}</span>
            </Button>
          ))}
        </div>

        {/* Categories */}
        <section>
          <h2 className="text-lg font-semibold mb-3">{t('home.categories')}</h2>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {EVENT_CATEGORIES.map((cat) => (
              <Button
                key={cat}
                variant="secondary"
                size="sm"
                className="rounded-full whitespace-nowrap"
              >
                {t(`categories.${cat}`)}
              </Button>
            ))}
          </div>
        </section>

        {/* Today Events Placeholder */}
        <section>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold">{t('home.todayEvents')}</h2>
            <Button variant="link" size="sm" className="text-primary">
              {t('common.seeAll')}
            </Button>
          </div>
          <Card className="bg-muted/50 border-dashed">
            <CardContent className="py-8 text-center text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>{t('events.noEvents')}</p>
              <p className="text-sm">{t('events.noEventsDesc')}</p>
            </CardContent>
          </Card>
        </section>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border px-2 py-2 safe-area-pb">
        <div className="flex justify-around">
          {[
            { icon: Search, label: t('nav.home'), active: true },
            { icon: Calendar, label: t('nav.events') },
            { icon: Calendar, label: t('nav.calendar') },
            { icon: Pill, label: t('nav.pharmacies') },
            { icon: Heart, label: t('nav.profile') },
          ].map((item, i) => (
            <button
              key={i}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
                item.active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-xs">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default Index;
