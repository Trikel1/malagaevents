import { useState } from 'react';
import SEO from '@/components/common/SEO';
import SportsHero from '@/components/sports/SportsHero';
import SportsContent from '@/components/sports/SportsContent';
import { useTranslation } from 'react-i18next';

const SportsEventsPage = () => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={t('sports.seo.title', 'Deporte en Málaga · Agenda, competiciones y recintos')}
        description={t(
          'sports.seo.description',
          'Agenda deportiva de Málaga: competiciones, actividades, entrenamientos y recintos deportivos en la ciudad y la provincia.',
        )}
        path="/sports"
      />

      <SportsHero value={search} onChange={setSearch} />

      <div className="mx-auto w-full max-w-[1180px] px-4 lg:px-8 py-6 lg:py-8">
        <SportsContent
          externalSearch={search}
          onClearExternalSearch={() => setSearch('')}
        />
      </div>
    </div>
  );
};

export default SportsEventsPage;
