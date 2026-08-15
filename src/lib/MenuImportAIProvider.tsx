import { createContext, useContext, ReactNode } from "react";
import { useAuth } from "./auth";
import { engineRequest } from "@/lib/arles-engine";

type MenuVariation = { name: string; price: number };
type MenuProduct = {
  name: string;
  description?: string;
  price?: number | null;
  available?: boolean;
  variations?: MenuVariation[];
  ignore?: boolean;
};
type MenuCategory = { name: string; products: MenuProduct[] };
type MenuImportResult = {
  categories: MenuCategory[];
  analysis?: {
    sourceImages: number;
    regionsAnalyzed: number;
    passesCompleted: number;
    productsWithoutPrice: number;
  };
};

type AIContextType = {
  extractMenu: (files: File | File[]) => Promise<MenuImportResult>;
  confirmImport: (categories: MenuCategory[]) => Promise<{ imported: number }>;
};

const MenuImportAIContext = createContext<AIContextType | null>(null);

/** Convert a File to an Image element */
function fileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

type PreparedImage = {
  data: string;
  mime: "image/jpeg";
  label: string;
  isOriginal: boolean;
  sourceIndex: number;
  priority: number;
};

type CropRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  priority: number;
};

const MAX_SOURCE_FILES = 6;
const MAX_PREPARED_BYTES = 24 * 1024 * 1024;
const MAX_RENDER_PIXELS = 4_800_000;

function renderRegion(
  img: HTMLImageElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  targetWidth: number,
): string {
  const canvas = document.createElement("canvas");
  const requestedScale = Math.min(targetWidth / sw, 2.4);
  const pixelSafeScale = Math.sqrt(MAX_RENDER_PIXELS / Math.max(1, sw * sh));
  const scale = Math.max(0.1, Math.min(requestedScale, pixelSafeScale));
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.88);
}

/**
 * Builds overlapping regions according to the menu layout. Overlap is deliberate:
 * headings and prices near a crop edge remain visible in the next region.
 */
function buildMenuCropPlan(width: number, height: number): CropRegion[] {
  const aspect = height / Math.max(1, width);

  if (aspect >= 1.05) {
    const cropHeight = 0.36;
    return [0, 0.21, 0.42, 0.64].map((y, index) => ({
      x: 0,
      y,
      width: 1,
      height: Math.min(cropHeight, 1 - y),
      label: ["topo", "meio superior", "meio inferior", "rodapé"][index]!,
      priority: index === 3 ? 1 : 2,
    }));
  }

  if (aspect >= 0.72) {
    return [
      { x: 0, y: 0, width: 0.56, height: 0.56, label: "quadrante superior esquerdo", priority: 2 },
      {
        x: 0.44,
        y: 0,
        width: 0.56,
        height: 0.56,
        label: "quadrante superior direito",
        priority: 2,
      },
      {
        x: 0,
        y: 0.44,
        width: 0.56,
        height: 0.56,
        label: "quadrante inferior esquerdo",
        priority: 1,
      },
      {
        x: 0.44,
        y: 0.44,
        width: 0.56,
        height: 0.56,
        label: "quadrante inferior direito",
        priority: 1,
      },
    ];
  }

  const columns =
    aspect < 0.42
      ? [0, 0.23, 0.46, 0.68].map((x, index) => ({
          x,
          y: 0,
          width: Math.min(0.32, 1 - x),
          height: 1,
          label: `coluna ${index + 1}`,
          priority: index === 3 ? 1 : 2,
        }))
      : [0, 0.29, 0.58].map((x, index) => ({
          x,
          y: 0,
          width: Math.min(0.42, 1 - x),
          height: 1,
          label: ["coluna esquerda", "coluna central", "coluna direita"][index]!,
          priority: index === 2 ? 1 : 2,
        }));

  return columns;
}

function preparedImageBytes(image: PreparedImage): number {
  const base64 = image.data.includes(",")
    ? image.data.slice(image.data.indexOf(",") + 1)
    : image.data;
  return Math.ceil((base64.length * 3) / 4);
}

