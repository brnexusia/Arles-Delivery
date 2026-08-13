import { describe, expect, it } from "vitest";
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { staticDataset } from "../src/lib/data";

describe("browser PII boundary", () => {
  it("does not ship a multi-tenant fallback dataset", async () => {
    expect(staticDataset).toEqual({ companies: [], contacts: [], fetchedAt: null });
    await expect(access("src/data/contacts.json", constants.F_OK)).rejects.toBeTruthy();
  });

  it("filters legacy metrics on the server by the authenticated company", async () => {
    const source = await readFile("netlify/functions/legacy-metrics.mts", "utf8");
    expect(source).toContain("engineSession(req, context)");
    expect(source).toContain('.eq("Company", company)');
    expect(source).not.toContain('.select("*")');
  });
});
