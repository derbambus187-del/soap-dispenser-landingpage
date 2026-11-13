#!/usr/bin/env node
// Generate ControlNet inputs (Canny edges, Depth map) from SVG or rendered images
// Run: node scripts/generate-controlnet-inputs.mjs

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';
import { createCanvas } from 'canvas';

const outDir = join(process.cwd(), 'comfyui', 'control_inputs');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const WIDTH = 1024;
const HEIGHT = 1280;

// ============================================================
// PROCEDURAL CANNY EDGE MAP (from our known geometry)
// ============================================================
function generateCannyMap() {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  
  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  const cx = WIDTH / 2;
  const cy = HEIGHT / 2;
  const scale = 0.35;
  
  // Body outline
  const bodyW = 380 * scale;
  const bodyH = 850 * scale;
  const bodyR = 40 * scale;
  const bodyX = cx - bodyW/2;
  const bodyY = cy - bodyH/2 - 50;
  
  ctx.beginPath();
  ctx.roundRect(bodyX, bodyY, bodyW, bodyH, bodyR);
  ctx.stroke();
  
  // Cap
  const capH = 40 * scale;
  ctx.beginPath();
  ctx.roundRect(bodyX, bodyY - capH, bodyW, capH, bodyR);
  ctx.stroke();
  
  // IR sensor
  ctx.beginPath();
  ctx.arc(cx, bodyY - capH/2, 15 * scale, 0, Math.PI * 2);
  ctx.stroke();
  
  // Three chambers
  const chamberH = 220 * scale;
  const chamberGap = 20 * scale;
  const chamberW = bodyW * 0.75;
  const chamberX = cx - chamberW/2;
  const chamberTop = bodyY + 60 * scale;
  
  for (let i = 0; i < 3; i++) {
    const y = chamberTop + i * (chamberH + chamberGap);
    ctx.beginPath();
    ctx.roundRect(chamberX, y, chamberW, chamberH, 20 * scale);
    ctx.stroke();
    
    // Fill level line
    const fillY = y + chamberH * (i === 0 ? 0.78 : i === 1 ? 0.62 : 0.82);
    ctx.beginPath();
    ctx.moveTo(chamberX + 10, fillY);
    ctx.lineTo(chamberX + chamberW - 10, fillY);
    ctx.stroke();
  }
  
  // Control panel
  const panelY = bodyY + bodyH + 20 * scale;
  ctx.beginPath();
  ctx.roundRect(chamberX, panelY, chamberW, 80 * scale, 15 * scale);
  ctx.stroke();
  
  // LEDs
  for (let i = 0; i < 3; i++) {
    const x = cx + (i - 1) * 50 * scale;
    ctx.beginPath();
    ctx.arc(x, panelY + 25 * scale, 10 * scale, 0, Math.PI * 2);
    ctx.stroke();
  }
  
  // Mode button
  ctx.beginPath();
  ctx.arc(cx, panelY + 55 * scale, 18 * scale, 0, Math.PI * 2);
  ctx.stroke();
  
  // Nozzles
  const nozzleY = bodyY + bodyH + 80 * scale;
  for (let i = 0; i < 3; i++) {
    const x = cx + (i - 1) * 55 * scale;
    ctx.beginPath();
    ctx.arc(x, nozzleY, 12 * scale, 0, Math.PI * 2);
    ctx.stroke();
  }
  
  // USB-C port (side)
  ctx.beginPath();
  ctx.roundRect(cx + bodyW/2 + 20, cy - 80 * scale, 25 * scale, 12 * scale, 3 * scale);
  ctx.stroke();
  
  // Mounting bracket
  ctx.beginPath();
  ctx.rect(cx - bodyW/2 - 30, cy - 150 * scale, 25 * scale, 250 * scale);
  ctx.stroke();
  
  // 3-in-1 badge
  ctx.beginPath();
  ctx.arc(cx + bodyW/2 + 30, cy - 100 * scale, 30 * scale, 0, Math.PI * 2);
  ctx.stroke();
  
  // Ground line
  ctx.beginPath();
  ctx.moveTo(cx - 300, cy + bodyH/2 + 50);
  ctx.lineTo(cx + 300, cy + bodyH/2 + 50);
  ctx.stroke();
  
  return canvas;
}

