import { useState, useMemo } from 'react';
import { Calendar, X, Music, Theater, PartyPopper, Mic2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

// Event type for category-specific fallbacks
export type EventType = 'music' | 'theater' | 'comedy' | 'festival' | 'nightlife' | 'other';

// Category-specific fallback configurations
const CATEGORY_FALLBACKS: Record<EventType, { 
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  label: string;
}> = {
  music: {
    icon: Music,
    gradient: 'from-violet-500/30 via-purple-500/20 to-fuchsia-500/30',
    label: 'Música',
  },
  theater: {
    icon: Theater,
    gradient: 'from-rose-500/30 via-red-500/20 to-orange-500/30',
    label: 'Teatro',
  },
  comedy: {
    icon: Mic2,
    gradient: 'from-amber-500/30 via-yellow-500/20 to-orange-500/30',
    label: 'Comedia',
  },
  festival: {
    icon: PartyPopper,
    gradient: 'from-cyan-500/30 via-teal-500/20 to-emerald-500/30',
    label: 'Festival',
  },
  nightlife: {
    icon: Sparkles,
    gradient: 'from-indigo-500/30 via-blue-500/20 to-purple-500/30',
    label: 'Noche',
  },
  other: {
    icon: Calendar,
    gradient: 'from-primary/20 to-secondary/20',
    label: 'Evento',
  },
};

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
  eventType?: EventType;
  category?: string;
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

// Image sizes per variant (width in pixels)
const IMAGE_SIZES: Record<EventImageVariant, { small: number; medium: number; large: number }> = {
  compact: { small: 96, medium: 192, large: 288 },
  card: { small: 320, medium: 640, large: 960 },
  list: { small: 320, medium: 640, large: 960 },
  grid: { small: 280, medium: 560, large: 840 },
  detail: { small: 640, medium: 1024, large: 1920 },
  hero: { small: 640, medium: 1280, large: 1920 },
};

// Sizes attribute per variant for responsive loading
const SIZES_ATTR: Record<EventImageVariant, string> = {
  compact: '96px',
  card: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 320px',
  list: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 320px',
  grid: '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 280px',
  detail: '100vw',
  hero: '100vw',
};

// Detect image provider and generate optimized URL
const getOptimizedUrl = (src: string, width: number, quality: number = 80): string | null => {
  try {
    const url = new URL(src);
    
    // Unsplash - supports w, q, fit params
    if (url.hostname.includes('unsplash.com') || url.hostname.includes('images.unsplash.com')) {
      url.searchParams.set('w', width.toString());
      url.searchParams.set('q', quality.toString());
      url.searchParams.set('fit', 'crop');
      url.searchParams.set('auto', 'format');
      return url.toString();
    }
    
    // Cloudinary - supports transformation params
    if (url.hostname.includes('cloudinary.com')) {
      const pathParts = url.pathname.split('/upload/');
      if (pathParts.length === 2) {
        const transformations = `w_${width},q_${quality},c_fill,f_auto`;
        url.pathname = `${pathParts[0]}/upload/${transformations}/${pathParts[1]}`;
        return url.toString();
      }
    }
    
    // Supabase Storage - supports transform params
    if (url.hostname.includes('supabase')) {
      url.searchParams.set('width', width.toString());
      url.searchParams.set('quality', quality.toString());
      return url.toString();
    }
    
    // Imgix - supports w, q params
    if (url.hostname.includes('imgix.net')) {
      url.searchParams.set('w', width.toString());
      url.searchParams.set('q', quality.toString());
      url.searchParams.set('auto', 'format');
      return url.toString();
    }
    
    // For other providers, return null (use original)
    return null;
  } catch {
    return null;
  }
};

// Generate srcset for responsive images
const generateSrcSet = (src: string, variant: EventImageVariant): string | undefined => {
  const sizes = IMAGE_SIZES[variant];
  const srcSetParts: string[] = [];
  
  // Try to generate optimized URLs for each size
  const smallUrl = getOptimizedUrl(src, sizes.small);
  const mediumUrl = getOptimizedUrl(src, sizes.medium);
  const largeUrl = getOptimizedUrl(src, sizes.large);
  
  if (smallUrl) srcSetParts.push(`${smallUrl} ${sizes.small}w`);
  if (mediumUrl) srcSetParts.push(`${mediumUrl} ${sizes.medium}w`);
  if (largeUrl) srcSetParts.push(`${largeUrl} ${sizes.large}w`);
  
  // If we couldn't generate any optimized URLs, return undefined
  if (srcSetParts.length === 0) return undefined;
  
  return srcSetParts.join(', ');
};

// Get the best default src for the variant
const getDefaultSrc = (src: string, variant: EventImageVariant): string => {
  const sizes = IMAGE_SIZES[variant];
  // Use medium size as default for good balance
  const optimizedUrl = getOptimizedUrl(src, sizes.medium);
  return optimizedUrl || src;
};

// Helper to determine event type from category string
const getEventTypeFromCategory = (category?: string): EventType => {
  if (!category) return 'other';
  const cat = category.toLowerCase();
  if (cat.includes('music') || cat.includes('concierto') || cat.includes('música')) return 'music';
  if (cat.includes('theater') || cat.includes('teatro')) return 'theater';
  if (cat.includes('comedy') || cat.includes('comedia') || cat.includes('humor')) return 'comedy';
  if (cat.includes('festival')) return 'festival';
  if (cat.includes('nightlife') || cat.includes('noche') || cat.includes('fiesta') || cat.includes('party')) return 'nightlife';
  return 'other';
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
  eventType,
  category,
}: EventImageProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  
  // Determine the event type for fallback styling
  const resolvedEventType: EventType = eventType || getEventTypeFromCategory(category);

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

  // Generate srcset and optimized src
  const { srcSet, optimizedSrc, sizesAttr } = useMemo(() => {
    if (!src) return { srcSet: undefined, optimizedSrc: undefined, sizesAttr: undefined };
    
    return {
      srcSet: generateSrcSet(src, variant),
      optimizedSrc: getDefaultSrc(src, variant),
      sizesAttr: SIZES_ATTR[variant],
    };
  }, [src, variant]);

  // Fallback placeholder component with category-specific styling
  const FallbackPlaceholder = () => {
    if (fallback) return <>{fallback}</>;
    
    const config = CATEGORY_FALLBACKS[resolvedEventType];
    const IconComponent = config.icon;
    
    return (
      <div className={cn(
        "w-full h-full flex flex-col items-center justify-center bg-gradient-to-br",
        config.gradient
      )}>
        <IconComponent className="h-12 w-12 text-foreground/40 mb-2" />
        <span className="text-xs font-medium text-foreground/50 uppercase tracking-wider">
          {config.label}
        </span>
      </div>
    );
  };

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
          src={optimizedSrc || src}
          srcSet={srcSet}
          sizes={srcSet ? sizesAttr : undefined}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={priority ? 'high' : 'auto'}
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
    // For lightbox, use the largest available size
    const lightboxSrc = src ? (getOptimizedUrl(src, IMAGE_SIZES.detail.large, 90) || src) : src;
    
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
                src={lightboxSrc!}
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