function fitPreparedImagesToBudget(images: PreparedImage[]): PreparedImage[] {
  const originals = images.filter((image) => image.isOriginal);
  const crops = images
    .filter((image) => !image.isOriginal)
    .sort((a, b) => a.priority - b.priority || a.sourceIndex - b.sourceIndex);
  const selected = [...originals];
  let bytes = selected.reduce((sum, image) => sum + preparedImageBytes(image), 0);

  // Round-robin by source keeps every page represented before adding extra regions.
  const queues = new Map<number, PreparedImage[]>();
  for (const crop of crops) {
    const queue = queues.get(crop.sourceIndex) ?? [];
    queue.push(crop);
    queues.set(crop.sourceIndex, queue);
  }

  while ([...queues.values()].some((queue) => queue.length > 0)) {
    for (const queue of queues.values()) {
      const crop = queue.shift();
      if (!crop) continue;
      const cropBytes = preparedImageBytes(crop);
      if (bytes + cropBytes <= MAX_PREPARED_BYTES) {
        selected.push(crop);
        bytes += cropBytes;
      }
    }
  }

  return selected.sort(
    (a, b) => a.sourceIndex - b.sourceIndex || Number(b.isOriginal) - Number(a.isOriginal),
  );
}

/** Original compressed + layout-aware overlapping enlarged regions. */
async function processImageWithCrops(file: File, sourceIndex: number): Promise<PreparedImage[]> {
  const img = await fileToImage(file);
  const results: PreparedImage[] = [];

  results.push({
    data: renderRegion(img, 0, 0, img.width, img.height, 1800),
    mime: "image/jpeg",
    label: `Foto ${sourceIndex + 1} — imagem completa`,
    isOriginal: true,
    sourceIndex,
    priority: 0,
  });

  for (const region of buildMenuCropPlan(img.width, img.height)) {
    const sx = Math.round(region.x * img.width);
    const sy = Math.round(region.y * img.height);
    const sw = Math.max(1, Math.round(region.width * img.width));
    const sh = Math.max(1, Math.round(region.height * img.height));
    results.push({
      data: renderRegion(img, sx, sy, sw, sh, 2100),
      mime: "image/jpeg",
      label: `Foto ${sourceIndex + 1} — recorte ampliado: ${region.label}`,
      isOriginal: false,
      sourceIndex,
      priority: region.priority,
    });
  }

  return results;
}

export function MenuImportAIProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  /**
   * Extract menu from one or more image files.
   * Sends original + automatic crops to the AI for better text recognition.
   */
  const extractMenu = async (files: File | File[]): Promise<MenuImportResult> => {
    if (!user) throw new Error("Usuário não autenticado");

    const fileArray = Array.isArray(files) ? files : [files];
    if (!fileArray.length) throw new Error("Selecione pelo menos uma foto do cardápio.");
    if (fileArray.length > MAX_SOURCE_FILES) {
      throw new Error(`Envie no máximo ${MAX_SOURCE_FILES} fotos por análise.`);
    }
    const imagesNested = await Promise.all(
      fileArray.map((file, index) => processImageWithCrops(file, index)),
    );
    const images = fitPreparedImagesToBudget(imagesNested.flat()).map(
      ({ priority, ...image }) => image,
    );

    const started = await engineRequest<{
      ok: boolean;
      job_id: string;
      status: "processing";
    }>("menu/analyze", {
      method: "POST",
      body: { images },
    });

    if (!started?.job_id) {
      throw new Error("Não foi possível iniciar a análise do cardápio.");
    }

    const deadline = Date.now() + 4 * 60 * 1000;

    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 1200));

      const job = await engineRequest<{
        ok: boolean;
        status: "processing" | "done" | "error";
        data?: MenuImportResult;
        error?: string;
      }>(`menu/analyze/${started.job_id}`);

      if (job.status === "done" && job.data) {
        return job.data;
      }

      if (job.status === "error") {
        throw new Error(job.error || "Não foi possível analisar o cardápio. Tente novamente.");
      }
    }

    throw new Error("A análise demorou mais que o esperado. Tente novamente em alguns instantes.");
  };

  const confirmImport = async (categories: MenuCategory[]): Promise<{ imported: number }> => {
    if (!user) throw new Error("Usuário não autenticado");

    const data = await engineRequest<{ ok: boolean; imported: number }>("menu/import", {
      method: "POST",
      body: { categories },
    });

    if (!data.ok) throw new Error("Erro ao salvar importação");
    return { imported: data.imported };
  };

  return (
    <MenuImportAIContext.Provider value={{ extractMenu, confirmImport }}>
      {children}
    </MenuImportAIContext.Provider>
  );
}

export function useMenuImportAI() {
  const ctx = useContext(MenuImportAIContext);
  if (!ctx) throw new Error("useMenuImportAI deve ser usado dentro de MenuImportAIProvider");
  return ctx;
}