// ============================================================
// PROCEDURAL DEPTH MAP
// ============================================================
function generateDepthMap() {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  
  // White = close, Black = far
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  
  const cx = WIDTH / 2;
  const cy = HEIGHT / 2;
  const scale = 0.35;
  
  const bodyW = 380 * scale;
  const bodyH = 850 * scale;
  const bodyR = 40 * scale;
  const bodyX = cx - bodyW/2;
  const bodyY = cy - bodyH/2 - 50;
  
  // Body - gradient from front (white) to back (gray)
  const grad = ctx.createLinearGradient(0, bodyY, 0, bodyY + bodyH);
  grad.addColorStop(0, '#ffffff');      // Front face
  grad.addColorStop(0.3, '#e0e0e0');    // Upper
  grad.addColorStop(0.5, '#c0c0c0');    // Middle
  grad.addColorStop(0.7, '#e0e0e0');    // Lower
  grad.addColorStop(1, '#ffffff');      // Bottom
  
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(bodyX, bodyY, bodyW, bodyH, bodyR);
  ctx.fill();
  
  // Cap - darker
  ctx.fillStyle = '#808080';
  ctx.beginPath();
  ctx.roundRect(bodyX, bodyY - 40 * scale, bodyW, 40 * scale, bodyR);
  ctx.fill();
  
  // IR sensor - bright (closest)
  const irGrad = ctx.createRadialGradient(cx, bodyY - 20 * scale, 0, cx, bodyY - 20 * scale, 15 * scale);
  irGrad.addColorStop(0, '#ffffff');
  irGrad.addColorStop(1, '#cccccc');
  ctx.fillStyle = irGrad;
  ctx.beginPath();
  ctx.arc(cx, bodyY - 20 * scale, 15 * scale, 0, Math.PI * 2);
  ctx.fill();
  
  // Chambers - glass walls (semi-transparent)
  const chamberH = 220 * scale;
  const chamberGap = 20 * scale;
  const chamberW = bodyW * 0.75;
  const chamberX = cx - chamberW/2;
  const chamberTop = bodyY + 60 * scale;
  
  for (let i = 0; i < 3; i++) {
    const y = chamberTop + i * (chamberH + chamberGap);
    
    // Glass outer wall
    ctx.fillStyle = '#b0b0b0';
    ctx.beginPath();
    ctx.roundRect(chamberX, y, chamberW, chamberH, 20 * scale);
    ctx.fill();
    
    // Liquid fill (darker = deeper)
    const fillH = chamberH * (i === 0 ? 0.78 : i === 1 ? 0.62 : 0.82);
    const fillY = y + chamberH - fillH;
    
    const liquidGrad = ctx.createLinearGradient(0, fillY, 0, y + chamberH);
    liquidGrad.addColorStop(0, '#909090');  // Surface
    liquidGrad.addColorStop(1, '#606060');  // Bottom
    
    ctx.fillStyle = liquidGrad;
    ctx.beginPath();
    ctx.roundRect(chamberX + 5, fillY, chamberW - 10, fillH, 18 * scale);
    ctx.fill();
    
    // Meniscus highlight
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(cx, fillY, chamberW/2 * 0.9, 4 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Control panel - dark (recessed)
  const panelY = bodyY + bodyH + 20 * scale;
  ctx.fillStyle = '#404040';
  ctx.beginPath();
  ctx.roundRect(chamberX, panelY, chamberW, 80 * scale, 15 * scale);
  ctx.fill();
  
  // LEDs - bright
  for (let i = 0; i < 3; i++) {
    const x = cx + (i - 1) * 50 * scale;
    const ledGrad = ctx.createRadialGradient(x, panelY + 25 * scale, 0, x, panelY + 25 * scale, 10 * scale);
    ledGrad.addColorStop(0, '#ffffff');
    ledGrad.addColorStop(1, '#aaaaaa');
    ctx.fillStyle = ledGrad;
    ctx.beginPath();
    ctx.arc(x, panelY + 25 * scale, 10 * scale, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Mode button - bright
  const btnGrad = ctx.createRadialGradient(cx, panelY + 55 * scale, 0, cx, panelY + 55 * scale, 18 * scale);
  btnGrad.addColorStop(0, '#ffffff');
  btnGrad.addColorStop(1, '#cccccc');
  ctx.fillStyle = btnGrad;
  ctx.beginPath();
  ctx.arc(cx, panelY + 55 * scale, 18 * scale, 0, Math.PI * 2);
  ctx.fill();
  
  // Nozzles
  const nozzleY = bodyY + bodyH + 80 * scale;
  for (let i = 0; i < 3; i++) {
    const x = cx + (i - 1) * 55 * scale;
    ctx.fillStyle = '#aaaaaa';
    ctx.beginPath();
    ctx.arc(x, nozzleY, 12 * scale, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Ground plane - gradient
  const groundY = bodyY + bodyH + 120 * scale;
  const groundGrad = ctx.createLinearGradient(0, groundY, 0, HEIGHT);
  groundGrad.addColorStop(0, '#808080');
  groundGrad.addColorStop(1, '#000000');
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, groundY, WIDTH, HEIGHT - groundY);
  
  return canvas;
}

// ============================================================
// SAVE FUNCTIONS
// ============================================================
async function saveCanvas(canvas, name) {
  const buffer = canvas.toBuffer('image/png');
  await sharp(buffer)
    .png({ compressionLevel: 9 })
    .toFile(join(outDir, `${name}.png`));
  
  // Also save as WebP for ComfyUI
  await sharp(buffer)
    .webp({ quality: 95, lossless: true })
    .toFile(join(outDir, `${name}.webp`));
  
  console.log(`  ✓ ${name}.png + .webp (${WIDTH}x${HEIGHT})`);
}

async function main() {
  console.log('\n🎨 Generating ControlNet inputs...\n');
  
  const canny = generateCannyMap();
  await saveCanvas(canny, 'dispenser_canny');
  
  const depth = generateDepthMap();
  await saveCanvas(depth, 'dispenser_depth');
  
  // Generate variants for different angles
  console.log('\n  Generating angle variants...');
  
  // Side view canny (rotate 90° conceptually - different layout)
  const cannySide = generateCannyMap();
  // Just reuse for now - in production you'd render from Blender
  await saveCanvas(cannySide, 'dispenser_canny_side');
  
  const depthSide = generateDepthMap();
  await saveCanvas(depthSide, 'dispenser_depth_side');
  
  console.log('\n✅ ControlNet inputs ready!');
  console.log(`📁 Output: ${outDir}/`);
  console.log('\nFiles for ComfyUI:');
  console.log('  - dispenser_canny.png (primary Canny)');
  console.log('  - dispenser_depth.png (primary Depth)');
  console.log('  - dispenser_canny_side.png');
  console.log('  - dispenser_depth_side.png');
}

main().catch(console.error);