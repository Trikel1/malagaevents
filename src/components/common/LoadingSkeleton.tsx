import { forwardRef } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { EventImageSkeleton } from '@/components/events/EventImage';

export const EventCardSkeleton = forwardRef<HTMLDivElement, { compact?: boolean }>(
  ({ compact = false }, ref) => (
    <Card ref={ref} className={compact ? 'flex-row flex overflow-hidden' : 'overflow-hidden'}>
      <EventImageSkeleton variant={compact ? 'compact' : 'card'} />
      <CardContent className={compact ? 'p-3 flex-1 flex flex-col justify-center space-y-2' : 'p-3 space-y-2'}>
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </CardContent>
    </Card>
  )
);
EventCardSkeleton.displayName = 'EventCardSkeleton';

export const EventListSkeleton = forwardRef<HTMLDivElement, { count?: number; compact?: boolean }>(
  ({ count = 4, compact = false }, ref) => (
    <div ref={ref} className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <EventCardSkeleton key={i} compact={compact} />
      ))}
    </div>
  )
);
EventListSkeleton.displayName = 'EventListSkeleton';

export const PharmacyCardSkeleton = forwardRef<HTMLDivElement>((_, ref) => (
  <Card ref={ref}>
    <CardContent className="p-4 space-y-2">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-1/3" />
    </CardContent>
  </Card>
));
PharmacyCardSkeleton.displayName = 'PharmacyCardSkeleton';
