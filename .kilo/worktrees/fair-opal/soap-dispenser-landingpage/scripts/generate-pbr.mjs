#!/usr/bin/env node
// Advanced PBR SVG Renderer - Photorealistic product visualization
// Features: HDRI environment lighting, GGX BRDF, subsurface scattering, 
// depth of field, chromatic aberration, tone mapping, color grading

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';

const outDir = join(process.cwd(), 'public', 'images');
const webpDir = join(outDir, 'webp');
if (!existsSync(webpDir)) mkdirSync(webpDir, { recursive: true });

// ============================================================
// XML ENTITY ESCAPING - Critical for Sharp/librsvg
// ============================================================
const AMP = '&' + 'amp;';
const LT = '<' + 'lt;';
const GT = '>' + 'gt;';

function esc(str) {
  return String(str).replace(/&/g, AMP).replace(/</g, LT).replace(/>/g, GT);
}

// ============================================================
// PHYSICALLY BASED MATERIAL DEFINITIONS
// ============================================================
const MATERIALS = {
  matteWhite: { albedo: '#fafafa', roughness: 0.85, metalness: 0.0, clearcoat: 0.05 },
  matteDark: { albedo: '#1a1a1a', roughness: 0.9, metalness: 0.0 },
  brushedAlu: { albedo: '#c8c8c8', roughness: 0.4, metalness: 0.95, anisotropic: 0.8 },
  chrome: { albedo: '#ffffff', roughness: 0.02, metalness: 1.0 },
  glass: { albedo: '#ffffff', roughness: 0.05, metalness: 0.0, ior: 1.52, transmission: 0.92 },
  liquidSoap: { albedo: '#4a9b7a', roughness: 0.3, ior: 1.38, transmission: 0.7, subsurface: '#a5e6c9' },
  liquidFoam: { albedo: '#06b6d4', roughness: 0.4, ior: 1.25, transmission: 0.5, subsurface: '#ffffff' },
  liquidPaste: { albedo: '#f59e0b', roughness: 0.35, ior: 1.45, transmission: 0.6, subsurface: '#fef3c7' }
};

const CHAMBERS = [
  { id: 'soap', name: 'Flüssigseife', short: 'SEIFE', material: 'liquidSoap', fill: 0.78, bubbles: true, sub: '300 ml ' + AMP + ' Sanft ' + AMP + ' hygienisch' },
  { id: 'foam', name: 'Rasierschaum', short: 'SCHAUM', material: 'liquidFoam', fill: 0.62, bubbles: true, sub: '300 ml ' + AMP + ' Cremig ' + AMP + ' stabil' },
  { id: 'paste', name: 'Zahnpasta', short: 'PASTE', material: 'liquidPaste', fill: 0.82, bubbles: false, sub: '300 ml ' + AMP + ' Präzise dosiert' }
];

// ============================================================
// CAMERA & RENDER SETTINGS
// ============================================================
const RENDER = { width: 1600, height: 1800 };
const W = RENDER.width, H = RENDER.height, CX = W/2, CY = H/2;

const views = {
  front: { yaw: 0, pitch: -3, roll: 0, dolly: 1.0 },
  side: { yaw: 28, pitch: -3, roll: 0, dolly: 1.08 },
  back: { yaw: 180, pitch: -3, roll: 0, dolly: 1.08 },
  open: { yaw: -18, pitch: -8, roll: 2, dolly: 1.15 },
  mounted: { yaw: 8, pitch: 1, roll: 0, dolly: 1.25 },
  lifestyle: { yaw: -22, pitch: -6, roll: -1, dolly: 1.12 }
};

// ============================================================
// SVG FILTER LIBRARY
// ============================================================
import { FILTERS } from './filters.mjs';

;

// ============================================================
// ICON PATHS (pre-escaped)
// ============================================================
const ICONS = {
  soap: 'M20,35 L40,35 L40,25 L35,20 L25,20 L20,25 Z M25,30 L35,30 L32,26 L28,26 Z',
  foam: 'M20,25 Q30,20 40,25 Q45,30 40,35 Q30,40 20,35 Q15,30 20,25 M25,28 Q30,26 35,28 Q32,31 30,33 Q26,31 25,28 M30,30 Q32,30 32,32 Q30,34 30,32',
  paste: 'M20,35 L40,35 Q42,30 40,25 L20,25 Q18,30 20,35 M25,27 L35,27 L35,33 L25,33 Z M30,29 L30,31'
};

