import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { EVENT_CATEGORIES } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import SEO from '@/components/common/SEO';

const SubmitEventPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const errorSummaryRef = useRef<HTMLDivElement | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    start_at: '',
    end_at: '',
    venue_name: '',
    address: '',
    ticket_url: '',
    price_info: '',
    is_free: false,
    image_url: '',
    age_restriction: '',
    accessibility_info: '',
    capacity_info: '',
    tags: '',
    email: '',
  });

  const isDirty = useMemo(() => {
    return (
      !!formData.title || !!formData.description || !!formData.category || !!formData.start_at ||
      !!formData.venue_name || !!formData.address || !!formData.email || !!formData.tags ||
      !!formData.ticket_url || !!formData.image_url || !!formData.price_info
    );
  }, [formData]);

  // Warn on tab close / reload if there are unsaved changes
  useEffect(() => {
    if (!isDirty || submitted) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty, submitted]);

  const guardedBack = () => {
    if (
      isDirty &&
      !submitted &&
      !window.confirm(t('submitEvent.confirmDiscard', '¿Descartar los datos sin guardar?'))
    ) {
      return;
    }
    navigate(-1);
  };

  const validate = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!formData.title.trim() || formData.title.trim().length < 3)
      errs.title = t('submitEvent.errors.titleShort', 'El título debe tener al menos 3 caracteres.');
    if (!formData.description.trim() || formData.description.trim().length < 10)
      errs.description = t('submitEvent.errors.descriptionShort', 'Describe el evento con más detalle (mín. 10 caracteres).');
    if (!formData.category)
      errs.category = t('submitEvent.errors.categoryRequired', 'Selecciona una categoría.');
    if (!formData.start_at)
      errs.start_at = t('submitEvent.errors.startRequired', 'Indica la fecha y hora de inicio.');
    if (!formData.venue_name.trim())
      errs.venue_name = t('submitEvent.errors.venueRequired', 'Indica el recinto o lugar.');
    if (!formData.address.trim())
      errs.address = t('submitEvent.errors.addressRequired', 'Indica la dirección.');
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      errs.email = t('submitEvent.errors.emailInvalid', 'Introduce un email de contacto válido.');
    return errs;
  };

  const focusFirstError = (errs: Record<string, string>) => {
    const first = Object.keys(errs)[0];
    if (!first) return;
    // small delay to ensure summary renders first (a11y)
    requestAnimationFrame(() => {
      errorSummaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      document.getElementById(first)?.focus();
    });
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return; // Block double submit

    const errs = validate();
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) {
      setError(t('submitEvent.errors.reviewFields', 'Revisa los campos marcados para continuar.'));
      focusFirstError(errs);
      return;
    }

    setIsLoading(true);
    setError(null);


    try {
      // Parse tags
      const tags = formData.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      const payload = {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        start_at: new Date(formData.start_at).toISOString(),
        end_at: formData.end_at ? new Date(formData.end_at).toISOString() : undefined,
        venue_name: formData.venue_name,
        address: formData.address,
        ticket_url: formData.ticket_url || undefined,
        price_info: formData.price_info || undefined,
        is_free: formData.is_free,
        image_url: formData.image_url || undefined,
        age_restriction: formData.age_restriction || undefined,
        accessibility_info: formData.accessibility_info || undefined,
        capacity_info: formData.capacity_info || undefined,
        tags: tags.length > 0 ? tags : undefined,
        email: formData.email,
      };

      const { data, error: fnError } = await supabase.functions.invoke('submit-event', {
        body: payload,
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Unknown error');
      }

      setSubmitted(true);
      toast({
        title: t('submitEvent.success'),
        description: t('submitEvent.successDesc'),
      });
    } catch (err) {
      console.error('Error submitting event:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      toast({
        title: t('submitEvent.error'),
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-6">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">{t('submitEvent.success')}</h2>
            <p className="text-muted-foreground mb-6">{t('submitEvent.successDesc')}</p>
            <Button onClick={() => navigate('/')} className="w-full">
              {t('common.back')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      <SEO
        title="Enviar un evento de Málaga"
        description="¿Organizas un evento en Málaga? Envíanos los detalles y lo añadimos a la agenda tras revisarlo. Gratuito y abierto a la comunidad."
        path="/submit-event"
      />
      {/* Header */}
      <header className="p-4 flex items-center gap-3 border-b border-border sticky top-0 bg-background z-40">
        <Button
          variant="ghost"
          size="icon"
          onClick={guardedBack}
          className="h-11 w-11"
          aria-label={t('common.back', 'Volver')}
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Button>
        <div>
          <h1 className="text-xl font-bold">{t('submitEvent.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('submitEvent.subtitle')}</p>
        </div>
      </header>

      <main className="p-4">
        {(error || Object.keys(fieldErrors).length > 0) && (
          <div ref={errorSummaryRef} role="alert" aria-live="assertive">
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" aria-hidden />
              <AlertTitle>{t('submitEvent.error')}</AlertTitle>
              <AlertDescription>
                {error}
                {Object.keys(fieldErrors).length > 0 && (
                  <ul className="mt-2 list-disc pl-5 text-sm">
                    {Object.entries(fieldErrors).map(([field, msg]) => (
                      <li key={field}>
                        <a
                          href={`#${field}`}
                          onClick={(ev) => {
                            ev.preventDefault();
                            document.getElementById(field)?.focus();
                          }}
                          className="underline underline-offset-2"
                        >
                          {msg}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </AlertDescription>
            </Alert>
          </div>
        )}


        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Información básica</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">{t('submitEvent.eventTitle')} *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  minLength={3}
                  maxLength={200}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{t('submitEvent.eventDescription')} *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  required
                  minLength={10}
                  maxLength={2000}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('submitEvent.eventCategory')} *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('events.category')} />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {EVENT_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {t(`categories.${cat}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Date & Location */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Fecha y lugar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_at">{t('submitEvent.startDate')} *</Label>
                  <Input
                    id="start_at"
                    type="datetime-local"
                    value={formData.start_at}
                    onChange={(e) => setFormData({ ...formData, start_at: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_at">{t('submitEvent.endDate')}</Label>
                  <Input
                    id="end_at"
                    type="datetime-local"
                    value={formData.end_at}
                    onChange={(e) => setFormData({ ...formData, end_at: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="venue_name">{t('submitEvent.venueName')} *</Label>
                <Input
                  id="venue_name"
                  value={formData.venue_name}
                  onChange={(e) => setFormData({ ...formData, venue_name: e.target.value })}
                  required
                  minLength={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">{t('submitEvent.address')} *</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  required
                  minLength={5}
                />
              </div>
            </CardContent>
          </Card>

          {/* Price & Tickets */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Precio y entradas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_free"
                  checked={formData.is_free}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_free: checked === true })
                  }
                />
                <Label htmlFor="is_free" className="cursor-pointer">
                  {t('submitEvent.isFree')}
                </Label>
              </div>

              {!formData.is_free && (
                <div className="space-y-2">
                  <Label htmlFor="price_info">{t('submitEvent.priceInfo')}</Label>
                  <Input
                    id="price_info"
                    placeholder="Ej: 15€ - 25€"
                    value={formData.price_info}
                    onChange={(e) => setFormData({ ...formData, price_info: e.target.value })}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="ticket_url">{t('submitEvent.ticketUrl')}</Label>
                <Input
                  id="ticket_url"
                  type="url"
                  placeholder="https://..."
                  value={formData.ticket_url}
                  onChange={(e) => setFormData({ ...formData, ticket_url: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Additional Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Información adicional</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="image_url">{t('submitEvent.imageUrl')}</Label>
                <Input
                  id="image_url"
                  type="url"
                  placeholder="https://..."
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags">{t('submitEvent.tags')}</Label>
                <Input
                  id="tags"
                  placeholder="música, festival, verano"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="age_restriction">{t('submitEvent.ageRestriction')}</Label>
                <Input
                  id="age_restriction"
                  placeholder="Todos los públicos"
                  value={formData.age_restriction}
                  onChange={(e) => setFormData({ ...formData, age_restriction: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="accessibility_info">{t('submitEvent.accessibilityInfo')}</Label>
                <Input
                  id="accessibility_info"
                  value={formData.accessibility_info}
                  onChange={(e) => setFormData({ ...formData, accessibility_info: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Contact */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Contacto</CardTitle>
              <CardDescription>Te enviaremos un email cuando se publique el evento</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="email">{t('submitEvent.email')} *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
            <Send className="h-4 w-4 mr-2" />
            {isLoading ? t('submitEvent.submitting') : t('submitEvent.submit')}
          </Button>
        </form>
      </main>
    </div>
  );
};

export default SubmitEventPage;
