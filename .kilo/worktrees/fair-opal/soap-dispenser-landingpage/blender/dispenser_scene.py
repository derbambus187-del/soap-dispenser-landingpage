"""
Blender Starter Script: 3-in-1 Soap Dispenser Product Visualization
Run in Blender: File > New > Scripting > Paste & Run
Requires: Blender 4.0+, Cycles, Node Wrangler addon
"""

import bpy
import math
from mathutils import Vector, Euler

# ============================================================
# SCENE SETUP
# ============================================================
def setup_scene():
    # Clear existing
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    
    # Render settings
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'GPU'  # or 'CPU'
    scene.cycles.samples = 256
    scene.cycles.preview_samples = 64
    scene.cycles.use_denoising = True
    scene.cycles.denoiser = 'OPENIMAGEDENOISE'
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 1800
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.view_settings.view_transform = 'Filmic'
    scene.view_settings.look = 'Medium High Contrast'
    scene.view_settings.exposure = 0.0
    scene.view_settings.gamma = 1.0
    
    # Color management
    scene.sequencer_colorspace_settings.name = 'sRGB'
    
    return scene

# ============================================================
# GEOMETRY: 3-in-1 DISPENSER
# ============================================================
def create_dispenser():
    # Dimensions (cm)
    BODY_W, BODY_D, BODY_H = 7.6, 7.6, 22.0
    CAP_H = 3.0
    CHAMBER_H = 6.0
    CHAMBER_WALL = 0.2
    NOZZLE_H = 0.8
    
    # Collection
    coll = bpy.data.collections.new('Dispenser')
    bpy.context.scene.collection.children.link(coll)
    
    # ---- BODY ----
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, BODY_H/2 + CAP_H))
    body = bpy.context.active_object
    body.name = 'Body'
    body.scale = (BODY_W/2, BODY_D/2, BODY_H/2)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    
    # Round corners with bevel modifier
    bevel = body.modifiers.new('Bevel', 'BEVEL')
    bevel.width = 0.45
    bevel.segments = 8
    bevel.profile = 0.5
    bevel.limit_method = 'ANGLE'
    bevel.angle_limit = math.radians(60)
    
    # Subdivision for smooth curves
    subdiv = body.modifiers.new('Subdiv', 'SUBSURF')
    subdiv.levels = 2
    subdiv.render_levels = 3
    subdiv.subdivision_type = 'CATMULL_CLARK'
    
    coll.objects.link(body)
    bpy.context.scene.collection.objects.unlink(body)
    
    # ---- CAP ----
    bpy.ops.mesh.primitive_cylinder_add(
        radius=BODY_W/2, depth=CAP_H,
        location=(0, 0, BODY_H + CAP_H/2)
    )
    cap = bpy.context.active_object
    cap.name = 'Cap'
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    
    # Cap inner cavity
    bpy.ops.mesh.primitive_cylinder_add(
        radius=BODY_W/2 - 0.5, depth=CAP_H - 0.4,
        location=(0, 0, BODY_H + CAP_H/2)
    )
    cap_inner = bpy.context.active_object
    cap_inner.name = 'CapInner'
    
    # Boolean difference
    bool_mod = cap.modifiers.new('CapCut', 'BOOLEAN')
    bool_mod.operation = 'DIFFERENCE'
    bool_mod.object = cap_inner
    bool_mod.solver = 'EXACT'
    
    # IR Sensor window
    bpy.ops.mesh.primitive_cylinder_add(
        radius=1.0, depth=0.3,
        location=(0, 0, BODY_H + CAP_H - 0.15)
    )
    ir_window = bpy.context.active_object
    ir_window.name = 'IR_Window'
    
    coll.objects.link(cap)
    coll.objects.link(ir_window)
    bpy.context.scene.collection.objects.unlink(cap)
    bpy.context.scene.collection.objects.unlink(ir_window)
    bpy.data.objects.remove(cap_inner, do_unlink=True)
    
    # ---- THREE CHAMBERS (Glass) ----
    chamber_gap = 0.3
    chamber_total_h = CHAMBER_H * 3 + chamber_gap * 2
    start_y = CAP_H + (BODY_H - chamber_total_h) / 2
    
    liquids = [
        {'name': 'Soap', 'color': (0.30, 0.65, 0.45, 1.0), 'fill': 0.78, 'ior': 1.38},
        {'name': 'Foam', 'color': (0.04, 0.72, 0.83, 1.0), 'fill': 0.62, 'ior': 1.25},
        {'name': 'Paste', 'color': (0.96, 0.62, 0.07, 1.0), 'fill': 0.82, 'ior': 1.45},
    ]
    
    chambers = []
    for i, liq in enumerate(liquids):
        z = start_y + i * (CHAMBER_H + chamber_gap)
        
        # Outer glass wall
        bpy.ops.mesh.primitive_cylinder_add(
            radius=BODY_W/2 - 0.8, depth=CHAMBER_H,
            location=(0, 0, z + CHAMBER_H/2)
        )
        chamber_outer = bpy.context.active_object
        chamber_outer.name = f'Chamber_{liq["name"]}_Outer'
        
        # Inner cavity
        bpy.ops.mesh.primitive_cylinder_add(
            radius=BODY_W/2 - 1.0, depth=CHAMBER_H - 0.2,
            location=(0, 0, z + CHAMBER_H/2)
        )
        chamber_inner = bpy.context.active_object
        chamber_inner.name = f'Chamber_{liq["name"]}_Inner'
        
        # Glass wall via boolean
        bool_mod = chamber_outer.modifiers.new('GlassWall', 'BOOLEAN')
        bool_mod.operation = 'DIFFERENCE'
        bool_mod.object = chamber_inner
        bool_mod.solver = 'EXACT'
        
        # Liquid volume
        fill_h = CHAMBER_H * liq['fill']
        bpy.ops.mesh.primitive_cylinder_add(
            radius=BODY_W/2 - 1.05, depth=fill_h,
            location=(0, 0, z + fill_h/2)
        )
        liquid = bpy.context.active_object
        liquid.name = f'Liquid_{liq["name"]}'
        liquid.data.materials.append(create_liquid_material(liq))
        
        # Meniscus (surface curve)
        bpy.ops.mesh.primitive_circle_add(
            radius=BODY_W/2 - 1.05, location=(0, 0, z + fill_h)
        )
        meniscus = bpy.context.active_object
        meniscus.name = f'Meniscus_{liq["name"]}'
        bpy.ops.object.convert(target='MESH')
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.extrude_region_move(TRANSFORM_OT_translate={"value":(0, 0, 0.05)})
        bpy.ops.object.mode_set(mode='OBJECT')
        meniscus.data.materials.append(create_meniscus_material(liq))
        
        chambers.append({
            'outer': chamber_outer,
            'liquid': liquid,
            'meniscus': meniscus,
            'inner': chamber_inner
        })
        
        coll.objects.link(chamber_outer)
        coll.objects.link(liquid)
        coll.objects.link(meniscus)
        bpy.context.scene.collection.objects.unlink(chamber_outer)
        bpy.context.scene.collection.objects.unlink(liquid)
        bpy.context.scene.collection.objects.unlink(meniscus)
        bpy.data.objects.remove(chamber_inner, do_unlink=True)
    
    # ---- CONTROL PANEL ----
    panel_z = BODY_H + CAP_H - 3.5
    bpy.ops.mesh.primitive_cube_add(
        size=1, location=(0, BODY_D/2 - 0.1, panel_z)
    )
    panel = bpy.context.active_object
    panel.name = 'ControlPanel'
    panel.scale = (BODY_W * 0.7/2, 0.3, 1.8)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    
    # LED indicator holes
    for i in range(3):
        y_off = (i - 1) * 1.8
        bpy.ops.mesh.primitive_cylinder_add(
            radius=0.35, depth=0.6,
            location=(0, BODY_D/2 + 0.2, panel_z + 1.0 + y_off)
        )
        led_hole = bpy.context.active_object
        led_hole.name = f'LED_Hole_{i}'
        bool_mod = panel.modifiers.new(f'LED_Hole_{i}', 'BOOLEAN')
        bool_mod.operation = 'DIFFERENCE'
        bool_mod.object = led_hole
        bool_mod.solver = 'EXACT'
        bpy.context.scene.collection.objects.unlink(led_hole)
    
    # Mode button
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.6, depth=0.5,
        location=(0, BODY_D/2 + 0.2, panel_z - 1.2)
    )
    mode_btn = bpy.context.active_object
    mode_btn.name = 'ModeButton'
    
    coll.objects.link(panel)
    coll.objects.link(mode_btn)
    bpy.context.scene.collection.objects.unlink(panel)
    bpy.context.scene.collection.objects.unlink(mode_btn)
    
    # ---- DISPENSING NOZZLES ----
    nozzle_z = BODY_H + CAP_H + 0.3
    for i in range(3):
        x_off = (i - 1) * 2.2
        bpy.ops.mesh.primitive_cone_add(
            radius1=0.45, radius2=0.15, depth=NOZZLE_H,
            location=(x_off, BODY_D/2 + 0.1, nozzle_z + NOZZLE_H/2)
        )
        nozzle = bpy.context.active_object
        nozzle.name = f'Nozzle_{i}'
        coll.objects.link(nozzle)
        bpy.context.scene.collection.objects.unlink(nozzle)
    
    # ---- USB-C PORT ----
    bpy.ops.mesh.primitive_cube_add(
        size=1, location=(BODY_W/2 + 0.3, 0, BODY_H/2 + 2.0)
    )
    usb = bpy.context.active_object
    usb.name = 'USB_Port'
    usb.scale = (0.5, 0.7, 0.3)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    
    # USB inner
    bpy.ops.mesh.primitive_cube_add(
        size=1, location=(BODY_W/2 + 0.55, 0, BODY_H/2 + 2.0)
    )
    usb_inner = bpy.context.active_object
    usb_inner.name = 'USB_Inner'
    usb_inner.scale = (0.3, 0.5, 0.2)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    
    bool_mod = usb.modifiers.new('USB_Cut', 'BOOLEAN')
    bool_mod.operation = 'DIFFERENCE'
    bool_mod.object = usb_inner
    bool_mod.solver = 'EXACT'
    
    coll.objects.link(usb)
    bpy.context.scene.collection.objects.unlink(usb)
    bpy.data.objects.remove(usb_inner, do_unlink=True)
    
    # ---- MOUNTING BRACKET ----
    bracket_z = BODY_H/2 + CAP_H
    bpy.ops.mesh.primitive_cube_add(
        size=1, location=(-BODY_W/2 - 1.0, 0, bracket_z)
    )
    bracket = bpy.context.active_object
    bracket.name = 'MountingBracket'
    bracket.scale = (0.4, BODY_D * 0.6/2, 8.0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    
    # Screw holes
    for z_off in [-3.5, 0, 3.5]:
        bpy.ops.mesh.primitive_cylinder_add(
            radius=0.25, depth=1.0,
            location=(-BODY_W/2 - 1.4, 0, bracket_z + z_off)
        )
        screw = bpy.context.active_object
        screw.name = f'ScrewHole_{z_off}'
        bool_mod = bracket.modifiers.new(f'Screw_{z_off}', 'BOOLEAN')
        bool_mod.operation = 'DIFFERENCE'
        bool_mod.object = screw
        bool_mod.solver = 'EXACT'
        bpy.context.scene.collection.objects.unlink(screw)
    
    # 3M pad recesses
    for z_off in [-3.8, 3.8]:
        bpy.ops.mesh.primitive_cylinder_add(
            radius=0.7, depth=0.3,
            location=(-BODY_W/2 - 1.3, 0, bracket_z + z_off)
        )
        pad = bpy.context.active_object
        pad.name = f'PadReccess_{z_off}'
        bool_mod = bracket.modifiers.new(f'Pad_{z_off}', 'BOOLEAN')
        bool_mod.operation = 'DIFFERENCE'
        bool_mod.object = pad
        bool_mod.solver = 'EXACT'
        bpy.context.scene.collection.objects.unlink(pad)
    
    coll.objects.link(bracket)
    bpy.context.scene.collection.objects.unlink(bracket)
    
    # ---- 3-in-1 BADGE ----
    bpy.ops.mesh.primitive_cylinder_add(
        radius=1.0, depth=0.4,
        location=(BODY_W/2 + 1.5, 0, BODY_H/2 + 3.0)
    )
    badge = bpy.context.active_object
    badge.name = 'Badge_3in1'
    coll.objects.link(badge)
    bpy.context.scene.collection.objects.unlink(badge)
    
    return body, cap, ir_window, chambers, panel, mode_btn, nozzles, usb, bracket, badge

# ============================================================
# MATERIALS
# ============================================================
def create_matte_white_plastic():
    mat = bpy.data.materials.new('MatteWhitePlastic')
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    
    # Principled BSDF
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.location = (0, 0)
    bsdf.inputs['Base Color'].default_value = (0.98, 0.98, 0.97, 1.0)
    bsdf.inputs['Roughness'].default_value = 0.85
    bsdf.inputs['Specular'].default_value = 0.3
    bsdf.inputs['Clearcoat'].default_value = 0.05
    bsdf.inputs['Clearcoat Roughness'].default_value = 0.3
    
    # Subsurface scattering
    bsdf.inputs['Subsurface'].default_value = 0.15
    bsdf.inputs['Subsurface Radius'].default_value = (1.2, 1.0, 0.8)
    bsdf.inputs['Subsurface Color'].default_value = (1.0, 0.98, 0.94, 1.0)
    
    # Noise texture for micro-variation
    noise = nodes.new('ShaderNodeTexNoise')
    noise.location = (-400, 0)
    noise.inputs['Scale'].default_value = 200.0
    noise.inputs['Detail'].default_value = 8.0
    noise.inputs['Roughness'].default_value = 0.6
    
    color_ramp = nodes.new('ShaderNodeValToRGB')
    color_ramp.location = (-200, 0)
    color_ramp.color_ramp.elements[0].color = (0.96, 0.96, 0.95, 1.0)
    color_ramp.color_ramp.elements[1].color = (1.0, 1.0, 0.99, 1.0)
    
    links.new(noise.outputs['Fac'], color_ramp.inputs['Fac'])
    links.new(color_ramp.outputs['Color'], bsdf.inputs['Base Color'])
    
    # Output
    output = nodes.new('ShaderNodeOutputMaterial')
    output.location = (300, 0)
    links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    
    return mat

def create_matte_dark_plastic():
    mat = bpy.data.materials.new('MatteDarkPlastic')
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.location = (0, 0)
    bsdf.inputs['Base Color'].default_value = (0.08, 0.07, 0.06, 1.0)
    bsdf.inputs['Roughness'].default_value = 0.9
    bsdf.inputs['Specular'].default_value = 0.2
    
    output = nodes.new('ShaderNodeOutputMaterial')
    output.location = (300, 0)
    links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    
    return mat

def create_brushed_aluminum():
    mat = bpy.data.materials.new('BrushedAluminum')
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.location = (0, 0)
    bsdf.inputs['Base Color'].default_value = (0.78, 0.78, 0.78, 1.0)
    bsdf.inputs['Metallic'].default_value = 0.95
    bsdf.inputs['Roughness'].default_value = 0.35
    bsdf.inputs['Anisotropic'].default_value = 0.8
    bsdf.inputs['Anisotropic Rotation'].default_value = 0.0
    
    # Brushed texture
    noise = nodes.new('ShaderNodeTexNoise')
    noise.location = (-400, 200)
    noise.inputs['Scale'].default_value = 500.0
    noise.inputs['Detail'].default_value = 16.0
    
    color_ramp = nodes.new('ShaderNodeValToRGB')
    color_ramp.location = (-200, 200)
    color_ramp.color_ramp.elements[0].color = (0.70, 0.70, 0.70, 1.0)
    color_ramp.color_ramp.elements[1].color = (0.85, 0.85, 0.85, 1.0)
    
    links.new(noise.outputs['Fac'], color_ramp.inputs['Fac'])
    links.new(color_ramp.outputs['Color'], bsdf.inputs['Base Color'])
    
    output = nodes.new('ShaderNodeOutputMaterial')
    output.location = (300, 0)
    links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    
    return mat

def create_chrome():
    mat = bpy.data.materials.new('Chrome')
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.location = (0, 0)
    bsdf.inputs['Base Color'].default_value = (1.0, 1.0, 1.0, 1.0)
    bsdf.inputs['Metallic'].default_value = 1.0
    bsdf.inputs['Roughness'].default_value = 0.02
    bsdf.inputs['Specular'].default_value = 1.0
    
    output = nodes.new('ShaderNodeOutputMaterial')
    output.location = (300, 0)
    links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    
    return mat

def create_glass():
    mat = bpy.data.materials.new('Glass')
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    
    # Glass BSDF
    glass = nodes.new('ShaderNodeBsdfGlass')
    glass.location = (0, 0)
    glass.inputs['Color'].default_value = (1.0, 1.0, 1.0, 1.0)
    glass.inputs['Roughness'].default_value = 0.03
    glass.inputs['IOR'].default_value = 1.52
    
    # Fresnel mix for thin walls
    fresnel = nodes.new('ShaderNodeFresnel')
    fresnel.location = (-200, 0)
    fresnel.inputs['IOR'].default_value = 1.52
    
    mix = nodes.new('ShaderNodeMixShader')
    mix.location = (200, 0)
    
    transparent = nodes.new('ShaderNodeBsdfTransparent')
    transparent.location = (0, -200)
    
    links.new(fresnel.outputs['Fac'], mix.inputs['Fac'])
    links.new(transparent.outputs['BSDF'], mix.inputs[1])
    links.new(glass.outputs['BSDF'], mix.inputs[2])
    
    output = nodes.new('ShaderNodeOutputMaterial')
    output.location = (400, 0)
    links.new(mix.outputs['Shader'], output.inputs['Surface'])
    
    # Shadow caustics
    mat.shadow_method = 'HASHED'
    mat.blend_method = 'HASHED'
    
    return mat

def create_liquid_material(liq):
    name = f'Liquid_{liq["name"]}'
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    
    # Principled with transmission
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.location = (0, 0)
    bsdf.inputs['Base Color'].default_value = liq['color']
    bsdf.inputs['Roughness'].default_value = 0.25
    bsdf.inputs['Specular'].default_value = 0.5
    bsdf.inputs['Transmission'].default_value = 0.7
    bsdf.inputs['IOR'].default_value = liq['ior']
    
    # Volume absorption
    volume = nodes.new('ShaderNodeVolumeAbsorption')
    volume.location = (0, -200)
    volume.inputs['Color'].default_value = liq['color']
    volume.inputs['Density'].default_value = 0.8
    
    output = nodes.new('ShaderNodeOutputMaterial')
    output.location = (300, 0)
    links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    links.new(volume.outputs['Volume'], output.inputs['Volume'])
    
    mat.shadow_method = 'HASHED'
    mat.blend_method = 'HASHED'
    
    return mat

def create_meniscus_material(liq):
    name = f'Meniscus_{liq["name"]}'
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.location = (0, 0)
    bsdf.inputs['Base Color'].default_value = liq['color']
    bsdf.inputs['Roughness'].default_value = 0.05
    bsdf.inputs['Transmission'].default_value = 0.9
    bsdf.inputs['IOR'].default_value = liq['ior']
    bsdf.inputs['Emission'].default_value = (*liq['color'][:3], 1.0)
    bsdf.inputs['Emission Strength'].default_value = 0.5
    
    output = nodes.new('ShaderNodeOutputMaterial')
    output.location = (300, 0)
    links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    
    mat.shadow_method = 'HASHED'
    mat.blend_method = 'HASHED'
    
    return mat

def create_emissive_led(color, strength=3.0):
    mat = bpy.data.materials.new(f'LED_{color[0]}_{color[1]}_{color[2]}')
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    
    emission = nodes.new('ShaderNodeEmission')
    emission.location = (0, 0)
    emission.inputs['Color'].default_value = (*color, 1.0)
    emission.inputs['Strength'].default_value = strength
    
    output = nodes.new('ShaderNodeOutputMaterial')
    output.location = (300, 0)
    links.new(emission.outputs['Emission'], output.inputs['Surface'])
    
    return mat

def assign_materials(body, cap, ir_window, chambers, panel, mode_btn, nozzles, usb, bracket, badge):
    mats = {
        'matte_white': create_matte_white_plastic(),
        'matte_dark': create_matte_dark_plastic(),
        'brushed_alu': create_brushed_aluminum(),
        'chrome': create_chrome(),
        'glass': create_glass(),
    }
    
    # Body
    body.data.materials.append(mats['matte_white'])
    
    # Cap
    cap.data.materials.append(mats['matte_dark'])
    
    # IR Window
    ir_window.data.materials.append(mats['chrome'])
    
    # Chambers - glass walls
    for ch in chambers:
        ch['outer'].data.materials.append(mats['glass'])
    
    # Control panel
    panel.data.materials.append(mats['matte_dark'])
    
    # Mode button
    mode_btn.data.materials.append(create_emissive_led((0.22, 0.47, 0.39), 2.0))
    
    # Nozzles
    for i, nozzle in enumerate(nozzles):
        if i == 0:  # Soap
            nozzle.data.materials.append(create_emissive_led((0.30, 0.65, 0.45), 1.0))
        elif i == 1:  # Foam
            nozzle.data.materials.append(create_emissive_led((0.04, 0.72, 0.83), 1.0))
        else:  # Paste
            nozzle.data.materials.append(create_emissive_led((0.96, 0.62, 0.07), 1.0))
    
    # USB port
    usb.data.materials.append(mats['matte_dark'])
    
    # Bracket
    bracket.data.materials.append(mats['brushed_alu'])
    
    # Badge
    badge.data.materials.append(create_emissive_led((0.22, 0.47, 0.39), 2.0))

# ============================================================
# LIGHTING: HDRI STUDIO SETUP
# ============================================================
def setup_lighting():
    # World HDRI
    world = bpy.context.scene.world
    if not world:
        world = bpy.data.worlds.new('World')
        bpy.context.scene.world = world
    world.use_nodes = True
    nodes = world.node_tree.nodes
    links = world.node_tree.links
    nodes.clear()
    
    # Background with HDRI
    bg = nodes.new('ShaderNodeBackground')
    bg.location = (0, 0)
    bg.inputs['Strength'].default_value = 1.0
    
    env_tex = nodes.new('ShaderNodeTexEnvironment')
    env_tex.location = (-400, 0)
    # Load HDRI - replace with your path
    # env_tex.image = bpy.data.images.load('//hdri/studio_soft.exr')
    
    # Procedural studio lighting as fallback
    sky = nodes.new('ShaderNodeTexSky')
    sky.location = (-400, -200)
    sky.sun_direction = (0.5, 0.3, 1.0)
    sky.turbidity = 2.0
    sky.ground_albedo = 0.4
    
    mix = nodes.new('ShaderNodeMixShader')
    mix.location = (-200, 0)
    mix.inputs['Fac'].default_value = 0.0  # Use sky for now
    
    output = nodes.new('ShaderNodeOutputWorld')
    output.location = (200, 0)
    
    links.new(sky.outputs['Color'], bg.inputs['Color'])
    links.new(bg.outputs['Background'], output.inputs['Surface'])
    
    # ---- KEY LIGHT (Large Softbox) ----
    bpy.ops.object.light_add(type='AREA', location=(3, -3, 5))
    key = bpy.context.active_object
    key.name = 'Key_Light'
    key.data.energy = 800
    key.data.size = 2.5
    key.data.size_y = 2.0
    key.data.shape = 'RECTANGLE'
    key.data.color = (1.0, 0.99, 0.95)
    key.data.cycles.cast_shadow = True
    key.rotation_euler = Euler((math.radians(-60), 0, math.radians(45)))
    
    # ---- FILL LIGHT ----
    bpy.ops.object.light_add(type='AREA', location=(-2.5, 3, 3))
    fill = bpy.context.active_object
    fill.name = 'Fill_Light'
    fill.data.energy = 300
    fill.data.size = 3.0
    fill.data.size_y = 2.5
    fill.data.shape = 'RECTANGLE'
    fill.data.color = (0.98, 0.97, 0.95)
    fill.rotation_euler = Euler((math.radians(-30), 0, math.radians(-120)))
    
    # ---- RIM/BACK LIGHT ----
    bpy.ops.object.light_add(type='AREA', location=(0, -4, 4))
    rim = bpy.context.active_object
    rim.name = 'Rim_Light'
    rim.data.energy = 500
    rim.data.size = 1.5
    rim.data.size_y = 4.0
    rim.data.shape = 'RECTANGLE'
    rim.data.color = (1.0, 0.99, 0.97)
    rim.rotation_euler = Euler((math.radians(-45), 0, math.radians(180)))
    
    # ---- TOP LIGHT (Subtle) ----
    bpy.ops.object.light_add(type='AREA', location=(0, 0, 6))
    top = bpy.context.active_object
    top.name = 'Top_Light'
    top.data.energy = 200
    top.data.size = 4.0
    top.data.size_y = 4.0
    top.data.shape = 'RECTANGLE'
    top.data.color = (1.0, 1.0, 0.98)
    top.rotation_euler = Euler((math.radians(-90), 0, 0))
    
    # Ground plane for shadows
    bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 0, -0.01))
    ground = bpy.context.active_object
    ground.name = 'Ground_Plane'
    ground.data.materials.append(create_ground_material())
    ground.cycles.is_shadow_catcher = True
    
    return key, fill, rim, top

