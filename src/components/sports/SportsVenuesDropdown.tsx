import { useTranslation } from 'react-i18next';
import { Building2 } from 'lucide-react';
import { MultiSelect, type MultiSelectOption } from '@/components/ui/adaptive';
import { useSportsVenues } from '@/hooks/useSportsEvents';

interface SportsVenuesDropdownProps {
  selectedVenueNames: string[];
  onSelectionChange: (names: string[]) => void;
}

export function SportsVenuesDropdown({
  selectedVenueNames,
  onSelectionChange,
}: SportsVenuesDropdownProps) {
  const { t } = useTranslation();
  const { data: venues = [], isLoading, isError } = useSportsVenues();

  const options: MultiSelectOption<string>[] = venues.map((v) => ({
    value: v.name,
    label: v.name,
    hint: v.city,
  }));

  return (
    <MultiSelect
      values={selectedVenueNames}
      onValuesChange={onSelectionChange}
      options={options}
      title={t('sports.venuesTitle', 'Recintos')}
      ariaLabel={t('sports.venuesTitle', 'Recintos')}
      triggerLabel={t('sports.venuesTitle', 'Recintos')}
      triggerIcon={<Building2 className="h-4 w-4 shrink-0" aria-hidden="true" />}
      loading={isLoading}
      error={isError ? t('errors.generic', 'Error al cargar') : undefined}
      emptyLabel={t('sports.noVenues', 'No se encontraron recintos')}
    />
  );
}

export default SportsVenuesDropdown;
