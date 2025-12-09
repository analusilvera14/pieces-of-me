import { createCanvas } from "canvas";
import path from "path";
import fs from "fs";
import os from "os";

// Create a 3x3 color grid and save to Desktop
const canvas = createCanvas(600, 600); // size of the image
const ctx = canvas.getContext("2d");

// Define 9 colors
const colors = [
  "blue",
  "orange",
  "yellow",
  "red",
  "green",
  "purple",
  "gray",
  "pink",
  "white",
];

// Grid size
const rows = 3;
const cols = 3;
const cellWidth = canvas.width / cols;
const cellHeight = canvas.height / rows;

// Draw the grid
let index = 0;
for (let y = 0; y < rows; y++) {
  for (let x = 0; x < cols; x++) {
    ctx.fillStyle = colors[index];
    ctx.fillRect(x * cellWidth, y * cellHeight, cellWidth, cellHeight);
    index++;
  }
}

// Add grid lines (optional)
ctx.strokeStyle = "black";
ctx.lineWidth = 2;
for (let i = 0; i <= rows; i++) {
  ctx.beginPath();
  ctx.moveTo(0, i * cellHeight);
  ctx.lineTo(canvas.width, i * cellHeight);
  ctx.stroke();
}
for (let i = 0; i <= cols; i++) {
  ctx.beginPath();
  ctx.moveTo(i * cellWidth, 0);
  ctx.lineTo(i * cellWidth, canvas.height);
  ctx.stroke();
}

// Save image to Desktop
const desktopPath = path.join(os.homedir(), "Desktop");
const outputDir = path.join(desktopPath, "color_grids");

// Make sure folder exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

const filePath = path.join(outputDir, "color_grid.png");
const buffer = canvas.toBuffer("image/png");
fs.writeFileSync(filePath, buffer);

console.log(`✅ Color grid saved to: ${filePath}`);
