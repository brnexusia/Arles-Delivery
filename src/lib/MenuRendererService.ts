/**
 * MenuRendererService
 *
 * Renders visual menu pages from the store's active products using the browser's
 * Canvas 2D API, uploads each page as a PNG to Supabase Storage (bucket: menu-assets),
 * and persists the URLs in the menu_assets table.
 *
 * All rendering is done client-side — no extra dependencies needed.
 */

import { engineData, engineRequest } from "./arles-engine";

// ── Design tokens ─────────────────────────────────────────────────────────────

const W = 800;
const H = 1200;
const PM = 56; // page margin

// Colour palette
const C = {
  // Cover
  coverDeep:   "#0C0418",
  coverMid:    "#1E0B3D",
  coverTop:    "#3B1578",
  glowViolet:  "#7C3AED",
  glowFuchsia: "#A855F7",

  // Product pages
  pageBg:      "#F9F6FF", // very light lavender
  headerDeep:  "#13062A",
  headerPurple:"#3B1578",
  headerAccent:"#7C3AED",

  // Typography
  white:       "#FFFFFF",
  cream:       "#EDE8FF",
  textDark:    "#1A0A32",
  textMid:     "#4A3F6B",
  textLight:   "#9A90B8",

  // Accents
  gold:        "#F4B740",
  goldDim:     "#7A5A10",
  priceBg:     "#2A0F5A",
  priceText:   "#F4B740",
  separatorLine:"#D9D0EF",

  // Footer
  footerBg:    "#13062A",
  footerText:  "#6B5FA0",
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StoreData {
  company: string;
  store_name?: string;
  short_description?: string;
  logo_url?: string;
}

export interface ProductRow {
  id: string;
  name: string;
  description?: string;
  price: number | null;
  category: string;
  is_active: boolean;
}

export interface MenuAsset {
  id: string;
  company_id: string;
  page_number: number;
  image_url: string;
  type: string;
  category?: string;
  is_active: boolean;
  created_at: string;
}

// ── Canvas helpers ─────────────────────────────────────────────────────────────

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  return canvas;
}

function ctx(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const c = canvas.getContext("2d") as CanvasRenderingContext2D;
  c.textBaseline = "top";
  return c;
}

function roundRect(
  c: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y);
  c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r);
  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r);
  c.quadraticCurveTo(x, y, x + r, y);
  c.closePath();
}

// Clip-safe rounded fill
function fillRoundRect(
  c: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
  fill: string
) {
  c.fillStyle = fill;
  roundRect(c, x, y, w, h, r);
  c.fill();
}

function wrapText(
  c: CanvasRenderingContext2D,
  text: string,
  x: number, y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 2,
  align: CanvasTextAlign = "left"
): number {
  const prevAlign = c.textAlign;
  c.textAlign = align;

  const words = text.split(" ");
  let line = "";
  let currentY = y;
  let linesDrawn = 0;

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (c.measureText(test).width > maxWidth && line) {
      c.fillText(line, x, currentY);
      linesDrawn++;
      currentY += lineHeight;
      if (linesDrawn >= maxLines) { c.textAlign = prevAlign; return currentY; }
      line = word;
    } else {
      line = test;
    }
  }
  if (line) {
    c.fillText(line, x, currentY);
    currentY += lineHeight;
  }

  c.textAlign = prevAlign;
  return currentY;
}

// Draw a decorative diamond + line ornament, centred at (cx, cy)
function drawOrnament(c: CanvasRenderingContext2D, cx: number, cy: number, lineW: number, color: string) {
  const d = 6; // diamond half-size
  c.strokeStyle = color;
  c.fillStyle = color;
  c.lineWidth = 1;

  // Left line
  c.beginPath();
  c.moveTo(cx - lineW / 2, cy);
  c.lineTo(cx - d * 2.5, cy);
  c.stroke();

  // Diamond
  c.beginPath();
  c.moveTo(cx, cy - d);
  c.lineTo(cx + d, cy);
  c.lineTo(cx, cy + d);
  c.lineTo(cx - d, cy);
  c.closePath();
  c.fill();

  // Right line
  c.beginPath();
  c.moveTo(cx + d * 2.5, cy);
  c.lineTo(cx + lineW / 2, cy);
  c.stroke();
}

