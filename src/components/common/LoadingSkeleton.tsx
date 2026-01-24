import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

export const EventCardSkeleton = () => (
  <Card className="overflow-hidden">
    <Skeleton className="h-40 w-full" />
    <CardContent className="p-3 space-y-2">
      <Skeleton className="h-5 w-16" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </CardContent>
  </Card>
);

export const EventListSkeleton = ({ count = 4 }: { count?: number }) => (
  <div className="space-y-4">
    {Array.from({ length: count }).map((_, i) => (
      <EventCardSkeleton key={i} />
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
