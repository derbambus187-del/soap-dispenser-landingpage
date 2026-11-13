#!/usr/bin/env node
// Generate high-quality photorealistic product SVGs and convert to WebP

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';

const outDir = join(process.cwd(), 'public', 'images');
const webpDir = join(outDir, 'webp');

if (!existsSync(webpDir)) {
  mkdirSync(webpDir, { recursive: true });
}

const COLORS = {
  brand: { 50: '#eef8f6', 100: '#d6ebe5', 200: '#a8d2c3', 300: '#70b39a', 400: '#44967b', 500: '#387763', 600: '#2d5f4f', 700: '#264a3e', 800: '#213c33', 900: '#1d332b', 950: '#0d1a15' },
  accent: { 500: '#f59e0b', 600: '#d97706', 700: '#b45309' },
  stone: { 50: '#fafaf9', 100: '#f5f5f4', 200: '#e7e5e4', 300: '#d6d3d1', 400: '#a8a29e', 500: '#78716c', 600: '#57534e', 700: '#44403c', 800: '#2f2a27', 900: '#1c1917', 950: '#0c0a09' },
  liquid: {
    soap: { light: '#6fc4a8', mid: '#3d9b78', dark: '#256b4a', gloss: '#a5e6c9' },
    foam: { light: '#67e8f9', mid: '#06b6d4', dark: '#0e7490', gloss: '#a5f3fc' },
    paste: { light: '#fde68a', mid: '#f59e0b', dark: '#b45309', gloss: '#fef3c7' }
  }
};

const WIDTH = 1200;
const HEIGHT = 1400;
const CX = WIDTH / 2;

const XML_AMP = '&' + 'amp;';

const DEFS = `
<defs>
  <linearGradient id="bodyMat" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="#ffffff"/>
    <stop offset="15%" stop-color="#f5f5f4"/>
    <stop offset="35%" stop-color="#e7e5e4"/>
    <stop offset="50%" stop-color="#d6d3d1"/>
    <stop offset="65%" stop-color="#e7e5e4"/>
    <stop offset="85%" stop-color="#f5f5f4"/>
    <stop offset="100%" stop-color="#ffffff"/>
  </linearGradient>
  <linearGradient id="bodyMatDark" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="#2f2a27"/>
    <stop offset="15%" stop-color="#26221f"/>
    <stop offset="35%" stop-color="#1c1917"/>
    <stop offset="50%" stop-color="#141110"/>
    <stop offset="65%" stop-color="#1c1917"/>
    <stop offset="85%" stop-color="#26221f"/>
    <stop offset="100%" stop-color="#2f2a27"/>
  </linearGradient>
  <linearGradient id="capMat" x1="0%" y1="0%" x2="0%" y2="100%">
    <stop offset="0%" stop-color="#3d3834"/>
    <stop offset="30%" stop-color="#2f2a27"/>
    <stop offset="60%" stop-color="#1c1917"/>
    <stop offset="100%" stop-color="#0c0a09"/>
  </linearGradient>
  <linearGradient id="btnMat" x1="0%" y1="0%" x2="0%" y2="100%">
    <stop offset="0%" stop-color="#44967b"/>
    <stop offset="50%" stop-color="#387763"/>
    <stop offset="100%" stop-color="#2d5f4f"/>
  </linearGradient>
  <linearGradient id="liqSoap" x1="0%" y1="0%" x2="0%" y2="100%">
    <stop offset="0%" stop-color="#a5e6c9" stop-opacity="0.9"/>
    <stop offset="40%" stop-color="#6fc4a8" stop-opacity="0.8"/>
    <stop offset="70%" stop-color="#3d9b78" stop-opacity="0.7"/>
    <stop offset="100%" stop-color="#256b4a" stop-opacity="0.6"/>
  </linearGradient>
  <linearGradient id="liqFoam" x1="0%" y1="0%" x2="0%" y2="100%">
    <stop offset="0%" stop-color="#a5f3fc" stop-opacity="0.85"/>
    <stop offset="30%" stop-color="#67e8f9" stop-opacity="0.75"/>
    <stop offset="60%" stop-color="#06b6d4" stop-opacity="0.65"/>
    <stop offset="100%" stop-color="#0e7490" stop-opacity="0.55"/>
  </linearGradient>
  <linearGradient id="liqPaste" x1="0%" y1="0%" x2="0%" y2="100%">
    <stop offset="0%" stop-color="#fef3c7" stop-opacity="0.9"/>
    <stop offset="40%" stop-color="#fde68a" stop-opacity="0.8"/>
    <stop offset="70%" stop-color="#f59e0b" stop-opacity="0.7"/>
    <stop offset="100%" stop-color="#b45309" stop-opacity="0.6"/>
  </linearGradient>
  <radialGradient id="meniscus" cx="50%" cy="0%" r="50%">
    <stop offset="0%" stop-color="rgba(255,255,255,0.6)"/>
    <stop offset="60%" stop-color="rgba(255,255,255,0.1)"/>
    <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
  </radialGradient>
  <linearGradient id="reflTop" x1="0%" y1="0%" x2="0%" y2="100%">
    <stop offset="0%" stop-color="rgba(255,255,255,0.5)"/>
    <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
  </linearGradient>
  <linearGradient id="reflSide" x1="0%" y1="0%" x2="100%" y2="0%">
    <stop offset="0%" stop-color="rgba(255,255,255,0.3)"/>
    <stop offset="50%" stop-color="rgba(255,255,255,0.05)"/>
    <stop offset="100%" stop-color="rgba(255,255,255,0.3)"/>
  </linearGradient>
  <radialGradient id="ledOn" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="#ffffff"/>
    <stop offset="30%" stop-color="#44967b"/>
    <stop offset="70%" stop-color="#387763"/>
    <stop offset="100%" stop-color="#2d5f4f"/>
  </radialGradient>
  <radialGradient id="ledOff" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="#44403c"/>
    <stop offset="100%" stop-color="#2f2a27"/>
  </radialGradient>
  <linearGradient id="batGrad" x1="0%" y1="0%" x2="100%" y2="0%">
    <stop offset="0%" stop-color="#387763"/>
    <stop offset="100%" stop-color="#44967b"/>
  </linearGradient>
  <filter id="shadowLarge" x="-50%" y="-20%" width="200%" height="150%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="18" result="blur"/>
    <feOffset dx="0" dy="16" result="offsetBlur"/>
    <feComponentTransfer><feFuncA type="linear" slope="0.25"/></feComponentTransfer>
    <feMerge><feMergeNode in="offsetBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="shadowMedium" x="-40%" y="-20%" width="180%" height="150%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="10" result="blur"/>
    <feOffset dx="0" dy="8" result="offsetBlur"/>
    <feComponentTransfer><feFuncA type="linear" slope="0.2"/></feComponentTransfer>
    <feMerge><feMergeNode in="offsetBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="shadowSmall" x="-30%" y="-20%" width="160%" height="140%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur"/>
    <feOffset dx="0" dy="3" result="offsetBlur"/>
    <feComponentTransfer><feFuncA type="linear" slope="0.15"/></feComponentTransfer>
    <feMerge><feMergeNode in="offsetBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="innerShadow" x="-20%" y="-20%" width="140%" height="140%">
    <feOffset dx="0" dy="2"/><feGaussianBlur stdDeviation="3" result="blur"/>
    <feComposite operator="out" in="SourceGraphic" in2="blur" result="cutout"/>
    <feComponentTransfer><feFuncA type="linear" slope="0.3"/></feComponentTransfer>
    <feComposite operator="atop" in="cutout" in2="SourceGraphic"/>
  </filter>
  <filter id="noiseTexture" x="0%" y="0%" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="3" stitchTiles="stitch" result="noise"/>
    <feColorMatrix in="noise" type="saturate" values="0"/>
    <feBlend in="SourceGraphic" in2="noise" mode="overlay"/>
    <feComponentTransfer><feFuncA type="linear" slope="0.02"/></feComponentTransfer>
  </filter>
  <filter id="caustics" x="-50%" y="-50%" width="200%" height="200%">
    <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="4" result="turb"/>
    <feDisplacementMap in="SourceGraphic" in2="turb" scale="3" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
</defs>
`;

