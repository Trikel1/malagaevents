import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Plus, Ticket, FileText, QrCode, Calendar, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import EmptyState from '@/components/common/EmptyState';
import type { Ticket as TicketType } from '@/types';

// Mock tickets for demo
const mockTickets: TicketType[] = [
  {
    id: '1',
    user_id: 'user1',
    title: 'Festival de Música de Málaga',
    event_date: new Date(Date.now() + 86400000 * 7).toISOString(),
    file_path: '/tickets/festival.pdf',
    created_at: new Date().toISOString(),
  },
  {
    id: '2',
    user_id: 'user1',
    title: 'Museo Picasso - Entrada',
    event_date: new Date(Date.now() + 86400000 * 3).toISOString(),
    qr_text: 'TICKET-12345-ABCDE',
    note: 'Entrada para 2 adultos',
    created_at: new Date().toISOString(),
  },
];

const TicketsPage = () => {
  const { t } = useTranslation();
  const [tickets] = useState<TicketType[]>(mockTickets);

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
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-40 p-4">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold">{t('tickets.title')}</h1>
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
        {tickets.length > 0 ? (
          <div className="space-y-3">
            {tickets.map((ticket) => {
              const Icon = getTicketIcon(ticket);
              return (
                <Card key={ticket.id} className="overflow-hidden">
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

                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-xs">
                            {t('tickets.offlineAvailable')}
                          </Badge>
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
            onAction={() => {}}
          />
        )}
      </main>
    </div>
  );
};

export default TicketsPage;
