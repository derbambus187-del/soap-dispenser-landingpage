# Professional Image Generation Toolkit

Complete toolkit for generating photorealistic 3-in-1 soap dispenser product images.

## 📁 Structure

```
├── blender/
│   └── dispenser_scene.py          # Blender Python script (Cycles, HDRI, PBR)
├── comfyui/
│   ├── workflow_sdxl_controlnet.json   # SDXL + Canny/Depth ControlNet
│   ├── workflow_flux_controlnet.json   # Flux + ControlNet
│   ├── workflow_config.json            # Prompt library for all angles
│   └── control_inputs/                 # Generated Canny/Depth maps
├── scripts/
│   ├── generate-pbr.mjs              # Advanced SVG PBR renderer (fallback)
│   ├── generate-controlnet-inputs.mjs # Procedural Canny/Depth from geometry
│   ├── optimize-ai-images.mjs         # AI image optimization pipeline
│   ├── ai-api-test.mjs               # Multi-provider API test script
│   └── filters.mjs                    # SVG filter definitions
├── ai-input/                          # Drop AI-generated images here
├── public/images/                     # Optimized output (WebP + PNG)
└── AI_PROMPT_LIBRARY.md              # Complete prompt reference
```

---

## 🎯 Quick Start

### Option 1: AI Generation (Recommended)
```bash
# 1. Set API keys
export OPENAI_API_KEY="sk-..."
export REPLICATE_API_KEY="r8_..."
export FAL_API_KEY="..."

# 2. Test all providers
node scripts/ai-api-test.mjs test

# 3. Or generate specific image
node scripts/ai-api-test.mjs generate openai hero_front
node scripts/ai-api-test.mjs generate replicate hero_side

# 4. Optimize & integrate
node scripts/optimize-ai-images.mjs
```

### Option 2: Blender (Full Control)
```bash
# 1. Open Blender 4.0+
# 2. File → New → Scripting
# 3. Paste contents of blender/dispenser_scene.py
# 4. Run Script (Alt+P)
# 5. In console: render_all_views(cams, out_dir)
# 6. Or press F12 for current camera
```

### Option 3: ComfyUI (Local SDXL/Flux)
```bash
# 1. Install ComfyUI + ComfyUI-Manager
# 2. Install models: SDXL Base, SDXL Refiner, Flux Dev/Schnell
# 3. Install ControlNets: Canny, Depth
# 4. Load workflow: comfyui/workflow_sdxl_controlnet.json
# 5. Generate control inputs: node scripts/generate-controlnet-inputs.mjs
# 6. Queue prompt
```

### Option 4: SVG PBR (Fallback - No GPU/API)
```bash
node scripts/generate-pbr.mjs
```

---

## 📸 Available Shots

| Shot | Description | Best For |
|------|-------------|----------|
| `hero_front` | Front 85mm macro, 3 chambers visible | Main product image |
| `hero_side` | Side 100mm, shows USB-C, bracket | Technical specs |
| `hero_angle` | 3/4 view 85mm, dimensional | Hero alternative |
| `hero_mounted` | On tile wall, 50mm | In-context usage |
| `hero_lifestyle` | Bathroom counter, 35mm shallow DOF | Marketing/hero |
| `hero_open` | Top-down refill view | How-it-works |
| `closeup_panel` | Macro control panel | Feature detail |
| `closeup_dispensing` | Action shot dispensing | Demo/video thumb |
| `og_social` | 1.91:1 for social meta | Open Graph |

---

## 🔧 Requirements

### Node.js Scripts
```bash
npm install sharp canvas node-fetch
```

### Blender
- Blender 4.0+
- Cycles GPU rendering (NVIDIA CUDA/OptiX)
- HDRI environment map (Poly Haven: `studio_soft.exr`)

### ComfyUI
- ComfyUI + ComfyUI-Manager
- Models: `sdxl_base_1.0.safetensors`, `sdxl_refiner_1.0.safetensors`, `flux1-dev.safetensors`
- ControlNets: `control_v11p_sd15_canny.safetensors`, `control_v11p_sd15_depth.safetensors`
- Flux ControlNets: `flux_canny.safetensors`, `flux_depth.safetensors`

### API Keys
- **OpenAI**: https://platform.openai.com/api-keys
- **Replicate**: https://replicate.com/account/api-tokens
- **Fal.ai**: https://fal.ai/dashboard/keys

---

## 📦 Integration with Landing Page

After generating images:

```bash
# 1. Drop selected images in ai-input/
# 2. Run optimization
node scripts/optimize-ai-images.mjs

# 3. Use in Astro components
---
import { getHeroImage, getResponsiveImage } from '@/lib/images';
---
{getHeroImage('product-front')}
{getResponsiveImage('usage-1')}
```

The optimizer creates:
- `public/images/image-manifest.json` - Metadata
- `src/lib/images.ts` - Astro helpers with `srcset`

---

## 🎨 Brand Visual Specs

**Colors:**
- Brand Teal: `#387763` (primary), `#4d967d` (light), `#2d5f4f` (dark)
- Accent Amber: `#f59e0b`
- Neutral Stone: `#fafaf9` (bg), `#1c1917` (dark)

**Materials:**
- Body: Matte white ABS, roughness 0.85, slight SSS
- Cap: Matte dark polycarbonate, roughness 0.9
- Accents: Brushed anodized aluminum, anisotropic 0.8
- IR Sensor: Chrome, roughness 0.02
- Chambers: Borosilicate glass 2mm, IOR 1.52
- Liquids: Soap `#4a9b7a`, Foam `#06b6d4`, Paste `#f59e0b`

**Chamber Fill Levels:**
- Soap: 78%
- Foam: 62%
- Paste: 82%

---

## 📝 Workflow Tips

### Consistent AI Generation
1. **Fix seed** for hero, vary only camera angle
2. **Use ControlNet** with SVG/Blender depth + canny
3. **Generate 8-16 variations** per angle, pick best 3
4. **Upscale** with Magnific.ai (2x) or Topaz Gigapixel (4x)
5. **Color grade** to match brand teal `#387763`

### Blender Render Settings
- Samples: 256 (final), 64 (preview)
- Denoising: OpenImageDenoise
- Filmic: Medium High Contrast
- Output: EXR 16-bit RGBA + Cryptomatte

### ComfyUI Settings
- SDXL: 30 steps, CFG 7, DPM++ 2M Karras
- Flux: 28 steps, Guidance 3.5, Euler Simple
- ControlNet: Canny 0.8, Depth 0.6 (end 0.8)

---

## 🚀 Next Steps

1. **Generate hero set** with preferred method
2. **Run optimizer** to create responsive WebP
3. **Update landing page** with new images
4. **Deploy** to Vercel/Cloudflare Pages

---

## 📞 Support

Check `AI_PROMPT_LIBRARY.md` for complete prompt reference and platform-specific modifiers.