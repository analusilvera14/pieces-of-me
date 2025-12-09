const { Jimp } = require("jimp");
const path = require("path");
const fs = require("fs");
const os = require("os");

// --- CONFIG ---
const desktopPath = path.join(os.homedir(), "Desktop");
const imageFolder = path.join(desktopPath, "mosaic_images");
const outputFolder = path.join(desktopPath, "mosaic_output");
const outputPath = path.join(outputFolder, "mosaic_smartcrop.png");

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
    Math.pow(a[0] - b[0], 2) +
    Math.pow(a[1] - b[1], 2) +
    Math.pow(a[2] - b[2], 2)
  );
}

async function averageColor(img, x, y, w, h) {
  let r = 0, g = 0, b = 0;
  let count = 0;
  img.scan(x, y, w, h, (xx, yy, idx) => {
    r += img.bitmap.data[idx + 0];
    g += img.bitmap.data[idx + 1];
    b += img.bitmap.data[idx + 2];
    count++;
  });
  return [r / count, g / count, b / count];
}

async function bestSectionMatch(img, targetColor, sections = 10) {
  const sw = Math.floor(img.bitmap.width / sections);
  const sh = Math.floor(img.bitmap.height / sections);
  let best = null;
  let bestDist = Infinity;
  for (let i = 0; i < sections; i++) {
    for (let j = 0; j < sections; j++) {
      const x = i * sw;
      const y = j * sh;
      const avg = await averageColor(img, x, y, sw, sh);
      const dist = colorDistance(avg, targetColor);
      if (dist < bestDist) {
        bestDist = dist;
        best = { x, y, w: sw, h: sh, avg };
      }
    }
  }
  return best;
}

async function createSmartMosaic() {
  console.log("🧠 Building Smart Mosaic from 9 images...");
  if (!fs.existsSync(imageFolder)) {
    console.error("❌ Folder not found:", imageFolder);
    return;
  }

  const files = fs.readdirSync(imageFolder).filter(f => /\.(jpg|jpeg|png)$/i.test(f));
  if (files.length < 9) {
    console.error("❌ Need at least 9 images in", imageFolder);
    return;
  }

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

  for (let i = 0; i < gridColors.length; i++) {
    const target = gridColors[i];
    console.log(`🎯 Finding best match for ${target.name}...`);

    // choose image with closest overall average
    let bestImg = null;
    let bestDist = Infinity;
    for (const { img } of images) {
      const avg = await averageColor(img, 0, 0, img.bitmap.width, img.bitmap.height);
      const dist = colorDistance(avg, target.rgb);
      if (dist < bestDist) {
        bestDist = dist;
        bestImg = img;
      }
    }

    // now find best section in that image
    const bestSection = await bestSectionMatch(bestImg, target.rgb, 10);
    const crop = bestImg.clone().crop({
  x: bestSection.x,
  y: bestSection.y,
  w: bestSection.w,
  h: bestSection.h
});

    const resized = crop.clone().cover({ w: cellSize, h: cellSize });

    const row = Math.floor(i / gridSize);
    const col = i % gridSize;
    mosaic.composite(resized, col * cellSize, row * cellSize);
    console.log(`✅ ${target.name} tile done`);
  }

  if (!fs.existsSync(outputFolder)) fs.mkdirSync(outputFolder);
  await mosaic.write(outputPath);
  console.log(`🎉 Smart mosaic saved to: ${outputPath}`);
}

createSmartMosaic().catch(console.error);
