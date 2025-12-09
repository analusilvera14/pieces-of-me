// Photomosaic: recreate a target portrait using crops from your gallery images
// Requires: npm i jimp
// Note: package.json should NOT have "type": "module"

const { Jimp } = require("jimp");
const path = require("path");
const fs = require("fs");
const os = require("os");

// ====== CONFIG (tweak these) ======
const desktop = path.join(os.homedir(), "Desktop");
const GALLERY_DIR = path.join(desktop, "mosaic_images");      // your 9–20+ photos
const TARGET_FILE = path.join(desktop, "portrait.jpg");       // the image to replicate
const OUTPUT_DIR  = path.join(desktop, "mosaic_output");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "portrait_mosaic.png");


// Mosaic density: we aim for about this many tiles across the portrait
const TARGET_COLUMNS = 400;   // try 150, 200, 250 to taste

// Limits for how small/big each tile can be (in pixels)
const MIN_TILE_SIZE = 2;
const MAX_TILE_SIZE = 40;

// How deeply to scan each gallery image for the best-colored patch
const SECTION_GRID = 24;      // 8x8 = 64 patches per image, faster for preview

// =================================

// --- helpers ---
function colorDistance(a, b) {
  const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return Math.sqrt(dr*dr + dg*dg + db*db);
}

async function avgColorRegion(img, x, y, w, h) {
  let r = 0, g = 0, b = 0, n = 0;
  img.scan(x, y, w, h, (xx, yy, idx) => {
    r += img.bitmap.data[idx];
    g += img.bitmap.data[idx + 1];
    b += img.bitmap.data[idx + 2];
    n++;
  });
  return [r / n, g / n, b / n];
}

async function precomputeSections(img, file, sections) {
  // Split the image into a grid and store average colors for quick matching
  const sw = Math.max(1, Math.floor(img.bitmap.width  / sections));
  const sh = Math.max(1, Math.floor(img.bitmap.height / sections));
  const entries = [];
  for (let sx = 0; sx < sections; sx++) {
    for (let sy = 0; sy < sections; sy++) {
      const x = sx * sw;
      const y = sy * sh;
      const w = (sx === sections - 1) ? (img.bitmap.width  - x) : sw;
      const h = (sy === sections - 1) ? (img.bitmap.height - y) : sh;
      const avg = await avgColorRegion(img, x, y, w, h);
      entries.push({ x, y, w, h, avg, file });
    }
  }
  return entries;
}

(async function buildPortraitMosaic() {
  try {
    // --- load & check files ---
    if (!fs.existsSync(TARGET_FILE)) {
      console.error("❌ Target portrait not found:", TARGET_FILE);
      return;
    }
    if (!fs.existsSync(GALLERY_DIR)) {
      console.error("❌ Gallery folder not found:", GALLERY_DIR);
      return;
    }
    const galleryFiles = fs.readdirSync(GALLERY_DIR)
      .filter(f => /\.(jpg|jpeg|png)$/i.test(f));
    if (galleryFiles.length < 9) {
      console.error("❌ Please put at least 9 images in:", GALLERY_DIR);
      return;
    }

   console.log("🖼️  Loading target portrait:", TARGET_FILE);
const target = await Jimp.read(TARGET_FILE);

const targetW = target.bitmap.width;
const targetH = target.bitmap.height;

// ---- AUTO TILE SIZE + GRID ----
// choose tileSize so we get about TARGET_COLUMNS tiles across
let tileSize = Math.floor(targetW / TARGET_COLUMNS);

// clamp tileSize so it doesn’t get ridiculous
if (tileSize < MIN_TILE_SIZE) tileSize = MIN_TILE_SIZE;
if (tileSize > MAX_TILE_SIZE) tileSize = MAX_TILE_SIZE;

// now compute how many tiles we actually get across/down
const tileCols = Math.floor(targetW / tileSize);
const tileRows = Math.floor(targetH / tileSize);

console.log(`🧩 Mosaic grid: ${tileCols} x ${tileRows} tiles (tileSize = ${tileSize}px)`);

// We’ll sample the target colors on a smaller working copy
const workW = tileCols, workH = tileRows;
const targetSmall = target.clone().resize({ w: workW, h: workH, mode: Jimp.RESIZE_BILINEAR });



    console.log("📚 Loading gallery images & precomputing sections…");
    const gallery = [];
    for (const file of galleryFiles) {
      const img = await Jimp.read(path.join(GALLERY_DIR, file));
      // Optional: downscale huge images to speed scanning while keeping color fidelity
      const maxDim = 1000;
      if (img.bitmap.width > maxDim || img.bitmap.height > maxDim) {
        img.resize({ w: Math.min(img.bitmap.width, maxDim), h: Jimp.AUTO, mode: Jimp.RESIZE_BILINEAR });
      }
      const sections = await precomputeSections(img, file, SECTION_GRID);
      gallery.push({ img, file, sections });
      console.log("   ✅", file, `→ ${sections.length} sections`);
    }

    // Create the blank output mosaic
   const outW = tileCols * tileSize;
const outH = tileRows * tileSize;
const mosaic = await new Jimp({ width: outW, height: outH, background: 0xffffffff });



   console.log("🎯 Matching each portrait tile to best gallery patch…");
for (let row = 0; row < tileRows; row++) {
  for (let col = 0; col < tileCols; col++) {
        // Average color of this tile in the target portrait
        const px = targetSmall.getPixelColor(col, row);
        const r = (px >> 24) & 0xff;
        const g = (px >> 16) & 0xff;
        const b = (px >> 8)  & 0xff;
        const targetRGB = [r, g, b];

        // Search the best section across ALL gallery images
        let best = { dist: Infinity, img: null, sec: null, file: "" };
        for (const gimg of gallery) {
          for (const sec of gimg.sections) {
            const dist = colorDistance(sec.avg, targetRGB);
            if (dist < best.dist) best = { dist, img: gimg.img, sec, file: gimg.file };
          }
        }

        // Composite the winning crop into the mosaic
       const crop = best.img.clone().crop({
  x: best.sec.x, y: best.sec.y, w: best.sec.w, h: best.sec.h
});
const tile = crop.clone().cover({ w: tileSize, h: tileSize });
mosaic.composite(tile, col * tileSize, row * tileSize);


       if ((row * tileCols + col) % Math.max(1, Math.floor((tileCols * tileRows) / 12)) === 0) {
  console.log(`   • tile ${row+1},${col+1} from ${best.file} (dist ${best.dist.toFixed(1)})`);
}
      }
    }

    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);
    await mosaic.write(OUTPUT_FILE);
    console.log(`🎉 Photomosaic saved to: ${OUTPUT_FILE}`);
    console.log("💡 Tip: increase TILE_COLS/ROWS for more detail; increase SECTION_GRID for tighter color matches.");
  } catch (err) {
    console.error("❌ Error:", err);
  }
})();
