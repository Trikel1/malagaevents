import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MultiSelect, type MultiSelectOption } from '@/components/ui/adaptive';
import { useVenues } from '@/hooks/useVenues';

interface VenueFilterProps {
  selectedVenueIds: string[];
  onSelectionChange: (venueIds: string[]) => void;
}

const VenueFilter = ({ selectedVenueIds, onSelectionChange }: VenueFilterProps) => {
  const { t } = useTranslation();
  const { data: venues = [], isLoading } = useVenues();

  const options: MultiSelectOption<string>[] = useMemo(
    () =>
      venues.map((v) => ({
        value: v.id,
        label: v.name,
        hint: v.city ?? undefined,
        aliases: v.city ? [v.city] : undefined,
      })),
    [venues],
  );

  const selectedVenues = useMemo(
    () => venues.filter((v) => selectedVenueIds.includes(v.id)),
    [venues, selectedVenueIds],
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <MultiSelect
        values={selectedVenueIds}
        onValuesChange={onSelectionChange}
        options={options}
        title={t('events.venues', 'Salas')}
        ariaLabel={t('events.venues', 'Salas')}
        triggerLabel={t('events.venues', 'Salas')}
        triggerIcon={<Building2 className="h-4 w-4 shrink-0" aria-hidden="true" />}
        loading={isLoading}
      />

      {selectedVenues.map((venue) => (
        <Badge key={venue.id} variant="secondary" className="gap-1 pr-1">
          {venue.name}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t('common.close', 'Cerrar')}
            className="h-5 w-5 min-h-0 min-w-0 p-0 hover:bg-transparent"
            onClick={() => onSelectionChange(selectedVenueIds.filter((id) => id !== venue.id))}
          >
            ×
          </Button>
        </Badge>
      ))}
    </div>
  );
};

export default VenueFilter;
