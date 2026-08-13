import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { CreditCard, LogOut } from "lucide-react";
import { useAuth, useSessionGuard, type PlatformModule } from "@/lib/auth";
import { getSubscriptionInfo, type SubscriptionInfo } from "@/lib/subscription";
import { engineData } from "@/lib/arles-engine";
import { TrialBanner } from "@/platform/billing/TrialBanner";
import { Billing } from "@/platform/billing/Billing";

export type UiModuleDefinition = {
  key: string;
  label: string;
  icons: Record<string, ReactNode>;
  defaultNavigation: Array<{ key: string; label: string; order: number }>;
  Provider?: ComponentType<{ children: ReactNode }>;
  renderScreen: (
    screen: string,
    context: {
      goToTab: (tab: string, subtab?: "geral" | "whatsapp" | "info") => void;
      settingsTab: "geral" | "whatsapp" | "info";
    },
  ) => ReactNode;
  renderOnboarding?: (context: {
    onComplete: (goToMenu?: boolean) => void;
    goToTab: (tab: string, subtab?: "geral" | "whatsapp" | "info") => void;
  }) => ReactNode;
};

export function PlatformShell({
  definition,
  manifest,
}: {
  definition: UiModuleDefinition;
  manifest: PlatformModule;
}) {
  const { user, signOut } = useAuth();
  useSessionGuard();
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === "undefined") return "dashboard";
    return new URLSearchParams(window.location.search).get("tab") === "billing"
      ? "billing"
      : "dashboard";
  });
  const [settingsTab, setSettingsTab] = useState<"geral" | "whatsapp" | "info">("geral");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const onboardingDone = useRef(false);

  useEffect(() => {
    if (!user) return;
    void getSubscriptionInfo(user.companyId).then(setSubscription);
    void engineData<any>("company")
      .then((data) => {
        onboardingDone.current = data?.onboarding_completed === true;
        setShowOnboarding(!onboardingDone.current);
      })
      .catch(() => setShowOnboarding(true));
  }, [user]);

  useEffect(() => {
    const handleStepDone = () => {
      if (!onboardingDone.current) setShowOnboarding(true);
    };
    window.addEventListener("onboarding-step-completed", handleStepDone);
    return () => window.removeEventListener("onboarding-step-completed", handleStepDone);
  }, []);

  const finishOnboarding = (goToMenu?: boolean) => {
    onboardingDone.current = true;
    setShowOnboarding(false);
    if (goToMenu) setActiveTab("menu");
  };

  const goToTab = (tab: string, subtab?: "geral" | "whatsapp" | "info") => {
    setActiveTab(tab);
    if (subtab) setSettingsTab(subtab);
    setShowOnboarding(false);
  };

  const moduleNavigation = manifest.ui?.navigation?.length
    ? [...manifest.ui.navigation].sort((a, b) => a.order - b.order)
    : definition.defaultNavigation;
  const navigation = [
    ...moduleNavigation,
    { key: "billing", label: "Assinatura", icon: "credit-card", order: 1000 },
  ];
  const Provider = definition.Provider ?? (({ children }) => <>{children}</>);

  return (
    <Provider>
      <div className="flex h-dvh min-h-dvh bg-background overflow-hidden relative">
        {showOnboarding &&
          definition.renderOnboarding?.({
            onComplete: finishOnboarding,
            goToTab,
          })}

        <aside className="hidden md:flex w-64 border-r bg-card flex-col">
          <div className="p-6">
            <img
              src="/logo.png"
              alt="Arles"
              className="h-8 w-auto object-contain mb-2"
              style={{ filter: "var(--logo-filter)" }}
            />
            <p className="text-xs font-semibold text-muted-foreground truncate">{user?.company}</p>
          </div>
          <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => (
              <button
                key={item.key}
                onClick={() => setActiveTab(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === item.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"}`}
              >
                {item.key === "billing" ? (
                  <CreditCard className="size-4" />
                ) : (
                  definition.icons[item.key]
                )}
                {item.label}
              </button>
            ))}
          </nav>
          <div className="p-4 border-t">
            <button
              onClick={signOut}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <LogOut className="size-4" /> Sair
            </button>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0 flex flex-col">
          {subscription && <TrialBanner subscription={subscription} />}
          <div
            className="md:hidden flex items-center justify-between p-4 border-b bg-card sticky top-0 z-10"
            style={{ paddingTop: "calc(1rem + env(safe-area-inset-top))" }}
          >
            <img
              src="/logo.png"
              alt="Arles"
              className="h-7 w-auto object-contain"
              style={{ filter: "var(--logo-filter)" }}
            />
            <span className="text-xs font-bold text-muted-foreground bg-muted px-2 py-1 rounded-md">
              {user?.company}
            </span>
          </div>
          <div className="p-4 sm:p-8 max-w-5xl mx-auto w-full">
            {activeTab === "billing" ? (
              <Billing />
            ) : (
              definition.renderScreen(activeTab, { goToTab, settingsTab })
            )}
          </div>
        </main>

        <nav
          className="md:hidden fixed inset-x-0 bottom-0 w-full border-t bg-card flex items-center justify-around pt-2 px-2 z-50"
          style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
        >
          {navigation.map((item) => (
            <button
              key={item.key}
              onClick={() => setActiveTab(item.key)}
              className={`flex flex-col items-center justify-center w-full py-2 space-y-1 rounded-lg ${activeTab === item.key ? "text-primary" : "text-muted-foreground"}`}
            >
              <div className={activeTab === item.key ? "scale-110 transition-transform" : ""}>
                {item.key === "billing" ? (
                  <CreditCard className="size-4" />
                ) : (
                  definition.icons[item.key]
                )}
              </div>
              <span className="text-[10px] font-medium leading-none truncate max-w-full px-1">
                {item.label}
              </span>
            </button>
          ))}
        </nav>
      </div>
    </Provider>
  );
}