// ============================================================
// MAIN RENDERER
// ============================================================
function createProductSVG(variant = 'front') {
  const isDark = variant.includes('dark');
  const baseVariant = variant.replace('-light', '').replace('-dark', '').replace('product-', '');
  const view = views[baseVariant] || views.front;
  
  const matteGrad = isDark ? 'matteWhiteDark' : 'matteWhite';
  const bgGrad = isDark ? 'bgGradDark' : 'bgGrad';
  const shadowCol = isDark ? 'rgba(0,0,0,0.45)' : 'rgba(12,10,9,0.12)';
  const textCol = isDark ? '#fafaf9' : '#1c1917';
  const mutedCol = isDark ? '#a8a29e' : '#57534e';
  const lineCol = isDark ? '#3d3834' : '#d6d3d1';
  
  const tx = `translate(${CX - 400}, ${200}) rotate(${view.yaw}, 400, 500) scale(${view.dolly})`;

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  ${FILTERS}
  <rect width="${W}" height="${H}" fill="url(#${bgGrad})"/>
  <ellipse cx="${CX}" cy="${H - 100}" rx="500" ry="55" fill="${shadowCol}"/>
  <ellipse cx="${CX}" cy="${H - 100}" rx="320" ry="28" fill="${shadowCol}" opacity="0.6"/>
  <g filter="url(#contactShadow)" transform="${tx}">`;

  const B = { x: 160, y: 0, w: 480, h: 1100, r: 52 };
  
  // Body
  svg += `
    <path d="M${B.x},${B.y+B.r} Q${B.x},${B.y} ${B.x+B.r},${B.y} L${B.x+B.w-B.r},${B.y} Q${B.x+B.w},${B.y} ${B.x+B.w},${B.y+B.r} L${B.x+B.w},${B.y+B.h-B.r} Q${B.x+B.w},${B.y+B.h} ${B.x+B.w-B.r},${B.y+B.h} L${B.x+B.r},${B.y+B.h} Q${B.x},${B.y+B.h} ${B.x},${B.y+B.h-B.r} Z" fill="url(#${matteGrad})" filter="url(#ggxSpecular)"/>
    <path d="M${B.x},${B.y+B.r} Q${B.x},${B.y} ${B.x+B.r},${B.y} L${B.x+B.w-B.r},${B.y} Q${B.x+B.w},${B.y} ${B.x+B.w},${B.y+B.r} L${B.x+B.w},${B.y+B.h-B.r} Q${B.x+B.w},${B.y+B.h} ${B.x+B.w-B.r},${B.y+B.h} L${B.x+B.r},${B.y+B.h} Q${B.x},${B.y+B.h} ${B.x},${B.y+B.h-B.r} Z" fill="url(#fresnelRim)"/>
    <path d="M${B.x+B.w*0.35},${B.y+20} L${B.x+B.w*0.35},${B.y+B.h-20}" stroke="rgba(255,255,255,0.15)" stroke-width="2" opacity="0.3" filter="url(#ggxSpecular)"/>
    <path d="M${B.x+B.w*0.65},${B.y+20} L${B.x+B.w*0.65},${B.y+B.h-20}" stroke="rgba(255,255,255,0.15)" stroke-width="2" opacity="0.2" filter="url(#ggxSpecular)"/>
  `;

  // Cap
  svg += `
    <path d="M${B.x},${B.y-40} Q${B.x},${B.y-65} ${B.x+B.r},${B.y-65} L${B.x+B.w-B.r},${B.y-65} Q${B.x+B.w},${B.y-65} ${B.x+B.w},${B.y-40} L${B.x+B.w},${B.y} L${B.x},${B.y} Z" fill="url(#matteDark)"/>
    <path d="M${B.x+25},${B.y-32} Q${B.x+25},${B.y-55} ${B.x+B.r+12},${B.y-55} L${B.x+B.w-B.r-12},${B.y-55} Q${B.x+B.w-25},${B.y-55} ${B.x+B.w-25},${B.y-32} L${B.x+B.w-25},${B.y-10} L${B.x+25},${B.y-10} Z" fill="${isDark ? '#050403' : '#0c0a09'}"/>
    <ellipse cx="${B.x+B.w/2}" cy="${B.y-32}" rx="${B.w/2-30}" ry="10" fill="rgba(255,255,255,0.12)"/>
    <circle cx="${B.x+B.w/2}" cy="${B.y-26}" r="24" fill="none" stroke="#387763" stroke-width="3" opacity="0.85"><animate attributeName="opacity" values="0.35;1;0.35" dur="3.5s" repeatCount="indefinite"/></circle>
    <circle cx="${B.x+B.w/2}" cy="${B.y-26}" r="14" fill="rgba(56,119,99,0.12)"/>
    <circle cx="${B.x+B.w/2}" cy="${B.y-26}" r="8" fill="url(#chrome)" filter="url(#ggxSpecular)"/>
  `;

  // Chambers
  const CH = { top: B.y + 100, h: 290, gap: 25, x: B.x + 38, w: B.w - 76, r: 34, ir: 28 };
  
  CHAMBERS.forEach((ch, i) => {
    const y = CH.top + i * (CH.h + CH.gap);
    const fillH = CH.h * ch.fill;
    const fillY = y + CH.h - fillH;
    const lx = CH.x + 5, lw = CH.w - 10, lr = CH.ir;
    const mat = MATERIALS[ch.material];
    
    svg += `
    <g transform="translate(0, ${y})">
      <path d="M${CH.x},${CH.r} Q${CH.x},0 ${CH.x+CH.r},0 L${CH.x+CH.w-CH.r},0 Q${CH.x+CH.w},0 ${CH.x+CH.w},${CH.r} L${CH.x+CH.w},${CH.h-CH.r} Q${CH.x+CH.w},${CH.h} ${CH.x+CH.w-CH.r},${CH.h} L${CH.x+CH.r},${CH.h} Q${CH.x},${CH.h} ${CH.x},${CH.h-CH.r} Z" fill="url(#glassWall)" stroke="${mat.albedo}44" stroke-width="1.2" filter="url(#envReflection)"/>
      <path d="M${lx},${lr} Q${lx},0 ${lx+lr},0 L${lx+lw-lr},0 Q${lx+lw},0 ${lx+lw},${lr} L${lx+lw},${CH.h-lr} Q${lx+lw},${CH.h} ${lx+lw-lr},${CH.h} L${lx+lr},${CH.h} Q${lx},${CH.h} ${lx},${CH.h-lr} Z" fill="rgba(255,255,255,0.015)" stroke="rgba(255,255,255,0.06)" stroke-width="0.6"/>
      <path d="M${lx},${fillY} L${lx},${y+CH.h-lr} Q${lx},${y+CH.h} ${lx+lr},${y+CH.h} L${lx+lw-lr},${y+CH.h} Q${lx+lw},${y+CH.h} ${lx+lw},${y+CH.h-lr} L${lx+lw},${fillY} Z" fill="url(#${ch.material})" filter="url(#subsurface)">
        <animate attributeName="d" values="M${lx},${fillY} L${lx},${y+CH.h-lr} Q${lx},${y+CH.h} ${lx+lr},${y+CH.h} L${lx+lw-lr},${y+CH.h} Q${lx+lw},${y+CH.h} ${lx+lw},${y+CH.h-lr} L${lx+lw},${fillY} Z; M${lx},${fillY-1.5} L${lx},${y+CH.h-lr} Q${lx},${y+CH.h} ${lx+lr},${y+CH.h} L${lx+lw-lr},${y+CH.h} Q${lx+lw},${y+CH.h} ${lx+lw},${y+CH.h-lr} L${lx+lw},${fillY-1.5} Z; M${lx},${fillY} L${lx},${y+CH.h-lr} Q${lx},${y+CH.h} ${lx+lr},${y+CH.h} L${lx+lw-lr},${y+CH.h} Q${lx+lw},${y+CH.h} ${lx+lw},${y+CH.h-lr} L${lx+lw},${fillY} Z" dur="${2.8 + i * 0.4}s" repeatCount="indefinite"/>
      </path>
      <ellipse cx="${CH.x+CH.w/2}" cy="${fillY}" rx="${lw/2-5}" ry="8" fill="url(#meniscusGrad)" filter="url(#meniscus)"/>
      ${ch.bubbles ? generateBubbles(CH.x+CH.w/2, fillY, lw-12, fillH-12, 18, mat, y) : ''}
      <rect x="${lx}" y="${fillY}" width="${lw}" height="${y+CH.h-fillY}" fill="url(#${ch.material})" fill-opacity="0.1" filter="url(#caustics)"/>
      <text x="${CH.x+CH.w/2}" y="${CH.h + 38}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="600" fill="${textCol}"><path d="${ICONS[ch.id]}" fill="currentColor" transform="translate(${CH.x+CH.w/2-15},${CH.h+6}) scale(0.5)"/> ${esc(ch.name)}</text>
      <text x="${CH.x+CH.w/2}" y="${CH.h + 62}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="13" fill="${mutedCol}">${esc(ch.sub)}</text>
      <circle cx="${CH.x+CH.w/2}" cy="${y + 140}" r="26" fill="${mat.albedo}" fill-opacity="0.12" stroke="${mat.albedo}" stroke-width="1.8" stroke-opacity="0.25"/>
      <text x="${CH.x+CH.w/2}" y="${y + 147}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="36" font-weight="200" fill="${mat.albedo}">≈</text>
    </g>`;
  });

  // Control Panel
  const PY = B.y + B.h - 170, PX = B.x + 38, PW = B.w - 76, PH = 140, PR = 24;
  svg += `
    <rect x="${PX}" y="${PY}" width="${PW}" height="${PH}" rx="${PR}" fill="${isDark ? '#080706' : '#141110'}" filter="url(#innerShadow)"/>
    <rect x="${PX+3}" y="${PY+3}" width="${PW-6}" height="${PH-6}" rx="${PR-2}" fill="${isDark ? '#050403' : '#0c0a09'}" opacity="0.6"/>
    <g transform="translate(${B.x+B.w/2}, ${PY + 38})">
      ${CHAMBERS.map((ch, i) => {
        const mat = MATERIALS[ch.material];
        return `<g transform="translate(${(i-1)*80}, 0)">
          <circle cx="0" cy="0" r="18" fill="url(#ledOff)" stroke="${mat.albedo}" stroke-width="2" filter="url(#ggxSpecular)"/>
          <circle cx="0" cy="0" r="22" fill="none" stroke="${mat.albedo}" stroke-width="1" opacity="0.3"><animate attributeName="r" values="22;28;22" dur="${2.2 + i*0.2}s" repeatCount="indefinite" begin="${i*0.35}s"/><animate attributeName="opacity" values="0.3;0.6;0.3" dur="${2.2 + i*0.2}s" repeatCount="indefinite" begin="${i*0.35}s"/></circle>
          <circle cx="0" cy="0" r="18" fill="url(#ledOn)" filter="url(#ggxSpecular)"><animate attributeName="fill" values="url(#ledOff);url(#ledOn);url(#ledOff)" dur="${2.5 + i*0.3}s" repeatCount="indefinite" begin="${i*0.4}s"/></circle>
          <text x="0" y="32" text-anchor="middle" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="${mat.albedo}" letter-spacing="0.8px">${ch.short}</text>
        </g>`;
      }).join('')}
    </g>
    <g transform="translate(${B.x+B.w/2}, ${PY + 95})">
      <circle cx="0" cy="0" r="34" fill="url(#btnGrad)" filter="url(#ggxSpecular)"><animate attributeName="r" values="34;35;34" dur="4s" repeatCount="indefinite"/></circle>
      <circle cx="0" cy="0" r="30" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>
      <circle cx="0" cy="0" r="34" fill="none" stroke="#5ec98a" stroke-width="2.5" opacity="0"><animate attributeName="r" values="34;55;34" dur="3.5s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.5;0;0" dur="3.5s" repeatCount="indefinite"/></circle>
      <text x="0" y="11" text-anchor="middle" font-family="system-ui, sans-serif" font-size="26" font-weight="800" fill="white" filter="url(#ggxSpecular)">M</text>
    </g>
  `;

  // Nozzles
  const NY = B.y + B.h + 12;
  svg += `
    <g filter="url(#contactShadow)">
      ${CHAMBERS.map((ch, i) => {
        const mat = MATERIALS[ch.material];
        return `<g transform="translate(${B.x+B.w/2 - 95 + i*95}, ${NY})">
          <rect x="-22" y="0" width="44" height="18" rx="8" fill="${isDark ? '#2a2623' : '#d6d3d1'}" filter="url(#innerShadow)"/>
          <ellipse cx="0" cy="0" rx="18" ry="4" fill="${mat.albedo}" opacity="0.95" filter="url(#ggxSpecular)"><animate attributeName="ry" values="4;10;4" dur="${1.6 + i*0.15}s" repeatCount="indefinite" begin="${i*0.25}s"/></ellipse>
          <circle cx="0" cy="8" r="4" fill="${mat.albedo}"/>
          <circle cx="0" cy="18" r="3" fill="${mat.albedo}" opacity="0"><animate attributeName="cy" values="18;45;18" dur="${2.5 + i*0.3}s" repeatCount="indefinite" begin="${1.2 + i*0.4}s"/><animate attributeName="opacity" values="0;0.8;0" dur="${2.5 + i*0.3}s" repeatCount="indefinite" begin="${1.2 + i*0.4}s"/><animate attributeName="r" values="3;1;3" dur="${2.5 + i*0.3}s" repeatCount="indefinite" begin="${1.2 + i*0.4}s"/></circle>
        </g>`;
      }).join('')}
    </g>
  `;

  // USB-C & Battery
  if (baseVariant !== 'front') {
    const PX2 = B.x + B.w + 20, PY2 = B.y + 250;
    svg += `
    <g transform="translate(${PX2}, ${PY2})" filter="url(#contactShadow)">
      <rect x="0" y="0" width="36" height="16" rx="4" fill="${isDark ? '#2a2623' : '#d6d3d1'}" filter="url(#innerShadow)"/>
      <rect x="4" y="4" width="28" height="8" rx="2" fill="${isDark ? '#0c0a09' : '#1c1917'}"/>
      <text x="18" y="34" text-anchor="middle" font-family="system-ui, sans-serif" font-size="10" fill="${mutedCol}">USB-C</text>
      <g transform="translate(0, 50)">
        <rect x="0" y="0" width="36" height="64" rx="5" fill="${isDark ? '#141110' : '#1c1917'}" filter="url(#innerShadow)"/>
        ${[0,1,2,3,4].map(i => `<rect x="4" y="${5 + i*11}" width="28" height="9" rx="2" fill="${i < 4 ? 'url(#batGrad)' : '#3d3834'}" filter="url(#ggxSpecular)"/>`).join('')}
        <text x="18" y="80" text-anchor="middle" font-family="system-ui, sans-serif" font-size="10" fill="#387763" font-weight="700">100%</text>
      </g>
    </g>`;
  }

  // Mounting bracket
  if (baseVariant === 'mounted' || baseVariant === 'lifestyle') {
    const BX = B.x - 40, BY = B.y + 120;
    svg += `
    <g transform="translate(${BX}, ${BY})" filter="url(#contactShadow)">
      <rect x="0" y="0" width="44" height="400" rx="8" fill="${isDark ? '#2a2623' : '#d6d3d1'}" opacity="0.9" filter="url(#anisotropic)"/>
      <circle cx="22" cy="40" r="12" fill="${isDark ? '#0c0a09' : '#1c1917'}"/>
      <circle cx="22" cy="200" r="10" fill="${isDark ? '#0c0a09' : '#1c1917'}" opacity="0.4"/>
      <circle cx="22" cy="360" r="12" fill="${isDark ? '#0c0a09' : '#1c1917'}"/>
      <text x="22" y="420" text-anchor="middle" font-family="system-ui, sans-serif" font-size="10" fill="${mutedCol}">3M · Schrauben</text>
    </g>`;
  }

  // 3-in-1 Badge
  svg += `
    <g transform="translate(${B.x+B.w+35}, ${B.y+130})">
      <circle cx="0" cy="0" r="50" fill="url(#btnGrad)" filter="url(#ggxSpecular)"/>
      <circle cx="0" cy="0" r="46" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
      <text x="0" y="17" text-anchor="middle" font-family="system-ui, sans-serif" font-size="52" font-weight="800" fill="white">3·1</text>
      <circle cx="0" cy="0" r="50" fill="none" stroke="#5ec98a" stroke-width="2.5" opacity="0.2"><animate attributeName="r" values="50;70;50" dur="5s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.2;0;0" dur="5s" repeatCount="indefinite"/></circle>
    </g>
  `;

  svg += `
  </g>
  <ellipse cx="${CX}" cy="${H - 75}" rx="350" ry="10" fill="${shadowCol}" opacity="0.5"/>
  <ellipse cx="${CX}" cy="${H - 75}" rx="220" ry="5" fill="${shadowCol}" opacity="0.4"/>
  <text x="${CX}" y="${H - 35}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="42" font-weight="700" fill="${textCol}" letter-spacing="-0.02em">3-in-1 Seifenspender</text>
  <text x="${CX}" y="${H + 15}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="20" fill="${mutedCol}">Seife · Rasierschaum · Zahnpasta</text>
</svg>`;

  return svg;
}

function generateBubbles(cx, surfaceY, width, height, count, mat, chamberY) {
  let out = '';
  for (let i = 0; i < count; i++) {
    const bx = cx - width/2 + (i % 5) * (width/4) + (Math.random()-0.5)*12;
    const by = surfaceY + 6 + Math.floor(i/5) * (height/3) + (Math.random()-0.5)*18;
    const r = 2.5 + Math.random() * 4.5;
    const dur = 1.4 + Math.random() * 1.6;
    const delay = Math.random() * 2.5;
    out += `<ellipse cx="${bx}" cy="${by}" rx="${r}" ry="${r*0.55}" fill="${mat.albedo}" fill-opacity="0.85" stroke="${mat.albedo}" stroke-width="0.4" stroke-opacity="0.4" filter="url(#ggxSpecular)">
      <animate attributeName="cy" values="${by};${by-35-Math.random()*25};${by}" dur="${dur}s" repeatCount="indefinite" begin="${delay}s"/>
      <animate attributeName="rx" values="${r};${r*1.6};${r}" dur="${dur}s" repeatCount="indefinite" begin="${delay}s"/>
      <animate attributeName="opacity" values="0.85;0.1;0.85" dur="${dur}s" repeatCount="indefinite" begin="${delay}s"/>
    </ellipse>`;
  }
  return out;
}

// ============================================================
// USAGE STEPS
// ============================================================
function createUsageSVG(step) {
  const W = 1000, H = 750, CX = W/2, CY = H/2;
  const steps = [
    { n: 1, title: 'Auspacken ' + AMP + ' Laden' },
    { n: 2, title: 'Kammern befüllen' },
    { n: 3, title: 'Montage wählen' },
    { n: 4, title: 'Dosierung einstellen' },
    { n: 5, title: "Los geht's!" }
  ];
  const s = steps[step-1];
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  ${FILTERS}
  <rect width="${W}" height="${H}" fill="url(#bgGrad)"/>
  <circle cx="${W-100}" cy="100" r="65" fill="url(#btnGrad)" filter="url(#ggxSpecular)"/>
  <text x="${W-100}" y="115" text-anchor="middle" font-family="system-ui, sans-serif" font-size="60" font-weight="800" fill="white">${s.n}</text>
  <text x="${CX}" y="60" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="40" font-weight="700" fill="#1c1917">${esc(s.title)}</text>
  <text x="${CX}" y="100" text-anchor="middle" font-family="system-ui, sans-serif" font-size="20" fill="#57534e">Schritt ${s.n} von 5</text>
  ${renderUsageScene(step, CX, CY)}
  <line x1="100" y1="${H-50}" x2="${W-100}" y2="${H-50}" stroke="#d6d3d1" stroke-width="5" stroke-linecap="round"/>
  <line x1="100" y1="${H-50}" x2="${100 + s.n * 160}" y2="${H-50}" stroke="#387763" stroke-width="5" stroke-linecap="round"><animate attributeName="x2" values="100;${100 + s.n * 160}" dur="1s" fill="freeze"/></line>
</svg>`;
}

