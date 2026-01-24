import { useState, useMemo } from 'react';
import { Calendar, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export type EventImageVariant = 'card' | 'list' | 'grid' | 'detail' | 'hero' | 'compact';

interface EventImageProps {
  src?: string | null;
  alt: string;
  variant?: EventImageVariant;
  aspectRatio?: string;
  fallback?: React.ReactNode;
  className?: string;
  showLightbox?: boolean;
  priority?: boolean;
}

// Aspect ratios per variant (16:9 for consistency)
const ASPECT_RATIOS: Record<EventImageVariant, string> = {
  card: '16/9',
  list: '16/9',
  grid: '16/9',
  detail: '16/9',
  hero: '21/9',
  compact: '1/1',
};

// Container classes per variant
const VARIANT_CLASSES: Record<EventImageVariant, string> = {
  card: 'w-full',
  list: 'w-full',
  grid: 'w-full',
  detail: 'w-full',
  hero: 'w-full',
  compact: 'w-24 h-24 flex-shrink-0',
};

const EventImage = ({
  src,
  alt,
  variant = 'card',
  aspectRatio,
  fallback,
  className,
  showLightbox = false,
  priority = false,
}: EventImageProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const finalAspectRatio = aspectRatio || ASPECT_RATIOS[variant];
  const isCompact = variant === 'compact';

  // Determine if we should show the image
  const shouldShowImage = src && !hasError;

  // Handle image load
  const handleLoad = () => {
    setIsLoading(false);
  };

  // Handle image error
  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  // Generate srcset for responsive images
  const srcSet = useMemo(() => {
    if (!src) return undefined;
    
    // If it's a Supabase storage URL or supports transformations, we could add srcset
    // For now, we return undefined as external images may not support this
    return undefined;
  }, [src]);

  // Fallback placeholder component
  const FallbackPlaceholder = () => (
    fallback || (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/20">
        <Calendar className="h-10 w-10 text-muted-foreground/50" />
      </div>
    )
  );

  // Loading skeleton
  const LoadingSkeleton = () => (
    <Skeleton className="absolute inset-0 w-full h-full" />
  );

  const containerStyle = isCompact 
    ? {} 
    : { aspectRatio: finalAspectRatio };

  const imageElement = (
    <div
      className={cn(
        'relative bg-muted overflow-hidden',
        VARIANT_CLASSES[variant],
        className
      )}
      style={containerStyle}
    >
      {/* Loading skeleton - shown while loading */}
      {isLoading && shouldShowImage && <LoadingSkeleton />}

      {/* Main image */}
      {shouldShowImage ? (
        <img
          src={src}
          alt={alt}
          srcSet={srcSet}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            'w-full h-full object-cover object-center transition-opacity duration-300',
            isLoading ? 'opacity-0' : 'opacity-100',
            showLightbox && 'cursor-pointer'
          )}
          onClick={showLightbox ? () => setIsLightboxOpen(true) : undefined}
        />
      ) : (
        <FallbackPlaceholder />
      )}
    </div>
  );

  // If lightbox is enabled, wrap with dialog
  if (showLightbox && shouldShowImage) {
    return (
      <>
        {imageElement}
        <Dialog open={isLightboxOpen} onOpenChange={setIsLightboxOpen}>
          <DialogContent className="max-w-4xl w-full p-0 bg-black/95 border-0">
            <DialogClose asChild>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 z-10 text-white hover:bg-white/20"
              >
                <X className="h-5 w-5" />
              </Button>
            </DialogClose>
            <div className="flex items-center justify-center min-h-[50vh] max-h-[90vh] p-4">
              <img
                src={src!}
                alt={alt}
                className="max-w-full max-h-full object-contain"
              />
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return imageElement;
};

export default EventImage;

// Skeleton component for loading states
export const EventImageSkeleton = ({ 
  variant = 'card',
  className 
}: { 
  variant?: EventImageVariant;
  className?: string;
}) => {
  const isCompact = variant === 'compact';
  const aspectRatio = ASPECT_RATIOS[variant];

  return (
    <Skeleton 
      className={cn(
        VARIANT_CLASSES[variant],
        className
      )}
      style={isCompact ? {} : { aspectRatio }}
    />
  );
};
