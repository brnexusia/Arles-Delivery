import type { ComponentType } from "react";
import type { PlatformModule } from "@/lib/auth";
import { PlatformShell } from "@/platform/PlatformShell";
import { deliveryUiModule } from "@/modules/delivery/ui-module";

type ModuleComponent = ComponentType;

const componentRegistry = new Map<string, ModuleComponent>([
  [
    "delivery",
    () => {
      throw new Error("MODULE_MANIFEST_REQUIRED");
    },
  ],
]);

export function resolveModuleComponent(modules: PlatformModule[]): ModuleComponent | null {
  for (const module of modules) {
    if (!componentRegistry.has(module.key)) continue;
    if (module.key === deliveryUiModule.key) {
      return () => <PlatformShell definition={deliveryUiModule} manifest={module} />;
    }
  }
  return null;
}