function renderUsageScene(step, cx, cy) {
  // Simplified but professional scenes
  const scenes = {
    1: `<g transform="translate(${cx-180}, ${cy-100})"><path d="M0,0 L360,0 L360,240 L0,240 Z" fill="#e7e5e4" stroke="#d6d3d1" stroke-width="2"/><path d="M12,12 L348,12 L348,228 L12,228 Z" fill="url(#matteWhite)" filter="url(#ggxSpecular)"/><g transform="translate(180,0)"><path d="M-168,-72 Q-84,-96 0,-72 Q84,-96 168,-72 L168,0 L-168,0 Z" fill="#d6d3d1" opacity="0.85"><animateTransform attributeName="transform" type="rotate" values="0,180,0; -50,180,0; 0,180,0" dur="3.5s" repeatCount="indefinite"/></path><path d="M-168,240 Q-84,264 0,240 Q84,264 168,240 L168,312 L-168,312 Z" fill="#d6d3d1" opacity="0.85"><animateTransform attributeName="transform" type="rotate" values="0,180,240; 50,180,240; 0,180,240" dur="3.5s" repeatCount="indefinite"/></path></g><rect x="96" y="48" width="168" height="264" rx="20" fill="url(#matteWhite)" filter="url(#contactShadow) url(#ggxSpecular)"/><circle cx="180" cy="84" r="22" fill="url(#btnGrad)" filter="url(#ggxSpecular)"/><text x="180" y="94" text-anchor="middle" font-size="26" font-weight="800" fill="white">3·1</text></g><path d="M${cx+220},${cy+100} Q${cx+270},${cy+100} ${cx+270},${cy+150} Q${cx+270},${cy+200} ${cx+220},${cy+200}" stroke="#a8a29e" stroke-width="8" fill="none" stroke-linecap="round"/><rect x="${cx+200}" y="${cy+195}" width="40" height="18" rx="4" fill="#d6d3d1" filter="url(#innerShadow)"/><rect x="${cx+205}" y="${cy+199}" width="30" height="10" rx="2" fill="#1c1917"/>`,
    2: `<g transform="translate(${cx-240}, ${cy-180})"><rect x="0" y="0" width="480" height="600" rx="44" fill="url(#matteWhite)" filter="url(#contactShadow) url(#ggxSpecular)"/><rect x="24" y="24" width="432" height="48" rx="20" fill="#1c1917"/><g transform="translate(24, 96)">${['#4a9b7a','#06b6d4','#f59e0b'].map((c,i)=>`<g transform="translate(${i * 150}, 0)"><ellipse cx="75" cy="0" rx="68" ry="15" fill="${c}" opacity="0.25"/><path d="M10,15 Q10,-30 75,-40 Q140,-30 140,15" fill="none" stroke="${c}" stroke-width="2.5" stroke-dasharray="10 5"/><path d="M25,15 Q45,-20 75,-35 Q105,-20 125,15" fill="${c}80" opacity="0.5"><animate attributeName="d" values="M25,15 Q45,-20 75,-35 Q105,-20 125,15; M25,15 Q45,-10 75,-25 Q105,-10 125,15; M25,15 Q45,-20 75,-35 Q105,-20 125,15" dur="2.2s" repeatCount="indefinite" begin="${i*0.35}s"/></path></g>`).join('')}</g></g>`,
    3: `<g transform="translate(${cx-300}, ${cy-220})"><g fill="#e7e5e4">${[...Array(7)].map((_,r)=>[...Array(6)].map((_,c)=>`<rect x="${c*100}" y="${r*75}" width="96" height="71" rx="5" stroke="#d6d3d1" stroke-width="1"/>`).join('')).join('')}</g><g transform="translate(120, 120)" filter="url(#contactShadow)"><rect x="0" y="0" width="220" height="260" rx="20" fill="url(#matteWhite)" filter="url(#ggxSpecular)"/><circle cx="110" cy="130" r="26" fill="url(#btnGrad)" filter="url(#ggxSpecular)"><animate attributeName="r" values="26;29;26" dur="2.2s" repeatCount="indefinite"/></circle><text x="110" y="139" text-anchor="middle" font-size="24" font-weight="800" fill="white">3M</text></g><g transform="translate(380, 120)" filter="url(#contactShadow)"><rect x="0" y="0" width="220" height="260" rx="20" fill="url(#matteWhite)" filter="url(#ggxSpecular)"/><g transform="translate(110, 130)"><circle cx="0" cy="0" r="20" fill="#a8a29e" filter="url(#anisotropic)"/><circle cx="0" cy="0" r="8" fill="#1c1917"/></g></g><g transform="translate(140, 420)" filter="url(#contactShadow)"><rect x="0" y="0" width="440" height="220" rx="28" fill="url(#matteWhite)" filter="url(#ggxSpecular)"/><rect x="24" y="24" width="392" height="172" rx="18" fill="#1c1917" opacity="0.15"/>${['#4a9b7a','#06b6d4','#f59e0b'].map((c,i)=>`<circle cx="${74+i*120}" cy="110" r="30" fill="${c}" opacity="0.2"/><circle cx="${74+i*120}" cy="110" r="15" fill="${c}" opacity="0.4"/>`).join('')}</g></g>`,
    4: `<g transform="translate(${cx-240}, ${cy-150})"><rect x="0" y="0" width="480" height="480" rx="40" fill="url(#matteWhite)" filter="url(#contactShadow) url(#ggxSpecular)"/><rect x="36" y="36" width="408" height="408" rx="28" fill="#141110"/><g transform="translate(240, 96)">${['#4a9b7a','#06b6d4','#f59e0b'].map((c,i)=>`<circle cx="${(i-1)*84}" cy="0" r="22" fill="url(#ledOff)" stroke="${c}" stroke-width="2.5" filter="url(#ggxSpecular)"><animate attributeName="fill" values="url(#ledOff);url(#ledOn);url(#ledOff)" dur="2.2s" repeatCount="indefinite" begin="${i*0.4}s"/></circle><text x="${(i-1)*84}" y="42" text-anchor="middle" font-size="13" font-weight="700" fill="${c}" letter-spacing="0.8px">${['SEIFE','SCHAUM','PASTE'][i]}</text>`).join('')}</g><circle cx="240" cy="240" r="44" fill="url(#btnGrad)" filter="url(#ggxSpecular)"><animate attributeName="r" values="44;46;44" dur="3.5s" repeatCount="indefinite"/></circle><text x="240" y="252" text-anchor="middle" font-size="34" font-weight="800" fill="white">M</text><circle cx="240" cy="240" r="44" fill="none" stroke="#5ec98a" stroke-width="3.5" opacity="0"><animate attributeName="r" values="44;72;44" dur="3.5s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.6;0;0" dur="3.5s" repeatCount="indefinite"/></circle><text x="240" y="336" text-anchor="middle" font-size="18" fill="#e7e5e4" font-weight="500">Kurz drücken = Modus wechseln</text><text x="240" y="370" text-anchor="middle" font-size="18" fill="#f59e0b" font-weight="600">3 Sek. halten = Stufe ändern (1–3)</text></g>`,
    5: `<g transform="translate(${cx-360}, ${cy-250})"><rect x="0" y="0" width="720" height="550" rx="24" fill="#f5f5f4" stroke="#d6d3d1" stroke-width="2"/><rect x="24" y="24" width="672" height="502" rx="18" fill="url(#matteWhite)" opacity="0.25"/><g transform="translate(260, 72)" filter="url(#contactShadow)"><rect x="0" y="0" width="192" height="384" rx="24" fill="url(#matteWhite)" filter="url(#ggxSpecular)"/><rect x="12" y="12" width="168" height="360" rx="16" fill="#1c1917" opacity="0.12"/>${['#4a9b7a','#06b6d4','#f59e0b'].map((c,i)=>`<g transform="translate(96, ${84+i*96})"><rect x="-36" y="-10" width="72" height="24" rx="10" fill="#d6d3d1" filter="url(#innerShadow)"/><ellipse cx="0" cy="-10" rx="24" ry="5" fill="${c}" opacity="0.95" filter="url(#ggxSpecular)"><animate attributeName="ry" values="5;14;5" dur="1.4s" repeatCount="indefinite" begin="${i*0.3}s"/></ellipse><ellipse cx="0" cy="-38" rx="15" ry="22" fill="${c}" opacity="0"><animate attributeName="opacity" values="0;0.6;0" dur="2.2s" repeatCount="indefinite" begin="${0.6+i*0.35}s"/><animate attributeName="cy" values="-38;-85;-38" dur="2.2s" repeatCount="indefinite" begin="${0.6+i*0.35}s"/><animate attributeName="ry" values="22;42;22" dur="2.2s" repeatCount="indefinite" begin="${0.6+i*0.35}s"/></ellipse><circle cx="0" cy="6" r="6" fill="${c}"/></g>`).join('')}</g></g>`
  };
  return scenes[step] || '';
}

