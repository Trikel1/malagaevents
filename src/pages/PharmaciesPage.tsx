import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { es, enUS, de, fr, it, pt, ja, zhCN, ru, type Locale } from 'date-fns/locale';
import { Phone, MapPin, Calendar as CalendarIcon, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import EmptyState from '@/components/common/EmptyState';
import { PharmacyCardSkeleton } from '@/components/common/LoadingSkeleton';
import type { Pharmacy } from '@/types';

const locales: Record<string, Locale> = {
  es, en: enUS, de, fr, it, pt, ja, zh: zhCN, ru
};

// Mock pharmacies
const mockPharmacies: Pharmacy[] = [
  {
    id: '1',
    name: 'Farmacia Central',
    address: 'Calle Larios 15, Málaga',
    phone: '+34 952 123 456',
    date_from: format(new Date(), 'yyyy-MM-dd'),
    date_to: format(new Date(), 'yyyy-MM-dd'),
    lat: 36.7213,
    lng: -4.4214,
    updated_at: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'Farmacia Plaza Mayor',
    address: 'Plaza de la Constitución 8, Málaga',
    phone: '+34 952 234 567',
    date_from: format(new Date(), 'yyyy-MM-dd'),
    date_to: format(new Date(), 'yyyy-MM-dd'),
    lat: 36.7220,
    lng: -4.4200,
    updated_at: new Date().toISOString(),
  },
  {
    id: '3',
    name: 'Farmacia El Carmen',
    address: 'Alameda Principal 42, Málaga',
    phone: '+34 952 345 678',
    date_from: format(new Date(), 'yyyy-MM-dd'),
    date_to: format(new Date(), 'yyyy-MM-dd'),
    lat: 36.7180,
    lng: -4.4250,
    updated_at: new Date().toISOString(),
  },
];

const PharmaciesPage = () => {
  const { t, i18n } = useTranslation();
  const locale = locales[i18n.language] || es;
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isLoading] = useState(false);

  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  const handleDirections = (pharmacy: Pharmacy) => {
    if (pharmacy.lat && pharmacy.lng) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${pharmacy.lat},${pharmacy.lng}`;
      window.open(url, '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 pb-8 rounded-b-3xl">
        <h1 className="text-xl font-bold mb-4">{t('pharmacies.title')}</h1>
        
        {/* Date Selector */}
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
      </header>

      {/* Content */}
      <main className="p-4 -mt-4 space-y-3">
        {isLoading ? (
          <>
            <PharmacyCardSkeleton />
            <PharmacyCardSkeleton />
            <PharmacyCardSkeleton />
          </>
        ) : mockPharmacies.length > 0 ? (
          mockPharmacies.map((pharmacy) => (
            <Card key={pharmacy.id} className="overflow-hidden">
              <CardContent className="p-4">
                <h3 className="font-semibold text-lg mb-2">{pharmacy.name}</h3>
                
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
          ))
        ) : (
          <EmptyState
            icon={MapPin}
            title={t('pharmacies.noPharmacies')}
            description={t('pharmacies.noPharmaciesDesc')}
          />
        )}
      </main>
    </div>
  );
};

export default PharmaciesPage;