// Draw scattered micro-dots for texture
function drawDotGrid(
  c: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  spacing: number, radius: number, alpha: number, color: string
) {
  c.save();
  c.globalAlpha = alpha;
  c.fillStyle = color;
  for (let px = x; px < x + w; px += spacing) {
    for (let py = y; py < y + h; py += spacing) {
      c.beginPath();
      c.arc(px, py, radius, 0, Math.PI * 2);
      c.fill();
    }
  }
  c.restore();
}

async function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error("Canvas toBlob failed")),
      "image/png"
    );
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("FileReader result is not string"));
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ── Shared footer ──────────────────────────────────────────────────────────────

function drawFooter(c: CanvasRenderingContext2D) {
  c.fillStyle = C.footerBg;
  c.fillRect(0, H - 56, W, 56);

  // Thin top accent line
  c.fillStyle = C.glowViolet;
  c.fillRect(0, H - 56, W, 2);

  c.fillStyle = C.footerText;
  c.font = "500 13px system-ui, sans-serif";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText("Criado com Arles Delivery  ·  @arlesdelivery", W / 2, H - 28);
  c.textBaseline = "top";
}

// ── COVER PAGE ────────────────────────────────────────────────────────────────

async function renderCoverPage(store: StoreData): Promise<Blob> {
  const canvas = createCanvas();
  const c = ctx(canvas);

  // ── 1. Background: deep radial gradient ──
  const bgGrad = c.createRadialGradient(W / 2, H * 0.42, 60, W / 2, H * 0.42, W * 1.1);
  bgGrad.addColorStop(0, C.coverTop);
  bgGrad.addColorStop(0.55, C.coverMid);
  bgGrad.addColorStop(1, C.coverDeep);
  c.fillStyle = bgGrad;
  c.fillRect(0, 0, W, H);

  // ── 2. Subtle dot-grid texture ──
  drawDotGrid(c, 0, 0, W, H, 28, 1.2, 0.07, "#C084FC");

  // ── 3. Large decorative circles (depth) ──
  c.save();
  // top-right glow circle
  const gr1 = c.createRadialGradient(W + 60, -80, 0, W + 60, -80, 420);
  gr1.addColorStop(0, "rgba(168,85,247,0.28)");
  gr1.addColorStop(1, "rgba(168,85,247,0)");
  c.fillStyle = gr1;
  c.fillRect(0, 0, W, H);
  // bottom-left glow circle
  const gr2 = c.createRadialGradient(-80, H + 40, 0, -80, H + 40, 500);
  gr2.addColorStop(0, "rgba(124,58,237,0.22)");
  gr2.addColorStop(1, "rgba(124,58,237,0)");
  c.fillStyle = gr2;
  c.fillRect(0, 0, W, H);
  c.restore();

  // ── 4. Decorative ring (outer thin stroke circle) ──
  const ringCX = W / 2;
  const ringCY = 420;
  const ringR1 = 230; // outer ring
  const ringR2 = 185; // inner ring

  c.save();
  c.strokeStyle = "rgba(168,85,247,0.18)";
  c.lineWidth = 1;
  c.beginPath(); c.arc(ringCX, ringCY, ringR1, 0, Math.PI * 2); c.stroke();
  c.strokeStyle = "rgba(168,85,247,0.10)";
  c.lineWidth = 1;
  c.beginPath(); c.arc(ringCX, ringCY, ringR1 + 18, 0, Math.PI * 2); c.stroke();
  c.strokeStyle = "rgba(168,85,247,0.28)";
  c.lineWidth = 1.5;
  c.beginPath(); c.arc(ringCX, ringCY, ringR2, 0, Math.PI * 2); c.stroke();
  c.restore();

  // ── 5. Logo and Content Layout ──
  const hasLogo = !!store.logo_url;
  const storeName = store.store_name || store.company;
  const logoR = 140;
  
  let currentY = ringCY + logoR + 46; // Default Y if logo is present

  if (hasLogo) {
    // ── Logo Fill & Image ──
    const logoGrad = c.createRadialGradient(ringCX, ringCY, 0, ringCX, ringCY, logoR);
    logoGrad.addColorStop(0, "rgba(255,255,255,0.10)");
    logoGrad.addColorStop(1, "rgba(255,255,255,0.03)");
    c.save();
    c.beginPath(); c.arc(ringCX, ringCY, logoR, 0, Math.PI * 2);
    c.fillStyle = logoGrad;
    c.fill();
    c.restore();

    const img = await loadImage(store.logo_url!);
    if (img) {
      const s = 180;
      c.save();
      c.beginPath(); c.arc(ringCX, ringCY, logoR - 4, 0, Math.PI * 2);
      c.clip();
      c.drawImage(img, ringCX - s / 2, ringCY - s / 2, s, s);
      c.restore();
    } else {
      c.font = "80px system-ui";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText("🍽", ringCX, ringCY);
      c.textBaseline = "top";
    }
  } else {
    // ── No Logo: Faint decorative circle and centered text ──
    const logoGrad = c.createRadialGradient(ringCX, ringCY, 0, ringCX, ringCY, logoR * 1.5);
    logoGrad.addColorStop(0, "rgba(255,255,255,0.06)");
    logoGrad.addColorStop(1, "rgba(255,255,255,0)");
    c.save();
    c.beginPath(); c.arc(ringCX, ringCY, logoR * 1.5, 0, Math.PI * 2);
    c.fillStyle = logoGrad;
    c.fill();
    c.restore();

    // Start text block higher to center it within the decorative rings
    currentY = ringCY - 80;
  }

  // ── 6. "CARDÁPIO" eyebrow ──
  c.fillStyle = C.gold;
  c.font = "600 13px system-ui, sans-serif";
  c.textAlign = "center";
  c.letterSpacing = "5px";
  c.fillText("C A R D Á P I O", W / 2, currentY);
  c.letterSpacing = "0px";
  currentY += 32;

  // ── 7. Store name ──
  c.fillStyle = C.white;
  c.textAlign = "center";

  let fontSize = hasLogo ? 60 : 72;
  const maxW = W - 120;
  c.font = `bold ${fontSize}px system-ui, sans-serif`;
  
  const words = storeName.split(" ");
  const lines = [];
  let currentLine = "";
  
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (c.measureText(testLine).width > maxW && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);

  // Auto-scale if single very long word
  if (lines.length === 1 && c.measureText(storeName).width > maxW) {
    fontSize = hasLogo ? 48 : 56;
    c.font = `bold ${fontSize}px system-ui, sans-serif`;
  }

  for (const line of lines) {
    c.fillText(line, W / 2, currentY);
    currentY += fontSize * 1.15;
  }

  // ── 8. Ornament divider ──
  currentY += 15;
  drawOrnament(c, W / 2, currentY, 260, C.glowViolet);
  currentY += 35;

  // ── 9. Subtitle ──
  c.fillStyle = C.cream;
  c.font = "400 21px system-ui, sans-serif";
  c.textAlign = "center";
  c.fillText(
    store.short_description
      ? store.short_description
      : "Confira nosso cardápio e faça seu pedido",
    W / 2, currentY
  );
  currentY += 50;

  // ── 10. WhatsApp CTA pill ──
  const pillW = 380, pillH = 54, pillX = (W - pillW) / 2;
  const pillGrad = c.createLinearGradient(pillX, currentY, pillX + pillW, currentY);
  pillGrad.addColorStop(0, "rgba(124,58,237,0.55)");
  pillGrad.addColorStop(1, "rgba(168,85,247,0.55)");
  c.fillStyle = pillGrad;
  roundRect(c, pillX, currentY, pillW, pillH, 27);
  c.fill();

  c.strokeStyle = "rgba(196,181,253,0.45)";
  c.lineWidth = 1;
  roundRect(c, pillX, currentY, pillW, pillH, 27);
  c.stroke();

  c.fillStyle = C.cream;
  c.font = "500 17px system-ui, sans-serif";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText("📲  Peça pelo WhatsApp agora", W / 2, currentY + pillH / 2);
  c.textBaseline = "top";

  drawFooter(c);
  return canvasToBlob(canvas);
}

