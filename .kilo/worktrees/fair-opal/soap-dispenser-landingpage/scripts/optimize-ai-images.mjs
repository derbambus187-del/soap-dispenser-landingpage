#!/usr/bin/env node
// Image Optimization & Integration Pipeline
// Processes AI-generated images (Midjourney, DALL-E, Stable Diffusion, Flux)
// and optimizes them for the landing page

import { writeFileSync, mkdirSync, existsSync, readdirSync, readFileSync } from 'fs';
import { join, extname, basename } from 'path';
import sharp from 'sharp';

const INPUT_DIR = join(process.cwd(), 'ai-input');
const OUTPUT_DIR = join(process.cwd(), 'public', 'images');
const WEBP_DIR = join(OUTPUT_DIR, 'webp');

if (!existsSync(INPUT_DIR)) mkdirSync(INPUT_DIR, { recursive: true });
if (!existsSync(WEBP_DIR)) mkdirSync(WEBP_DIR, { recursive: true });

// ============================================================
// TARGET SPECIFICATIONS
// ============================================================
const SPECS = {
  // Hero product shots
  hero: { 
    widths: [1600, 1200, 800], 
    aspect: 4/5, 
    fit: 'contain',
    background: { r: 250, g: 250, b: 249, alpha: 1 },
    quality: 92
  },
  // Gallery thumbnails
  gallery: { 
    widths: [800, 600, 400], 
    aspect: 1, 
    fit: 'cover',
    background: { r: 250, g: 250, b: 249, alpha: 1 },
    quality: 88
  },
  // Usage steps
  usage: { 
    widths: [1000, 800, 600], 
    aspect: 4/3, 
    fit: 'contain',
    background: { r: 250, g: 250, b: 249, alpha: 1 },
    quality: 90
  },
  // OG/Social
  og: { 
    widths: [1200], 
    aspect: 1.91, 
    fit: 'cover',
    background: { r: 12, g: 10, b: 9, alpha: 1 },
    quality: 95
  },
  // Favicon/App icons
  icons: {
    widths: [512, 192, 180, 152, 144, 128, 96, 72, 48, 32, 16],
    aspect: 1,
    fit: 'contain',
    background: { r: 56, g: 119, b: 99, alpha: 1 },
    quality: 90
  }
};

// ============================================================
// FILENAME MAPPING
// ============================================================
// Maps input filenames to output roles
const ROLE_MAP = {
  // Product views
  'product-front': 'hero',
  'product-side': 'hero',
  'product-angle': 'hero',
  'product-open': 'hero',
  'product-mounted': 'hero',
  'product-lifestyle': 'hero',
  'product-closeup': 'gallery',
  
  // Usage steps
  'usage-1': 'usage', 'usage-2': 'usage', 'usage-3': 'usage',
  'usage-4': 'usage', 'usage-5': 'usage',
  'step-1': 'usage', 'step-2': 'usage', 'step-3': 'usage',
  'step-4': 'usage', 'step-5': 'usage',
  
  // Special
  'og-image': 'og',
  'og-default': 'og',
  'social': 'og',
  'hero': 'hero',
  'logo': 'icons',
  'icon': 'icons',
  'favicon': 'icons'
};

// ============================================================
// COLOR PROFILE & METADATA
// ============================================================
const ICC_PROFILE = 'sRGB'; // Ensure sRGB for web
const STRIP_METADATA = true;

async function optimizeImage(inputPath, role, outputName) {
  const spec = SPECS[role];
  if (!spec) {
    console.warn(`  ⚠ Unknown role: ${role}`);
    return;
  }

  try {
    const inputBuffer = readFileSync(inputPath);
    const metadata = await sharp(inputBuffer).metadata();
    
    console.log(`  📸 ${basename(inputPath)} → ${role} (${metadata.width}x${metadata.height} ${metadata.format})`);

    for (const width of spec.widths) {
      const height = Math.round(width / spec.aspect);
      const suffix = spec.widths.length > 1 ? `-${width}w` : '';
      const outName = `${outputName}${suffix}.webp`;
      const outPath = join(role === 'icons' ? OUTPUT_DIR : WEBP_DIR, outName);

      await sharp(inputBuffer)
        .rotate() // Auto-rotate from EXIF
        .resize(width, height, { 
          fit: spec.fit, 
          background: spec.background,
          withoutEnlargement: false
        })
        .webp({ 
          quality: spec.quality, 
          effort: 6,
          smartSubsample: true
        })
        .withMetadata(STRIP_METADATA ? {} : undefined)
        .toFile(outPath);

      console.log(`    ✓ ${outName} (${width}x${height})`);
    }

    // Also save original as optimized PNG for fallback
    const pngPath = join(OUTPUT_DIR, `${outputName}.png`);
    await sharp(inputBuffer)
      .rotate()
      .resize(spec.widths[0], Math.round(spec.widths[0] / spec.aspect), {
        fit: spec.fit,
        background: spec.background,
        withoutEnlargement: false
      })
      .png({ quality: 95, effort: 10, compressionLevel: 9, adaptiveFiltering: true })
      .toFile(pngPath);
    
    console.log(`    ✓ ${outputName}.png (fallback)`);

  } catch (err) {
    console.error(`  ✗ Failed: ${err.message}`);
  }
}

