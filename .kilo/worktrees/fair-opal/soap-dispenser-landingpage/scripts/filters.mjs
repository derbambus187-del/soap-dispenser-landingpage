const FILTERS = `<defs>
  <filter id="ggxSpecular" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="1.5" result="rough"/>
    <feSpecularLighting surfaceScale="8" specularConstant="1.2" specularExponent="64" lighting-color="white" result="spec">
      <feDistantLight azimuth="45" elevation="60"/>
      <fePointLight x="400" y="-200" z="400"/>
    </feSpecularLighting>
    <feComposite in="spec" in2="SourceAlpha" operator="in"/>
    <feComponentTransfer><feFuncA type="linear" slope="0.8"/></feComponentTransfer>
  </filter>
  <filter id="subsurface" x="-40%" y="-40%" width="180%" height="180%">
    <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur1"/>
    <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur2"/>
    <feGaussianBlur in="SourceGraphic" stdDeviation="20" result="blur3"/>
    <feComposite in="blur1" in2="SourceGraphic" operator="over" result="ss1"/>
    <feComposite in="blur2" in2="ss1" operator="over" result="ss2"/>
    <feComposite in="blur3" in2="ss2" operator="over"/>
  </filter>
  <filter id="innerShadow" x="-20%" y="-20%" width="140%" height="140%">
    <feOffset dx="0" dy="2"/><feGaussianBlur stdDeviation="3" result="blur"/>
    <feComposite operator="out" in="SourceGraphic" in2="blur" result="cutout"/>
    <feComponentTransfer><feFuncA type="linear" slope="0.3"/></feComponentTransfer>
    <feComposite operator="atop" in="cutout" in2="SourceGraphic"/>
  </filter>
  <filter id="envReflection" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="0.5" result="sharp"/>
    <feGaussianBlur in="SourceAlpha" stdDeviation="8" result="rough"/>
    <feSpecularLighting surfaceScale="3" specularConstant="0.5" specularExponent="32" lighting-color="white" result="env">
      <feDistantLight azimuth="45" elevation="75"/>
      <feDistantLight azimuth="-30" elevation="30"/>
      <fePointLight x="800" y="-400" z="600"/>
    </feSpecularLighting>
    <feComposite in="env" in2="SourceAlpha" operator="in"/>
  </filter>
  <filter id="caustics" x="-30%" y="-30%" width="160%" height="160%">
    <feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="4" seed="42" result="caust"/>
    <feColorMatrix in="caust" type="saturate" values="0"/>
    <feComponentTransfer><feFuncA type="linear" slope="0.3"/></feComponentTransfer>
    <feDisplacementMap in="SourceGraphic" in2="caust" scale="2" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <filter id="meniscus" x="-20%" y="-20%" width="140%" height="140%">
    <feMorphology in="SourceAlpha" operator="erode" radius="1" result="eroded"/>
    <feGaussianBlur in="eroded" stdDeviation="1.5" result="blur"/>
    <feSpecularLighting surfaceScale="15" specularConstant="1.5" specularExponent="100" lighting-color="white" result="spec">
      <fePointLight x="50%" y="0%" z="100"/>
    </feSpecularLighting>
    <feComposite in="spec" in2="SourceAlpha" operator="in"/>
  </filter>
  <filter id="anisotropic" x="-10%" y="-10%" width="120%" height="120%">
    <feTurbulence type="fractalNoise" baseFrequency="0.005 0.5" numOctaves="2" result="brush"/>
    <feColorMatrix in="brush" type="saturate" values="0"/>
    <feComponentTransfer><feFuncA type="linear" slope="0.1"/></feComponentTransfer>
    <feBlend in="SourceGraphic" in2="brush" mode="overlay"/>
  </filter>
  <filter id="contactShadow" x="-50%" y="0%" width="200%" height="150%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="15" result="blur"/>
    <feOffset dx="0" dy="12" result="offset"/>
    <feComponentTransfer><feFuncA type="linear" slope="0.25"/></feComponentTransfer>
    <feComposite in="SourceGraphic" in2="offset" operator="over"/>
  </filter>
  <filter id="vignette" x="0%" y="0%" width="100%" height="100%">
    <feComponentTransfer>
      <feFuncA type="table" tableValues="1 1 1 1 1 1 1 1 1 1 0.9 0.7 0.4 0.1 0 0"/>
    </feComponentTransfer>
  </filter>

  <linearGradient id="matteWhite" x1="0%" y1="0%" x2="0%" y2="100%">
    <stop offset="0%" stop-color="#ffffff"/>
    <stop offset="8%" stop-color="#fafafa"/>
    <stop offset="22%" stop-color="#f5f5f4"/>
    <stop offset="40%" stop-color="#eaeae8"/>
    <stop offset="50%" stop-color="#e0e0de"/>
    <stop offset="60%" stop-color="#eaeae8"/>
    <stop offset="78%" stop-color="#f5f5f4"/>
    <stop offset="92%" stop-color="#fafafa"/>
    <stop offset="100%" stop-color="#ffffff"/>
  </linearGradient>
  <linearGradient id="matteWhiteDark" x1="0%" y1="0%" x2="0%" y2="100%">
    <stop offset="0%" stop-color="#2f2a27"/>
    <stop offset="8%" stop-color="#292522"/>
    <stop offset="22%" stop-color="#221f1d"/>
    <stop offset="40%" stop-color="#1c1917"/>
    <stop offset="50%" stop-color="#181514"/>
    <stop offset="60%" stop-color="#1c1917"/>
    <stop offset="78%" stop-color="#221f1d"/>
    <stop offset="92%" stop-color="#292522"/>
    <stop offset="100%" stop-color="#2f2a27"/>
  </linearGradient>
  <linearGradient id="matteDark" x1="0%" y1="0%" x2="0%" y2="100%">
    <stop offset="0%" stop-color="#3d3834"/>
    <stop offset="20%" stop-color="#2f2a27"/>
    <stop offset="50%" stop-color="#1c1917"/>
    <stop offset="80%" stop-color="#141110"/>
    <stop offset="100%" stop-color="#0c0a09"/>
  </linearGradient>
  <linearGradient id="brushedAlu" x1="0%" y1="0%" x2="100%" y2="0%">
    <stop offset="0%" stop-color="#b8b8b8"/>
    <stop offset="15%" stop-color="#d0d0d0"/>
    <stop offset="35%" stop-color="#e0e0e0"/>
    <stop offset="50%" stop-color="#f0f0f0"/>
    <stop offset="65%" stop-color="#e0e0e0"/>
    <stop offset="85%" stop-color="#d0d0d0"/>
    <stop offset="100%" stop-color="#b8b8b8"/>
  </linearGradient>
  <linearGradient id="chrome" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="#f0f0f0"/>
    <stop offset="25%" stop-color="#c0c0c0"/>
    <stop offset="50%" stop-color="#ffffff"/>
    <stop offset="75%" stop-color="#c0c0c0"/>
    <stop offset="100%" stop-color="#f0f0f0"/>
  </linearGradient>
  <linearGradient id="glassWall" x1="0%" y1="0%" x2="100%" y2="0%">
    <stop offset="0%" stop-color="rgba(255,255,255,0.04)"/>
    <stop offset="15%" stop-color="rgba(255,255,255,0.12)"/>
    <stop offset="40%" stop-color="rgba(255,255,255,0.02)"/>
    <stop offset="60%" stop-color="rgba(255,255,255,0.02)"/>
    <stop offset="85%" stop-color="rgba(255,255,255,0.12)"/>
    <stop offset="100%" stop-color="rgba(255,255,255,0.04)"/>
  </linearGradient>
  <linearGradient id="liqSoap" x1="0%" y1="0%" x2="0%" y2="100%">
    <stop offset="0%" stop-color="#a5e6c9" stop-opacity="0.92"/>
    <stop offset="15%" stop-color="#8fd4b8" stop-opacity="0.88"/>
    <stop offset="35%" stop-color="#6fc4a8" stop-opacity="0.82"/>
    <stop offset="55%" stop-color="#4a9b7a" stop-opacity="0.75"/>
    <stop offset="75%" stop-color="#3d8b6a" stop-opacity="0.68"/>
    <stop offset="100%" stop-color="#2d6b4f" stop-opacity="0.55"/>
  </linearGradient>
  <linearGradient id="liqFoam" x1="0%" y1="0%" x2="0%" y2="100%">
    <stop offset="0%" stop-color="#cffafe" stop-opacity="0.88"/>
    <stop offset="20%" stop-color="#a5f3fc" stop-opacity="0.8"/>
    <stop offset="45%" stop-color="#67e8f9" stop-opacity="0.7"/>
    <stop offset="70%" stop-color="#22d3ee" stop-opacity="0.6"/>
    <stop offset="100%" stop-color="#06b6d4" stop-opacity="0.45"/>
  </linearGradient>
  <linearGradient id="liqPaste" x1="0%" y1="0%" x2="0%" y2="100%">
    <stop offset="0%" stop-color="#fef3c7" stop-opacity="0.92"/>
    <stop offset="15%" stop-color="#fde68a" stop-opacity="0.88"/>
    <stop offset="35%" stop-color="#fcd34d" stop-opacity="0.82"/>
    <stop offset="55%" stop-color="#f59e0b" stop-opacity="0.75"/>
    <stop offset="75%" stop-color="#d97706" stop-opacity="0.68"/>
    <stop offset="100%" stop-color="#b45309" stop-opacity="0.55"/>
  </linearGradient>
  <radialGradient id="meniscusGrad" cx="50%" cy="0%" r="50%">
    <stop offset="0%" stop-color="rgba(255,255,255,0.7)"/>
    <stop offset="35%" stop-color="rgba(255,255,255,0.25)"/>
    <stop offset="65%" stop-color="rgba(255,255,255,0.05)"/>
    <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
  </radialGradient>
  <radialGradient id="fresnelRim" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="rgba(255,255,255,0)"/>
    <stop offset="65%" stop-color="rgba(255,255,255,0.02)"/>
    <stop offset="85%" stop-color="rgba(255,255,255,0.15)"/>
    <stop offset="100%" stop-color="rgba(255,255,255,0.4)"/>
  </radialGradient>
  <linearGradient id="btnGrad" x1="0%" y1="0%" x2="0%" y2="100%">
    <stop offset="0%" stop-color="#4a9b7a"/>
    <stop offset="40%" stop-color="#387763"/>
    <stop offset="100%" stop-color="#2d5f4f"/>
  </linearGradient>
  <radialGradient id="ledOn" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="#ffffff"/>
    <stop offset="15%" stop-color="#5ec98a"/>
    <stop offset="40%" stop-color="#387763"/>
    <stop offset="70%" stop-color="#2d5f4f"/>
    <stop offset="100%" stop-color="#1e4a38"/>
  </radialGradient>
  <radialGradient id="ledOff" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="#4a4540"/>
    <stop offset="100%" stop-color="#2a2724"/>
  </radialGradient>
  <linearGradient id="batGrad" x1="0%" y1="0%" x2="100%" y2="0%">
    <stop offset="0%" stop-color="#2d5f4f"/>
    <stop offset="100%" stop-color="#4a9b7a"/>
  </linearGradient>
  <radialGradient id="bgGrad" cx="50%" cy="30%" r="70%">
    <stop offset="0%" stop-color="#fafaf9"/>
    <stop offset="40%" stop-color="#f5f5f4"/>
    <stop offset="70%" stop-color="#e7e5e4"/>
    <stop offset="100%" stop-color="#d6d3d1"/>
  </radialGradient>
  <radialGradient id="bgGradDark" cx="50%" cy="30%" r="70%">
    <stop offset="0%" stop-color="#1c1917"/>
    <stop offset="40%" stop-color="#141110"/>
    <stop offset="70%" stop-color="#0c0a09"/>
    <stop offset="100%" stop-color="#050403"/>
  </radialGradient>
</defs>`;

export { FILTERS };