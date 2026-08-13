import { describe, expect, it } from "vitest";
import { normalizeUser } from "../src/lib/auth";

describe("auth capability contract", () => {
  it("uses modules and capabilities as the primary source", () => {
    const user = normalizeUser({
      companyId: "tenant-a",
      role: "user",
      has_delivery: false,
      capabilities: {
        "vertical.delivery": { status: "active", configuration: {} },
      },
      modules: [
        {
          key: "delivery",
          name: "Arles Delivery",
          capability: "vertical.delivery",
          ui: { entry: "delivery", navigation: [] },
        },
      ],
    });
    expect(user?.modules[0]?.key).toBe("delivery");
    expect(user?.has_delivery).toBe(true);
  });

  it("preserves the legacy flag only as compatibility fallback", () => {
    const user = normalizeUser({ companyId: "tenant-a", has_delivery: true });
    expect(user?.modules[0]?.key).toBe("delivery");
  });
});
