import { useState, useEffect } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isSameMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, List, Grid, Clock, MapPin, Plus, Loader2, Edit2, Trash2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { Servico } from "@/components/dashboard/Servicos";

type Event = {
  id: string;
  title: string;
  date: string;
  time: string;
  location?: string;
  client: string;
};

export function Agenda() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Services
  const [services, setServices] = useState<Servico[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

  // Detail/Edit states
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Form states (used for both create and edit)
  const [title, setTitle] = useState("");
  const [dateStr, setDateStr] = useState("");
  const [timeStr, setTimeStr] = useState("");
  const [client, setClient] = useState("");
  const [location, setLocation] = useState("");

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToday = () => setCurrentDate(new Date());

  const fetchEvents = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("events")
      .select("*")
      .eq("company_id", user.companyId);
    
    if (data) {
      setEvents(data);
    }
    setLoading(false);
  };

  const fetchServices = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("services")
      .select("*")
      .eq("company_id", user.companyId)
      .order("name");
    if (data) setServices(data);
  };

  useEffect(() => {
    fetchEvents();
    fetchServices();
  }, [user]);

  const resetForm = () => {
    setTitle("");
    setDateStr("");
    setTimeStr("");
    setClient("");
    setLocation("");
  };

  const handleOpenCreate = () => {
    resetForm();
    setSelectedServiceId(null);
    setCreateOpen(true);
  };

  const handlePickService = (s: Servico) => {
    setSelectedServiceId(s.id);
    setTitle(s.name);
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title || !dateStr || !timeStr || !client) return;

    setSaving(true);
    const { error } = await supabase.from("events").insert([
      {
        company_id: user.companyId,
        title,
        date: dateStr,
        time: timeStr,
        client,
        location,
      }
    ]);
    setSaving(false);

    if (error) {
      alert("Erro ao criar evento: " + error.message);
    } else {
      setCreateOpen(false);
      resetForm();
      fetchEvents();
    }
  };

  const handleViewDetails = (event: Event) => {
    setSelectedEvent(event);
    setIsEditing(false);
    setDetailOpen(true);
  };

  const handleOpenEdit = () => {
    if (!selectedEvent) return;
    setTitle(selectedEvent.title);
    setDateStr(selectedEvent.date);
    setTimeStr(selectedEvent.time);
    setClient(selectedEvent.client);
    setLocation(selectedEvent.location || "");
    setIsEditing(true);
  };

  const handleUpdateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent || !title || !dateStr || !timeStr || !client) return;

    setActionLoading(true);
    const { error } = await supabase
      .from("events")
      .update({
        title,
        date: dateStr,
        time: timeStr,
        client,
        location,
      })
      .eq("id", selectedEvent.id);
    
    setActionLoading(false);

    if (error) {
      alert("Erro ao atualizar evento: " + error.message);
    } else {
      setIsEditing(false);
      setDetailOpen(false);
      fetchEvents();
    }
  };

  const handleDeleteEvent = async () => {
    if (!selectedEvent) return;
    if (!confirm("Tem certeza que deseja excluir este evento?")) return;

    setActionLoading(true);
    const { error } = await supabase.from("events").delete().eq("id", selectedEvent.id);
    setActionLoading(false);

    if (error) {
      alert("Erro ao excluir: " + error.message);
    } else {
      setDetailOpen(false);
      fetchEvents();
    }
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const startDay = monthStart.getDay();
  const prefixDays = Array.from({ length: startDay }).map((_, i) => i);

  // Transforma as strings YYYY-MM-DD em objetos Date no timezone local para comparação
  const parsedEvents = events.map(e => ({
    ...e,
    parsedDate: new Date(`${e.date}T12:00:00`)
  })).sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime() || a.time.localeCompare(b.time));

  const monthEvents = parsedEvents.filter(e => isSameMonth(e.parsedDate, currentDate));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border bg-card p-4 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={prevMonth}>
              <ChevronLeft className="size-4" />
            </Button>
            <h2 className="text-lg font-semibold w-40 text-center capitalize">
              {format(currentDate, "MMMM yyyy", { locale: ptBR })}
            </h2>
            <Button variant="outline" size="icon" onClick={nextMonth}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <Button variant="secondary" onClick={goToday} className="hidden sm:inline-flex">
            Hoje
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center rounded-lg border bg-muted/50 p-1">
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("grid")}
              className="rounded-md px-3"
            >
              <Grid className="size-4 mr-2" />
              Calendário
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="rounded-md px-3"
            >
              <List className="size-4 mr-2" />
              Lista
            </Button>
          </div>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleOpenCreate}>
                <Plus className="size-4 mr-2" />
                Novo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Agendar Novo Evento</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateEvent} className="space-y-4 pt-4">
                {services.length > 0 && (
                  <div className="space-y-2">
                    <Label>Selecionar serviço</Label>
                    <div className="max-h-36 overflow-y-auto rounded-md border divide-y">
                      {services.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => handlePickService(s)}
                          className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left transition-colors hover:bg-muted/50 ${
                            selectedServiceId === s.id ? "bg-primary/10 text-primary font-medium" : ""
                          }`}
                        >
                          <span>{s.name}</span>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {s.duration_min ? `${s.duration_min}min` : ""}
                            {s.price != null ? ` · R$${s.price.toFixed(2).replace(".", ",")}` : ""}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Título / Serviço</Label>
                  <Input required value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Consulta Inicial" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data</Label>
                    <Input type="date" required value={dateStr} onChange={e => setDateStr(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Horário</Label>
                    <Input type="time" required value={timeStr} onChange={e => setTimeStr(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Cliente</Label>
                  <Input required value={client} onChange={e => setClient(e.target.value)} placeholder="Nome do cliente" />
                </div>
                <div className="space-y-2">
                  <Label>Localização (Opcional)</Label>
                  <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Ex: Sala 2 / Online" />
                </div>
                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Plus className="size-4 mr-2" />}
                  Salvar Evento
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : viewMode === "grid" ? (
        <Card className="shadow-[var(--shadow-card)]">
          <CardContent className="p-0">
            <div className="grid grid-cols-7 border-b bg-muted/20">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(day => (
                <div key={day} className="py-3 text-center text-xs font-medium text-muted-foreground">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 auto-rows-[minmax(120px,auto)]">
              {prefixDays.map(i => (
                <div key={`prefix-${i}`} className="border-b border-r bg-muted/10 p-2" />
              ))}
              
              {daysInMonth.map((date, idx) => {
                const dayEvents = monthEvents.filter(e => isSameDay(e.parsedDate, date));
                const isToday = isSameDay(date, new Date());
                
                return (
                  <div 
                    key={date.toISOString()} 
                    className={`border-b border-r p-2 transition-colors hover:bg-muted/5 ${
                      (idx + startDay + 1) % 7 === 0 ? "border-r-0" : ""
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className={`inline-flex size-7 items-center justify-center rounded-full text-sm ${
                        isToday ? "bg-primary text-primary-foreground font-bold" : "text-foreground font-medium"
                      }`}>
                        {format(date, "d")}
                      </span>
                      {dayEvents.length > 0 && (
                        <span className="text-[10px] font-medium text-muted-foreground">
                          {dayEvents.length} ev
                        </span>
                      )}
                    </div>
                    
                    <div className="mt-2 space-y-1.5 max-h-[80px] overflow-y-auto no-scrollbar">
                      {dayEvents.map(event => (
                        <div 
                          key={event.id} 
                          onClick={() => handleViewDetails(event as any)}
                          className="rounded bg-primary/10 px-1.5 py-1 text-xs text-primary border border-primary/20 truncate cursor-pointer hover:bg-primary/20"
                          title={`${event.time} - ${event.title} (${event.client})`}
                        >
                          <span className="font-semibold mr-1">{event.time}</span>
                          {event.title}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="text-lg">Próximos Eventos - {format(currentDate, "MMMM", { locale: ptBR })}</CardTitle>
          </CardHeader>
          <CardContent>
            {monthEvents.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CalendarIcon className="size-12 mx-auto mb-4 opacity-20" />
                <p>Nenhum evento agendado para este mês.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {monthEvents.map(event => (
                  <div key={event.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="flex flex-col items-center justify-center rounded-lg bg-primary/10 px-4 py-2 text-primary w-16">
                        <span className="text-xs font-semibold uppercase">{format(event.parsedDate, "MMM", { locale: ptBR })}</span>
                        <span className="text-xl font-bold">{format(event.parsedDate, "dd")}</span>
                      </div>
                      <div>
                        <h3 className="font-semibold">{event.title}</h3>
                        <p className="text-sm text-muted-foreground mb-1">Cliente: {event.client}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="size-3.5" />
                            {event.time}
                          </span>
                          {event.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="size-3.5" />
                              {event.location}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleViewDetails(event as any)}>
                      Ver Detalhes
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialog de Detalhes / Edição */}
      <Dialog open={detailOpen} onOpenChange={(open) => {
        setDetailOpen(open);
        if (!open) setTimeout(() => setIsEditing(false), 200);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Editar Evento" : "Detalhes do Evento"}</DialogTitle>
          </DialogHeader>
          
          {isEditing ? (
            <form onSubmit={handleUpdateEvent} className="space-y-4 pt-4">
              {services.length > 0 && (
                <div className="space-y-2">
                  <Label>Selecionar serviço</Label>
                  <div className="max-h-36 overflow-y-auto rounded-md border divide-y">
                    {services.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handlePickService(s)}
                        className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left transition-colors hover:bg-muted/50 ${
                          selectedServiceId === s.id ? "bg-primary/10 text-primary font-medium" : ""
                        }`}
                      >
                        <span>{s.name}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {s.duration_min ? `${s.duration_min}min` : ""}
                          {s.price != null ? ` · R$${s.price.toFixed(2).replace(".", ",")}` : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label>Título / Serviço</Label>
                <Input required value={title} onChange={e => setTitle(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data</Label>
                  <Input type="date" required value={dateStr} onChange={e => setDateStr(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Horário</Label>
                  <Input type="time" required value={timeStr} onChange={e => setTimeStr(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Input required value={client} onChange={e => setClient(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Localização (Opcional)</Label>
                <Input value={location} onChange={e => setLocation(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setIsEditing(false)} className="w-full">
                  Cancelar
                </Button>
                <Button type="submit" className="w-full" disabled={actionLoading}>
                  {actionLoading ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
                  Salvar
                </Button>
              </div>
            </form>
          ) : selectedEvent ? (
            <div className="space-y-4 pt-4">
              <div>
                <h3 className="font-semibold text-lg">{selectedEvent.title}</h3>
                <p className="text-muted-foreground">{selectedEvent.client}</p>
              </div>
              <div className="space-y-2 text-sm">
                <p className="flex items-center gap-2">
                  <CalendarIcon className="size-4 text-muted-foreground" /> 
                  {format(new Date(`${selectedEvent.date}T12:00:00`), "dd/MM/yyyy")}
                </p>
                <p className="flex items-center gap-2">
                  <Clock className="size-4 text-muted-foreground" /> {selectedEvent.time}
                </p>
                {selectedEvent.location && (
                  <p className="flex items-center gap-2">
                    <MapPin className="size-4 text-muted-foreground" /> {selectedEvent.location}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between pt-4 border-t">
                <Button variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={handleDeleteEvent} disabled={actionLoading}>
                  {actionLoading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Trash2 className="size-4 mr-2" />}
                  Excluir
                </Button>
                <Button variant="secondary" onClick={handleOpenEdit}>
                  <Edit2 className="size-4 mr-2" />
                  Editar
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