// ── PRODUCT PAGE ──────────────────────────────────────────────────────────────

function renderCategoryPage(
  blocks: { category: string; items: ProductRow[] }[],
  pageNum: number,
  totalPages: number
): Promise<Blob> {
  return new Promise<Blob>(async (resolve) => {
    const canvas = createCanvas();
    const c = ctx(canvas);

    // ── 1. Background ──
    c.fillStyle = C.pageBg;
    c.fillRect(0, 0, W, H);

    // Subtle right-edge glow
    const bgEdge = c.createRadialGradient(W, 0, 0, W, 0, W * 0.8);
    bgEdge.addColorStop(0, "rgba(124,58,237,0.06)");
    bgEdge.addColorStop(1, "rgba(124,58,237,0)");
    c.fillStyle = bgEdge;
    c.fillRect(0, 0, W, H);

    // Micro-dot texture (very subtle)
    drawDotGrid(c, 0, 0, W, H, 32, 0.9, 0.04, C.glowViolet);

    // ── 2. Top header band ──
    const headerH = 120;
    const hGrad = c.createLinearGradient(0, 0, W, headerH);
    hGrad.addColorStop(0, C.headerDeep);
    hGrad.addColorStop(1, C.headerPurple);
    c.fillStyle = hGrad;
    c.fillRect(0, 0, W, headerH);

    // Header bottom accent line
    c.fillStyle = C.glowViolet;
    c.fillRect(0, headerH - 3, W, 3);

    // Page indicator (top-right in header)
    c.fillStyle = "rgba(255,255,255,0.35)";
    c.font = "500 13px system-ui, sans-serif";
    c.textAlign = "right";
    c.fillText(`${pageNum} / ${totalPages}`, W - PM, 18);

    // Category name (or combined names for multi-block pages)
    const allCats = blocks.map(b => b.category).join("  ·  ");
    c.fillStyle = C.white;
    c.font = "bold 38px system-ui, sans-serif";
    c.textAlign = "left";
    if (c.measureText(allCats).width > W - PM * 2) {
      c.font = "bold 28px system-ui, sans-serif";
    }
    c.fillText(allCats, PM, 42);

    // Gold underline accent
    c.fillStyle = C.gold;
    c.fillRect(PM, 95, 48, 4);

    // ── 3. Products ──
    let currentY = headerH + 32;
    const contentBottom = H - 56 - 16; // above footer
    const itemW = W - PM * 2;

    for (const block of blocks) {
      // If multiple blocks, show sub-category label (only when > 1 block)
      if (blocks.length > 1) {
        c.fillStyle = C.glowViolet;
        c.font = "700 14px system-ui, sans-serif";
        c.textAlign = "left";
        c.letterSpacing = "2px";
        c.fillText(block.category.toUpperCase(), PM, currentY);
        c.letterSpacing = "0px";
        currentY += 28;
      }

      for (let i = 0; i < block.items.length; i++) {
        const prod = block.items[i];
        if (currentY + 50 > contentBottom) break; // safety guard

        const rowStartY = currentY;

        // ── Price badge ──
        const priceStr = prod.price !== null && prod.price !== undefined
          ? `R$ ${Number(prod.price).toFixed(2).replace(".", ",")}`
          : "Consultar";

        c.font = "bold 18px system-ui, sans-serif";
        const priceW = c.measureText(priceStr).width + 28;
        const priceH = 36;
        const priceX = PM + itemW - priceW;
        const priceY = rowStartY;

        fillRoundRect(c, priceX, priceY, priceW, priceH, 8, C.priceBg);
        c.fillStyle = C.priceText;
        c.font = "bold 17px system-ui, sans-serif";
        c.textAlign = "right";
        c.fillText(priceStr, priceX + priceW - 14, priceY + 10);

        // ── Product name ──
        c.fillStyle = C.textDark;
        c.font = "bold 21px system-ui, sans-serif";
        c.textAlign = "left";
        const maxNameW = priceX - PM - 16;
        // Truncate if too long
        let displayName = prod.name;
        while (c.measureText(displayName).width > maxNameW && displayName.length > 4) {
          displayName = displayName.slice(0, -2) + "…";
        }
        c.fillText(displayName, PM, rowStartY + 8);
        currentY = rowStartY + 36;

        // ── Description ──
        if (prod.description) {
          c.fillStyle = C.textMid;
          c.font = "400 15px system-ui, sans-serif";
          c.textAlign = "left";
          const afterDesc = wrapText(c, prod.description, PM, currentY, itemW * 0.80, 22, 2);
          currentY = afterDesc + 4;
        }

        currentY += 14; // padding below item

        // ── Separator ── (skip after last item in last block)
        const isLastItem = i === block.items.length - 1;
        const isLastBlock = block === blocks[blocks.length - 1];

        if (!(isLastItem && isLastBlock)) {
          c.strokeStyle = C.separatorLine;
          c.lineWidth = 1;
          c.setLineDash([5, 5]);
          c.beginPath();
          c.moveTo(PM, currentY);
          c.lineTo(PM + itemW, currentY);
          c.stroke();
          c.setLineDash([]);
          currentY += 16;
        }
      }

      // Space between category blocks
      if (blocks.length > 1 && block !== blocks[blocks.length - 1]) {
        // Thin full-width divider between categories
        currentY += 10;
        c.fillStyle = C.glowViolet;
        c.fillRect(PM, currentY, 32, 2);
        currentY += 22;
      }
    }

    drawFooter(c);
    resolve(await canvasToBlob(canvas));
  });
}