function esc(str) {
  return str.replace(/&/g, XML_AMP);
}

function createProductSVG(variant = 'front') {
  const isDark = variant.includes('dark');
  const bgColor = isDark ? '#0c0a09' : '#fafaf9';
  const floorColor = isDark ? '#141110' : '#f0efe9';
  const shadowColor = isDark ? 'rgba(0,0,0,0.5)' : 'rgba(12,10,9,0.15)';
  
  const views = {
    front: { rotY: 0, rotX: -5, dist: 1 },
    side: { rotY: 30, rotX: -5, dist: 1.1 },
    open: { rotY: -15, rotX: -10, dist: 1.2 },
    mounted: { rotY: 10, rotX: 0, dist: 1.3 },
    lifestyle: { rotY: -20, rotX: -8, dist: 1.15 }
  };
  
  const view = views[variant.replace('product-', '').replace('-light', '').replace('-dark', '')] || views.front;
  
  const chambers = [
    { id: 'soap', name: 'Fl\u00FCssigseife', short: 'Seife', liquid: 'liqSoap', color: COLORS.liquid.soap, icon: 'M20,35 L40,35 L40,25 L35,20 L25,20 L20,25 Z M25,30 L35,30 L32,26 L28,26 Z', fillLevel: 0.78, bubbles: 12, sub: '300 ml ' + XML_AMP + ' Sanft ' + XML_AMP + ' hygienisch' },
    { id: 'foam', name: 'Rasierschaum', short: 'Schaum', liquid: 'liqFoam', color: COLORS.liquid.foam, icon: 'M20,25 Q30,20 40,25 Q45,30 40,35 Q30,40 20,35 Q15,30 20,25 M25,28 Q30,26 35,28 Q32,31 30,33 Q26,31 25,28 M30,30 Q32,30 32,32 Q30,34 30,32', fillLevel: 0.65, bubbles: 20, sub: '300 ml ' + XML_AMP + ' Cremig ' + XML_AMP + ' stabil' },
    { id: 'paste', name: 'Zahnpasta', short: 'Paste', liquid: 'liqPaste', color: COLORS.liquid.paste, icon: 'M20,35 L40,35 Q42,30 40,25 L20,25 Q18,30 20,35 M25,27 L35,27 L35,33 L25,33 Z M30,29 L30,31', fillLevel: 0.82, bubbles: 0, sub: '300 ml ' + XML_AMP + ' Pr\u00E4zise dosiert' }
  ];
  
  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}">
  ${DEFS}
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${bgColor}"/>
  <ellipse cx="${CX}" cy="${HEIGHT - 80}" rx="420" ry="45" fill="${shadowColor}"/>
  <g filter="url(#shadowLarge)" transform="translate(${CX - 320}, ${180})">
    <g transform="rotate(${view.rotY}, 320, 420) scale(${view.dist})">