def create_ground_material():
    mat = bpy.data.materials.new('Ground')
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.location = (0, 0)
    bsdf.inputs['Base Color'].default_value = (0.96, 0.96, 0.95, 1.0)
    bsdf.inputs['Roughness'].default_value = 0.8
    bsdf.inputs['Specular'].default_value = 0.1
    
    output = nodes.new('ShaderNodeOutputMaterial')
    output.location = (300, 0)
    links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    
    return mat

# ============================================================
# CAMERAS
# ============================================================
def setup_cameras():
    cams = {}
    
    # Hero Front
    bpy.ops.object.camera_add(location=(0, -8.5, 2.5))
    cam_front = bpy.context.active_object
    cam_front.name = 'Cam_Hero_Front'
    cam_front.data.lens = 85
    cam_front.data.sensor_width = 36
    cam_front.data.dof.use_dof = True
    cam_front.data.dof.aperture_fstop = 5.6
    cam_front.data.dof.focus_distance = 8.5
    cam_front.rotation_euler = Euler((math.radians(90), 0, math.radians(-3)))
    cams['front'] = cam_front
    
    # Hero Side
    bpy.ops.object.camera_add(location=(8.5, 0, 2.5))
    cam_side = bpy.context.active_object
    cam_side.name = 'Cam_Hero_Side'
    cam_side.data.lens = 100
    cam_side.data.sensor_width = 36
    cam_side.data.dof.use_dof = True
    cam_side.data.dof.aperture_fstop = 5.6
    cam_side.data.dof.focus_distance = 8.5
    cam_side.rotation_euler = Euler((math.radians(90), 0, math.radians(93)))
    cams['side'] = cam_side
    
    # 3/4 Angle
    bpy.ops.object.camera_add(location=(6, -6, 3))
    cam_angle = bpy.context.active_object
    cam_angle.name = 'Cam_34_Angle'
    cam_angle.data.lens = 85
    cam_angle.data.sensor_width = 36
    cam_angle.data.dof.use_dof = True
    cam_angle.data.dof.aperture_fstop = 4.5
    cam_angle.data.dof.focus_distance = 8.5
    cam_angle.rotation_euler = Euler((math.radians(85), 0, math.radians(135)))
    cams['angle'] = cam_angle
    
    # Mounted
    bpy.ops.object.camera_add(location=(1.5, -7, 1))
    cam_mounted = bpy.context.active_object
    cam_mounted.name = 'Cam_Mounted'
    cam_mounted.data.lens = 50
    cam_mounted.data.sensor_width = 36
    cam_mounted.data.dof.use_dof = True
    cam_mounted.data.dof.aperture_fstop = 8.0
    cam_mounted.data.dof.focus_distance = 7.0
    cam_mounted.rotation_euler = Euler((math.radians(92), 0, math.radians(5)))
    cams['mounted'] = cam_mounted
    
    # Lifestyle
    bpy.ops.object.camera_add(location=(5, -6, 2))
    cam_life = bpy.context.active_object
    cam_life.name = 'Cam_Lifestyle'
    cam_life.data.lens = 35
    cam_life.data.sensor_width = 36
    cam_life.data.dof.use_dof = True
    cam_life.data.dof.aperture_fstop = 2.8
    cam_life.data.dof.focus_distance = 7.5
    cam_life.rotation_euler = Euler((math.radians(88), 0, math.radians(115)))
    cams['lifestyle'] = cam_life
    
    # Closeup Panel
    bpy.ops.object.camera_add(location=(0, -1.2, 1.5))
    cam_panel = bpy.context.active_object
    cam_panel.name = 'Cam_Closeup_Panel'
    cam_panel.data.lens = 100
    cam_panel.data.sensor_width = 36
    cam_panel.data.dof.use_dof = True
    cam_panel.data.dof.aperture_fstop = 8.0
    cam_panel.data.dof.focus_distance = 1.2
    cam_panel.rotation_euler = Euler((math.radians(90), 0, 0))
    cams['closeup_panel'] = cam_panel
    
    # Dispensing Action
    bpy.ops.object.camera_add(location=(0.5, -1.5, 1.2))
    cam_dispense = bpy.context.active_object
    cam_dispense.name = 'Cam_Dispensing'
    cam_dispense.data.lens = 100
    cam_dispense.data.sensor_width = 36
    cam_dispense.data.dof.use_dof = True
    cam_dispense.data.dof.aperture_fstop = 11.0
    cam_dispense.data.dof.focus_distance = 1.5
    cam_dispense.rotation_euler = Euler((math.radians(85), 0, math.radians(10)))
    cams['dispensing'] = cam_dispense
    
    # OG/Social
    bpy.ops.object.camera_add(location=(0, -7, 2))
    cam_og = bpy.context.active_object
    cam_og.name = 'Cam_OG'
    cam_og.data.lens = 50
    cam_og.data.sensor_width = 36
    cam_og.data.dof.use_dof = True
    cam_og.data.dof.aperture_fstop = 5.6
    cam_og.data.dof.focus_distance = 7.0
    cam_og.rotation_euler = Euler((math.radians(90), 0, 0))
    cams['og'] = cam_og
    
    return cams

