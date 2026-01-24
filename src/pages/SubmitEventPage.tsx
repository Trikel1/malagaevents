import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { EVENT_CATEGORIES } from '@/types';

const SubmitEventPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // TODO: Implement actual submission with Edge Function
      toast({
        title: t('submitEvent.success'),
        description: t('submitEvent.successDesc'),
      });
      navigate('/');
    } catch (error) {
      toast({
        title: t('submitEvent.error'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <header className="p-4 flex items-center gap-3 border-b border-border sticky top-0 bg-background z-40">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">{t('submitEvent.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('submitEvent.subtitle')}</p>
        </div>
      </header>

      <main className="p-4">
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
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">{t('submitEvent.address')} *</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  required
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
              <CardDescription>Te enviaremos un email para verificar el evento</CardDescription>
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
