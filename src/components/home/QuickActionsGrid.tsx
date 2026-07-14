import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Calendar, Baby, Pill, Map as MapIcon, Heart, type LucideIcon } from 'lucide-react';

interface QuickAction {
  k: string;
  icon: LucideIcon;
  to: string;
}

const QUICK_ACTIONS: readonly QuickAction[] = [
  { k: 'today', icon: Sparkles, to: '/events?filter=today' },
  { k: 'weekend', icon: Calendar, to: '/events?filter=weekend' },
  { k: 'family', icon: Baby, to: '/events?filter=family' },
  { k: 'pharmacies', icon: Pill, to: '/pharmacies' },
  { k: 'map', icon: MapIcon, to: '/map' },
  { k: 'free', icon: Heart, to: '/events?filter=free' },
];

const QuickActionsGrid = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <section aria-label={t('home.quickActions.aria')}>
      <div className="grid grid-cols-3 gap-2.5 lg:grid-cols-6">
        {QUICK_ACTIONS.map((qa) => (
          <button
            key={qa.k}
            onClick={() => navigate(qa.to)}
            className="group flex flex-col items-center justify-center gap-1.5 rounded-2xl py-3 px-2 min-h-[76px] bg-card border border-border shadow-soft hover:border-primary/40 hover:shadow-card transition-[transform,box-shadow,border-color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
          >
            <qa.icon className="h-5 w-5 text-primary" aria-hidden />
            <span className="text-[12px] font-semibold text-foreground leading-tight text-center">
              {t(`home.quickActions.${qa.k}`)}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
};

export default QuickActionsGrid;