# ============================================================
# RENDER OUTPUT SETUP
# ============================================================
def setup_render_output(cams):
    scene = bpy.context.scene
    
    # Output settings
    scene.render.image_settings.file_format = 'OPEN_EXR'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.color_depth = '16'
    scene.render.image_settings.exr_codec = 'DWAA'
    scene.render.film_transparent = True
    
    # View layer for compositing
    scene.view_layers['ViewLayer'].use_pass_combined = True
    scene.view_layers['ViewLayer'].use_pass_z = True
    scene.view_layers['ViewLayer'].use_pass_normal = True
    scene.view_layers['ViewLayer'].use_pass_mist = True
    scene.view_layers['ViewLayer'].use_pass_object_index = True
    scene.view_layers['ViewLayer'].use_pass_material_index = True
    scene.view_layers['ViewLayer'].use_pass_cryptomatte_object = True
    scene.view_layers['ViewLayer'].use_pass_cryptomatte_material = True
    
    # Create output directory
    import os
    out_dir = '//renders/'
    os.makedirs(bpy.path.abspath(out_dir), exist_ok=True)
    
    return out_dir

def render_all_views(cams, out_dir):
    scene = bpy.context.scene
    
    for name, cam in cams.items():
        scene.camera = cam
        scene.render.filepath = f'{out_dir}{name}_'
        print(f'Rendering {name}...')
        bpy.ops.render.render(write_still=True)

