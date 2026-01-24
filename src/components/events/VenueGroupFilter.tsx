import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useVenues } from '@/hooks/useVenues';
import type { Venue } from '@/types';

export type VenueGroup = 'all' | 'theaters' | 'halls' | 'others';

interface VenueGroupFilterProps {
  selectedGroup: VenueGroup;
  onGroupChange: (group: VenueGroup) => void;
  onVenueIdsChange: (venueIds: string[]) => void;
}

// Venue classification by normalized name patterns
const THEATER_PATTERNS = [
  'teatro del soho',
  'teatro cervantes',
  'teatro echegaray',
  'factoria echegaray',
  'factoría echegaray',
  'la cochera cabaret',
  'cochera cabaret',
];

const HALL_PATTERNS = [
  'paris 15',
  'parís 15',
  'sala trinchera',
  'sala marte',
  'eventual',
  'antojo',
];

function classifyVenue(venue: Venue): VenueGroup {
  const name = venue.normalized_name?.toLowerCase() || venue.name?.toLowerCase() || '';
  
  if (THEATER_PATTERNS.some(pattern => name.includes(pattern))) {
    return 'theaters';
  }
  
  if (HALL_PATTERNS.some(pattern => name.includes(pattern))) {
    return 'halls';
  }
  
  return 'others';
}

const groups: { value: VenueGroup; labelKey: string }[] = [
  { value: 'all', labelKey: 'events.allVenues' },
  { value: 'theaters', labelKey: 'events.theaters' },
  { value: 'halls', labelKey: 'events.halls' },
  { value: 'others', labelKey: 'events.otherVenues' },
];

export function VenueGroupFilter({
  selectedGroup,
  onGroupChange,
  onVenueIdsChange,
}: VenueGroupFilterProps) {
  const { t } = useTranslation();
  const { data: venues = [] } = useVenues();

  // Classify all venues into groups
  const venuesByGroup = useMemo(() => {
    const grouped: Record<VenueGroup, string[]> = {
      all: [],
      theaters: [],
      halls: [],
      others: [],
    };

    venues.forEach((venue) => {
      const group = classifyVenue(venue);
      grouped[group].push(venue.id);
      grouped.all.push(venue.id);
    });

    return grouped;
  }, [venues]);

  const handleGroupChange = (group: VenueGroup) => {
    onGroupChange(group);
    
    if (group === 'all') {
      onVenueIdsChange([]); // Empty = no filter, show all
    } else {
      onVenueIdsChange(venuesByGroup[group]);
    }
  };

  return (
    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide py-1">
      {groups.map((group) => {
        const isActive = selectedGroup === group.value;
        const count = group.value === 'all' ? null : venuesByGroup[group.value].length;
        
        return (
          <Button
            key={group.value}
            variant={isActive ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleGroupChange(group.value)}
            className={cn(
              'shrink-0 text-xs h-8 px-3',
              isActive && 'shadow-sm'
            )}
          >
            {t(group.labelKey)}
            {count !== null && count > 0 && (
              <span className={cn(
                'ml-1.5 text-[10px] font-medium',
                isActive ? 'text-primary-foreground/80' : 'text-muted-foreground'
              )}>
                ({count})
              </span>
            )}
          </Button>
        );
      })}
    </div>
  );
}
