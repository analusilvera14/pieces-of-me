import { Jimp, intToRGBA } from "jimp";
import fs from "fs";
import path from "path";


const portraitPath = "C:/Users/Analu/Desktop/portrait.jpg"; // change if needed
const imagesDir = "C:/Users/Analu/Desktop/mosaic_images";
const outputPath = "C:/Users/Analu/Desktop/portrait_mosaic_adaptive.png";

const BASE_COLS = 60;
const BASE_ROWS = 60;
const TILE_SIZE = 45; // larger for 1.5x output
const SECTION_GRID = 16;

// Helper to compute average color of a region
async function getAverageColor(img, x, y, w, h) {
  let r = 0, g = 0, b = 0;
  const pixels = w * h;
  for (let i = 0; i < pixels; i++) {
    const color = intToRGBA(img.getPixelColor(x + (i % w), y + Math.floor(i / w)));

    r += color.r;
    g += color.g;
    b += color.b;
  }
  return { r: r / pixels, g: g / pixels, b: b / pixels };
}

// Compute brightness (for adaptive sizing)
function brightness({ r, g, b }) {
  return (r * 0.299 + g * 0.587 + b * 0.114) / 255;
}

// Calculate color distance
function colorDistance(a, b) {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

async function loadImages() {
  const files = fs.readdirSync(imagesDir).filter(f => /\.(jpg|jpeg|png)$/i.test(f));
  const images = [];
  for (const file of files) {
    const img = await Jimp.read(path.join(imagesDir, file));
    images.push({ img, name: file });
    console.log("📸 Loaded", file);
  }
  return images;
}

async function createAdaptiveMosaic() {
  console.log("🧠 Building Adaptive Mosaic...");
  const target = await Jimp.read(portraitPath);
  const gallery = await loadImages();

  const outW = BASE_COLS * TILE_SIZE;
  const outH = BASE_ROWS * TILE_SIZE;
  const mosaic = await new Jimp({ width: outW, height: outH, background: 0xffffffff });


  const tileW = Math.floor(target.bitmap.width / BASE_COLS);
  const tileH = Math.floor(target.bitmap.height / BASE_ROWS);

  for (let ty = 0; ty < BASE_ROWS; ty++) {
    for (let tx = 0; tx < BASE_COLS; tx++) {
      const x = tx * tileW;
      const y = ty * tileH;
      const color = await getAverageColor(target, x, y, tileW, tileH);
      const bright = brightness(color);

      // Adaptive tile scaling (brighter = smaller tiles)
      const localSize = TILE_SIZE * (0.7 + (1 - bright) * 0.6); // range ~0.7x to 1.3x

      // find best match
      let bestMatch = gallery[0];
      let bestDiff = Infinity;
      for (const imgObj of gallery) {
        const { img } = imgObj;
        const sample = await getAverageColor(
          img,
          Math.floor(Math.random() * (img.bitmap.width - SECTION_GRID)),
          Math.floor(Math.random() * (img.bitmap.height - SECTION_GRID)),
          SECTION_GRID,
          SECTION_GRID
        );
        const diff = colorDistance(color, sample);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestMatch = imgObj;
        }
      }

      const crop = bestMatch.img.clone();
      await crop.cover({ w: localSize, h: localSize });
      mosaic.composite(crop, tx * TILE_SIZE, ty * TILE_SIZE);
    }
  }

  await mosaic.write(outputPath);
  console.log("✅ Adaptive mosaic saved to:", outputPath);
}

createAdaptiveMosaic();