# ============================================================
# COMPOSITING NODES (Post-processing)
# ============================================================
def setup_compositing():
    scene = bpy.context.scene
    scene.use_nodes = True
    tree = scene.node_tree
    nodes = tree.nodes
    links = tree.links
    nodes.clear()
    
    # Render Layers
    rl = nodes.new('CompositorNodeRLayers')
    rl.location = (-600, 0)
    
    # Glare (Bloom)
    glare = nodes.new('CompositorNodeGlare')
    glare.location = (-200, 200)
    glare.glare_type = 'FOG_GLOW'
    glare.quality = 'HIGH'
    glare.size = 7
        # Inputs[0] is image, Inputs[1] is threshold
    glare.inputs['Mix'].default_value = 0.15
    glare.inputs['Threshold'].default_value = 1.2
    
    # Color Balance (Film look)
    colorbal = nodes.new('CompositorNodeColorBalance')
    colorbal.location = (0, 0)
    colorbal.correction_method = 'LIFT_GAMMA_GAIN'
    # Lift (shadows) - slight teal
    colorbal.lift = [1.0, 1.0, 1.0]
    colorbal.gain = [1.0, 1.0, 1.0]
    colorbal.gamma = [1.0, 1.0, 1.0]
    
    # Hue Saturation
    hue_sat = nodes.new('CompositorNodeHueSat')
    hue_sat.location = (200, 0)
    hue_sat.color_saturation = 1.02
    hue_sat.color_value = 1.0
    
    # Vignette
    vignette = nodes.new('CompositorNodeVignette')
    vignette.location = (400, 0)
    vignette.intensity = 0.15
    vignette.size = 0.6
    
    # Lens Distortion (Chromatic Aberration)
    lens_dist = nodes.new('CompositorNodeLensdist')
    lens_dist.location = (600, 0)
    lens_dist.distort = 0.01
    lens_dist.dispersion = 0.005
    
    # Film Grain
    grain = nodes.new('CompositorNodeNoise')
    grain.location = (600, -200)
    grain.noise_type = 'WHITE'
    grain.size = 0.5
    
    mix_grain = nodes.new('CompositorNodeMixRGB')
    mix_grain.location = (800, 0)
    mix_grain.blend_type = 'OVERLAY'
    mix_grain.inputs['Fac'].default_value = 0.008
    
    # Output
    composite = nodes.new('CompositorNodeComposite')
    composite.location = (1000, 0)
    
    viewer = nodes.new('CompositorNodeViewer')
    viewer.location = (1000, -200)
    
    # Links
    links.new(rl.outputs['Image'], glare.inputs['Image'])
    links.new(glare.outputs['Image'], colorbal.inputs['Image'])
    links.new(colorbal.outputs['Image'], hue_sat.inputs['Image'])
    links.new(hue_sat.outputs['Image'], vignette.inputs['Image'])
    links.new(vignette.outputs['Image'], lens_dist.inputs['Image'])
    links.new(lens_dist.outputs['Image'], mix_grain.inputs[1])
    links.new(grain.outputs['Color'], mix_grain.inputs[2])
    links.new(mix_grain.outputs['Image'], composite.inputs['Image'])
    links.new(mix_grain.outputs['Image'], viewer.inputs['Image'])
    
    # Alpha over for transparent background
    alpha_over = nodes.new('CompositorNodeAlphaOver')
    alpha_over.location = (1200, 0)
    links.new(mix_grain.outputs['Image'], alpha_over.inputs[2])
    links.new(rl.outputs['Alpha'], alpha_over.inputs['Fac'])
    links.new(alpha_over.outputs['Image'], composite.inputs['Image'])

# ============================================================
# MAIN EXECUTION
# ============================================================
def main():
    print("Setting up 3-in-1 Soap Dispenser scene...")
    
    setup_scene()
    
    body, cap, ir_window, chambers, panel, mode_btn, nozzles, usb, bracket, badge = create_dispenser()
    
    assign_materials(body, cap, ir_window, chambers, panel, mode_btn, nozzles, usb, bracket, badge)
    
    setup_lighting()
    
    cams = setup_cameras()
    
    setup_compositing()
    
    out_dir = setup_render_output(cams)
    
    # Set active camera for final render
    bpy.context.scene.camera = cams['front']
    
    print(f"\nScene ready! Output directory: {out_dir}")
    print("\nCameras available:")
    for name, cam in cams.items():
        print(f"  {name}: {cam.data.lens}mm f/{cam.data.dof.aperture_fstop}")
    
    print("\nTo render all views, run:")
    print("  render_all_views(cams, out_dir)")
    
    print("\nTo render current view: F12")
    print("To render animation: Ctrl+F12")

if __name__ == '__main__':
    main()