#!/usr/bin/env node
// AI Image Generation API Test Script
// Supports: OpenAI DALL-E 3, Replicate (Flux, SDXL), Fal.ai, Together.ai
// Run: node scripts/ai-api-test.mjs

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import fetch from 'node-fetch';

const OUT_DIR = join(process.cwd(), 'ai-input');
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

// ============================================================
// PROMPT LIBRARY (from AI_PROMPT_LIBRARY.md)
// ============================================================
const PROMPTS = {
  hero_front: {
    prompt: `Professional product photography of 3-in-1 soap dispenser, front view, 85mm macro lens f/5.6, three visible chambers with liquid soap (pale green), foam (white), toothpaste (white), matte white plastic body, dark matte cap, IR sensor ring chrome, three LED indicators glowing green/cyan/amber, tactile mode button with "M", studio lighting: large softbox 45° key, white fill card, subtle rim, white seamless background, soft contact shadow, high key, commercial cosmetics photography, 8k resolution, sharp details, color accurate, sRGB`,
    negative: `blurry, out of focus, low resolution, pixelated, noise, grain, watermark, text, logo, branding, labels, stickers, distorted geometry, wrong proportions, extra chambers, missing chambers, wrong colors, oversaturated, undersaturated, color cast, cluttered background, busy environment, messy, dirty, fingers blocking product, cartoon, illustration, 3d render look, artificial, fake, plastic toy look, cheap, low quality, amateur photography, harsh shadows, blown highlights, chromatic aberration, vignetting`,
    aspect: "1024x1024", // DALL-E 3 square
    model: "dall-e-3"
  },
  hero_side: {
    prompt: `Professional product photography of 3-in-1 soap dispenser, side profile view, 100mm macro lens f/5.6, shows chamber depth and USB-C port, battery indicator LEDs, mounting bracket silhouette, matte white body, dark cap, studio lighting with edge highlight defining form, white seamless, soft shadow, commercial product photo`,
    negative: `blurry, out of focus, low resolution, pixelated, noise, grain, watermark, text, logo, branding, labels, stickers, distorted geometry, wrong proportions, extra chambers, missing chambers, wrong colors, oversaturated, undersaturated, color cast, cluttered background, busy environment, messy, dirty, fingers blocking product, cartoon, illustration, 3d render look, artificial, fake, plastic toy look, cheap, low quality, amateur photography, harsh shadows, blown highlights, chromatic aberration, vignetting`,
    aspect: "1024x1024",
    model: "dall-e-3"
  },
  hero_angle: {
    prompt: `Professional product photography of 3-in-1 soap dispenser, three-quarter view, 85mm f/4.5, shows depth and dimensionality, three chambers visible, IR sensor catchlight, LED glow, mode button highlight, studio lighting: key 45°/45°, fill opposite, rim from behind, clean white background, premium cosmetics advertising`,
    negative: `blurry, out of focus, low resolution, pixelated, noise, grain, watermark, text, logo, branding, labels, stickers, distorted geometry, wrong proportions, extra chambers, missing chambers, wrong colors, oversaturated, undersaturated, color cast, cluttered background, busy environment, messy, dirty, fingers blocking product, cartoon, illustration, 3d render look, artificial, fake, plastic toy look, cheap, low quality, amateur photography, harsh shadows, blown highlights, chromatic aberration, vignetting`,
    aspect: "1024x1024",
    model: "dall-e-3"
  },
  hero_mounted: {
    prompt: `3-in-1 soap dispenser mounted on white subway tile bathroom wall, 50mm f/8, shows 3M pads and screw mounting, level installation, three dispensing nozzles visible at bottom, subtle tile texture, natural window light from left, sheer curtain, morning 5500K, mirror reflection showing product, clean modern bathroom`,
    negative: `blurry, out of focus, low resolution, pixelated, noise, grain, watermark, text, logo, branding, labels, stickers, distorted geometry, wrong proportions, extra chambers, missing chambers, wrong colors, oversaturated, undersaturated, color cast, cluttered background, busy environment, messy, dirty, fingers blocking product, cartoon, illustration, 3d render look, artificial, fake, plastic toy look, cheap, low quality, amateur photography, harsh shadows, blown highlights, chromatic aberration, vignetting`,
    aspect: "1024x1024",
    model: "dall-e-3"
  },
  hero_lifestyle: {
    prompt: `Modern minimalist bathroom counter, 3-in-1 dispenser on marble vanity, 35mm f/2.8, shallow depth of field, product sharp background soft, toothbrush, razor, towel context, natural window light, warm bounce from beige tiles, cool mirror fill, authentic lifestyle, aspirational but real`,
    negative: `blurry, out of focus, low resolution, pixelated, noise, grain, watermark, text, logo, branding, labels, stickers, distorted geometry, wrong proportions, extra chambers, missing chambers, wrong colors, oversaturated, undersaturated, color cast, cluttered background, busy environment, messy, dirty, fingers blocking product, cartoon, illustration, 3d render look, artificial, fake, plastic toy look, cheap, low quality, amateur photography, harsh shadows, blown highlights, chromatic aberration, vignetting`,
    aspect: "1792x1024",
    model: "dall-e-3"
  },
  hero_open: {
    prompt: `3-in-1 soap dispenser cap open, top-down view showing three chamber openings, 100mm macro f/8, focus stacked, pouring liquid soap into first chamber, foam refill into second, toothpaste tube at third, dynamic pouring streams, droplets, realistic physics, studio lighting overhead, white background`,
    negative: `blurry, out of focus, low resolution, pixelated, noise, grain, watermark, text, logo, branding, labels, stickers, distorted geometry, wrong proportions, extra chambers, missing chambers, wrong colors, oversaturated, undersaturated, color cast, cluttered background, busy environment, messy, dirty, fingers blocking product, cartoon, illustration, 3d render look, artificial, fake, plastic toy look, cheap, low quality, amateur photography, harsh shadows, blown highlights, chromatic aberration, vignetting`,
    aspect: "1024x1024",
    model: "dall-e-3"
  },
  closeup_panel: {
    prompt: `Extreme closeup of dispenser control panel, 100mm macro f/8, three LED indicators (green/cyan/amber) with soft glow, tactile mode button with "M" legend, matte dark surface texture, finger pressing button, subtle indentation, depth of field`,
    negative: `blurry, out of focus, low resolution, pixelated, noise, grain, watermark, text, logo, branding, labels, stickers, distorted geometry, wrong proportions, extra chambers, missing chambers, wrong colors, oversaturated, undersaturated, color cast, cluttered background, busy environment, messy, dirty, fingers blocking product, cartoon, illustration, 3d render look, artificial, fake, plastic toy look, cheap, low quality, amateur photography, harsh shadows, blown highlights, chromatic aberration, vignetting`,
    aspect: "1024x1024",
    model: "dall-e-3"
  },
  closeup_dispensing: {
    prompt: `Macro shot of dispensing nozzles in action, 100mm macro f/11, three streams: liquid soap (amber droplet), foam (white puff), paste (white ribbon), high speed capture frozen moment, studio flash, black background, dramatic rim lighting, commercial slo-mo aesthetic`,
    negative: `blurry, out of focus, low resolution, pixelated, noise, grain, watermark, text, logo, branding, labels, stickers, distorted geometry, wrong proportions, extra chambers, missing chambers, wrong colors, oversaturated, undersaturated, color cast, cluttered background, busy environment, messy, dirty, fingers blocking product, cartoon, illustration, 3d render look, artificial, fake, plastic toy look, cheap, low quality, amateur photography, harsh shadows, blown highlights, chromatic aberration, vignetting`,
    aspect: "1792x1024",
    model: "dall-e-3"
  },
  og_social: {
    prompt: `3-in-1 soap dispenser hero shot for social media, 1200x630, centered composition with negative space left for text overlay, three chambers clearly visible, "3·1" badge prominent, studio lighting, clean white background fading to brand teal gradient, copy space, marketing ready, high contrast`,
    negative: `blurry, out of focus, low resolution, pixelated, noise, grain, watermark, text, logo, branding, labels, stickers, distorted geometry, wrong proportions, extra chambers, missing chambers, wrong colors, oversaturated, undersaturated, color cast, cluttered background, busy environment, messy, dirty, fingers blocking product, cartoon, illustration, 3d render look, artificial, fake, plastic toy look, cheap, low quality, amateur photography, harsh shadows, blown highlights, chromatic aberration, vignetting`,
    aspect: "1216x640",
    model: "dall-e-3"
  }
};

