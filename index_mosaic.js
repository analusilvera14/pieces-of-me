const { Jimp } = require("jimp");
const path = require("path");
const fs = require("fs");
const os = require("os");


// --- CONFIG ---
const desktopPath = path.join(os.homedir(), "Desktop");
const imageFolder = path.join(desktopPath, "mosaic_images");
const outputFolder = path.join(desktopPath, "mosaic_output");
const outputPath = path.join(outputFolder, "mosaic_output.png");

// 9 colors in grid order
const targetColors = [
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

// --- UTILITIES ---
function colorDistance(c1, c2) {
  return Math.sqrt(
    Math.pow(c1[0] - c2[0], 2) +
    Math.pow(c1[1] - c2[1], 2) +
    Math.pow(c1[2] - c2[2], 2)
  );
}

async function averageColor(image) {
  let r = 0, g = 0, b = 0;
  const total = image.bitmap.width * image.bitmap.height;
  image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
    r += this.bitmap.data[idx + 0];
    g += this.bitmap.data[idx + 1];
    b += this.bitmap.data[idx + 2];
  });
  return [r / total, g / total, b / total];
}

// --- MAIN ---
async function createMosaic() {
  console.log("🖼️  Loading images from:", imageFolder);
  if (!fs.existsSync(imageFolder)) {
    console.error("❌ Folder not found:", imageFolder);
    return;
  }

  const imageFiles = fs.readdirSync(imageFolder).filter(f => /\.(jpg|jpeg|png)$/i.test(f));
  if (imageFiles.length < 9) {
    console.error("❌ Please include at least 9 images in the folder.");
    return;
  }

  // Load and analyze images
  const loadedImages = [];
  for (const file of imageFiles) {
    const imgPath = path.join(imageFolder, file);
    const image = await Jimp.read(imgPath);
    const avg = await averageColor(image);
    loadedImages.push({ image, avg, file });
    console.log(`🎨 Analyzed: ${file}`);
  }

  // Match each target color to the best image
  const matched = [];
  for (const target of targetColors) {
    let best = null;
    let bestDist = Infinity;
    for (const img of loadedImages) {
      const dist = colorDistance(target.rgb, img.avg);
      if (dist < bestDist) {
        bestDist = dist;
        best = img;
      }
    }
    matched.push({ target, img: best });
    console.log(`🎯 Matched ${target.name} → ${best.file}`);
  }

  // Create mosaic
  if (!fs.existsSync(outputFolder)) fs.mkdirSync(outputFolder);
  const gridSize = 3;
  const cellSize = 200;
  const mosaic = await new Jimp({
  width: cellSize * gridSize,
  height: cellSize * gridSize,
  background: 0xffffffff // white background
});

  let index = 0;
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const { img } = matched[index];
      const resized = img.image.clone().cover({ w: cellSize, h: cellSize });
      mosaic.composite(resized, x * cellSize, y * cellSize);
      index++;
    }
  }

  await mosaic.write(outputPath);
console.log(`✅ Mosaic created and saved to: ${outputPath}`);

}

createMosaic().catch(console.error);
