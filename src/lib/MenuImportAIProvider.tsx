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
type MenuImportResult = { categories: MenuCategory[] };

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
};

function renderRegion(
  img: HTMLImageElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  targetWidth: number,
): string {
  const canvas = document.createElement("canvas");
  const scale = Math.min(targetWidth / sw, 2.2);
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.86);
}

/** Original compressed + overlapping enlarged regions for small-text recovery. */
async function processImageWithCrops(file: File, sourceIndex: number): Promise<PreparedImage[]> {
  const img = await fileToImage(file);
  const results: PreparedImage[] = [];

  results.push({
    data: renderRegion(img, 0, 0, img.width, img.height, 1600),
    mime: "image/jpeg",
    label: `Foto ${sourceIndex + 1} — imagem completa`,
    isOriginal: true,
  });

  if (img.height >= img.width * 1.05) {
    const cropHeight = Math.min(img.height, Math.round(img.height * 0.4));
    const maxY = Math.max(0, img.height - cropHeight);
    const offsets = [0, 0.22, 0.44, 0.6].map((ratio) => Math.min(maxY, Math.round(img.height * ratio)));
    const labels = ["topo", "meio superior", "meio inferior", "rodapé"];

    offsets.forEach((y, i) => {
      results.push({
        data: renderRegion(img, 0, y, img.width, cropHeight, 1700),
        mime: "image/jpeg",
        label: `Foto ${sourceIndex + 1} — recorte ampliado: ${labels[i]}`,
        isOriginal: false,
      });
    });
  } else {
    const cropWidth = Math.min(img.width, Math.round(img.width * 0.58));
    const maxX = Math.max(0, img.width - cropWidth);
    [0, maxX].forEach((x, i) => {
      results.push({
        data: renderRegion(img, x, 0, cropWidth, img.height, 1700),
        mime: "image/jpeg",
        label: `Foto ${sourceIndex + 1} — recorte ampliado: coluna ${i === 0 ? "esquerda" : "direita"}`,
        isOriginal: false,
      });
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
    const imagesNested = await Promise.all(
      fileArray.map((file, index) => processImageWithCrops(file, index)),
    );
    const images = imagesNested.flat();

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

    const deadline = Date.now() + 3 * 60 * 1000;

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
        throw new Error(
          job.error || "Não foi possível analisar o cardápio. Tente novamente.",
        );
      }
    }

    throw new Error(
      "A análise demorou mais que o esperado. Tente novamente em alguns instantes.",
    );
  };

  const confirmImport = async (
    categories: MenuCategory[]
  ): Promise<{ imported: number }> => {
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
  if (!ctx)
    throw new Error("useMenuImportAI deve ser usado dentro de MenuImportAIProvider");
  return ctx;
}
