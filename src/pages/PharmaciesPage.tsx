import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { es, enUS, de, fr, it, pt, ja, zhCN, ru, type Locale } from 'date-fns/locale';
import { Phone, MapPin, Calendar as CalendarIcon, Navigation, Filter, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import EmptyState from '@/components/common/EmptyState';
import { PharmacyCardSkeleton } from '@/components/common/LoadingSkeleton';
import { usePharmaciesOnDuty, useAllPharmacies } from '@/hooks/usePharmacies';
import type { Pharmacy } from '@/types';

const locales: Record<string, Locale> = {
  es, en: enUS, de, fr, it, pt, ja, zh: zhCN, ru
};

const PharmaciesPage = () => {
  const { t, i18n } = useTranslation();
  const locale = locales[i18n.language] || es;
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<'duty' | 'all'>('duty');

  // Fetch pharmacies
  const { data: dutyPharmacies, isLoading: isLoadingDuty } = usePharmaciesOnDuty(selectedDate);
  const { data: allPharmacies, isLoading: isLoadingAll } = useAllPharmacies();

  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone.replace(/\s/g, '')}`;
  };

  const handleDirections = (pharmacy: Pharmacy) => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    if (pharmacy.lat && pharmacy.lng) {
      // Use coordinates for accurate directions
      const url = isIOS
        ? `maps://maps.apple.com/?daddr=${pharmacy.lat},${pharmacy.lng}`
        : `https://www.google.com/maps/dir/?api=1&destination=${pharmacy.lat},${pharmacy.lng}`;
      window.open(url, '_blank');
    } else {
      // Fallback to address search
      const fullAddress = `${pharmacy.address}, Málaga, España`;
      const url = isIOS
        ? `maps://maps.apple.com/?daddr=${encodeURIComponent(fullAddress)}`
        : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddress)}`;
      window.open(url, '_blank');
    }
  };

  const PharmacyCard = ({ pharmacy, showDutyBadge = false }: { pharmacy: Pharmacy; showDutyBadge?: boolean }) => (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-lg">{pharmacy.name}</h3>
          {showDutyBadge && (
            <Badge className="bg-green-500 hover:bg-green-500 text-white shrink-0">
              <Clock className="h-3 w-3 mr-1" />
              {t('pharmacies.onDuty')}
            </Badge>
          )}
        </div>
        
        <div className="flex items-start gap-2 text-muted-foreground mb-3">
          <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span className="text-sm">{pharmacy.address}</span>
        </div>

        {pharmacy.phone && (
          <div className="flex items-center gap-2 text-muted-foreground mb-4">
            <Phone className="h-4 w-4 flex-shrink-0" />
            <span className="text-sm">{pharmacy.phone}</span>
          </div>
        )}

        <div className="flex gap-2">
          {pharmacy.phone && (
            <Button
              variant="default"
              size="sm"
              className="flex-1 bg-green-500 hover:bg-green-600"
              onClick={() => handleCall(pharmacy.phone!)}
            >
              <Phone className="h-4 w-4 mr-1" />
              {t('pharmacies.call')}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => handleDirections(pharmacy)}
          >
            <Navigation className="h-4 w-4 mr-1" />
            {t('pharmacies.directions')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 pb-8 rounded-b-3xl">
        <h1 className="text-xl font-bold mb-4">{t('pharmacies.title')}</h1>
        
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'duty' | 'all')} className="mb-4">
          <TabsList className="grid w-full grid-cols-2 bg-white/20">
            <TabsTrigger 
              value="duty" 
              className="data-[state=active]:bg-white data-[state=active]:text-green-600"
            >
              <Clock className="h-4 w-4 mr-2" />
              {t('pharmacies.onDuty')}
            </TabsTrigger>
            <TabsTrigger 
              value="all"
              className="data-[state=active]:bg-white data-[state=active]:text-green-600"
            >
              <Filter className="h-4 w-4 mr-2" />
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
          // Duty pharmacies
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
                <PharmacyCard key={pharmacy.id} pharmacy={pharmacy} showDutyBadge />
              ))}
            </>
          ) : (
            <EmptyState
              icon={MapPin}
              title={t('pharmacies.noPharmacies')}
              description={t('pharmacies.noPharmaciesDesc')}
            />
          )
        ) : (
          // All pharmacies
          isLoadingAll ? (
            <>
              <PharmacyCardSkeleton />
              <PharmacyCardSkeleton />
              <PharmacyCardSkeleton />
            </>
          ) : allPharmacies && allPharmacies.length > 0 ? (
            <>
              <p className="text-sm text-muted-foreground mb-2">
                {t('pharmacies.totalCount', { count: allPharmacies.length })}
              </p>
              {allPharmacies.map((pharmacy) => (
                <PharmacyCard key={pharmacy.id} pharmacy={pharmacy} />
              ))}
            </>
          ) : (
            <EmptyState
              icon={MapPin}
              title={t('pharmacies.noPharmacies')}
              description={t('pharmacies.noPharmaciesDesc')}
            />
          )
        )}
      </main>
    </div>
  );
};

export default PharmaciesPage;
