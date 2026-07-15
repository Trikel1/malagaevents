import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useCreateTicket } from '@/hooks/useTickets';
import { useAuthContext } from '@/contexts/AuthContext';
import EmptyState from '@/components/common/EmptyState';
import { Ticket } from 'lucide-react';
import SEO from '@/components/common/SEO';

const AddTicketPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuthContext();
  const createTicket = useCreateTicket();

  const [formData, setFormData] = useState({
    title: '',
    note: '',
    qr_text: '',
    event_date: '',
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Redirect to auth if not logged in
  if (!authLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-background p-4">
        <EmptyState
          icon={Ticket}
          title={t('profile.loginRequired')}
          description={t('profile.loginRequiredDesc')}
          actionLabel={t('profile.login')}
          onAction={() => navigate('/auth')}
        />
      </div>
    );
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await createTicket.mutateAsync({
      title: formData.title,
      note: formData.note || undefined,
      qr_text: formData.qr_text || undefined,
      event_date: formData.event_date || undefined,
      file: selectedFile || undefined,
    });

    navigate('/tickets');
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Añadir entrada — MalagaEvents" description="Añade una entrada a tu colección personal." path="/tickets/add" noindex />
      {/* Header */}
      <header className="p-4 flex items-center gap-3 border-b border-border">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">{t('tickets.addTicket')}</h1>
      </header>

      <main className="p-4">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">{t('tickets.ticketTitle')} *</Label>
            <Input
              id="title"
              placeholder="Ej: Concierto de verano"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label>{t('tickets.uploadFile')}</Label>
            <Card className="border-dashed">
              <CardContent className="p-6">
                <label className="flex flex-col items-center gap-3 cursor-pointer">
                  <div className="p-3 rounded-full bg-muted">
                    <Upload className="h-6 w-6 text-muted-foreground" />
                  </div>
                  {selectedFile ? (
                    <p className="text-sm font-medium">{selectedFile.name}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center">
                      Haz clic para seleccionar PDF o imagen
                    </p>
                  )}
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center gap-4">
            <Separator className="flex-1" />
            <span className="text-sm text-muted-foreground">{t('tickets.orAddQR')}</span>
            <Separator className="flex-1" />
          </div>

          {/* QR Code */}
          <div className="space-y-2">
            <Label htmlFor="qr_text" className="flex items-center gap-2">
              <QrCode className="h-4 w-4" />
              {t('tickets.qrCode')}
            </Label>
            <Input
              id="qr_text"
              placeholder="Ej: TICKET-12345-ABCDE"
              value={formData.qr_text}
              onChange={(e) => setFormData({ ...formData, qr_text: e.target.value })}
            />
          </div>

          <Separator />

          {/* Event Date */}
          <div className="space-y-2">
            <Label htmlFor="event_date">{t('tickets.eventDate')}</Label>
            <Input
              id="event_date"
              type="datetime-local"
              value={formData.event_date}
              onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="note">{t('tickets.ticketNote')}</Label>
            <Textarea
              id="note"
              placeholder="Añade notas sobre la entrada..."
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              rows={3}
            />
          </div>

          {/* Submit */}
          <Button 
            type="submit" 
            className="w-full" 
            disabled={createTicket.isPending || !formData.title}
          >
            {createTicket.isPending ? t('common.loading') : t('common.save')}
          </Button>
        </form>
      </main>
    </div>
  );
};

export default AddTicketPage;