`;

  const bodyX = 140, bodyY = 0, bodyW = 360, bodyH = 900, bodyR = 42;
  
  svg += `
    <path d="M${bodyX},${bodyY + bodyR} Q${bodyX},${bodyY} ${bodyX + bodyR},${bodyY} L${bodyX + bodyW - bodyR},${bodyY} Q${bodyX + bodyW},${bodyY} ${bodyX + bodyW},${bodyY + bodyR} L${bodyX + bodyW},${bodyY + bodyH - bodyR} Q${bodyX + bodyW},${bodyY + bodyH} ${bodyX + bodyW - bodyR},${bodyY + bodyH} L${bodyX + bodyR},${bodyY + bodyH} Q${bodyX},${bodyY + bodyH} ${bodyX},${bodyY + bodyH - bodyR} Z" fill="url(#bodyMat${isDark ? 'Dark' : ''})" filter="url(#noiseTexture)"/>
    <path d="M${bodyX + 4},${bodyY + bodyR} Q${bodyX + 4},${bodyY + 4} ${bodyX + bodyR - 2},${bodyY + 4} L${bodyX + bodyW - bodyR + 2},${bodyY + 4} L${bodyX + bodyW - 4},${bodyY + bodyR} L${bodyX + bodyW - 4},${bodyY + bodyH - bodyR} L${bodyX + bodyW - bodyR + 2},${bodyY + bodyH - 4} L${bodyX + bodyR - 2},${bodyY + bodyH - 4} Q${bodyX + 4},${bodyY + bodyH - 4} ${bodyX + 4},${bodyY + bodyH - bodyR} Z" fill="url(#reflSide)" opacity="0.6"/>
    <line x1="${bodyX + bodyW/2}" y1="${bodyY + 20}" x2="${bodyX + bodyW/2}" y2="${bodyY + bodyH - 20}" stroke="${isDark ? '#3d3834' : '#d6d3d1'}" stroke-width="0.5" opacity="0.5"/>
    <path d="M${bodyX},${bodyY - 30} Q${bodyX},${bodyY - 50} ${bodyX + bodyR},${bodyY - 50} L${bodyX + bodyW - bodyR},${bodyY - 50} Q${bodyX + bodyW},${bodyY - 50} ${bodyX + bodyW},${bodyY - 30} L${bodyX + bodyW},${bodyY} L${bodyX},${bodyY} Z" fill="url(#capMat)"/>
    <path d="M${bodyX + 20},${bodyY - 22} Q${bodyX + 20},${bodyY - 42} ${bodyX + bodyR + 10},${bodyY - 42} L${bodyX + bodyW - bodyR - 10},${bodyY - 42} Q${bodyX + bodyW - 20},${bodyY - 42} ${bodyX + bodyW - 20},${bodyY - 22} L${bodyX + bodyW - 20},${bodyY - 8} L${bodyX + 20},${bodyY - 8} Z" fill="${isDark ? '#0c0a09' : '#1c1917'}"/>
    <ellipse cx="${bodyX + bodyW/2}" cy="${bodyY - 22}" rx="${bodyW/2 - 25}" ry="8" fill="url(#reflTop)" opacity="0.4"/>
    <circle cx="${bodyX + bodyW/2}" cy="${bodyY - 18}" r="18" fill="none" stroke="#387763" stroke-width="2.5" opacity="0.9"><animate attributeName="opacity" values="0.4;1;0.4" dur="3s" repeatCount="indefinite"/></circle>
    <circle cx="${bodyX + bodyW/2}" cy="${bodyY - 18}" r="10" fill="rgba(56,119,99,0.15)"/>
