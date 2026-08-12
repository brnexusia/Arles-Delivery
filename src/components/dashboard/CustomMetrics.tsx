import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Loader2, Edit2, Trash2, LayoutList, AlignLeft, Hash, Info } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type CustomMetric = {
  id: string;
  company: string;
  name: string;
  value: number | null;
  description: string | null;
  extra_text: string | null;
  created_at: string;
};

type FormState = {
  name: string;
  value: string;
  description: string;
  extra_text: string;
};

const emptyForm: FormState = { name: "", value: "", description: "", extra_text: "" };

export function CustomMetrics() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<CustomMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CustomMetric | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);

  const fetchMetrics = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("custom_metrics")
      .select("*")
      .eq("company_id", user.companyId)
      .order("created_at", { ascending: false });
    if (data) setMetrics(data);
    setLoading(false);
  };

  useEffect(() => { fetchMetrics(); }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("custom_metrics").insert([{
      company_id: user.companyId,
      name: form.name.trim(),
      value: form.value ? parseFloat(form.value.replace(",", ".")) : null,
      description: form.description.trim() || null,
      extra_text: form.extra_text.trim() || null,
    }]);
    setSaving(false);
    if (error) { alert("Erro ao criar registro: " + error.message); return; }
    setCreateOpen(false);
    setForm(emptyForm);
    fetchMetrics();
  };

  const handleOpenEdit = (m: CustomMetric) => {
    setEditTarget(m);
    setEditForm({
      name: m.name,
      value: m.value != null ? String(m.value) : "",
      description: m.description ?? "",
      extra_text: m.extra_text ?? "",
    });
    setEditOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget || !editForm.name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("custom_metrics").update({
      name: editForm.name.trim(),
      value: editForm.value ? parseFloat(editForm.value.replace(",", ".")) : null,
      description: editForm.description.trim() || null,
      extra_text: editForm.extra_text.trim() || null,
    }).eq("id", editTarget.id);
    setSaving(false);
    if (error) { alert("Erro ao atualizar registro: " + error.message); return; }
    setEditOpen(false);
    setEditTarget(null);
    fetchMetrics();
  };

  const handleDelete = async (m: CustomMetric) => {
    if (!confirm(`Tem certeza que deseja excluir o registro "${m.name}"?`)) return;
    await supabase.from("custom_metrics").delete().eq("id", m.id);
    fetchMetrics();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-xl border bg-card p-4 shadow-[var(--shadow-card)]">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <LayoutList className="size-5 text-primary" />
            Métricas Extras
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Controle registros flexíveis como follow-ups, feedbacks ou outras variáveis da sua empresa.
          </p>
        </div>
        
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4 mr-2" />
              Novo Registro
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Criar Novo Registro</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Nome / Categoria *</Label>
                <Input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Follow-up, Venda Extra, etc" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5"><Hash className="size-3.5" />Valor Numérico (Opcional)</Label>
                <Input value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder="Ex: 5, 10.5" inputMode="decimal" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5"><AlignLeft className="size-3.5" />Texto 1 / Descrição</Label>
                <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Ex: Detalhes do contexto" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5"><Info className="size-3.5" />Texto 2 / Extra</Label>
                <Input value={form.extra_text} onChange={e => setForm(f => ({ ...f, extra_text: e.target.value }))} placeholder="Ex: Observações adicionais" />
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Plus className="size-4 mr-2" />}
                Salvar Registro
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : metrics.length === 0 ? (
        <Card className="shadow-[var(--shadow-card)]">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <LayoutList className="size-12 mb-4 opacity-20" />
            <p className="font-medium text-foreground">Nenhum registro encontrado</p>
            <p className="text-sm mt-1">Clique em "Novo Registro" para adicionar métricas flexíveis.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map(m => (
            <Card key={m.id} className="relative group shadow-[var(--shadow-card)]">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground mb-1">
                      {format(new Date(m.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                    <h3 className="font-semibold text-base truncate">{m.name}</h3>
                  </div>
                  <div className="flex items-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => handleOpenEdit(m)}>
                      <Edit2 className="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-7 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(m)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  {m.value != null && (
                    <div className="flex items-center gap-2 text-sm">
                      <Hash className="size-4 text-primary shrink-0" />
                      <span className="font-medium text-foreground">{m.value}</span>
                    </div>
                  )}
                  {m.description && (
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <AlignLeft className="size-4 shrink-0 mt-0.5" />
                      <span className="line-clamp-2 leading-tight">{m.description}</span>
                    </div>
                  )}
                  {m.extra_text && (
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Info className="size-4 shrink-0 mt-0.5" />
                      <span className="line-clamp-2 leading-tight">{m.extra_text}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog de Edição */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Registro</DialogTitle></DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Nome / Categoria *</Label>
              <Input required value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Hash className="size-3.5" />Valor Numérico (Opcional)</Label>
              <Input value={editForm.value} onChange={e => setEditForm(f => ({ ...f, value: e.target.value }))} inputMode="decimal" />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><AlignLeft className="size-3.5" />Texto 1 / Descrição</Label>
              <Input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Info className="size-3.5" />Texto 2 / Extra</Label>
              <Input value={editForm.extra_text} onChange={e => setEditForm(f => ({ ...f, extra_text: e.target.value }))} />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)} className="w-full">Cancelar</Button>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
                Salvar Alterações
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
