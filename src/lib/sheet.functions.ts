import { createServerFn } from "@tanstack/react-start";

export const getSheetDataset = createServerFn({ method: "GET" }).handler(async () => {
  const { fetchSheetDataset } = await import("./sheet.server");
  return fetchSheetDataset();
});