// ── State variables for background generation ─────────────────────────────────

let isGenerating = false;
let hasPendingChanges = false;


// ── Main service ──────────────────────────────────────────────────────────────

export class MenuRendererService {

  /**
   * Fetch all active products for a company, grouped by category.
   */
  static async fetchActiveProducts(_companyId: string): Promise<Record<string, ProductRow[]>> {
    const data = (await engineData<ProductRow[]>("products"))
      .filter((row) => row.is_active);

    if (!data.length) return {};

    const groups: Record<string, ProductRow[]> = {};
    for (const row of data) {
      const cat = row.category || "Sem categoria";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(row as ProductRow);
    }
    return groups;
  }

  /**
   * Fetch store info (name, logo, description).
   */
  static async fetchStoreData(_companyId: string): Promise<StoreData> {
    const [store, company] = await Promise.all([
      engineData<any>("store-info").catch(() => null),
      engineData<any>("company").catch(() => null),
    ]);

    return {
      company: company?.name || store?.store_name || "Delivery",
      store_name: store?.store_name || company?.name || undefined,
      short_description: store?.short_description,
      logo_url: company?.logo_url || undefined,
    };
  }

  /**
   * Main entry point: generate all menu pages and persist them via backend function.
   * Returns the list of active assets after generation.
   */
  static async generateMenuImages(companyId: string): Promise<MenuAsset[]> {
    const [store, grouped] = await Promise.all([
      MenuRendererService.fetchStoreData(companyId),
      MenuRendererService.fetchActiveProducts(companyId),
    ]);

    const categories = Object.keys(grouped);
    if (categories.length === 0) throw new Error("NO_PRODUCTS");

    const pagesPayload: { page_number: number, base64: string, category: string | null }[] = [];
    let pageNum = 0;

    // Page 0 — Cover
    const coverBlob = await renderCoverPage(store);
    pagesPayload.push({
      page_number: pageNum,
      base64: await blobToBase64(coverBlob),
      category: null
    });
    pageNum++;

    // Calculate pagination dynamically based on height
    const MAX_PAGE_CONTENT_HEIGHT = H - 160; // Leave room for footer and top margin
    const allPages: { category: string, items: ProductRow[] }[][] = [];
    
    let currentPageBlocks: { category: string, items: ProductRow[] }[] = [];
    let currentHeightUsed = 0;

    for (const cat of categories) {
      const products = grouped[cat];
      
      // Calculate category header height
      const headerHeight = 45 + 40 + 30; // Text + underline + padding

      // Check if we need to start a new page just for the header
      if (currentHeightUsed + headerHeight > MAX_PAGE_CONTENT_HEIGHT) {
        if (currentPageBlocks.length > 0) {
          allPages.push(currentPageBlocks);
          currentPageBlocks = [];
          currentHeightUsed = 0;
        }
      }

      let currentCatBlock: { category: string, items: ProductRow[] } = { category: cat, items: [] };
      currentHeightUsed += headerHeight;

      for (const prod of products) {
        // Approximate height calculation per product
        let prodH = 28 + 15 + 20; // name/price + spacing + separator
        if (prod.description) {
           prodH += 24 * 2; // up to 2 lines approx
        }

        if (currentHeightUsed + prodH > MAX_PAGE_CONTENT_HEIGHT) {
          // Push current block to page, push page, start new page
          if (currentCatBlock.items.length > 0) {
            currentPageBlocks.push(currentCatBlock);
          }
          if (currentPageBlocks.length > 0) {
            allPages.push(currentPageBlocks);
          }
          
          // Reset for new page
          currentPageBlocks = [];
          currentHeightUsed = headerHeight;
          currentCatBlock = { category: cat, items: [] }; // continued category
        }
        
        currentCatBlock.items.push(prod);
        currentHeightUsed += prodH;
      }
      
      if (currentCatBlock.items.length > 0) {
        currentPageBlocks.push(currentCatBlock);
      }
    }
    
    if (currentPageBlocks.length > 0) {
      allPages.push(currentPageBlocks);
    }

    const totalProductPages = allPages.length;

    for (const pageBlocks of allPages) {
      const blob = await renderCategoryPage(pageBlocks, pageNum, totalProductPages);
      // We combine category names for the metadata
      const catNames = pageBlocks.map(b => b.category).join(", ");
      
      pagesPayload.push({
        page_number: pageNum,
        base64: await blobToBase64(blob),
        category: catNames
      });
      pageNum++;
    }

    const result = await engineRequest<{ ok: boolean; data: MenuAsset[] }>("menu-assets", {
      method: "POST",
      body: { pages: pagesPayload },
    });
    return (result.data || []) as MenuAsset[];
  }

  /**
   * Retrieve current active menu assets ordered by page number.
   */
  static async getActiveMenuImages(_companyId: string): Promise<MenuAsset[]> {
    try {
      return (await engineData<MenuAsset[]>("menu-assets")) || [];
    } catch {
      return [];
    }
  }

  /**
   * Trigger regeneration automatically. 
   * Includes lock and pending logic to avoid redundant overlapping generations.
   */
  static async triggerRegeneration(companyId: string): Promise<void> {
    if (isGenerating) {
      hasPendingChanges = true;
      return;
    }

    isGenerating = true;
    hasPendingChanges = false;
    
    // Dispatch event so UI can show "Atualizando..."
    window.dispatchEvent(new CustomEvent("menu-generation-start"));

    try {
      await MenuRendererService.generateMenuImages(companyId);
    } catch (err) {
      if (err instanceof Error && err.message !== "NO_PRODUCTS") {
        console.error("[ARLES MenuRenderer] Regeneration failed:", err);
      }
    } finally {
      isGenerating = false;
      window.dispatchEvent(new CustomEvent("menu-assets-updated"));

      if (hasPendingChanges) {
        MenuRendererService.triggerRegeneration(companyId);
      }
    }
  }
}

