import type { ComponentType, ReactNode } from "react";
import { Home, Utensils, Settings } from "lucide-react";
import { Dashboard } from "@/components/delivery/Dashboard";
import { Menu } from "@/components/delivery/Menu";
import { DeliverySettings } from "@/components/delivery/Settings";
import { Onboarding } from "@/components/delivery/Onboarding";
import { MenuImportAIProvider } from "@/lib/MenuImportAIProvider";
import type { UiModuleDefinition } from "@/platform/PlatformShell";

const icons: Record<string, ReactNode> = {
  dashboard: <Home className="size-4" />,
  menu: <Utensils className="size-4" />,
  settings: <Settings className="size-4" />,
};

export const deliveryUiModule: UiModuleDefinition = {
  key: "delivery",
  label: "Delivery",
  icons,
  defaultNavigation: [
    { key: "dashboard", label: "Resumo", order: 10 },
    { key: "menu", label: "Cardápio", order: 30 },
    { key: "settings", label: "Ajustes", order: 50 },
  ],
  Provider: MenuImportAIProvider as ComponentType<{ children: ReactNode }>,
  renderScreen(screen, context) {
    if (screen === "dashboard") return <Dashboard goToTab={context.goToTab as any} />;
    if (screen === "menu") return <Menu />;
    if (screen === "settings") return <DeliverySettings initialTab={context.settingsTab} />;
    return null;
  },
  renderOnboarding(context) {
    return <Onboarding onComplete={context.onComplete} goToTab={context.goToTab as any} />;
  },
};