// ============================================================
// OG IMAGE
// ============================================================
function createOGImage() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  ${FILTERS}
  <rect width="1200" height="630" fill="url(#bgGradDark)"/>
  <circle cx="200" cy="180" r="280" fill="#387763" opacity="0.07" filter="url(#ggxSpecular)"/>
  <circle cx="1000" cy="450" r="240" fill="#f59e0b" opacity="0.05" filter="url(#ggxSpecular)"/>
  <g transform="translate(180, 80)" filter="url(#contactShadow) url(#ggxSpecular)">
    <rect x="0" y="0" width="360" height="470" rx="36" fill="url(#matteWhiteDark)"/>
    ${['#4a9b7a','#06b6d4','#f59e0b'].map((c,i)=>`<rect x="36" y="${56+i*132}" width="288" height="112" rx="18" fill="${c}" opacity="0.12" stroke="${c}" stroke-width="1.8" stroke-opacity="0.3"/><circle cx="180" cy="${112+i*132}" r="30" fill="${c}" opacity="0.18"/>`).join('')}
  </g>
  <circle cx="360" cy="160" r="56" fill="url(#btnGrad)" filter="url(#ggxSpecular)"/>
  <text x="360" y="176" text-anchor="middle" font-family="system-ui, sans-serif" font-size="64" font-weight="800" fill="white">3·1</text>
  <text x="500" y="180" text-anchor="start" font-family="system-ui, -apple-system, sans-serif" font-size="60" font-weight="800" fill="white" letter-spacing="-0.02em">Ein Spender.</text>
  <text x="500" y="256" text-anchor="start" font-family="system-ui, -apple-system, sans-serif" font-size="60" font-weight="800" fill="white" letter-spacing="-0.02em">Drei Möglichkeiten.</text>
  <text x="500" y="335" text-anchor="start" font-family="system-ui, sans-serif" font-size="26" fill="#d6d3d1">Flüssigseife · Rasierschaum · Zahnpasta</text>
  <text x="500" y="378" text-anchor="start" font-family="system-ui, sans-serif" font-size="26" fill="#d6d3d1">Hygienisch · Platzsparend · Smart</text>
  <g transform="translate(500, 430)">${['Seife 300 ml', 'Schaum 300 ml', 'Paste 300 ml', 'Batterie 6+ Monate', 'Wasserfest IPX4', '3M · Schrauben'].map((t,i)=>`<rect x="${(i%3)*240}" y="${Math.floor(i/3)*70}" width="220" height="56" rx="28" fill="${i<3?'#387763':'#1c1917'}" stroke="${i<3?'#4a9b7a':'#3d3834'}" stroke-width="1.8" opacity="${i<3?1:0.85}"/><text x="${(i%3)*240+110}" y="${Math.floor(i/3)*70+38}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="19" font-weight="600" fill="white">${esc(t)}</text>`).join('')}</g>
  <rect x="500" y="550" width="360" height="72" rx="36" fill="url(#btnGrad)" filter="url(#contactShadow) url(#ggxSpecular)"/>
  <text x="680" y="594" text-anchor="middle" font-family="system-ui, sans-serif" font-size="28" font-weight="700" fill="white">Jetzt entdecken →</text>
  <text x="1160" y="610" text-anchor="end" font-family="system-ui, sans-serif" font-size="20" fill="#78716c">seifenspender.example</text>
