import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { EventImageSkeleton } from '@/components/events/EventImage';

export const EventCardSkeleton = ({ compact = false }: { compact?: boolean }) => (
  <Card className={compact ? 'flex-row flex overflow-hidden' : 'overflow-hidden'}>
    <EventImageSkeleton variant={compact ? 'compact' : 'card'} />
    <CardContent className={compact ? 'p-3 flex-1 flex flex-col justify-center space-y-2' : 'p-3 space-y-2'}>
      <Skeleton className="h-5 w-16" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </CardContent>
  </Card>
);

export const EventListSkeleton = ({ count = 4, compact = false }: { count?: number; compact?: boolean }) => (
  <div className="space-y-4">
    {Array.from({ length: count }).map((_, i) => (
      <EventCardSkeleton key={i} compact={compact} />
    ))}
  </div>
);

export const PharmacyCardSkeleton = () => (
  <Card>
    <CardContent className="p-4 space-y-2">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-1/3" />
    </CardContent>
  </Card>
);
