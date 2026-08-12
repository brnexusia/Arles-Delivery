import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LogOut, Plus, Building, Loader2, Copy, Trash2, Edit2 } from "lucide-react";

export const Route = createFileRoute("/adm")({
  component: AdminDashboard,
});

type Company = {
  id: string;
  name: string;
  username: string;
  password?: string;
  has_calendar?: boolean;
  has_services?: boolean;
  has_custom_metrics?: boolean;
  has_delivery?: boolean;
  created_at: string;
};

type ModuleKey = "has_calendar" | "has_services" | "has_custom_metrics" | "has_delivery";
const MODULES: { key: ModuleKey; label: string; desc: string; color: string }[] = [
  { key: "has_calendar", label: "Agenda", desc: "Calendário de eventos", color: "bg-violet-500/10 text-violet-600 border-violet-300" },
  { key: "has_services", label: "Serviços", desc: "Cadastro de serviços", color: "bg-emerald-500/10 text-emerald-600 border-emerald-300" },
  { key: "has_custom_metrics", label: "Métricas Extras", desc: "Registros e acompanhamentos variáveis", color: "bg-blue-500/10 text-blue-600 border-blue-300" },
  { key: "has_delivery", label: "Delivery (SaaS)", desc: "Painel exclusivo para operação de delivery", color: "bg-rose-500/10 text-rose-600 border-rose-300" },
];

