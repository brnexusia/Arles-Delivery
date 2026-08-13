import { useState, useEffect, useRef } from "react";
import { Home, Package, Utensils, Settings, LogOut, Users, CreditCard } from "lucide-react";
import { Dashboard } from "./Dashboard";
import { Orders } from "./Orders";
import { Menu } from "./Menu";
import { DeliverySettings } from "./Settings";
import { Onboarding } from "./Onboarding";
import { TrialBanner } from "./TrialBanner";
import { Customers } from "./Customers";
import { Billing } from "./Billing";
import { useAuth, useSessionGuard } from "@/lib/auth";
import { MenuImportAIProvider } from "@/lib/MenuImportAIProvider";
import { getSubscriptionInfo, type SubscriptionInfo } from "@/lib/subscription";
import { engineData } from "@/lib/arles-engine";

type Tab = "dashboard" | "orders" | "menu" | "customers" | "settings" | "billing";

export function DeliveryApp() {
  const { user, signOut } = useAuth();
  useSessionGuard();
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    if (typeof window === "undefined") return "dashboard";
    return new URLSearchParams(window.location.search).get("tab") === "billing" ? "billing" : "dashboard";
  });
  const [settingsTab, setSettingsTab] = useState<"geral" | "whatsapp" | "info">("geral");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [subscription, setSubscription]     = useState<SubscriptionInfo | null>(null);

  // ── Definitive onboarding gate — only DB is truth ─────────────────────────
  const onboardingDone = useRef(false);

  useEffect(() => {
    if (!user) return;

    // Load subscription info
    getSubscriptionInfo(user.companyId).then(setSubscription);

    // Operational onboarding state now comes from Arles Engine/PostgreSQL.
    engineData<any>("company")
      .then((data) => {
        if (data?.onboarding_completed) {
          onboardingDone.current = true;
          setShowOnboarding(false);
        } else {
          setShowOnboarding(true);
        }
      })
      .catch((error) => {
        console.error("Onboarding Engine:", error);
        setShowOnboarding(true);
      });
  }, [user]);

  // ── Listen for step-completed events from StoreInfo / WhatsApp ─────────────
  // Only re-shows the onboarding overlay if it hasn't been completed yet.
  // Menu actions (add/edit product, import) do NOT dispatch this event.
  useEffect(() => {
    const handleStepDone = () => {
      if (!onboardingDone.current) {
        setShowOnboarding(true);
      }
    };
    window.addEventListener("onboarding-step-completed", handleStepDone);
    return () => window.removeEventListener("onboarding-step-completed", handleStepDone);
  }, []);

  const finishOnboarding = (goToMenu?: boolean) => {
    onboardingDone.current = true;
    setShowOnboarding(false);
    if (goToMenu) setActiveTab("menu");
  };

  const goToTab = (tab: Tab, subtab?: "geral" | "whatsapp" | "info") => {
    setActiveTab(tab);
    if (subtab) setSettingsTab(subtab);
    setShowOnboarding(false);
  };

  const NAV_ITEMS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "dashboard", label: "Dashboard",  icon: <Home className="size-4" /> },
    { id: "orders",    label: "Pedidos",    icon: <Package className="size-4" /> },
    { id: "menu",      label: "Cardápio",   icon: <Utensils className="size-4" /> },
    { id: "customers", label: "Clientes",   icon: <Users className="size-4" /> },
    { id: "settings",  label: "Ajustes",    icon: <Settings className="size-4" /> },
    { id: "billing",   label: "Assinatura", icon: <CreditCard className="size-4" /> },
  ];

  return (
    <MenuImportAIProvider>
      <div className="flex h-dvh min-h-dvh bg-background overflow-hidden relative">
        {showOnboarding && (
          <Onboarding onComplete={finishOnboarding} goToTab={goToTab} />
        )}

        {/* Desktop Sidebar */}
        <aside className="hidden md:flex w-64 border-r bg-card flex-col">
          <div className="p-6">
            <img src="/logo.png" alt="Arles" className="h-8 w-auto object-contain mb-2" style={{ filter: "var(--logo-filter)" }} />
            <p className="text-xs font-semibold text-muted-foreground truncate">{user?.company} Delivery</p>
          </div>

          <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors ${
                  activeTab === item.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>

          <div className="p-4 border-t">
            <button
              onClick={signOut}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <LogOut className="size-4" />
              Sair
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0 flex flex-col">
          {subscription && <TrialBanner subscription={subscription} />}

          {/* Mobile Header */}
          <div className="md:hidden flex items-center justify-between p-4 border-b bg-card sticky top-0 z-10" style={{ paddingTop: "calc(1rem + env(safe-area-inset-top))" }}>
            <img src="/logo.png" alt="Arles" className="h-7 w-auto object-contain" style={{ filter: "var(--logo-filter)" }} />
            <span className="text-xs font-bold text-muted-foreground bg-muted px-2 py-1 rounded-md">{user?.company}</span>
          </div>

          <div className="p-4 sm:p-8 max-w-5xl mx-auto w-full">
            {activeTab === "dashboard" && <Dashboard goToTab={goToTab} />}
            {activeTab === "orders"    && <Orders />}
            {activeTab === "menu"      && <Menu />}
            {activeTab === "customers" && <Customers />}
            {activeTab === "settings"  && <DeliverySettings initialTab={settingsTab} />}
            {activeTab === "billing"   && <Billing />}
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="md:hidden fixed inset-x-0 bottom-0 w-full border-t bg-card flex items-center justify-around pt-2 px-2 z-50" style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center w-full py-2 space-y-1 rounded-lg ${
                activeTab === item.id ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <div className={activeTab === item.id ? "scale-110 transition-transform" : ""}>
                {item.icon}
              </div>
              <span className="text-[10px] font-medium leading-none truncate max-w-full px-1">{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </MenuImportAIProvider>
  );
}