// Flux/SDXL prompts (same prompts, different aspect ratios for native models)
const FLUX_PROMPTS = {
  hero_front: { ...PROMPTS.hero_front, aspect: "1024x1280" },
  hero_side: { ...PROMPTS.hero_side, aspect: "1024x1280" },
  hero_angle: { ...PROMPTS.hero_angle, aspect: "1024x1280" },
  hero_mounted: { ...PROMPTS.hero_mounted, aspect: "1024x1280" },
  hero_lifestyle: { ...PROMPTS.hero_lifestyle, aspect: "1536x1024" },
  hero_open: { ...PROMPTS.hero_open, aspect: "1024x1024" },
  closeup_panel: { ...PROMPTS.closeup_panel, aspect: "1024x1024" },
  closeup_dispensing: { ...PROMPTS.closeup_dispensing, aspect: "1536x1024" },
  og_social: { ...PROMPTS.og_social, aspect: "1216x640" }
};

// ============================================================
// API CLIENTS
// ============================================================
class OpenAIClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.openai.com/v1';
  }

  async generateImage(prompt, options = {}) {
    const { model = 'dall-e-3', size = '1024x1024', quality = 'hd', n = 1 } = options;
    
    const response = await fetch(`${this.baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        prompt: prompt.prompt,
        negative_prompt: prompt.negative,
        size,
        quality,
        n,
        response_format: 'b64_json'
      })
    });
    
    if (!response.ok) {
      const err = await response.json();
      throw new Error(`OpenAI API error: ${err.error?.message || response.statusText}`);
    }
    
    const data = await response.json();
    return data.data.map((d, i) => ({
      base64: d.b64_json,
      revised_prompt: d.revised_prompt,
      index: i
    }));
  }
}

class ReplicateClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.replicate.com/v1';
  }

  async generateFlux(prompt, options = {}) {
    const { width = 1024, height = 1280, steps = 28, guidance = 3.5, seed } = options;
    
    const input = {
      prompt: prompt.prompt,
      negative_prompt: prompt.negative,
      width,
      height,
      num_inference_steps: steps,
      guidance_scale: guidance,
      seed: seed || Math.floor(Math.random() * 2147483647),
      output_format: 'webp',
      output_quality: 95
    };
    
    // Use Flux Schnell or Flux Dev
    const model = 'black-forest-labs/flux-schnell';
    
    const prediction = await this.createPrediction(model, input);
    return await this.waitForPrediction(prediction.id);
  }

  async generateSDXL(prompt, options = {}) {
    const { width = 1024, height = 1280, steps = 30, cfg = 7.0, seed, refine = 'expert_ensemble_refiner' } = options;
    
    const input = {
      prompt: prompt.prompt,
      negative_prompt: prompt.negative,
      width,
      height,
      num_inference_steps: steps,
      guidance_scale: cfg,
      seed: seed || Math.floor(Math.random() * 2147483647),
      refine,
      apply_watermark: false,
      output_format: 'webp',
      output_quality: 95
    };
    
    const model = 'stability-ai/sdxl';
    const prediction = await this.createPrediction(model, input);
    return await this.waitForPrediction(prediction.id);
  }

  async createPrediction(model, input) {
    const response = await fetch(`${this.baseUrl}/predictions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait'
      },
      body: JSON.stringify({
        version: await this.getModelVersion(model),
        input
      })
    });
    
    if (!response.ok) {
      const err = await response.json();
      throw new Error(`Replicate API error: ${err.detail || response.statusText}`);
    }
    
    return response.json();
  }

  async getModelVersion(model) {
    // Cache versions
    const versions = {
      'black-forest-labs/flux-schnell': 'latest',
      'stability-ai/sdxl': 'latest'
    };
    return versions[model] || 'latest';
  }

  async waitForPrediction(id) {
    while (true) {
      const response = await fetch(`${this.baseUrl}/predictions/${id}`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });
      const data = await response.json();
      
      if (data.status === 'succeeded') {
        return data.output;
      }
      if (data.status === 'failed') {
        throw new Error(`Prediction failed: ${data.error}`);
      }
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

class FalClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://fal.run';
  }

  async generateFlux(prompt, options = {}) {
    const { width = 1024, height = 1280, steps = 28, guidance = 3.5, seed } = options;
    
    const response = await fetch(`${this.baseUrl}/fal-ai/flux/dev`, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: prompt.prompt,
        negative_prompt: prompt.negative,
        image_size: { width, height },
        num_inference_steps: steps,
        guidance_scale: guidance,
        seed,
        enable_safety_checker: false,
        output_format: 'webp'
      })
    });
    
    if (!response.ok) {
      const err = await response.json();
      throw new Error(`Fal.ai API error: ${err.detail || response.statusText}`);
    }
    
    return response.json();
  }
}

