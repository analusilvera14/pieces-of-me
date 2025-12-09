const { Jimp } = require("jimp");
const path = require("path");
const fs = require("fs");
const os = require("os");

const desktopPath = path.join(os.homedir(), "Desktop");
const imageFolder = path.join(desktopPath, "mosaic_images");
const outputFolder = path.join(desktopPath, "mosaic_output");
const outputPath = path.join(outputFolder, "mosaic_fullsearch.png");

const gridColors = [
  { name: "blue", rgb: [0, 0, 255] },
  { name: "orange", rgb: [255, 165, 0] },
  { name: "yellow", rgb: [255, 255, 0] },
  { name: "red", rgb: [255, 0, 0] },
  { name: "green", rgb: [0, 128, 0] },
  { name: "purple", rgb: [128, 0, 128] },
  { name: "gray", rgb: [128, 128, 128] },
  { name: "pink", rgb: [255, 192, 203] },
  { name: "white", rgb: [255, 255, 255] },
];

function colorDistance(a, b) {
  return Math.sqrt(
    (a[0] - b[0]) ** 2 +
    (a[1] - b[1]) ** 2 +
    (a[2] - b[2]) ** 2
  );
}

async function averageColor(img, x, y, w, h) {
  let r = 0, g = 0, b = 0, count = 0;
  img.scan(x, y, w, h, (xx, yy, idx) => {
    r += img.bitmap.data[idx];
    g += img.bitmap.data[idx + 1];
    b += img.bitmap.data[idx + 2];
    count++;
  });
  return [r / count, g / count, b / count];
}

async function createFullSearchMosaic() {
  console.log("🧠 Full-search Smart Mosaic started...");
  if (!fs.existsSync(imageFolder)) {
    console.error("❌ Folder not found:", imageFolder);
    return;
  }

  const files = fs.readdirSync(imageFolder).filter(f => /\.(jpg|jpeg|png)$/i.test(f));
  if (files.length < 9) {
    console.error("❌ Need at least 9 images in", imageFolder);
    return;
  }

  // Load all images
  const images = [];
  for (const file of files) {
    const img = await Jimp.read(path.join(imageFolder, file));
    images.push({ img, file });
    console.log("📸 Loaded", file);
  }

  const gridSize = 3;
  const cellSize = 200;
  const mosaic = await new Jimp({
    width: gridSize * cellSize,
    height: gridSize * cellSize,
    background: 0xffffffff,
  });

  // For each target color, search ALL images and sections
  for (let i = 0; i < gridColors.length; i++) {
    const target = gridColors[i];
    console.log(`🎯 Searching best match for ${target.name}...`);

    let best = { dist: Infinity, img: null, section: null };

    for (const { img, file } of images) {
      const sections = 10;
      const sw = Math.floor(img.bitmap.width / sections);
      const sh = Math.floor(img.bitmap.height / sections);

      for (let sx = 0; sx < sections; sx++) {
        for (let sy = 0; sy < sections; sy++) {
          const x = sx * sw;
          const y = sy * sh;
          const avg = await averageColor(img, x, y, sw, sh);
          const dist = colorDistance(avg, target.rgb);
          if (dist < best.dist) {
            best = { dist, img, section: { x, y, w: sw, h: sh }, file };
          }
        }
      }
    }

    if (best.img && best.section) {
      const crop = best.img.clone().crop({
        x: best.section.x,
        y: best.section.y,
        w: best.section.w,
        h: best.section.h,
      });
      const resized = crop.clone().cover({ w: cellSize, h: cellSize });
      const row = Math.floor(i / gridSize);
      const col = i % gridSize;
      mosaic.composite(resized, col * cellSize, row * cellSize);
      console.log(`✅ ${target.name} → ${best.file} (distance ${best.dist.toFixed(2)})`);
    } else {
      console.warn(`⚠️ No match found for ${target.name}`);
    }
  }

  if (!fs.existsSync(outputFolder)) fs.mkdirSync(outputFolder);
  await mosaic.write(outputPath);
  console.log(`🎉 Full-search mosaic saved to: ${outputPath}`);
}

createFullSearchMosaic().catch(console.error);