function AdminDashboard() {
  const { user, ready, signOut } = useAuth();
  const router = useRouter();
  
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  
  const [newName, setNewName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newModules, setNewModules] = useState<Record<ModuleKey, boolean>>({ has_calendar: false, has_services: false, has_custom_metrics: false, has_delivery: false });

  // Edit states
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [editName, setEditName] = useState("");
  const [editModules, setEditModules] = useState<Record<ModuleKey, boolean>>({ has_calendar: false, has_services: false, has_custom_metrics: false, has_delivery: false });
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (ready && (!user || user.role !== "admin")) {
      router.navigate({ to: "/login", replace: true });
    }
  }, [ready, user, router]);

  useEffect(() => {
    if (user?.role === "admin") {
      loadCompanies();
    }
  }, [user]);

  async function loadCompanies() {
    setLoading(true);
    const { data } = await supabase.from("companies").select("*").order("created_at", { ascending: false });
    if (data) setCompanies(data);
    setLoading(false);
  }

  const handleSignOut = () => {
    signOut();
    router.navigate({ to: "/login", replace: true });
  };

  const generateCredentials = () => {
    if (!newName) return;
    const base = newName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
    setNewUsername(base);
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@";
    let pass = "";
    for (let i = 0; i < 8; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
    setNewPassword(pass);
  };

  const toggleNewModule = (key: ModuleKey) =>
    setNewModules(prev => ({ ...prev, [key]: !prev[key] }));

  const toggleEditModule = (key: ModuleKey) =>
    setEditModules(prev => ({ ...prev, [key]: !prev[key] }));

  const createCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newUsername || !newPassword) return;
    
    setCreating(true);
    const { data, error } = await supabase.from("companies").insert([
      { name: newName, username: newUsername, password: newPassword, ...newModules }
    ]).select().single();

    setCreating(false);
    
    if (error) {
      alert("Erro ao criar empresa: " + error.message);
    } else if (data) {
      alert(`Empresa criada com sucesso!\n\nLogin: ${data.username}\nSenha: ${data.password}\n\nGuarde esta senha.`);
      setNewName("");
      setNewUsername("");
      setNewPassword("");
      setNewModules({ has_calendar: false, has_services: false, has_custom_metrics: false, has_delivery: false });
      loadCompanies();
    }
  };

  const openEdit = (c: Company) => {
    setEditingCompany(c);
    setEditName(c.name);
    setEditModules({ has_calendar: !!c.has_calendar, has_services: !!c.has_services, has_custom_metrics: !!c.has_custom_metrics, has_delivery: !!c.has_delivery });
  };

  const updateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompany || !editName) return;

    setUpdating(true);
    const { error } = await supabase
      .from("companies")
      .update({ name: editName, ...editModules })
      .eq("id", editingCompany.id);
    
    setUpdating(false);

    if (error) {
      alert("Erro ao atualizar empresa: " + error.message);
    } else {
      setEditingCompany(null);
      loadCompanies();
    }
  };

  const deleteCompany = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta empresa? O usuário perderá o acesso.")) {
      await supabase.from("companies").delete().eq("id", id);
      loadCompanies();
    }
  };

  if (!ready || !user || user.role !== "admin") return null;

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Painel Administrativo</h1>
            <p className="text-muted-foreground mt-1">Gerencie empresas e acessos do sistema.</p>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="size-4 mr-2" />
            Sair
          </Button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xl font-semibold">Nova Empresa</CardTitle>
              <Building className="size-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <form onSubmit={createCompany} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Nome da Empresa</Label>
                  <Input 
                    id="name" 
                    value={newName} 
                    onChange={e => setNewName(e.target.value)} 
                    placeholder="Ex: Loja Matriz" 
                    onBlur={generateCredentials}
                  />
                </div>
                
                <div className="space-y-1.5">
                  <Label htmlFor="username">Usuário (Login)</Label>
                  <Input 
                    id="username" 
                    value={newUsername} 
                    onChange={e => setNewUsername(e.target.value)} 
                    placeholder="Gerado automaticamente"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password">Senha</Label>
                  <div className="flex gap-2">
                    <Input 
                      id="password" 
                      value={newPassword} 
                      readOnly 
                      placeholder="Senha" 
                    />
                    <Button type="button" variant="outline" onClick={() => navigator.clipboard.writeText(newPassword)} title="Copiar Senha">
                      <Copy className="size-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Módulos</Label>
                  <div className="space-y-2">
                    {/* Métricas — always on */}
                    <div className="flex items-center justify-between rounded-lg border px-3 py-2 bg-muted/30">
                      <div>
                        <p className="text-sm font-medium">Métricas</p>
                        <p className="text-xs text-muted-foreground">Painel principal — sempre ativo</p>
                      </div>
                      <span className="text-xs font-semibold text-primary">Sempre ON</span>
                    </div>
                    {MODULES.map(mod => (
                      <button
                        key={mod.key}
                        type="button"
                        onClick={() => toggleNewModule(mod.key)}
                        className={`w-full flex items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors ${
                          newModules[mod.key]
                            ? "border-primary/40 bg-primary/5"
                            : "bg-background hover:bg-muted/30"
                        }`}
                      >
                        <div>
                          <p className="text-sm font-medium">{mod.label}</p>
                          <p className="text-xs text-muted-foreground">{mod.desc}</p>
                        </div>
                        <div className={`size-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                          newModules[mod.key] ? "bg-primary border-primary" : "border-muted-foreground/30"
                        }`}>
                          {newModules[mod.key] && <span className="block size-2 rounded-full bg-white" />}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={creating || !newName || !newUsername || !newPassword}>
                  {creating ? <Loader2 className="size-4 animate-spin mr-2" /> : <Plus className="size-4 mr-2" />}
                  Criar Acesso
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-xl font-semibold">Empresas Cadastradas</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="size-8 animate-spin text-muted-foreground" />
                </div>
              ) : companies.length === 0 ? (
                <p className="text-muted-foreground text-center p-8">Nenhuma empresa cadastrada ainda.</p>
              ) : (
                <div className="space-y-4">
                  {companies.map(c => (
                    <div key={c.id} className="flex items-center justify-between p-4 rounded-lg border bg-card">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium">{c.name}</h3>
                          {MODULES.filter(m => c[m.key]).map(m => (
                            <span key={m.key} className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${m.color}`}>
                              {m.label}
                            </span>
                          ))}
                        </div>
                        <p className="text-sm text-muted-foreground">Login: {c.username}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)} className="text-muted-foreground hover:text-foreground">
                          <Edit2 className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteCompany(c.id)} className="text-destructive hover:bg-destructive/10">
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={!!editingCompany} onOpenChange={(open) => !open && setEditingCompany(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Empresa</DialogTitle>
          </DialogHeader>
          <form onSubmit={updateCompany} className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <Label htmlFor="editName">Nome da Empresa</Label>
              <Input 
                id="editName" 
                value={editName} 
                onChange={e => setEditName(e.target.value)} 
                required
              />
            </div>
            
            <div className="space-y-2 pt-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Módulos</Label>
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-lg border px-3 py-2 bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">Métricas</p>
                    <p className="text-xs text-muted-foreground">Painel principal — sempre ativo</p>
                  </div>
                  <span className="text-xs font-semibold text-primary">Sempre ON</span>
                </div>
                {MODULES.map(mod => (
                  <button
                    key={mod.key}
                    type="button"
                    onClick={() => toggleEditModule(mod.key)}
                    className={`w-full flex items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors ${
                      editModules[mod.key]
                        ? "border-primary/40 bg-primary/5"
                        : "bg-background hover:bg-muted/30"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium">{mod.label}</p>
                      <p className="text-xs text-muted-foreground">{mod.desc}</p>
                    </div>
                    <div className={`size-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                      editModules[mod.key] ? "bg-primary border-primary" : "border-muted-foreground/30"
                    }`}>
                      {editModules[mod.key] && <span className="block size-2 rounded-full bg-white" />}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={updating}>
              {updating ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Salvar Alterações
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