// ============================================================
// UTILITIES
// ============================================================
async function saveBase64Image(base64, filename) {
  const buffer = Buffer.from(base64, 'base64');
  const filepath = join(OUT_DIR, filename);
  writeFileSync(filepath, buffer);
  return filepath;
}

async function saveUrlImage(url, filename) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download: ${response.statusText}`);
  const buffer = await response.arrayBuffer();
  const filepath = join(OUT_DIR, filename);
  writeFileSync(filepath, Buffer.from(buffer));
  return filepath;
}

function getTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

// ============================================================
// MAIN TEST RUNNER
// ============================================================
async function runTests() {
  console.log('\n🤖 AI Image Generation API Tests\n');
  console.log('=====================================\n');
  
  const results = {
    timestamp: new Date().toISOString(),
    tests: []
  };
  
  // Test OpenAI DALL-E 3
  if (process.env.OPENAI_API_KEY) {
    console.log('\n📡 Testing OpenAI DALL-E 3...');
    const openai = new OpenAIClient(process.env.OPENAI_API_KEY);
    
    for (const [name, prompt] of Object.entries(PROMPTS)) {
      if (name !== 'hero_lifestyle' && name !== 'closeup_dispensing' && name !== 'og_social') {
        try {
          console.log(`  Generating ${name}...`);
          const images = await openai.generateImage(prompt, {
            size: prompt.aspect,
            quality: 'hd',
            n: 1
          });
          
          for (const img of images) {
            const filename = `dalle3_${name}_${getTimestamp()}.webp`;
            await saveBase64Image(img.base64, filename);
            console.log(`    ✓ Saved: ${filename}`);
            results.tests.push({
              provider: 'openai',
              model: 'dall-e-3',
              prompt: name,
              file: filename,
              revised_prompt: img.revised_prompt
            });
          }
        } catch (err) {
          console.error(`    ✗ Failed: ${err.message}`);
          results.tests.push({
            provider: 'openai',
            model: 'dall-e-3',
            prompt: name,
            error: err.message
          });
        }
      }
    }
  } else {
    console.log('\n⚠️  OPENAI_API_KEY not set - skipping DALL-E 3 tests');
  }
  
  // Test Replicate (Flux + SDXL)
  if (process.env.REPLICATE_API_KEY) {
    console.log('\n📡 Testing Replicate (Flux + SDXL)...');
    const replicate = new ReplicateClient(process.env.REPLICATE_API_KEY);
    
    for (const [name, prompt] of Object.entries(FLUX_PROMPTS)) {
      if (name === 'hero_front' || name === 'hero_side') { // Limit for testing
        try {
          console.log(`  Generating ${name} with Flux...`);
          const output = await replicate.generateFlux(prompt, {
            width: parseInt(prompt.aspect.split('x')[0]),
            height: parseInt(prompt.aspect.split('x')[1]),
            steps: 28,
            guidance: 3.5
          });
          
          for (let i = 0; i < output.length; i++) {
            const filename = `flux_${name}_${getTimestamp()}_${i}.webp`;
            await saveUrlImage(output[i], filename);
            console.log(`    ✓ Saved: ${filename}`);
            results.tests.push({
              provider: 'replicate',
              model: 'flux-schnell',
              prompt: name,
              file: filename
            });
          }
        } catch (err) {
          console.error(`    ✗ Failed: ${err.message}`);
          results.tests.push({
            provider: 'replicate',
            model: 'flux-schnell',
            prompt: name,
            error: err.message
          });
        }
      }
    }
  } else {
    console.log('\n⚠️  REPLICATE_API_KEY not set - skipping Replicate tests');
  }
  
  // Test Fal.ai
  if (process.env.FAL_API_KEY) {
    console.log('\n📡 Testing Fal.ai (Flux)...');
    const fal = new FalClient(process.env.FAL_API_KEY);
    
    try {
      console.log('  Generating hero_front with Fal.ai Flux...');
      const output = await fal.generateFlux(FLUX_PROMPTS.hero_front, {
        width: 1024,
        height: 1280,
        steps: 28,
        guidance: 3.5
      });
      
      for (let i = 0; i < output.images.length; i++) {
        const filename = `fal_flux_hero_front_${getTimestamp()}_${i}.webp`;
        await saveUrlImage(output.images[i].url, filename);
        console.log(`    ✓ Saved: ${filename}`);
        results.tests.push({
          provider: 'fal.ai',
          model: 'flux-dev',
          prompt: 'hero_front',
          file: filename
        });
      }
    } catch (err) {
      console.error(`    ✗ Failed: ${err.message}`);
      results.tests.push({
        provider: 'fal.ai',
        model: 'flux-dev',
        prompt: 'hero_front',
        error: err.message
      });
    }
  } else {
    console.log('\n⚠️  FAL_API_KEY not set - skipping Fal.ai tests');
  }
  
  // Save results
  const resultsFile = join(OUT_DIR, `test-results-${getTimestamp()}.json`);
  writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`\n📋 Results saved to: ${resultsFile}`);
  
  // Summary
  const successful = results.tests.filter(t => !t.error).length;
  const failed = results.tests.filter(t => t.error).length;
  console.log(`\n✅ Completed: ${successful} successful, ${failed} failed`);
  console.log(`📁 Images saved to: ${OUT_DIR}/`);
  
  if (successful > 0) {
    console.log('\n🔄 Next step: Run optimization pipeline');
    console.log('   node scripts/optimize-ai-images.mjs');
  }
}

// ============================================================
// QUICK SINGLE GENERATION
// ============================================================
async function quickGenerate(provider, promptName) {
  const prompt = FLUX_PROMPTS[promptName] || PROMPTS[promptName];
  if (!prompt) {
    console.error(`Unknown prompt: ${promptName}`);
    return;
  }
  
  console.log(`\n🎨 Quick generate: ${promptName} via ${provider}\n`);
  
  try {
    let output;
    let filename;
    
    if (provider === 'openai' && process.env.OPENAI_API_KEY) {
      const client = new OpenAIClient(process.env.OPENAI_API_KEY);
      const images = await client.generateImage(prompt, { size: prompt.aspect, quality: 'hd' });
      output = images[0];
      filename = `quick_${provider}_${promptName}_${getTimestamp()}.webp`;
      await saveBase64Image(output.base64, filename);
    }
    else if (provider === 'replicate' && process.env.REPLICATE_API_KEY) {
      const client = new ReplicateClient(process.env.REPLICATE_API_KEY);
      output = await client.generateFlux(prompt);
      filename = `quick_${provider}_${promptName}_${getTimestamp()}.webp`;
      await saveUrlImage(output[0], filename);
    }
    else if (provider === 'fal' && process.env.FAL_API_KEY) {
      const client = new FalClient(process.env.FAL_API_KEY);
      output = await client.generateFlux(prompt);
      filename = `quick_${provider}_${promptName}_${getTimestamp()}.webp`;
      await saveUrlImage(output.images[0].url, filename);
    }
    else {
      console.error(`Provider ${provider} not configured or API key missing`);
      return;
    }
    
    console.log(`✅ Generated: ${filename}`);
    console.log(`📁 Saved to: ${OUT_DIR}/${filename}`);
    
  } catch (err) {
    console.error(`❌ Generation failed: ${err.message}`);
  }
}

// ============================================================
// CLI
// ============================================================
const args = process.argv.slice(2);
const command = args[0];

if (command === 'test') {
  runTests().catch(console.error);
} else if (command === 'generate' && args[1] && args[2]) {
  quickGenerate(args[1], args[2]).catch(console.error);
} else {
  console.log(`
AI Image Generation API Test Script
====================================

Usage:
  node scripts/ai-api-test.mjs test              # Run all configured API tests
  node scripts/ai-api-test.mjs generate <provider> <prompt>  # Quick single generation

Providers:
  openai    - DALL-E 3 (requires OPENAI_API_KEY)
  replicate - Flux/SDXL (requires REPLICATE_API_KEY)
  fal       - Flux Dev (requires FAL_API_KEY)

Prompts:
  hero_front, hero_side, hero_angle, hero_mounted, hero_lifestyle,
  hero_open, closeup_panel, closeup_dispensing, og_social

Environment Variables:
  OPENAI_API_KEY   - Get from https://platform.openai.com/api-keys
  REPLICATE_API_KEY - Get from https://replicate.com/account/api-tokens
  FAL_API_KEY       - Get from https://fal.ai/dashboard/keys

Example:
  OPENAI_API_KEY=sk-... node scripts/ai-api-test.mjs generate openai hero_front
  REPLICATE_API_KEY=r8_... node scripts/ai-api-test.mjs generate replicate hero_side
  `);
}