import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import os from "os";
import Jimp from "jimp";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static("public"));
app.get("/", (req, res) => {
  res.sendFile(path.resolve("public/mosaic_preview_v3.html"));
});


if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");
if (!fs.existsSync("output")) fs.mkdirSync("output");

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 15 * 1024 * 1024, files: 50 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) return cb(new Error("Only image files allowed"));
    cb(null, true);
  }
});

// Cloud-friendly settings: fewer tiles + smaller color grid for Render free tier
const TILE_COLS = 60;       
const TILE_ROWS = 60;       
const SECTION_GRID = 12;    
const TILE_SIZE = 16;       

const desktop = path.join(os.homedir(), "Desktop");
const DESKTOP_OUT_DIR = path.join(desktop, "mosaic_output");

function colorDistance(a, b) {
  const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
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
  const sw = Math.max(1, Math.floor(img.bitmap.width / sections));
  const sh = Math.max(1, Math.floor(img.bitmap.height / sections));
  const entries = [];
  for (let sx = 0; sx < sections; sx++) {
    for (let sy = 0; sy < sections; sy++) {
      const x = sx * sw;
      const y = sy * sh;
      const w = (sx === sections - 1) ? (img.bitmap.width - x) : sw;
      const h = (sy === sections - 1) ? (img.bitmap.height - y) : sh;
      const avg = await avgColorRegion(img, x, y, w, h);
      entries.push({ x, y, w, h, avg, file });
    }
  }
  return entries;
}

async function buildPortraitMosaic(portraitPath, galleryPaths, outPathFile) {
  const target = await Jimp.read(portraitPath);
  // Keep portrait image smaller to reduce memory use
const MAX_TARGET = 800;
if (target.bitmap.width > MAX_TARGET || target.bitmap.height > MAX_TARGET) {
  target.resize(MAX_TARGET, Jimp.AUTO, Jimp.RESIZE_BILINEAR);
}

  const targetSmall = target.clone().resize(TILE_COLS, TILE_ROWS, Jimp.RESIZE_BILINEAR);

  const gallery = [];
  for (const gPath of galleryPaths) {
    try {
      const img = await Jimp.read(gPath);
      const maxDim = 500;   //changed from 1000 to 500
      if (img.bitmap.width > maxDim || img.bitmap.height > maxDim)
        img.resize(Math.min(img.bitmap.width, maxDim), Jimp.AUTO, Jimp.RESIZE_BILINEAR);
      const sections = await precomputeSections(img, path.basename(gPath), SECTION_GRID);
      gallery.push({ img, file: path.basename(gPath), sections });
    } catch { }
  }

  const mosaic = await new Jimp(TILE_COLS * TILE_SIZE, TILE_ROWS * TILE_SIZE, 0xffffffff);
  const totalTiles = TILE_ROWS * TILE_COLS;
  let done = 0;

  for (let row = 0; row < TILE_ROWS; row++) {
    for (let col = 0; col < TILE_COLS; col++) {
      const px = targetSmall.getPixelColor(col, row);
      const { r, g, b } = Jimp.intToRGBA(px);
      const targetRGB = [r, g, b];
      let best = { dist: Infinity, img: null, sec: null, file: "" };
      for (const gimg of gallery) {
        for (const sec of gimg.sections) {
          const dist = colorDistance(sec.avg, targetRGB);
          if (dist < best.dist) best = { dist, img: gimg.img, sec, file: gimg.file };
        }
      }
      let tile;
      try {
        const crop = best.img.clone().crop(best.sec.x, best.sec.y, best.sec.w, best.sec.h);
        tile = crop.clone().cover(TILE_SIZE, TILE_SIZE);
        mosaic.composite(tile, col * TILE_SIZE, row * TILE_SIZE);
      } catch { }
      done++;
      if (done % Math.max(1, Math.floor(totalTiles / 10)) === 0)
        console.log(`   • ${Math.round((done / totalTiles) * 100)}% complete`);
    }
  }
  await mosaic.write(outPathFile);
  }

app.post("/upload", upload.fields([{ name: "portrait", maxCount: 1 }, { name: "gallery", maxCount: 50 }]), async (req, res) => {
  try {
    const portraitFile = req.files?.portrait?.[0];
    const galleryFiles = req.files?.gallery || [];
    if (!portraitFile) return res.status(400).json({ error: "Please upload a portrait image." });
    if (galleryFiles.length < 20) return res.status(400).json({ error: "Please upload at least 20 gallery images." });
    if (galleryFiles.length > 50) return res.status(400).json({ error: "Maximum 50 gallery images allowed." });

    const filename = `mosaic_${Date.now()}.png`;
    const outPathFile = path.join("output", filename);
    await buildPortraitMosaic(portraitFile.path, galleryFiles.map(f => f.path), outPathFile);

    for (const f of [...galleryFiles, portraitFile]) fs.unlink(f.path, () => {});
    res.json({ output: `/output/${filename}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create mosaic." });
  }
});

app.use("/output", express.static(path.resolve("output")));
app.listen(PORT, () => console.log(`🌐 Server running on http://localhost:${PORT}`));

Optimize mosaic settings for Render memory limits

