import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ArrowLeft,
  Calendar,
  Check,
  X,
  Trash2,
  Globe,
  Play,
  Plus,
  ToggleLeft,
  ToggleRight,
  Clock,
  BarChart3,
  AlertCircle,
  Loader2,
  Dumbbell,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { useToast } from '@/hooks/use-toast';
import { useAuthContext } from '@/contexts/AuthContext';
import {
  useIsAdmin,
  usePendingEvents,
  useAllEvents,
  useScrapingSources,
  useApproveEvent,
  useRejectEvent,
  useDeleteEvent,
  useToggleSource,
  useAddSource,
  useDeleteSource,
  useRunScraping,
  useAdminStats,
} from '@/hooks/useAdmin';
import { EVENT_CATEGORIES } from '@/types';
import CategoryChip from '@/components/events/CategoryChip';

const AdminPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuthContext();
  const { data: isAdmin, isLoading: adminLoading } = useIsAdmin();
  const { data: pendingEvents, isLoading: pendingLoading } = usePendingEvents();
  const { data: allEvents } = useAllEvents();
  const { data: sources, isLoading: sourcesLoading } = useScrapingSources();
  const { data: stats } = useAdminStats();
  
  const approveEvent = useApproveEvent();
  const rejectEvent = useRejectEvent();
  const deleteEvent = useDeleteEvent();
  const toggleSource = useToggleSource();
  const addSource = useAddSource();
  const deleteSource = useDeleteSource();
  const runScraping = useRunScraping();

  const [newSource, setNewSource] = useState({ name: '', url: '', category: 'other' });
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [sportsSyncing, setSportsSyncing] = useState(false);
  const [sportsRuns, setSportsRuns] = useState<any[]>([]);
  const [sportsRunsLoading, setSportsRunsLoading] = useState(false);

  // Loading state
  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-6">
            <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Acceso denegado</h2>
            <p className="text-muted-foreground mb-6">Debes iniciar sesión para acceder al panel de administración.</p>
            <Button onClick={() => navigate('/auth')} className="w-full">
              Iniciar sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not admin
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-6">
            <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Sin permisos</h2>
            <p className="text-muted-foreground mb-6">No tienes permisos de administrador para acceder a esta sección.</p>
            <Button onClick={() => navigate('/')} className="w-full">
              Volver al inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleApprove = async (eventId: string) => {
    try {
      await approveEvent.mutateAsync(eventId);
      toast({ title: 'Evento aprobado', description: 'El evento ha sido publicado.' });
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo aprobar el evento.', variant: 'destructive' });
    }
  };

  const handleReject = async (eventId: string) => {
    try {
      await rejectEvent.mutateAsync(eventId);
      toast({ title: 'Evento rechazado', description: 'El evento ha sido rechazado.' });
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo rechazar el evento.', variant: 'destructive' });
    }
  };

  const handleDelete = async (eventId: string) => {
    try {
      await deleteEvent.mutateAsync(eventId);
      toast({ title: 'Evento eliminado', description: 'El evento ha sido eliminado.' });
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo eliminar el evento.', variant: 'destructive' });
    }
  };

  const handleToggleSource = async (id: string, currentState: boolean) => {
    try {
      await toggleSource.mutateAsync({ id, is_active: !currentState });
      toast({ title: currentState ? 'Fuente desactivada' : 'Fuente activada' });
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo cambiar el estado.', variant: 'destructive' });
    }
  };

  const handleAddSource = async () => {
    if (!newSource.name || !newSource.url) {
      toast({ title: 'Error', description: 'Nombre y URL son requeridos.', variant: 'destructive' });
      return;
    }
    try {
      await addSource.mutateAsync(newSource);
      toast({ title: 'Fuente añadida', description: 'La nueva fuente ha sido añadida.' });
      setNewSource({ name: '', url: '', category: 'other' });
      setAddDialogOpen(false);
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo añadir la fuente.', variant: 'destructive' });
    }
  };

  const handleDeleteSource = async (id: string) => {
    try {
      await deleteSource.mutateAsync(id);
      toast({ title: 'Fuente eliminada' });
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo eliminar la fuente.', variant: 'destructive' });
    }
  };

  const handleRunScraping = async () => {
    try {
      toast({ title: 'Scraping iniciado', description: 'El proceso puede tardar varios minutos.' });
      await runScraping.mutateAsync();
      toast({ title: 'Scraping completado', description: 'Los eventos han sido actualizados.' });
    } catch (error) {
      toast({ title: 'Error', description: 'Error durante el scraping.', variant: 'destructive' });
    }
  };

  const fetchSportsRuns = async () => {
    setSportsRunsLoading(true);
    try {
      const { data } = await supabase
        .from('sports_sync_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(10);
      setSportsRuns(data || []);
    } catch {
      // silent
    } finally {
      setSportsRunsLoading(false);
    }
  };

  const handleSportsSync = async () => {
    setSportsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-sync-sports', {
        body: { force: true, cooldownMinutes: 0 },
      });
      if (error) throw error;
      if (data?.recentRuns) setSportsRuns(data.recentRuns);
      toast({ title: 'Sync deportes completado', description: data?.ok ? 'Sincronización exitosa.' : 'Revisa los resultados.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error?.message || 'No se pudo ejecutar el sync.', variant: 'destructive' });
    } finally {
      setSportsSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="p-4 flex items-center gap-3 border-b border-border sticky top-0 bg-background z-40">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Panel de Administración</h1>
          <p className="text-sm text-muted-foreground">Gestión de eventos y fuentes</p>
        </div>
      </header>

      <main className="p-4 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="pt-4 text-center">
              <Calendar className="h-6 w-6 mx-auto mb-1 text-primary" />
              <p className="text-2xl font-bold">{stats?.totalEvents || 0}</p>
              <p className="text-xs text-muted-foreground">Publicados</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <Clock className="h-6 w-6 mx-auto mb-1 text-orange-500" />
              <p className="text-2xl font-bold">{stats?.pendingEvents || 0}</p>
              <p className="text-xs text-muted-foreground">Pendientes</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <Globe className="h-6 w-6 mx-auto mb-1 text-green-500" />
              <p className="text-2xl font-bold">{stats?.activeSources || 0}</p>
              <p className="text-xs text-muted-foreground">Fuentes</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="pending" className="flex-1">
              Pendientes
              {(pendingEvents?.length || 0) > 0 && (
                <Badge variant="destructive" className="ml-2">{pendingEvents?.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="sources" className="flex-1">Fuentes</TabsTrigger>
            <TabsTrigger value="deportes" className="flex-1" onClick={fetchSportsRuns}>
              <Dumbbell className="h-4 w-4 mr-1" />
              Deportes
            </TabsTrigger>
            <TabsTrigger value="all" className="flex-1">Todos</TabsTrigger>
          </TabsList>

          {/* Pending Events Tab */}
          <TabsContent value="pending" className="space-y-4">
            {pendingLoading ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : pendingEvents && pendingEvents.length > 0 ? (
              pendingEvents.map((event) => (
                <Card key={event.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <CardTitle className="text-base">{event.title}</CardTitle>
                        <CardDescription>
                          {event.venue_name} • {format(new Date(event.start_at), "d MMM yyyy, HH:mm", { locale: es })}
                        </CardDescription>
                      </div>
                      <CategoryChip category={event.category as any} size="sm" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {event.description}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleApprove(event.id)}
                        disabled={approveEvent.isPending}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Aprobar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReject(event.id)}
                        disabled={rejectEvent.isPending}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Rechazar
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar evento?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción no se puede deshacer.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(event.id)}>
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="bg-muted/50 border-dashed">
                <CardContent className="py-8 text-center">
                  <Check className="h-12 w-12 mx-auto mb-2 text-green-500" />
                  <p className="font-medium">No hay eventos pendientes</p>
                  <p className="text-sm text-muted-foreground">Todos los eventos han sido revisados</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Sources Tab */}
          <TabsContent value="sources" className="space-y-4">
            <div className="flex gap-2">
              <Button onClick={handleRunScraping} disabled={runScraping.isPending}>
                {runScraping.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Ejecutar scraping
              </Button>
              
              <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Añadir fuente
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nueva fuente de scraping</DialogTitle>
                    <DialogDescription>
                      Añade una nueva web para extraer eventos automáticamente.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Nombre</Label>
                      <Input
                        value={newSource.name}
                        onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                        placeholder="Teatro Cervantes"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>URL</Label>
                      <Input
                        value={newSource.url}
                        onChange={(e) => setNewSource({ ...newSource, url: e.target.value })}
                        placeholder="https://..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Categoría por defecto</Label>
                      <Select
                        value={newSource.category}
                        onValueChange={(v) => setNewSource({ ...newSource, category: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {EVENT_CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleAddSource} disabled={addSource.isPending}>
                      Añadir
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {sourcesLoading ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : (
              sources?.map((source) => (
                <Card key={source.id} className={!source.is_active ? 'opacity-60' : ''}>
                  <CardContent className="py-4">
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleSource(source.id, source.is_active)}
                      >
                        {source.is_active ? (
                          <ToggleRight className="h-6 w-6 text-green-500" />
                        ) : (
                          <ToggleLeft className="h-6 w-6 text-muted-foreground" />
                        )}
                      </Button>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{source.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{source.url}</p>
                      </div>
                      <Badge variant="secondary">{source.category}</Badge>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar fuente?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Se eliminará "{source.name}" de las fuentes de scraping.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteSource(source.id)}>
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Deportes Tab */}
          <TabsContent value="deportes" className="space-y-4">
            <Button onClick={handleSportsSync} disabled={sportsSyncing}>
              {sportsSyncing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Sync Deportes ahora
            </Button>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Últimos sync runs</CardTitle>
                <CardDescription>Últimas 10 ejecuciones de sincronización deportiva</CardDescription>
              </CardHeader>
              <CardContent>
                {sportsRunsLoading ? (
                  <div className="text-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </div>
                ) : sportsRuns.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No hay ejecuciones registradas.</p>
                ) : (
                  <div className="space-y-2">
                    {sportsRuns.map((run: any) => (
                      <div key={run.id} className="flex items-center gap-2 text-sm border-b border-border pb-2 last:border-0">
                        <Badge variant={
                          run.status === 'completed' ? 'default' :
                          run.status === 'failed' ? 'destructive' : 'secondary'
                        }>
                          {run.status}
                        </Badge>
                        <span className="text-muted-foreground text-xs">
                          {format(new Date(run.started_at), "d MMM HH:mm", { locale: es })}
                        </span>
                        <span className="font-medium truncate flex-1">{run.source_slug}</span>
                        <span className="text-xs text-muted-foreground">
                          ↑{run.items_upserted} ✗{run.items_failed}
                        </span>
                        {run.error_sample && (
                          <span className="text-xs text-destructive truncate max-w-[120px]" title={run.error_sample}>
                            {run.error_sample.slice(0, 40)}…
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* All Events Tab */}
          <TabsContent value="all" className="space-y-4">
            {allEvents?.map((event) => (
              <Card key={event.id}>
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{event.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(event.start_at), "d MMM yyyy", { locale: es })} • {event.venue_name}
                      </p>
                    </div>
                    <Badge variant={
                      event.status === 'published' ? 'default' :
                      event.status === 'pending' ? 'secondary' : 'destructive'
                    }>
                      {event.status}
                    </Badge>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar evento?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acción no se puede deshacer.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(event.id)}>
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminPage;