`;

  const chamberTop = bodyY + 80, chamberH = 240, chamberGap = 20, chamberX = bodyX + 30, chamberW = bodyW - 60, chamberR = 28, chamberInnerR = 24;
  
  chambers.forEach((ch, i) => {
    const y = chamberTop + i * (chamberH + chamberGap);
    const fillH = chamberH * ch.fillLevel;
    const fillY = y + chamberH - fillH;
    const liquidX = chamberX + 4, liquidW = chamberW - 8, liquidR = chamberInnerR;
    
    svg += `
    <g transform="translate(0, ${y})">
      <path d="M${chamberX},${chamberR} Q${chamberX},0 ${chamberX + chamberR},0 L${chamberX + chamberW - chamberR},0 Q${chamberX + chamberW},0 ${chamberX + chamberW},${chamberR} L${chamberX + chamberW},${chamberH - chamberR} Q${chamberX + chamberW},${chamberH} ${chamberX + chamberW - chamberR},${chamberH} L${chamberX + chamberR},${chamberH} Q${chamberX},${chamberH} ${chamberX},${chamberH - chamberR} Z" fill="${ch.color.light}" fill-opacity="0.08" stroke="${ch.color.mid}" stroke-width="1.5" stroke-opacity="0.4"/>
      <path d="M${liquidX},${liquidR} Q${liquidX},0 ${liquidX + liquidR},0 L${liquidX + liquidW - liquidR},0 Q${liquidX + liquidW},0 ${liquidX + liquidW},${liquidR} L${liquidX + liquidW},${chamberH - liquidR} Q${liquidX + liquidW},${chamberH} ${liquidX + liquidW - liquidR},${chamberH} L${liquidX + liquidR},${chamberH} Q${liquidX},${chamberH} ${liquidX},${chamberH - liquidR} Z" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.1)" stroke-width="0.5"/>
      <path d="M${liquidX},${fillY} L${liquidX},${y + chamberH - liquidR} Q${liquidX},${y + chamberH} ${liquidX + liquidR},${y + chamberH} L${liquidX + liquidW - liquidR},${y + chamberH} Q${liquidX + liquidW},${y + chamberH} ${liquidX + liquidW},${y + chamberH - liquidR} L${liquidX + liquidW},${fillY} Z" fill="url(#${ch.liquid})" filter="url(#caustics)"><animate attributeName="d" values="M${liquidX},${fillY} L${liquidX},${y + chamberH - liquidR} Q${liquidX},${y + chamberH} ${liquidX + liquidR},${y + chamberH} L${liquidX + liquidW - liquidR},${y + chamberH} Q${liquidX + liquidW},${y + chamberH} ${liquidX + liquidW},${y + chamberH - liquidR} L${liquidX + liquidW},${fillY} Z; M${liquidX},${fillY - 2} L${liquidX},${y + chamberH - liquidR} Q${liquidX},${y + chamberH} ${liquidX + liquidR},${y + chamberH} L${liquidX + liquidW - liquidR},${y + chamberH} Q${liquidX + liquidW},${y + chamberH} ${liquidX + liquidW},${y + chamberH - liquidR} L${liquidX + liquidW},${fillY - 2} Z; M${liquidX},${fillY} L${liquidX},${y + chamberH - liquidR} Q${liquidX},${y + chamberH} ${liquidX + liquidR},${y + chamberH} L${liquidX + liquidW - liquidR},${y + chamberH} Q${liquidX + liquidW},${y + chamberH} ${liquidX + liquidW},${y + chamberH - liquidR} L${liquidX + liquidW},${fillY} Z" dur="${3 + i * 0.5}s" repeatCount="indefinite"/></path>
      <ellipse cx="${chamberX + chamberW/2}" cy="${fillY}" rx="${liquidW/2 - 4}" ry="6" fill="url(#meniscus)" opacity="0.7"/>
      ${generateBubbles(chamberX + chamberW/2, fillY, liquidW - 10, fillH - 10, ch.bubbles, ch.color, y)}
      <text x="${chamberX + chamberW/2}" y="${chamberH + 30}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="600" fill="${isDark ? '#e7e5e4' : '#1c1917'}">${ch.icon} ${esc(ch.name)}</text>
      <text x="${chamberX + chamberW/2}" y="${chamberH + 52}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="12" fill="${isDark ? '#a8a29e' : '#57534e'}">${esc(ch.sub)}</text>
      <circle cx="${chamberX + chamberW/2}" cy="${y + 120}" r="22" fill="${ch.color.mid}" fill-opacity="0.15" stroke="${ch.color.mid}" stroke-width="1.5" stroke-opacity="0.3"/>
      <text x="${chamberX + chamberW/2}" y="${y + 126}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="32" font-weight="300" fill="${ch.color.mid}">\u2248</text>
    </g>`;
  });
  
  const panelY = bodyY + bodyH - 140, panelX = bodyX + 30, panelW = bodyW - 60, panelH = 120, panelR = 20;
  svg += `
    <rect x="${panelX}" y="${panelY}" width="${panelW}" height="${panelH}" rx="${panelR}" fill="${isDark ? '#0c0a09' : '#1c1917'}" filter="url(#innerShadow)"/>
    <g transform="translate(${bodyX + bodyW/2}, ${panelY + 30})">
      ${chambers.map((ch, i) => `<circle cx="${(i - 1) * 65}" cy="0" r="14" fill="url(#ledOff)" stroke="${ch.color.mid}" stroke-width="1.5"><animate attributeName="fill" values="url(#ledOff);url(#ledOn);url(#ledOff)" dur="${2.5 + i * 0.3}s" repeatCount="indefinite" begin="${i * 0.4}s"/></circle><text x="${(i - 1) * 65}" y="26" text-anchor="middle" font-family="system-ui, sans-serif" font-size="10" font-weight="700" fill="${ch.color.mid}" letter-spacing="0.5px">${ch.short.toUpperCase()}</text>`).join('')}
    </g>
    <circle cx="${bodyX + bodyW/2}" cy="${panelY + 85}" r="28" fill="url(#btnMat)" filter="url(#shadowMedium)"><animate attributeName="r" values="28;29;28" dur="4s" repeatCount="indefinite"/></circle>
    <text x="${bodyX + bodyW/2}" y="${panelY + 92}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="20" font-weight="800" fill="white">M</text>
    <circle cx="${bodyX + bodyW/2}" cy="${panelY + 85}" r="28" fill="none" stroke="#44967b" stroke-width="2" opacity="0"><animate attributeName="r" values="28;45;28" dur="3s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.5;0;0" dur="3s" repeatCount="indefinite"/></circle>
  `;
  
  const nozzleY = bodyY + bodyH + 10;
  svg += `
    <g filter="url(#shadowSmall)">
      ${chambers.map((ch, i) => `<g transform="translate(${bodyX + bodyW/2 - 70 + i * 70}, ${nozzleY})"><rect x="-18" y="0" width="36" height="14" rx="6" fill="${isDark ? '#2f2a27' : '#d6d3d1'}"/><ellipse cx="0" cy="0" rx="14" ry="3" fill="${ch.color.mid}" opacity="0.9"><animate attributeName="ry" values="3;8;3" dur="${1.8 + i * 0.2}s" repeatCount="indefinite" begin="${i * 0.3}s"/></ellipse><circle cx="0" cy="6" r="3" fill="${ch.color.mid}"/></g>`).join('')}
    </g>
  `;
  
  if (variant !== 'front' && !variant.includes('light') && !variant.includes('dark')) {
    const portX = bodyX + bodyW + 15, portY = bodyY + 200;
    svg += `
      <g transform="translate(${portX}, ${portY})" filter="url(#shadowSmall)">
        <rect x="0" y="0" width="28" height="12" rx="3" fill="${isDark ? '#2f2a27' : '#d6d3d1'}"/>
        <rect x="3" y="3" width="22" height="6" rx="1.5" fill="${isDark ? '#1c1917' : '#2f2a27'}"/>
        <text x="14" y="28" text-anchor="middle" font-family="system-ui, sans-serif" font-size="9" fill="${isDark ? '#a8a29e' : '#57534e'}">USB-C</text>
        <g transform="translate(0, 40)">
          <rect x="0" y="0" width="28" height="50" rx="4" fill="${isDark ? '#1c1917' : '#2f2a27'}"/>
          ${[0,1,2,3,4].map(i => `<rect x="3" y="${4 + i * 9}" width="22" height="7" rx="1.5" fill="${i < 4 ? 'url(#batGrad)' : '#44403c'}"/>`).join('')}
          <text x="14" y="62" text-anchor="middle" font-family="system-ui, sans-serif" font-size="9" fill="#387763" font-weight="700">100%</text>
        </g>
      </g>
    `;
  }
  
  if (variant === 'mounted' || variant === 'lifestyle') {
    const bracketX = bodyX - 30, bracketY = bodyY + 100;
    svg += `
      <g transform="translate(${bracketX}, ${bracketY})" filter="url(#shadowMedium)">
        <rect x="0" y="0" width="36" height="320" rx="6" fill="${isDark ? '#2f2a27' : '#d6d3d1'}" opacity="0.9"/>
        <circle cx="18" cy="30" r="10" fill="${isDark ? '#1c1917' : '#2f2a27'}"/>
        <circle cx="18" cy="160" r="8" fill="${isDark ? '#1c1917' : '#2f2a27'}" opacity="0.5"/>
        <circle cx="18" cy="290" r="10" fill="${isDark ? '#1c1917' : '#2f2a27'}"/>
        <text x="18" y="340" text-anchor="middle" font-family="system-ui, sans-serif" font-size="9" fill="${isDark ? '#a8a29e' : '#57534e'}">3M ' + XML_AMP + ' Schrauben</text>
      </g>
    `;
  }
  
  svg += `
    <g transform="translate(${bodyX + bodyW + 25}, ${bodyY + 100})">
      <circle cx="0" cy="0" r="40" fill="url(#btnMat)"/>
      <text x="0" y="14" text-anchor="middle" font-family="system-ui, sans-serif" font-size="40" font-weight="800" fill="white">3\u00B71</text>
      <circle cx="0" cy="0" r="40" fill="none" stroke="#44967b" stroke-width="2" opacity="0.3"><animate attributeName="r" values="40;55;40" dur="4s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.3;0;0" dur="4s" repeatCount="indefinite"/></circle>
    </g>
  `;
  
  svg += `
    </g>
  </g>
  <ellipse cx="${CX}" cy="${HEIGHT - 60}" rx="280" ry="8" fill="${shadowColor}" opacity="0.4"/>
  <ellipse cx="${CX}" cy="${HEIGHT - 60}" rx="180" ry="4" fill="${shadowColor}" opacity="0.3"/>
  <text x="${CX}" y="${HEIGHT - 30}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="36" font-weight="700" fill="${isDark ? '#fafaf9' : '#1c1917'}" letter-spacing="-0.02em">3-in-1 Seifenspender</text>
  <text x="${CX}" y="${HEIGHT + 10}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="18" fill="${isDark ? '#a8a29e' : '#57534e'}">Seife \u00B7 Rasierschaum \u00B7 Zahnpasta</text>
