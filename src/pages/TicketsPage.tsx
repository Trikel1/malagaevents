import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Ticket, FileText, QrCode, Calendar, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import EmptyState from '@/components/common/EmptyState';
import { EventCardSkeleton } from '@/components/common/LoadingSkeleton';
import { useTickets, useDeleteTicket } from '@/hooks/useTickets';
import { useAuthContext } from '@/contexts/AuthContext';
import type { Ticket as TicketType } from '@/types';
import SEO from '@/components/common/SEO';

const TicketsPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuthContext();
  
  const { data: tickets, isLoading } = useTickets();
  const deleteTicket = useDeleteTicket();

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

  const getTicketIcon = (ticket: TicketType) => {
    if (ticket.file_path) return FileText;
    if (ticket.qr_text) return QrCode;
    return Ticket;
  };

  const getTicketType = (ticket: TicketType): string => {
    if (ticket.file_path) return 'PDF';
    if (ticket.qr_text) return 'QR';
    return 'Ticket';
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Mis entradas — MalagaEvents"
        description="Tus entradas guardadas para eventos en Málaga. Accede rápidamente a códigos QR y detalles de tus tickets."
        path="/tickets"
        noindex
      />
      {/* Header */}
      <header className="bg-card/90 backdrop-blur-xl border-b border-border/60 sticky top-0 z-40 p-4 shadow-soft">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold tracking-tight">{t('tickets.title')}</h1>
          <Button asChild size="sm">
            <Link to="/tickets/add">
              <Plus className="h-4 w-4 mr-1" />
              {t('tickets.addTicket')}
            </Link>
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="p-4">
        {isLoading ? (
          <div className="space-y-3">
            <EventCardSkeleton />
            <EventCardSkeleton />
          </div>
        ) : tickets && tickets.length > 0 ? (
          <div className="space-y-3">
            {tickets.map((ticket) => {
              const Icon = getTicketIcon(ticket);
              return (
                <Card key={ticket.id} className="overflow-hidden rounded-2xl shadow-soft hover:shadow-card transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold line-clamp-1">{ticket.title}</h3>
                          <Badge variant="secondary" className="flex-shrink-0">
                            {getTicketType(ticket)}
                          </Badge>
                        </div>
                        
                        {ticket.event_date && (
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>
                              {new Date(ticket.event_date).toLocaleDateString()}
                            </span>
                          </div>
                        )}

                        {ticket.note && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                            {ticket.note}
                          </p>
                        )}

                        <div className="flex items-center justify-between mt-3">
                          <Badge variant="outline" className="text-xs">
                            {t('tickets.offlineAvailable')}
                          </Badge>
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t('tickets.deleteConfirm')}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {ticket.title}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteTicket.mutate(ticket)}
                                  disabled={deleteTicket.isPending}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  {deleteTicket.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    t('common.delete')
                                  )}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={Ticket}
            title={t('tickets.noTickets')}
            description={t('tickets.noTicketsDesc')}
            actionLabel={t('tickets.addTicket')}
            onAction={() => navigate('/tickets/add')}
          />
        )}
      </main>
    </div>
  );
};

export default TicketsPage;
