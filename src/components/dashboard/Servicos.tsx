import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Loader2, Edit2, Trash2, Tag, Clock, DollarSign, Scissors } from "lucide-react";

export type Servico = {
  id: string;
  company: string;
  name: string;
  price: number | null;
  duration_min: number | null;
  description: string | null;
  created_at: string;
};

function formatPrice(v: number | null) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDuration(min: number | null) {
  if (min == null) return "—";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

type FormState = {
  name: string;
  price: string;
  duration_min: string;
  description: string;
};

const emptyForm: FormState = { name: "", price: "", duration_min: "", description: "" };

export function Servicos() {
  const { user } = useAuth();
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Servico | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);

  const fetchServicos = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("services")
      .select("*")
      .eq("company_id", user.companyId)
      .order("name");
    if (data) setServicos(data);
    setLoading(false);
  };

  useEffect(() => { fetchServicos(); }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("services").insert([{
      company_id: user.companyId,
      name: form.name.trim(),
      price: form.price ? parseFloat(form.price.replace(",", ".")) : null,
      duration_min: form.duration_min ? parseInt(form.duration_min) : null,
      description: form.description.trim() || null,
    }]);
    setSaving(false);
    if (error) { alert("Erro ao criar: " + error.message); return; }
    setCreateOpen(false);
    setForm(emptyForm);
    fetchServicos();
  };

  const handleOpenEdit = (s: Servico) => {
    setEditTarget(s);
    setEditForm({
      name: s.name,
      price: s.price != null ? String(s.price) : "",
      duration_min: s.duration_min != null ? String(s.duration_min) : "",
      description: s.description ?? "",
    });
    setEditOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget || !editForm.name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("services").update({
      name: editForm.name.trim(),
      price: editForm.price ? parseFloat(editForm.price.replace(",", ".")) : null,
      duration_min: editForm.duration_min ? parseInt(editForm.duration_min) : null,
      description: editForm.description.trim() || null,
    }).eq("id", editTarget.id);
    setSaving(false);
    if (error) { alert("Erro ao atualizar: " + error.message); return; }
    setEditOpen(false);
    setEditTarget(null);
    fetchServicos();
  };

  const handleDelete = async (s: Servico) => {
    if (!confirm(`Excluir "${s.name}"?`)) return;
    await supabase.from("services").delete().eq("id", s.id);
    fetchServicos();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-base">Serviços oferecidos</h3>
          <p className="text-xs text-muted-foreground">
            Cadastre os serviços da sua empresa. Eles aparecerão na seleção ao agendar eventos.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-4 mr-2" />
              Novo Serviço
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Cadastrar Serviço</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Nome do serviço *</Label>
                <Input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Corte Feminino" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><DollarSign className="size-3.5" />Valor (R$)</Label>
                  <Input value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="Ex: 80,00" inputMode="decimal" />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Clock className="size-3.5" />Duração (min)</Label>
                  <Input value={form.duration_min} onChange={e => setForm(f => ({ ...f, duration_min: e.target.value }))} placeholder="Ex: 60" inputMode="numeric" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Descrição (opcional)</Label>
                <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Breve descrição do serviço" />
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Plus className="size-4 mr-2" />}
                Salvar
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-7 animate-spin text-muted-foreground" />
        </div>
      ) : servicos.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-14 text-center text-muted-foreground">
          <Scissors className="size-10 mb-3 opacity-20" />
          <p className="text-sm font-medium">Nenhum serviço cadastrado ainda.</p>
          <p className="text-xs mt-1">Clique em "Novo Serviço" para começar.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {servicos.map(s => (
            <Card key={s.id} className="relative group">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="shrink-0 flex items-center justify-center size-8 rounded-full bg-primary/10 text-primary">
                      <Tag className="size-4" />
                    </div>
                    <h4 className="font-semibold text-sm leading-tight truncate">{s.name}</h4>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => handleOpenEdit(s)}>
                      <Edit2 className="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-7 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(s)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground pl-10">
                  <span className="flex items-center gap-1 font-medium text-foreground">
                    <DollarSign className="size-3" />{formatPrice(s.price)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="size-3" />{formatDuration(s.duration_min)}
                  </span>
                </div>
                {s.description && (
                  <p className="text-xs text-muted-foreground pl-10 line-clamp-2">{s.description}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Serviço</DialogTitle></DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Nome do serviço *</Label>
              <Input required value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5"><DollarSign className="size-3.5" />Valor (R$)</Label>
                <Input value={editForm.price} onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))} inputMode="decimal" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5"><Clock className="size-3.5" />Duração (min)</Label>
                <Input value={editForm.duration_min} onChange={e => setEditForm(f => ({ ...f, duration_min: e.target.value }))} inputMode="numeric" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)} className="w-full">Cancelar</Button>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
                Salvar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