</svg>`;

  return svg;
}

function generateBubbles(cx, surfaceY, width, height, count, color, chamberY) {
  if (count === 0) return '';
  let bubbles = '';
  for (let i = 0; i < count; i++) {
    const bx = cx - width/2 + (i % 5) * (width/4) + (Math.random() - 0.5) * 10;
    const by = surfaceY + 5 + Math.floor(i/5) * (height/3) + (Math.random() - 0.5) * 15;
    const r = 2 + Math.random() * 4;
    const dur = 1.5 + Math.random() * 1.5;
    const delay = Math.random() * 2;
    bubbles += `<ellipse cx="${bx}" cy="${by}" rx="${r}" ry="${r * 0.6}" fill="${color.light}" fill-opacity="0.8" stroke="${color.mid}" stroke-width="0.5" stroke-opacity="0.5"><animate attributeName="cy" values="${by};${by - 30 - Math.random()*20};${by}" dur="${dur}s" repeatCount="indefinite" begin="${delay}s"/><animate attributeName="rx" values="${r};${r*1.5};${r}" dur="${dur}s" repeatCount="indefinite" begin="${delay}s"/><animate attributeName="opacity" values="0.8;0;0.8" dur="${dur}s" repeatCount="indefinite" begin="${delay}s"/></ellipse>`;
  }
  return bubbles;
}

function createUsageSVG(step) {
  const steps = [
    { num: 1, title: 'Auspacken ' + XML_AMP + ' Laden', scene: (cx, cy, isDark) => `
      <g transform="translate(${cx - 150}, ${cy - 80})">
        <path d="M0,0 L300,0 L300,200 L0,200 Z" fill="${isDark ? '#2f2a27' : '#e7e5e4'}" stroke="${isDark ? '#44403c' : '#d6d3d1'}" stroke-width="2"/>
        <path d="M10,10 L290,10 L290,190 L10,190 Z" fill="${isDark ? '#1c1917' : '#fafaf9'}"/>
        <g transform="translate(150,0)">
          <path d="M-140,-60 Q-70,-80 0,-60 Q70,-80 140,-60 L140,0 L-140,0 Z" fill="${isDark ? '#3d3834' : '#d6d3d1'}" opacity="0.8"><animateTransform attributeName="transform" type="rotate" values="0,150,0; -45,150,0; 0,150,0" dur="3s" repeatCount="indefinite"/></path>
          <path d="M-140,200 Q-70,220 0,200 Q70,220 140,200 L140,260 L-140,260 Z" fill="${isDark ? '#3d3834' : '#d6d3d1'}" opacity="0.8"><animateTransform attributeName="transform" type="rotate" values="0,150,200; 45,150,200; 0,150,200" dur="3s" repeatCount="indefinite"/></path>
        </g>
        <rect x="80" y="40" width="140" height="220" rx="16" fill="url(#bodyMat)" filter="url(#shadowMedium)"/>
        <circle cx="150" cy="70" r="18" fill="url(#btnMat)"/>
        <text x="150" y="78" text-anchor="middle" font-size="22" font-weight="800" fill="white">3\u00B71</text>
      </g>
      <path d="M${cx + 180},${cy + 80} Q${cx + 220},${cy + 80} ${cx + 220},${cy + 120} Q${cx + 220},${cy + 160} ${cx + 180},${cy + 160}" stroke="${isDark ? '#78716c' : '#a8a29e'}" stroke-width="6" fill="none" stroke-linecap="round"/>
      <rect x="${cx + 165}" y="${cy + 155}" width="30" height="14" rx="3" fill="${isDark ? '#2f2a27' : '#d6d3d1'}"/>
      <rect x="${cx + 170}" y="${cy + 158}" width="20" height="8" rx="2" fill="${isDark ? '#1c1917' : '#2f2a27'}"/>
      <g transform="translate(${cx + 180}, ${cy + 100})">
        <line x1="0" y1="-15" x2="0" y2="-5" stroke="#387763" stroke-width="3" stroke-linecap="round" opacity="0"><animate attributeName="opacity" values="0;1;0" dur="1.5s" repeatCount="indefinite"/></line>
        <line x1="-8" y1="-13" x2="-8" y2="-3" stroke="#387763" stroke-width="3" stroke-linecap="round" opacity="0"><animate attributeName="opacity" values="0;1;0" dur="1.5s" repeatCount="indefinite" begin="0.2s"/></line>
        <line x1="8" y1="-13" x2="8" y2="-3" stroke="#387763" stroke-width="3" stroke-linecap="round" opacity="0"><animate attributeName="opacity" values="0;1;0" dur="1.5s" repeatCount="indefinite" begin="0.4s"/></line>
      </g>
    `},
    { num: 2, title: 'Kammern bef\u00FCllen', scene: (cx, cy, isDark) => `
      <g transform="translate(${cx - 200}, ${cy - 150})">
        <rect x="0" y="0" width="400" height="500" rx="36" fill="url(#bodyMat)" filter="url(#shadowLarge)"/>
        <rect x="20" y="20" width="360" height="40" rx="16" fill="${isDark ? '#1c1917' : '#2f2a27'}"/>
        <g transform="translate(20, 80)">
          ${['#3d9b78','#06b6d4','#f59e0b'].map((c, i) => `<g transform="translate(${i * 125}, 0)"><ellipse cx="60" cy="0" rx="55" ry="12" fill="${c}" opacity="0.3"/><path d="M5,10 Q5,-20 60,-30 Q115,-20 115,10" fill="none" stroke="${c}" stroke-width="2" stroke-dasharray="8 4"/><path d="M20,10 Q35,-10 60,-20 Q85,-10 100,10" fill="${c}80" opacity="0.6"><animate attributeName="d" values="M20,10 Q35,-10 60,-20 Q85,-10 100,10; M20,10 Q35,-5 60,-15 Q85,-5 100,10; M20,10 Q35,-10 60,-20 Q85,-10 100,10" dur="2s" repeatCount="indefinite" begin="${i * 0.3}s"/></path><g transform="translate(60, -30)">${[0,1,2].map(j => `<ellipse cx="${(j-1)*6}" cy="${j*8}" rx="3" ry="6" fill="${c}" opacity="${0.7 - j*0.2}"><animate attributeName="cy" values="${j*8};${j*8+40};${j*8}" dur="1.5s" repeatCount="indefinite" begin="${j*0.2}s"/><animate attributeName="opacity" values="${0.7 - j*0.2};0;${0.7 - j*0.2}" dur="1.5s" repeatCount="indefinite" begin="${j*0.2}s"/></ellipse>`).join('')}</g><text x="60" y="150" text-anchor="middle" font-size="14" font-weight="600" fill="${c}">${['FL\u00DCSSIGSEIFE','RASIERSCHAUM','ZAHNPASTA'][i]}</text></g>`).join('')}
        </g>
      </g>
    `},
    { num: 3, title: 'Montage w\u00E4hlen', scene: (cx, cy, isDark) => `
      <g transform="translate(${cx - 250}, ${cy - 180})">
        <g fill="${isDark ? '#2f2a27' : '#e7e5e4'}">${[...Array(6)].map((_, row) => [...Array(5)].map((_, col) => `<rect x="${col * 100}" y="${row * 70}" width="96" height="66" rx="4" stroke="${isDark ? '#44403c' : '#d6d3d1'}" stroke-width="1"/>`).join('')).join('')}</g>
        <g transform="translate(100, 100)" filter="url(#shadowMedium)"><rect x="0" y="0" width="180" height="220" rx="16" fill="url(#bodyMat)"/><rect x="20" y="20" width="140" height="180" rx="10" fill="${isDark ? '#1c1917' : '#2f2a27'}" opacity="0.3"/><circle cx="30" cy="50" r="14" fill="#387763" opacity="0.3"/><circle cx="150" cy="50" r="14" fill="#387763" opacity="0.3"/><circle cx="30" cy="170" r="14" fill="#387763" opacity="0.3"/><circle cx="150" cy="170" r="14" fill="#387763" opacity="0.3"/><circle cx="90" cy="110" r="20" fill="url(#btnMat)"><animate attributeName="r" values="20;22;20" dur="2s" repeatCount="indefinite"/></circle><text x="90" y="118" text-anchor="middle" font-size="20" font-weight="800" fill="white">3M</text></g>
        <g transform="translate(320, 100)" filter="url(#shadowMedium)"><rect x="0" y="0" width="180" height="220" rx="16" fill="url(#bodyMat)"/><rect x="20" y="20" width="140" height="180" rx="10" fill="${isDark ? '#1c1917' : '#2f2a27'}" opacity="0.3"/><circle cx="30" cy="50" r="10" fill="${isDark ? '#57534e' : '#a8a29e'}"/><circle cx="150" cy="50" r="10" fill="${isDark ? '#57534e' : '#a8a29e'}"/><circle cx="30" cy="170" r="10" fill="${isDark ? '#57534e' : '#a8a29e'}"/><circle cx="150" cy="170" r="10" fill="${isDark ? '#57534e' : '#a8a29e'}"/><g transform="translate(90, 110)"><circle cx="0" cy="0" r="16" fill="${isDark ? '#57534e' : '#a8a29e'}"/><circle cx="0" cy="0" r="6" fill="${isDark ? '#1c1917' : '#fafaf9'}"/></g></g>
        <g transform="translate(120, 350)" filter="url(#shadowLarge)"><rect x="0" y="0" width="360" height="180" rx="24" fill="url(#bodyMat)"/><rect x="20" y="20" width="320" height="140" rx="16" fill="${isDark ? '#1c1917' : '#2f2a27'}" opacity="0.2"/>${['#3d9b78','#06b6d4','#f59e0b'].map((c, i) => `<circle cx="${60 + i * 100}" cy="90" r="24" fill="${c}" opacity="0.2"/><circle cx="${60 + i * 100}" cy="90" r="12" fill="${c}" opacity="0.4"/>`).join('')}</g>
      </g>
    `},
    { num: 4, title: 'Dosierung einstellen', scene: (cx, cy, isDark) => `
      <g transform="translate(${cx - 200}, ${cy - 120})">
        <rect x="0" y="0" width="400" height="400" rx="32" fill="url(#bodyMat)" filter="url(#shadowLarge)"/>
        <rect x="30" y="30" width="340" height="340" rx="24" fill="${isDark ? '#1c1917' : '#2f2a27'}"/>
        <g transform="translate(200, 80)">${['#3d9b78','#06b6d4','#f59e0b'].map((c, i) => `<circle cx="${(i-1)*70}" cy="0" r="18" fill="url(#ledOff)" stroke="${c}" stroke-width="2"><animate attributeName="fill" values="url(#ledOff);url(#ledOn);url(#ledOff)" dur="2s" repeatCount="indefinite" begin="${i * 0.4}s"/></circle><text x="${(i-1)*70}" y="35" text-anchor="middle" font-size="11" font-weight="700" fill="${c}" letter-spacing="0.5px">${['SEIFE','SCHAUM','PASTE'][i]}</text>`).join('')}</g>
        <circle cx="200" cy="200" r="36" fill="url(#btnMat)" filter="url(#shadowMedium)"><animate attributeName="r" values="36;38;36" dur="3s" repeatCount="indefinite"/></circle>
        <text x="200" y="210" text-anchor="middle" font-size="28" font-weight="800" fill="white">M</text>
        <circle cx="200" cy="200" r="36" fill="none" stroke="#44967b" stroke-width="3" opacity="0"><animate attributeName="r" values="36;60;36" dur="3s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.6;0;0" dur="3s" repeatCount="indefinite"/></circle>
        <text x="200" y="280" text-anchor="middle" font-size="16" fill="${isDark ? '#e7e5e4' : '#1c1917'}" font-weight="500">Kurz dr\u00FCcken = Modus wechseln</text>
        <text x="200" y="310" text-anchor="middle" font-size="16" fill="#f59e0b" font-weight="600">3 Sek. halten = Stufe \u00E4ndern (1-3)</text>
        <g transform="translate(200, 340)">${[0,1,2].map(i => `<circle cx="${(i-1)*45}" cy="0" r="14" fill="${i < 2 ? 'url(#batGrad)' : '#44403c'}" stroke="${isDark ? '#44403c' : '#d6d3d1'}" stroke-width="1.5"/>`).join('')}</g>
      </g>
    `},
    { num: 5, title: 'Los geht\u00B4s!', scene: (cx, cy, isDark) => `
      <g transform="translate(${cx - 300}, ${cy - 200})">
        <rect x="0" y="0" width="600" height="450" rx="20" fill="${isDark ? '#1c1917' : '#f5f5f4'}" stroke="${isDark ? '#3d3834' : '#d6d3d1'}" stroke-width="2"/>
        <rect x="20" y="20" width="560" height="410" rx="14" fill="${isDark ? '#0c0a09' : '#fafaf9'}" opacity="0.3"/>
        <g transform="translate(220, 60)" filter="url(#shadowLarge)"><rect x="0" y="0" width="160" height="320" rx="20" fill="url(#bodyMat)"/><rect x="10" y="10" width="140" height="300" rx="14" fill="${isDark ? '#1c1917' : '#2f2a27'}" opacity="0.15"/>${['#3d9b78','#06b6d4','#f59e0b'].map((c, i) => `<g transform="translate(80, ${70 + i * 80})"><rect x="-30" y="-8" width="60" height="20" rx="8" fill="${isDark ? '#2f2a27' : '#d6d3d1'}"/><ellipse cx="0" cy="-8" rx="20" ry="4" fill="${c}" opacity="0.9"><animate attributeName="ry" values="4;12;4" dur="1.5s" repeatCount="indefinite" begin="${i * 0.3}s"/></ellipse><ellipse cx="0" cy="-30" rx="12" ry="18" fill="${c}" opacity="0"><animate attributeName="opacity" values="0;0.5;0" dur="2s" repeatCount="indefinite" begin="${0.5 + i * 0.3}s"/><animate attributeName="cy" values="-30;-70;-30" dur="2s" repeatCount="indefinite" begin="${0.5 + i * 0.3}s"/><animate attributeName="ry" values="18;35;18" dur="2s" repeatCount="indefinite" begin="${0.5 + i * 0.3}s"/></ellipse><circle cx="0" cy="4" r="5" fill="${c}"/></g>`).join('')}</g>
        <g transform="translate(120, 200)"><ellipse cx="0" cy="0" rx="35" ry="50" fill="${isDark ? '#44403c' : '#d6d3d1'}" transform="rotate(-20)"/><ellipse cx="-30" cy="-40" rx="15" ry="35" fill="${isDark ? '#44403c' : '#d6d3d1'}" transform="rotate(30)"/></g>
        ${[...Array(8)].map((_, i) => { const x = 150 + (i % 4) * 100; const y = 100 + Math.floor(i/4) * 150; return `<g transform="translate(${x}, ${y})"><polygon points="0,-10 2,-3 10,-3 4,1 6,10 0,5 -6,10 -4,1 -10,-3 -2,-3" fill="#f59e0b" opacity="0"><animate attributeName="opacity" values="0;1;0" dur="1.5s" repeatCount="indefinite" begin="${i * 0.2}s"/><animateTransform attributeName="transform" type="rotate" values="0;180;360" dur="3s" repeatCount="indefinite"/></polygon></g>`; }).join('')}
        <circle cx="450" cy="380" r="40" fill="#387763" opacity="0.2"><animate attributeName="r" values="40;45;40" dur="2s" repeatCount="indefinite"/></circle>
        <path d="M430,380 L445,395 L470,365" fill="none" stroke="#387763" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity="0"><animate attributeName="opacity" values="0;1;1" dur="1s" repeatCount="indefinite" begin="2s"/><animate attributeName="stroke-dashoffset" values="50;0;0" dur="1s" repeatCount="indefinite" begin="2s"/><animate attributeName="stroke-dasharray" values="0,50;50,0;50,0" dur="1s" repeatCount="indefinite" begin="2s"/></path>
      </g>
    `}
  ];
  
  const s = steps[step - 1];
  const isDark = false, bg = isDark ? '#0c0a09' : '#fafaf9', cx = 400, cy = 300;
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
  ${DEFS}
  <rect width="800" height="600" fill="${bg}"/>
  <circle cx="720" cy="80" r="55" fill="url(#btnMat)"/>
  <text x="720" y="95" text-anchor="middle" font-family="system-ui, sans-serif" font-size="52" font-weight="800" fill="white">${s.num}</text>
  <text x="400" y="55" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="36" font-weight="700" fill="${isDark ? '#fafaf9' : '#1c1917'}">${esc(s.title)}</text>
  <text x="400" y="90" text-anchor="middle" font-family="system-ui, sans-serif" font-size="18" fill="${isDark ? '#a8a29e' : '#57534e'}">Schritt ${s.num} von 5</text>
  ${s.scene(cx, cy, isDark)}
  <line x1="150" y1="570" x2="650" y2="570" stroke="${isDark ? '#3d3834' : '#d6d3d1'}" stroke-width="4" stroke-linecap="round"/>
  <line x1="150" y1="570" x2="${150 + s.num * 100}" y2="570" stroke="#387763" stroke-width="4" stroke-linecap="round"><animate attributeName="x2" values="150;${150 + s.num * 100}" dur="1s" fill="freeze"/></line>
</svg>`;
}

