import { describe, expect, it } from "vitest";
import { resolveEnginePath } from "../netlify/functions/engine-proxy.mts";

describe("Core ↔ Delivery route contracts", () => {
  it("maps platform capabilities, onboarding, channels and billing", () => {
    expect(resolveEnginePath("company")).toBe("/internal/platform/company");
    expect(resolveEnginePath("capabilities")).toBe("/internal/platform/capabilities");
    expect(resolveEnginePath("onboarding/complete")).toBe("/internal/platform/onboarding/complete");
    expect(resolveEnginePath("whatsapp/status")).toBe("/internal/platform/channels/whatsapp");
    expect(resolveEnginePath("billing/subscription")).toBe(
      "/internal/platform/billing/subscription",
    );
  });

  it("maps Delivery resources into the vertical namespace and enforces allowlist", () => {
    expect(resolveEnginePath("orders")).toBe("/internal/verticals/delivery/orders");
    expect(resolveEnginePath("orders/123e4567-e89b-12d3-a456-426614174000/status")).toBe(
      "/internal/verticals/delivery/orders/123e4567-e89b-12d3-a456-426614174000/status",
    );
    expect(resolveEnginePath("../../internal/billing/context")).toBeNull();
    expect(resolveEnginePath("verticals/test/private")).toBeNull();
  });
});