function detectRole(filename) {
  const name = basename(filename, extname(filename)).toLowerCase();
  
  // Check exact matches first
  for (const [key, role] of Object.entries(ROLE_MAP)) {
    if (name.includes(key.toLowerCase())) return role;
  }
  
  // Check patterns
  if (name.match(/^(product|hero|shot|view)/)) return 'hero';
  if (name.match(/^(usage|step|tutorial|howto)/)) return 'usage';
  if (name.match(/^(og|social|share|meta)/)) return 'og';
  if (name.match(/^(gallery|thumb|thumb)/)) return 'gallery';
  if (name.match(/^(icon|logo|favicon|app)/)) return 'icons';
  
  return 'hero'; // default
}

function generateSrcset(role, baseName) {
  const spec = SPECS[role];
  return spec.widths.map(w => {
    const suffix = spec.widths.length > 1 ? `-${w}w` : '';
    return `/images/webp/${baseName}${suffix}.webp ${w}w`;
  }).join(', ');
}

async function processAll() {
  console.log('\n🔄 AI Image Optimization Pipeline\n');
  
  if (!existsSync(INPUT_DIR)) {
    console.log(`📁 Created input directory: ${INPUT_DIR}`);
    console.log('   Drop your AI-generated images there and run again.');
    return;
  }

  const files = readdirSync(INPUT_DIR)
    .filter(f => /\.(png|jpg|jpeg|webp|tiff|avif)$/i.test(f))
    .sort();

  if (files.length === 0) {
    console.log('📭 No images found in ai-input/');
    console.log('\n   Supported formats: PNG, JPG, WebP, TIFF, AVIF');
    console.log('   Naming convention: product-front.png, usage-1.jpg, og-image.png, etc.');
    return;
  }

  console.log(`📦 Found ${files.length} image(s) to process\n`);

  const manifest = {
    generated: new Date().toISOString(),
    images: {}
  };

  for (const file of files) {
    const inputPath = join(INPUT_DIR, file);
    const baseName = basename(file, extname(file));
    const role = detectRole(file);
    
    console.log(`Processing: ${file} → ${role}`);
    await optimizeImage(inputPath, role, baseName);
    
    // Add to manifest
    const spec = SPECS[role];
    manifest.images[baseName] = {
      role,
      srcset: generateSrcset(role, baseName),
      widths: spec.widths,
      aspect: spec.aspect,
      fallback: `/images/${baseName}.png`
    };
    console.log('');
  }

  // Write manifest for Astro integration
  writeFileSync(
    join(OUTPUT_DIR, 'image-manifest.json'),
    JSON.stringify(manifest, null, 2)
  );
  console.log('📋 Manifest written to public/images/image-manifest.json');

  // Generate Astro helper component
  const helperCode = `---
// Auto-generated image helper - DO NOT EDIT MANUALLY
// Run: node scripts/optimize-ai-images.mjs

import manifest from '../public/images/image-manifest.json' assert { type: 'json' };

export function getImage(name: string) {
  const img = manifest.images[name];
  if (!img) {
    console.warn(\`Image "\${name}" not found in manifest\`);
    return null;
  }
  return {
    src: img.fallback,
    srcset: img.srcset,
    widths: img.widths,
    aspectRatio: img.aspect,
    alt: name.replace(/[-_]/g, ' ')
  };
}

export function getHeroImage(name: string) {
  const img = getImage(name);
  if (!img) return null;
  return \`<picture>
  <source srcset="\${img.srcset}" type="image/webp">
  <img src="\${img.src}" alt="\${img.alt}" loading="eager" fetchpriority="high" decoding="async" />
</picture>\`;
}

export function getResponsiveImage(name: string, loading = 'lazy') {
  const img = getImage(name);
  if (!img) return null;
  return \`<picture>
  <source srcset="\${img.srcset}" type="image/webp">
  <img src="\${img.src}" alt="\${img.alt}" loading="\${loading}" decoding="async" />
</picture>\`;
}
`;
  
  writeFileSync(join(process.cwd(), 'src', 'lib', 'images.ts'), helperCode);
  console.log('🔧 Astro helper written to src/lib/images.ts\n');
  
  console.log('✅ Optimization complete!');
  console.log('\nNext steps:');
  console.log('  1. Import helpers: import { getHeroImage, getResponsiveImage } from "@/lib/images"');
  console.log('  2. Use in components: {getHeroImage("product-front")}');
  console.log('  3. Run build: npm run build');
}

processAll().catch(console.error);