function createOGImage() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  ${DEFS}
  <rect width="1200" height="630" fill="url(#bodyMatDark)"/>
  <circle cx="180" cy="180" r="250" fill="#387763" opacity="0.08" filter="url(#glow)"/>
  <circle cx="1020" cy="450" r="220" fill="#f59e0b" opacity="0.06" filter="url(#glow)"/>
  <g transform="translate(180, 80)" filter="url(#shadowLarge)"><rect x="0" y="0" width="320" height="470" rx="32" fill="url(#bodyMat)"/><rect x="20" y="20" width="280" height="430" rx="20" fill="#387763" opacity="0.05"/>${['#3d9b78','#06b6d4','#f59e0b'].map((c, i) => `<rect x="30" y="${50 + i * 135}" width="260" height="110" rx="16" fill="${c}" opacity="0.12" stroke="${c}" stroke-width="1.5" stroke-opacity="0.3"/><circle cx="160" cy="${105 + i * 135}" r="26" fill="${c}" opacity="0.18"/>`).join('')}</g>
  <circle cx="340" cy="150" r="50" fill="url(#btnMat)" filter="url(#glow)"/><text x="340" y="165" text-anchor="middle" font-family="system-ui, sans-serif" font-size="56" font-weight="800" fill="white">3\u00B71</text>
  <text x="480" y="170" text-anchor="start" font-family="system-ui, -apple-system, sans-serif" font-size="56" font-weight="800" fill="white" letter-spacing="-0.02em">Ein Spender.</text>
  <text x="480" y="240" text-anchor="start" font-family="system-ui, -apple-system, sans-serif" font-size="56" font-weight="800" fill="white" letter-spacing="-0.02em">Drei M\u00F6glichkeiten.</text>
  <text x="480" y="315" text-anchor="start" font-family="system-ui, sans-serif" font-size="24" fill="#d6d3d1" line-height="1.5">Fl\u00FCssigseife \u00B7 Rasierschaum \u00B7 Zahnpasta</text>
  <text x="480" y="355" text-anchor="start" font-family="system-ui, sans-serif" font-size="24" fill="#d6d3d1">Hygienisch \u00B7 Platzsparend \u00B7 Smart</text>
  <g transform="translate(480, 400)">${['Seife 300 ml', 'Schaum 300 ml', 'Paste 300 ml', 'Batterie 6+ Monate', 'Wasserfest IPX4', '3M ' + XML_AMP + ' Schrauben'].map((t, i) => `<rect x="${(i % 3) * 220}" y="${Math.floor(i/3) * 60}" width="200" height="50" rx="25" fill="${i < 3 ? '#387763' : '#1c1917'}" stroke="${i < 3 ? '#44967b' : '#44403c'}" stroke-width="1.5" opacity="${i < 3 ? 1 : 0.8}"/><text x="${(i % 3) * 220 + 100}" y="${Math.floor(i/3) * 60 + 34}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="17" font-weight="600" fill="white">${esc(t)}</text>`).join('')}</g>
  <rect x="480" y="520" width="320" height="64" rx="32" fill="url(#btnMat)" filter="url(#shadowMedium)"/><text x="640" y="562" text-anchor="middle" font-family="system-ui, sans-serif" font-size="24" font-weight="700" fill="white">Jetzt entdecken \u2192</text>
  <text x="1150" y="605" text-anchor="end" font-family="system-ui, sans-serif" font-size="18" fill="#78716c">seifenspender.example</text>
