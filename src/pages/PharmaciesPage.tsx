import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { es, enUS, de, fr, it, pt, ja, zhCN, ru, type Locale } from 'date-fns/locale';
import { Phone, MapPin, Calendar as CalendarIcon, Clock, Building2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import EmptyState from '@/components/common/EmptyState';
import { PharmacyCardSkeleton } from '@/components/common/LoadingSkeleton';
import { usePharmaciesOnDuty, usePharmacyDirectory } from '@/hooks/usePharmacies';
import type { Pharmacy } from '@/types';

const locales: Record<string, Locale> = {
  es, en: enUS, de, fr, it, pt, ja, zh: zhCN, ru
};

// Helper to generate maps URL
const getMapsUrl = (pharmacy: { lat?: number | null; lng?: number | null; address: string }): string => {
  if (pharmacy.lat && pharmacy.lng) {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    return isIOS
      ? `maps://maps.apple.com/?daddr=${pharmacy.lat},${pharmacy.lng}`
      : `https://www.google.com/maps/search/?api=1&query=${pharmacy.lat},${pharmacy.lng}`;
  }
  const fullAddress = `${pharmacy.address}, Málaga, España`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
};

const formatPhoneForLink = (phone: string): string => {
  return phone.replace(/[^\d+]/g, '');
};

interface PharmacyCardProps {
  pharmacy: { name: string; address: string; phone?: string | null; lat?: number | null; lng?: number | null; municipality?: string };
  showDutyBadge?: boolean;
}

const PharmacyCard = ({ pharmacy, showDutyBadge = false }: PharmacyCardProps) => {
  const { t } = useTranslation();
  return (
  <Card className={`overflow-hidden ${showDutyBadge ? 'border-green-500/40 ring-1 ring-green-500/20' : ''}`}>
    <CardContent className="p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-semibold text-lg leading-tight">{pharmacy.name}</h3>
        {showDutyBadge && (
          <Badge className="bg-green-500 hover:bg-green-500 text-white shrink-0">
            <Clock className="h-3 w-3 mr-1" />
            {t('pharmacies.onDuty', 'De guardia')}
          </Badge>
        )}
      </div>

      {pharmacy.municipality && pharmacy.municipality !== 'Málaga' && (
        <div className="flex items-center gap-1 mb-2">
          <Building2 className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-medium">{pharmacy.municipality}</span>
        </div>
      )}

      <a
        href={getMapsUrl(pharmacy)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-start gap-2 text-muted-foreground mb-3 hover:text-foreground transition-colors group"
      >
        <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary group-hover:scale-110 transition-transform" />
        <span className="text-sm underline decoration-dotted underline-offset-2 group-hover:decoration-solid">
          {pharmacy.address}
        </span>
      </a>

      {pharmacy.phone && (
        <a
          href={`tel:${formatPhoneForLink(pharmacy.phone)}`}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group"
        >
          <Phone className="h-4 w-4 flex-shrink-0 text-green-600 group-hover:scale-110 transition-transform" />
          <span className="text-sm underline decoration-dotted underline-offset-2 group-hover:decoration-solid font-medium">
            {pharmacy.phone}
          </span>
        </a>
      )}
    </CardContent>
  </Card>
  );
};

const PharmaciesPage = () => {
  const { t, i18n } = useTranslation();
  const locale = locales[i18n.language] || es;
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<'duty' | 'all'>('duty');

  const { data: dutyPharmacies, isLoading: isLoadingDuty } = usePharmaciesOnDuty(selectedDate);
  const { data: directoryPharmacies, isLoading: isLoadingDirectory } = usePharmacyDirectory();

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 pb-8 rounded-b-3xl">
        <h1 className="text-xl font-bold mb-4">{t('pharmacies.title')}</h1>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'duty' | 'all')} className="mb-4">
          <TabsList className="grid w-full grid-cols-2 bg-white/20">
            <TabsTrigger
              value="duty"
              className="text-white/90 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm"
            >
              <Clock className="h-4 w-4 mr-2" />
              {t('pharmacies.onDuty')}
            </TabsTrigger>
            <TabsTrigger
              value="all"
              className="text-white/90 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm"
            >
              <Building2 className="h-4 w-4 mr-2" />
              {t('pharmacies.all')}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Date Selector (only for duty tab) */}
        {activeTab === 'duty' && (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setSelectedDate(new Date())}
              className="bg-white/20 hover:bg-white/30 text-white border-0"
            >
              {t('pharmacies.today')}
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="secondary"
                  className="flex-1 bg-white/20 hover:bg-white/30 text-white border-0 justify-start"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(selectedDate, 'PPP', { locale })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 z-50 bg-popover" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        )}
      </header>

      {/* Content */}
      <main className="p-4 -mt-4 space-y-3">
        {activeTab === 'duty' ? (
          isLoadingDuty ? (
            <>
              <PharmacyCardSkeleton />
              <PharmacyCardSkeleton />
              <PharmacyCardSkeleton />
            </>
          ) : dutyPharmacies && dutyPharmacies.length > 0 ? (
            <>
              <p className="text-sm text-muted-foreground mb-2">
                {t('pharmacies.dutyCount', { count: dutyPharmacies.length })}
              </p>
              {dutyPharmacies.map((pharmacy) => (
                <PharmacyCard
                  key={pharmacy.id}
                  pharmacy={{ ...pharmacy, municipality: (pharmacy as any).municipality }}
                  showDutyBadge
                />
              ))}
            </>
          ) : (
            <EmptyState
              icon={AlertTriangle}
              title={t('pharmacies.noPharmacies')}
              description={t('pharmacies.noPharmaciesDesc', 'No se encontraron farmacias de guardia para esta fecha. Puede que los datos no estén disponibles aún.')}
              actionLabel={t('common.retry', 'Reintentar')}
              onAction={() => window.location.reload()}
              variant="error"
            />
          )
        ) : (
          isLoadingDirectory ? (
            <>
              <PharmacyCardSkeleton />
              <PharmacyCardSkeleton />
              <PharmacyCardSkeleton />
            </>
          ) : directoryPharmacies && directoryPharmacies.length > 0 ? (
            <>
              <p className="text-sm text-muted-foreground mb-2">
                {t('pharmacies.totalCount', { count: directoryPharmacies.length })}
              </p>
              {directoryPharmacies.map((pharmacy) => (
                <PharmacyCard
                  key={pharmacy.id}
                  pharmacy={pharmacy}
                />
              ))}
            </>
          ) : (
            <EmptyState
              icon={AlertTriangle}
              title={t('pharmacies.noPharmacies')}
              description={t('pharmacies.directoryEmpty', 'El directorio de farmacias aún no ha sido cargado. Inténtalo más tarde.')}
              actionLabel={t('common.retry', 'Reintentar')}
              onAction={() => window.location.reload()}
              variant="error"
            />
          )
        )}
      </main>
    </div>
  );
};

export default PharmaciesPage;