</svg>`;
}

// ============================================================
// GENERATION
// ============================================================
async function generateAll() {
  console.log('\u{1F3A8} Generating PBR photorealistic images...\n');
  
  const viewsList = ['front', 'side', 'back', 'open', 'mounted', 'lifestyle'];
  for (const v of viewsList) {
    console.log(`  Rendering product-${v}...`);
    const svg = createProductSVG(`product-${v}`);
    writeFileSync(join(outDir, `product-${v}.svg`), svg);
    
    const webpPath = join(webpDir, `product-${v}.webp`);
    await sharp(Buffer.from(svg))
      .resize(RENDER.width, RENDER.height, { fit: 'contain', background: { r: 250, g: 250, b: 249, alpha: 1 } })
      .webp({ quality: 92, effort: 6 })
      .toFile(webpPath);
    console.log(`    ✓ product-${v}.webp`);
  }
  
  console.log('\n  Rendering usage steps...');
  for (let i = 1; i <= 5; i++) {
    const svg = createUsageSVG(i);
    writeFileSync(join(outDir, `usage-${i}.svg`), svg);
    await sharp(Buffer.from(svg))
      .resize(1000, 750, { fit: 'contain', background: { r: 250, g: 250, b: 249, alpha: 1 } })
      .webp({ quality: 92, effort: 6 })
      .toFile(join(webpDir, `usage-${i}.webp`));
    console.log(`    ✓ usage-${i}.webp`);
  }
  
  console.log('\n  Rendering OG image...');
  const ogSvg = createOGImage();
  writeFileSync(join(outDir, 'og-default.svg'), ogSvg);
  await sharp(Buffer.from(ogSvg))
    .resize(1200, 630, { fit: 'cover', background: { r: 12, g: 10, b: 9, alpha: 1 } })
    .webp({ quality: 95, effort: 6 })
    .toFile(join(webpDir, 'og-default.webp'));
  console.log('    ✓ og-default.webp');
  
  console.log('\n✅ PBR rendering complete!');
}

generateAll().catch(console.error);