</svg>`;
}

async function generateAll() {
  console.log('\u{1F3A8} Generating photorealistic product images...\n');
  
  const views = ['front', 'side', 'open', 'mounted', 'lifestyle'];
  for (const view of views) {
    const name = `product-${view}`;
    console.log(`  Generating ${name}...`);
    const svg = createProductSVG(name);
    writeFileSync(join(outDir, `${name}.svg`), svg);
    
    for (const suffix of ['', '-light', '-dark']) {
      const fullName = name + suffix;
      const webpPath = join(webpDir, `${fullName}.webp`);
      const svgStr = createProductSVG(fullName).replace(/&/g, XML_AMP);
      await sharp(Buffer.from(svgStr))
        .resize(1200, 1400, { fit: 'contain', background: { r: 250, g: 250, b: 249, alpha: 1 } })
        .webp({ quality: 90, effort: 6 })
        .toFile(webpPath);
      console.log(`    \u2713 ${fullName}.webp`);
    }
  }
  
  console.log('\n  Generating usage steps...');
  for (let i = 1; i <= 5; i++) {
    const svg = createUsageSVG(i);
    writeFileSync(join(outDir, `usage-${i}.svg`), svg);
    
    const webpPath = join(webpDir, `usage-${i}.webp`);
    const svgStr = svg.replace(/&/g, XML_AMP);
    await sharp(Buffer.from(svgStr))
      .resize(800, 600, { fit: 'contain', background: { r: 250, g: 250, b: 249, alpha: 1 } })
      .webp({ quality: 90, effort: 6 })
      .toFile(webpPath);
    console.log(`    \u2713 usage-${i}.svg + .webp`);
  }
  
  console.log('\n  Generating OG image...');
  const ogSvg = createOGImage();
  writeFileSync(join(outDir, 'og-default.svg'), ogSvg);
  const ogStr = ogSvg.replace(/&/g, XML_AMP);
  await sharp(Buffer.from(ogStr))
    .resize(1200, 630, { fit: 'cover', background: { r: 12, g: 10, b: 9, alpha: 1 } })
    .webp({ quality: 95, effort: 6 })
    .toFile(join(webpDir, 'og-default.webp'));
  console.log('    \u2713 og-default.svg + .webp');
  
  console.log('\n\u2705 All high-quality images generated successfully!');
  console.log(`\u{1F4C1} Output: ${outDir}/`);
  console.log(`\u{1F4C1} WebP: ${webpDir}/`);
}

generateAll().catch(console.error);