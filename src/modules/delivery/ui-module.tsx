import type { ComponentType, ReactNode } from "react";
import { Home, Package, Utensils, Settings, Users } from "lucide-react";
import { Dashboard } from "@/components/delivery/Dashboard";
import { Orders } from "@/components/delivery/Orders";
import { Menu } from "@/components/delivery/Menu";
import { Customers } from "@/components/delivery/Customers";
import { DeliverySettings } from "@/components/delivery/Settings";
import { Onboarding } from "@/components/delivery/Onboarding";
import { MenuImportAIProvider } from "@/lib/MenuImportAIProvider";
import type { UiModuleDefinition } from "@/platform/PlatformShell";

const icons: Record<string, ReactNode> = {
  dashboard: <Home className="size-4" />,
  orders: <Package className="size-4" />,
  menu: <Utensils className="size-4" />,
  customers: <Users className="size-4" />,
  settings: <Settings className="size-4" />,
};

export const deliveryUiModule: UiModuleDefinition = {
  key: "delivery",
  label: "Delivery",
  icons,
  defaultNavigation: [
    { key: "dashboard", label: "Dashboard", order: 10 },
    { key: "orders", label: "Pedidos", order: 20 },
    { key: "menu", label: "Cardápio", order: 30 },
    { key: "customers", label: "Clientes", order: 40 },
    { key: "settings", label: "Ajustes", order: 50 },
  ],
  Provider: MenuImportAIProvider as ComponentType<{ children: ReactNode }>,
  renderScreen(screen, context) {
    if (screen === "dashboard") return <Dashboard goToTab={context.goToTab as any} />;
    if (screen === "orders") return <Orders />;
    if (screen === "menu") return <Menu />;
    if (screen === "customers") return <Customers />;
    if (screen === "settings") return <DeliverySettings initialTab={context.settingsTab} />;
    return null;
  },
  renderOnboarding(context) {
    return <Onboarding onComplete={context.onComplete} goToTab={context.goToTab as any} />;
  },
};
