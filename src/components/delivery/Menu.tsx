import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit2, Trash2, Loader2 } from "lucide-react";
import { engineData, engineRequest } from "@/lib/arles-engine";
import { useAuth } from "@/lib/auth";
import { MenuImportModal } from "./MenuImportModal";
import { VisualMenuPanel } from "./VisualMenuPanel";
import { MenuRendererService } from "@/lib/MenuRendererService";

type ProductVariation = {
  id?: string;
  name: string;
  price: number;
  price_delta?: number;
  is_active?: boolean;
};

type Product = {
  id: string;
  category: string;
  name: string;
  description: string;
  price: number;
  is_active: boolean;
  variations?: ProductVariation[];
};

export function Menu() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ id: "", name: "", description: "", price: "", category: "", is_active: true });
  const [saving, setSaving] = useState(false);
  
  const [activeCategory, setActiveCategory] = useState<string>("Todos");

  const fetchProducts = async () => {
    if (!user) return;
    setLoading(true);
    try {
      setProducts((await engineData<Product[]>("products")) || []);
    } catch (error) {
      console.error("Cardápio Engine:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProducts(); }, [user]);

  const categories = ["Todos", ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))];
  const filteredProducts = activeCategory === "Todos" ? products : products.filter(p => p.category === activeCategory);

  const triggerMenuRegen = () => {
    if (!user) return;
    MenuRendererService.triggerRegeneration(user.companyId);
  };

  const toggleAvailability = async (id: string, current: boolean) => {
    const next = !current;
    setProducts(prev => prev.map(p => p.id === id ? { ...p, is_active: next } : p));
    try {
      await engineRequest(`products/${id}`, { method: "PATCH", body: { is_active: next } });
      triggerMenuRegen();
    } catch (error: any) {
      setProducts(prev => prev.map(p => p.id === id ? { ...p, is_active: current } : p));
      alert("Erro ao alterar disponibilidade: " + (error?.message || "erro desconhecido"));
    }
  };

  const deleteProduct = async (id: string) => {
    if (!confirm("Excluir este item permanentemente?")) return;
    try {
      await engineRequest(`products/${id}`, { method: "DELETE" });
      setProducts(prev => prev.filter(p => p.id !== id));
      triggerMenuRegen();
    } catch (error: any) {
      alert("Erro ao excluir: " + (error?.message || "erro desconhecido"));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    
    // Sanitize price (remove R$, spaces, etc)
    const cleanPrice = form.price.replace(/[^\d,.]/g, '').replace(',', '.');
    const numericPrice = parseFloat(cleanPrice) || 0;

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      price: numericPrice,
      category: form.category.trim(),
      is_active: form.is_active,
    };

    try {
      if (form.id) {
        await engineRequest(`products/${form.id}`, { method: "PATCH", body: payload });
      } else {
        await engineRequest("products", { method: "POST", body: payload });
      }
      setFormOpen(false);
      await fetchProducts();
      triggerMenuRegen();
    } catch (error: any) {
      alert((form.id ? "Erro ao editar: " : "Erro ao criar: ") + (error?.message || "erro desconhecido"));
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (p: Product) => {
    setForm({ id: p.id, name: p.name, description: p.description || "", price: String(p.price), category: p.category || "", is_active: p.is_active });
    setFormOpen(true);
  };

  const openNew = () => {
    setForm({ id: "", name: "", description: "", price: "", category: "", is_active: true });
    setFormOpen(true);
  };

  const handleImportComplete = async () => {
    await fetchProducts();
    triggerMenuRegen();
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Gerenciamento do Cardápio</h2>
          <p className="text-sm text-muted-foreground mt-1">Produtos que a IA usará no atendimento.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={openNew}>
            <Plus className="size-4 mr-2" />
            Cadastrar Item
          </Button>
          <MenuImportModal onImportComplete={handleImportComplete} />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar border-b">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-[1px] ${
              activeCategory === cat 
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
          <p>Nenhum produto cadastrado nesta categoria.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map(p => (
            <div key={p.id} className={`p-4 rounded-xl border bg-card shadow-sm transition-opacity ${!p.is_active ? 'opacity-50' : ''}`}>
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted px-1.5 py-0.5 rounded">{p.category}</span>
                  <h3 className="font-semibold text-base mt-1.5 leading-tight">{p.name}</h3>
                  {p.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2 leading-snug">{p.description}</p>}
                  <p className="font-bold text-primary mt-2">
                    {p.variations && p.variations.length > 0 ? "A partir de " : ""}R$ {Number(p.price).toFixed(2).replace(".", ",")}
                  </p>
                  {p.variations && p.variations.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {p.variations
                        .filter(v => v.is_active !== false)
                        .map(v => (
                          <span
                            key={`${p.id}-${v.id || v.name}`}
                            className="text-[11px] font-medium px-2 py-1 rounded-md bg-muted text-foreground border"
                          >
                            {v.name}: R$ {Number(v.price).toFixed(2).replace(".", ",")}
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between mt-4 pt-3 border-t">
                <div className="flex items-center gap-2">
                  <Switch checked={p.is_active} onCheckedChange={() => toggleAvailability(p.id, p.is_active)} />
                  <span className="text-xs font-medium text-muted-foreground">{p.is_active ? "Disponível" : "Esgotado"}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(p)}>
                    <Edit2 className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => deleteProduct(p.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Product Form Modal */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar Produto" : "Novo Produto"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Nome do Produto *</Label>
              <Input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Pizza Calabresa" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoria *</Label>
                <Input required value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="Ex: Pizzas" />
              </div>
              <div className="space-y-2">
                <Label>Preço (R$) *</Label>
                <Input required value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0,00" inputMode="decimal" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição / Ingredientes</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Ex: Mussarela, calabresa e cebola." />
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
              <div className="space-y-0.5">
                <Label className="text-sm">Disponibilidade Imediata</Label>
                <p className="text-xs text-muted-foreground">Produto ficará visível para a IA vender.</p>
              </div>
              <Switch checked={form.is_active} onCheckedChange={c => setForm(f => ({ ...f, is_active: c }))} />
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? <Loader2 className="size-4 mr-2 animate-spin" /> : "Salvar Produto"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Visual Menu ── */}
      <div className="pt-4">
        <VisualMenuPanel onRegenerate={() => {}} />
      </div>
    </div>
  );
}
