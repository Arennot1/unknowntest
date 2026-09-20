/* ============================================================================
   PORTFOLIO DRIVE -- handoff build
   Loads your own GLB assets at runtime via GLTFLoader. Point ASSET_PATHS at
   wherever the files live on your site (rename them or edit the paths).
   Serve over http(s) -- GLB fetching does not work from file://.
   ============================================================================ */

const ASSET_PATHS = {
  car:       'models/car.glb',        // Range_Rover_by_IvOfficial_-_8zk4o6nALW.glb
  pine:      'models/pine.glb',       // Pine_by_Quaternius_-_Zt62gceKXZ.glb
  twisted:   'models/twisted-tree.glb', // Twisted_Tree_by_Quaternius_-_8oraKn9m0x.glb
  bush:      'models/bush.glb',       // Bush_by_Quaternius_-_EoTERLq3z2.glb
  pebble:    'models/pebble.glb',     // Pebble_Round_by_Quaternius_-_kAMfq1uJUY.glb
  pathstone: 'models/rock-path.glb',  // Rock_Path_Round_Wide_by_Quaternius_-_mWb3XxOctl.glb
  petal:     'models/petal.glb'       // Flower_Petal_by_Quaternius_-_eVE0j49ux9.glb
};


(function(){
"use strict";
try{

/* ======================================================================
   PORTFOLIO DRIVE — Quaternius nature kit + Range Rover integration
   Pine / TwistedTree / Bush clones sway in the wind shader, Pebble and
   RockPath stones are instanced, Petal_3 feeds the flying-petal systems,
   and the car loads as a baked vertex-colored shell with a procedural
   fallback body. EffectComposer bloom + purple/orange lighting.
   ====================================================================== */

const GRAVITY = 30;
const ISLAND_RADIUS = 82;
const CAR_RADIUS = 1.9;
const POND = { x: 30, z: 34, r: 11 };

//////////////////////// RENDERER / COMPOSER ////////////////////////

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// sRGB output + ACES filmic tone mapping (r128 names; SRGBColorSpace in newer three)
if ('outputEncoding' in renderer) renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xb87a6a, 0.0088);

const camera = new THREE.PerspectiveCamera(50, innerWidth/innerHeight, 0.1, 600);
const CAM_DIR = new THREE.Vector3(-0.55, 1.05, 0.72).normalize();
const camState = {
  distance: 15, minDist: 9, maxDist: 28,
  look: new THREE.Vector3(0, 0.8, 30),
  topDown: 0
};
camera.position.copy(new THREE.Vector3(0, 0.8, 30).addScaledVector(CAM_DIR, 17));
camera.lookAt(camState.look);

// post-processing: render -> bloom -> gamma correction
const composer = new THREE.EffectComposer(renderer);
composer.addPass(new THREE.RenderPass(scene, camera));
const bloomPass = new THREE.UnrealBloomPass(
  new THREE.Vector2(innerWidth, innerHeight), 0.42, 0.4, 0.85
);
composer.addPass(bloomPass);
const gammaPass = new THREE.ShaderPass(THREE.GammaCorrectionShader);
composer.addPass(gammaPass);

function onResize(){
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
}
window.addEventListener('resize', onResize);
onResize();

//////////////////////// SHADER SKY ////////////////////////

const skyMat = new THREE.ShaderMaterial({
  uniforms: {
    uTime:    { value: 0 },
    uHorizon: { value: new THREE.Color(0xe09a63) },
    uMid:     { value: new THREE.Color(0x9a6088) },
    uTop:     { value: new THREE.Color(0x2c2050) }
  },
  vertexShader: `
    varying vec3 vPos;
    void main(){
      vPos = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec3 vPos;
    uniform float uTime;
    uniform vec3 uHorizon;
    uniform vec3 uMid;
    uniform vec3 uTop;
    void main(){
      vec3 d = normalize(vPos);
      float h = d.y;
      float mist = sin(d.x*3.1 + uTime*0.04) * cos(d.z*2.6 - uTime*0.03) * 0.06;
      float t1 = smoothstep(-0.06, 0.32, h + mist);
      float t2 = smoothstep(0.22, 0.9, h);
      vec3 col = mix(uHorizon, uMid, t1);
      col = mix(col, uTop, t2);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
  side: THREE.BackSide,
  fog: false
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(480, 24, 16), skyMat);
scene.add(sky);

//////////////////////// LIGHTS — purple shade / orange sun ////////////////////////

const hemi = new THREE.HemisphereLight(0x8a7ad9, 0xcc7a44, 0.45);
scene.add(hemi);

const purpleAmbient = new THREE.AmbientLight(0x5c3f99, 0.5);
scene.add(purpleAmbient);

const sun = new THREE.DirectionalLight(0xff9a3a, 1.55);
sun.position.set(-40, 60, 30);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -45; sun.shadow.camera.right = 45;
sun.shadow.camera.top = 45; sun.shadow.camera.bottom = -45;
sun.shadow.camera.near = 10; sun.shadow.camera.far = 220;
sun.shadow.bias = -0.002;
sun.shadow.normalBias = 0.8;
scene.add(sun);
scene.add(sun.target);

//////////////////////// SHARED UNIFORMS / WIND ////////////////////////

const windUniform = { value: 0 };
const carPosUniform = { value: new THREE.Vector3(0, 0, 999) };

function flatMat(color, opts){
  opts = opts || {};
  return new THREE.MeshStandardMaterial(Object.assign({
    color: color, flatShading:true, roughness:1, metalness:0
  }, opts));
}

// Injects world-space wind sway (+ optional car crush) into any standard
// material's vertex shader. Base stays rooted: offsets scale with local Y.
function patchWind(material, swayAmp, swayHeight, crush){
  material.onBeforeCompile = function(sh){
    sh.uniforms.uTime = windUniform;
    sh.uniforms.uCarPos = carPosUniform;
    sh.uniforms.uSwayAmp = { value: swayAmp };
    sh.uniforms.uSwayHeight = { value: swayHeight };
    sh.uniforms.uCrush = { value: crush ? 1.0 : 0.0 };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform vec3 uCarPos;\nuniform float uSwayAmp;\nuniform float uSwayHeight;\nuniform float uCrush;')
      .replace('#include <project_vertex>', [
        'vec4 wPos4 = vec4(transformed, 1.0);',
        '#ifdef USE_INSTANCING',
        '  wPos4 = instanceMatrix * wPos4;',
        '#endif',
        'wPos4 = modelMatrix * wPos4;',
        'float hw = clamp(position.y / uSwayHeight, 0.0, 1.0);',
        'wPos4.x += sin(uTime*1.6 + wPos4.x*0.5 + wPos4.z*0.7) * uSwayAmp * hw;',
        'wPos4.z += cos(uTime*1.2 + wPos4.x*0.7) * uSwayAmp * 0.7 * hw;',
        'vec2 toCar = wPos4.xz - uCarPos.xz;',
        'float cdc = length(toCar);',
        'float crushF = smoothstep(2.6, 0.5, cdc) * uCrush;',
        'vec2 pd = cdc > 0.001 ? toCar / cdc : vec2(1.0, 0.0);',
        'wPos4.x += pd.x * crushF * 0.9 * hw;',
        'wPos4.z += pd.y * crushF * 0.9 * hw;',
        'wPos4.y -= crushF * hw * 0.5;',
        'vec4 mvPosition = viewMatrix * wPos4;',
        'gl_Position = projectionMatrix * mvPosition;'
      ].join('\n'));
  };
  return material;
}

function makeFoliageMat(color){
  return patchWind(flatMat(color), 0.07, 3.0, false);
}
// procedural material fallbacks (used only if a kit asset fails to parse)
const pineMats  = [0x4f8a3f, 0x62a04c, 0x468238, 0x76b358].map(makeFoliageMat);
const leafMats  = [0x62a04c, 0x76b358, 0x559244].map(makeFoliageMat);
const bushMats  = [0x5c9a44, 0x76b358, 0x4d8a3c].map(makeFoliageMat);
const trunkMatA = flatMat(0x5c4030);
const trunkMatB = flatMat(0x6b4a35);

//////////////////////// ASSET LOADING (your own GLB files) ////////////////////////

const KIT = { pine:null, twisted:null, bush:null, pebble:null, pathstone:null, petal:null };
let carRoot = null;

const gltfLoader = new THREE.GLTFLoader();
function loadGLB(url){
  return new Promise(function(resolve, reject){
    gltfLoader.load(url, function(g){ resolve(g.scene); }, undefined, reject);
  });
}

// The twisted tree / bush ship with RED autumn leaves. For the lush look we
// build a green variant at runtime (channel swap on a canvas); a share of the
// twisted trees keep the red as autumn accents.
const foliageTex = { green:null, red:null };
function makeGreenVariant(tex){
  try{
    const img = tex.image;
    if (!img || !img.width) return null;
    const cv = document.createElement('canvas');
    cv.width = img.width; cv.height = img.height;
    const ctx = cv.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, cv.width, cv.height);
    for (let i=0;i<d.data.length;i+=4){
      const r = d.data[i];
      d.data[i] = d.data[i+1];
      d.data[i+1] = Math.min(255, r*1.18);
    }
    ctx.putImageData(d, 0, 0);
    const t = new THREE.CanvasTexture(cv);
    t.flipY = tex.flipY;
    if ('encoding' in t) t.encoding = THREE.sRGBEncoding;
    return t;
  } catch(e){ return null; }
}

function setCardTexture(entry, tex){
  if (!entry || !tex) return;
  entry.root.traverse(function(o){
    if (o.isMesh && o.material && o.material.map && o.material.alphaTest > 0){
      o.material.map = tex;
      o.material.needsUpdate = true;
    }
  });
}

// Kit prep: shadows, BLEND leaf cards -> alpha-cutout (crisper, no sorting
// issues), sRGB texture encoding, optional wind patch (sway.height is in the
// model's RAW units so the canopy sways while the base stays rooted).
function prepareKit(root, sway){
  root.traverse(function(o){
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    const m = o.material;
    if (!m) return;
    if (m.map && 'encoding' in m.map) m.map.encoding = THREE.sRGBEncoding;
    if (m.transparent){          // Quaternius leaf/petal cards ship as BLEND
      m.transparent = false;
      m.alphaTest = 0.45;
      m.side = THREE.DoubleSide;
    }
    m.roughness = 0.88; m.metalness = 0;
    if (sway) patchWind(m, sway.amp, sway.height, false);
    m.needsUpdate = true;
  });
  return root;
}

// Car prep: hide the GLB's four tire nodes (replaced by animated procedural
// wheels -- their FBX transforms shear if reparented for steering), render the
// shell double-sided so no panel is backface-culled, style the glass.
function prepareCar(root){
  root.traverse(function(o){
    if (o.isMesh){
      o.castShadow = true;
      o.receiveShadow = true;
      const nm = (o.name || '') + ' ' + ((o.parent && o.parent.name) || '');
      if (/Tire[1-4]/.test(nm)) o.visible = false;
      const m = o.material;
      if (m){
        if (m.map && 'encoding' in m.map) m.map.encoding = THREE.sRGBEncoding;
        m.side = THREE.DoubleSide;
        if (/glass/i.test(m.name || '')){
          m.transparent = true; m.opacity = 0.82;
          m.roughness = 0.12; m.metalness = 0.35;
        } else {
          m.roughness = Math.min(0.85, m.roughness != null ? m.roughness : 0.8);
          m.metalness = 0;
        }
        m.needsUpdate = true;
      }
    }
  });
  return root;
}

function kitEntry(root, opts){
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3(); box.getSize(size);
  let baseScale = 1;
  if (opts.targetHeight) baseScale = opts.targetHeight / Math.max(0.001, size.y);
  else if (opts.targetWidth) baseScale = opts.targetWidth / Math.max(0.001, Math.max(size.x, size.z));
  let firstMesh = null;
  root.traverse(function(o){ if (!firstMesh && o.isMesh) firstMesh = o; });
  return {
    root, baseScale, size,
    geo: firstMesh ? firstMesh.geometry : null,
    mat: firstMesh ? firstMesh.material : null
  };
}

function labelTexture(text, opts){
  opts = opts || {};
  const cv = document.createElement('canvas');
  cv.width = 640; cv.height = 320;
  const ctx = cv.getContext('2d');
  if (opts.bg){ ctx.fillStyle = opts.bg; ctx.fillRect(0,0,cv.width,cv.height); }
  ctx.fillStyle = opts.color || '#2b1a12';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${opts.size||88}px 'Baloo 2', system-ui, sans-serif`;
  ctx.fillText(text, cv.width/2, cv.height/2 - (opts.sub ? 34 : 0));
  if (opts.sub){
    ctx.font = `600 ${opts.subSize||40}px 'Manrope', system-ui, sans-serif`;
    ctx.fillStyle = opts.subColor || opts.color || '#2b1a12';
    ctx.fillText(opts.sub, cv.width/2, cv.height/2 + 48);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.needsUpdate = true;
  tex.anisotropy = 4;
  return tex;
}

function wedgeGeometry(len, w, h){
  const w2 = w/2;
  const A0=[0,0,-w2], A1=[0,0,w2], B0=[len,0,-w2], B1=[len,0,w2], C0=[len,h,-w2], C1=[len,h,w2];
  const tris = [
    [A0,B1,B0],[A0,A1,B1],
    [B0,B1,C1],[B0,C1,C0],
    [A0,C0,C1],[A0,C1,A1],
    [A0,B0,C0],
    [A1,C1,B1]
  ];
  const pos = [];
  tris.forEach(t=>t.forEach(v=>pos.push(v[0],v[1],v[2])));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
  geo.computeVertexNormals();
  return geo;
}

function grassTuftGeometry(){
  const positions = [];
  const blades = 6;
  for (let i=0;i<blades;i++){
    const ang = (i/blades)*Math.PI*2 + Math.random()*0.7;
    const dx = Math.sin(ang), dz = Math.cos(ang);
    const px = Math.cos(ang), pz = -Math.sin(ang);
    const wBase = 0.07 + Math.random()*0.05;
    const lean = 0.3 + Math.random()*0.35;
    const h = 0.85 + Math.random()*0.5;
    positions.push(
      px*wBase, 0, pz*wBase,
      -px*wBase, 0, -pz*wBase,
      dx*lean, h, dz*lean
    );
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

function inPond(x, z, pad){
  return Math.hypot(x - POND.x, z - POND.z) < POND.r + (pad || 0);
}

function toLocal(x, z, zone){
  const dx = x - zone.x, dz = z - zone.z;
  const c = Math.cos(zone.rot), s = Math.sin(zone.rot);
  return { lx: dx*c - dz*s, lz: dx*s + dz*c };
}

const elevationZones = [];
const pebblePlacements = [];    // {x, z, s, yMul} — small rocks, boulders, formations
const slabPlacements = [];      // giant flat pebbles forming the drivable ramps/plateaus
function recordFormation(x, z, rot, len, w){
  // giant Pebble_Round rocks hugging the ramp/plateau so it reads as one big
  // rock formation rather than a floating slab
  const c = Math.cos(rot), s = Math.sin(rot);
  function world(lx, lz){ return { x: x + lx*c + lz*s, z: z - lx*s + lz*c }; }
  const spots = [];
  for (const side of [-1, 1]){
    const n = 2 + Math.floor(Math.random()*2);
    for (let i=0;i<n;i++){
      spots.push([ (0.15 + 0.7*Math.random()) * len, side * (w/2 + 1.2 + Math.random()*1.6) ]);
    }
  }
  spots.push([ len + 1.6 + Math.random(), (Math.random()-0.5) * w * 0.8 ]);
  for (const sp of spots){
    const p = world(sp[0], sp[1]);
    pebblePlacements.push({ x: p.x, z: p.z, s: 6.0 + Math.random()*4.5, yMul: 1.5 + Math.random()*0.9 });
  }
}

function addRamp(x, z, rot, len, w, h, color){
  elevationZones.push({ type:'ramp', x, z, rot, len, w, h });
  recordFormation(x, z, rot, len, w);
  slabPlacements.push({ type:'ramp', x, z, rot, len, w, h });
}

function addPlateau(x, z, rot, len, w, h, color){
  elevationZones.push({ type:'plateau', x, z, rot, len, w, h });
  recordFormation(x, z, rot, len, w);
  slabPlacements.push({ type:'plateau', x, z, rot, len, w, h });
}

function groundHeightAt(x, z){
  let best = 0;
  for (const zn of elevationZones){
    const { lx, lz } = toLocal(x, z, zn);
    if (lx < -0.2 || lx > zn.len + 0.2 || Math.abs(lz) > zn.w/2 + 0.2) continue;
    let h;
    if (zn.type === 'ramp') h = zn.h * Math.min(1, Math.max(0, lx/zn.len));
    else h = zn.h;
    if (h > best) best = h;
  }
  return best;
}

function groundPitchAt(x, z, heading){
  const eps = 1.35;
  const fx = Math.sin(heading), fz = Math.cos(heading);
  const hF = groundHeightAt(x + fx*eps, z + fz*eps);
  const hB = groundHeightAt(x - fx*eps, z - fz*eps);
  return Math.atan2(hF - hB, eps*2);
}

//////////////////////// WORLD ////////////////////////

const worldGroup = new THREE.Group();
scene.add(worldGroup);

// endless animated ocean all around — soft waves + a foam line at the shore
const oceanMat = new THREE.ShaderMaterial({
  uniforms: THREE.UniformsUtils.merge([
    THREE.UniformsLib['fog'],
    {
      uTime:    { value: 0 },
      uDeep:    { value: new THREE.Color(0x2a6288) },
      uShallow: { value: new THREE.Color(0x63a8c4) },
      uFoam:    { value: new THREE.Color(0xeef6f2) }
    }
  ]),
  vertexShader: `
    varying vec3 vWp;
    #include <fog_pars_vertex>
    void main(){
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWp = wp.xyz;
      vec4 mvPosition = viewMatrix * wp;
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }
  `,
  fragmentShader: `
    varying vec3 vWp;
    uniform float uTime;
    uniform vec3 uDeep;
    uniform vec3 uShallow;
    uniform vec3 uFoam;
    #include <fog_pars_fragment>
    float hash21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vnoise(vec2 p){
      vec2 i = floor(p), f = fract(p);
      f = f*f*(3.0 - 2.0*f);
      return mix(
        mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
        mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
        f.y
      );
    }
    void main(){
      float r = length(vWp.xz);
      vec2 p = vWp.xz * 0.05;
      float n = vnoise(p*1.5 + uTime*vec2(0.07, 0.05)) * 0.6
              + vnoise(p*3.2 - uTime*vec2(0.05, 0.08)) * 0.4;
      vec3 col = mix(uShallow, uDeep, smoothstep(92.0, 200.0, r));
      col += (n - 0.5) * 0.10;
      col += vec3(1.0, 0.85, 0.6) * pow(n, 9.0) * 0.22;
      float rw = r + (n - 0.5) * 4.0;
      float foam = 1.0 - smoothstep(0.0, 3.6, abs(rw - 90.5));
      col = mix(col, uFoam, foam * 0.8);
      gl_FragColor = vec4(col, 1.0);
      #include <fog_fragment>
    }
  `,
  fog: true
});
{
  const ocean = new THREE.Mesh(new THREE.CircleGeometry(460, 64), oceanMat);
  ocean.rotation.x = -Math.PI/2;
  ocean.position.y = -0.08;
  worldGroup.add(ocean);
}

function makeGroundTexture(){
  const s = 1024;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#b5623a';
  ctx.fillRect(0, 0, s, s);
  for (let i=0;i<70;i++){
    const x = Math.random()*s, y = Math.random()*s, r = 40 + Math.random()*150;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const dark = Math.random() < 0.5;
    g.addColorStop(0, dark ? 'rgba(120,58,32,0.16)' : 'rgba(224,150,98,0.13)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x-r, y-r, r*2, r*2);
  }
  for (let i=0;i<9000;i++){
    const x = Math.random()*s, y = Math.random()*s;
    const a = 0.04 + Math.random()*0.08;
    ctx.fillStyle = Math.random() < 0.5 ? `rgba(60,28,14,${a})` : `rgba(255,205,155,${a})`;
    ctx.fillRect(x, y, 1 + Math.random()*2, 1 + Math.random()*2);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  if ('encoding' in tex) tex.encoding = THREE.sRGBEncoding;
  if (renderer.capabilities && renderer.capabilities.getMaxAnisotropy){
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  }
  return tex;
}
{
  const floorGeo = new THREE.CircleGeometry(ISLAND_RADIUS, 96);
  const floor = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({
    color:0xffffff, map: makeGroundTexture(), roughness:0.95, metalness:0
  }));
  floor.rotation.x = -Math.PI/2;
  floor.receiveShadow = true;
  worldGroup.add(floor);

  for (let i=0;i<14;i++){
    const a = Math.random()*Math.PI*2, r = 14 + Math.random()*62;
    const px = Math.sin(a)*r, pz = Math.cos(a)*r;
    if (inPond(px, pz, 4)) continue;
    const rad = 2.5 + Math.random()*5;
    const dark = Math.random() < 0.6;
    const patch = new THREE.Mesh(
      new THREE.CircleGeometry(rad, 20),
      new THREE.MeshStandardMaterial({
        color: dark ? 0x8f4c2c : 0xcf8352, transparent:true, opacity:0.28,
        roughness:1, depthWrite:false, polygonOffset:true,
        polygonOffsetFactor:-2, polygonOffsetUnits:-2
      })
    );
    patch.rotation.x = -Math.PI/2;
    patch.position.set(px, 0.02, pz);
    patch.receiveShadow = true;
    worldGroup.add(patch);
  }

  const ring = new THREE.Mesh(new THREE.CircleGeometry(14, 48), flatMat(0x9c5836));
  ring.rotation.x = -Math.PI/2;
  ring.position.y = 0.01;
  ring.receiveShadow = true;
  worldGroup.add(ring);

  // sandy beach ring easing the island into open water (no walls)
  const beach = new THREE.Mesh(new THREE.RingGeometry(77, 90, 72), new THREE.MeshStandardMaterial({
    color:0xe6c08e, roughness:1, metalness:0,
    polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-1
  }));
  beach.rotation.x = -Math.PI/2;
  beach.position.y = 0.04;
  beach.receiveShadow = true;
  worldGroup.add(beach);
}

//////////////////////// POND — scrolling-noise water shader ////////////////////////

const waterMat = new THREE.ShaderMaterial({
  uniforms: THREE.UniformsUtils.merge([
    THREE.UniformsLib['fog'],
    {
      uTime:    { value: 0 },
      uDeep:    { value: new THREE.Color(0x1e4a68) },
      uShallow: { value: new THREE.Color(0x4a8aa8) },
      uFoam:    { value: new THREE.Color(0xdde8e2) },
      uSunCol:  { value: new THREE.Color(0xffb066) },
      uSunDir:  { value: new THREE.Vector3(-0.512, 0.768, 0.384) }
    }
  ]),
  vertexShader: `
    varying vec2 vUv;
    #include <fog_pars_vertex>
    void main(){
      vUv = uv;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    uniform float uTime;
    uniform vec3 uDeep;
    uniform vec3 uShallow;
    uniform vec3 uFoam;
    uniform vec3 uSunCol;
    uniform vec3 uSunDir;
    #include <fog_pars_fragment>

    float hash21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vnoise(vec2 p){
      vec2 i = floor(p), f = fract(p);
      f = f*f*(3.0 - 2.0*f);
      return mix(
        mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
        mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
        f.y
      );
    }
    float waterHeight(vec2 p){
      float n1 = vnoise(p*6.0  + uTime*vec2(0.22, 0.16));
      float n2 = vnoise(p*11.0 - uTime*vec2(0.13, 0.27));
      return n1*0.62 + n2*0.38;
    }
    void main(){
      vec2 c = vUv - 0.5;
      float r = length(c) * 2.0;
      float ang = atan(c.y, c.x);

      float h = waterHeight(vUv);
      float e = 0.02;
      float hx = waterHeight(vUv + vec2(e, 0.0));
      float hz = waterHeight(vUv + vec2(0.0, e));
      vec3 nrm = normalize(vec3(-(hx - h)*7.0, 1.0, -(hz - h)*7.0));
      float spec = pow(max(dot(nrm, normalize(uSunDir)), 0.0), 26.0);

      vec3 col = mix(uShallow, uDeep, smoothstep(0.05, 0.8, r + (h - 0.5)*0.35));
      col += (h - 0.5) * 0.14;
      col += uSunCol * spec * 0.5;
      float foam = smoothstep(0.86, 0.97, r + sin(ang*7.0 + uTime*1.3)*0.035);
      float foam2 = smoothstep(0.06, 0.0, abs(h - 0.72)) * smoothstep(0.35, 0.75, r);
      col = mix(col, uFoam, clamp(foam*0.85 + foam2*0.3, 0.0, 1.0));
      gl_FragColor = vec4(col, 1.0);
      #include <fog_fragment>
    }
  `,
  fog: true
});
{
  const shore = new THREE.Mesh(new THREE.RingGeometry(POND.r - 0.6, POND.r + 2.2, 48), flatMat(0xe0b27e));
  shore.rotation.x = -Math.PI/2;
  shore.position.set(POND.x, 0.06, POND.z);
  shore.receiveShadow = true;
  worldGroup.add(shore);
  const water = new THREE.Mesh(new THREE.CircleGeometry(POND.r, 48), waterMat);
  water.rotation.x = -Math.PI/2;
  water.position.set(POND.x, 0.14, POND.z);
  worldGroup.add(water);
  for (let i=0;i<9;i++){
    const a = Math.random()*Math.PI*2;
    const rr = POND.r + 0.6 + Math.random()*1.2;
    const reed = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 1.1 + Math.random()*0.7, 5), makeFoliageMat(0x6f9a48));
    reed.position.set(POND.x + Math.sin(a)*rr, 0.6, POND.z + Math.cos(a)*rr);
    reed.castShadow = true;
    worldGroup.add(reed);
  }
}

//////////////////////// PATH — RockPath stepping stones ////////////////////////

const envOccluders = [];
const grassClusterSpots = [];
function ringGrass(x, z, count, rMin, rMax){
  for (let i=0;i<count;i++){
    const a = Math.random()*Math.PI*2;
    const rr = rMin + Math.random()*(rMax - rMin);
    grassClusterSpots.push([x + Math.sin(a)*rr, z + Math.cos(a)*rr]);
  }
}
const treePlacements = [];      // {kind, x, z, s, red}
const bushPlacements = [];      // {x, z, s}
const pathStonePlacements = []; // {x, z, s, rot}

function recordPathStones(dirX, dirZ, from, to){
  const count = Math.round((to - from) / 3.1);
  for (let i=0;i<count;i++){
    const t = from + i*3.1 + Math.random()*0.5;
    const x = dirX*t + (Math.random()-0.5)*1.2;
    const z = dirZ*t + (Math.random()-0.5)*1.2;
    if (inPond(x, z, 1.5)) continue;
    pathStonePlacements.push({ x, z, s: 1.15 + Math.random()*0.45, rot: Math.random()*Math.PI*2 });
    if (i % 2 === 0) ringGrass(x, z, 3, 1.4, 2.6);
  }
}
function recordPlaza(cx, cz, n){
  for (let i=0;i<n;i++){
    const a = Math.random()*Math.PI*2, d = Math.random()*3.6;
    const x = cx + Math.sin(a)*d, z = cz + Math.cos(a)*d;
    if (inPond(x, z, 1.5)) continue;
    pathStonePlacements.push({ x, z, s: 1.2 + Math.random()*0.55, rot: Math.random()*Math.PI*2 });
  }
  ringGrass(cx, cz, 6, 3.2, 5.2);
}
recordPathStones(0, 1, 8, 30);
recordPathStones(-1, 0, 8, 46);
recordPathStones(0, -1, 8, 38);
recordPathStones(1, 0, 8, 22);
recordPathStones(0.662, 0.749, 10, 36);   // crossroads -> pond
[[-63,15],[-26,-16],[-15,-15],[18,-8],[-8,28],[40,15],[-35,25],[52,-28],[-48,-32],
 [-58,0],[58,18],[10,-20],[-40,-8],[28,14],[-12,44],[44,-12],[-28,32],[64,28],[20,58],[-52,48],[-70,-28]]
  .forEach(([x,z])=>recordPlaza(x, z, 6 + Math.floor(Math.random()*4)));
// stone circle around the crossroads
for (let i=0;i<26;i++){
  const a = (i/26)*Math.PI*2;
  pathStonePlacements.push({
    x: Math.sin(a)*14.6 + (Math.random()-0.5), z: Math.cos(a)*14.6 + (Math.random()-0.5),
    s: 1.1 + Math.random()*0.4, rot: Math.random()*Math.PI*2
  });
}
// wide ring road around the island
for (let i=0;i<46;i++){
  const a = (i/46)*Math.PI*2;
  const x = Math.sin(a)*52 + (Math.random()-0.5)*1.6;
  const z = Math.cos(a)*52 + (Math.random()-0.5)*1.6;
  if (inPond(x, z, 1.5)) continue;
  pathStonePlacements.push({ x, z, s: 1.15 + Math.random()*0.45, rot: Math.random()*Math.PI*2 });
  if (i % 3 === 0) ringGrass(x, z, 2, 1.4, 2.4);
}

//////////////////////// SIGNAGE ////////////////////////

function addLabelPanel(x, y, z, rotY, w, h, text, sub, panelColor, textColor){
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotY;
  const backing = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.35), flatMat(panelColor));
  backing.position.y = y;
  backing.castShadow = true; backing.receiveShadow = true;
  group.add(backing);
  const tex = labelTexture(text, { sub, color: textColor || '#2b1a12', size: 92 });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w*0.86, h*0.6), new THREE.MeshBasicMaterial({ map: tex, transparent:true }));
  face.position.set(0, y + h*0.06, 0.19);
  group.add(face);
  [-w/2+0.5, w/2-0.5].forEach(lx=>{
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.4, y*0.9, 0.4), flatMat(panelColor));
    leg.position.set(lx, y*0.45, 0);
    leg.castShadow = true;
    group.add(leg);
  });
  worldGroup.add(group);
  return group;
}

{
  const tex = labelTexture('ARROWS / WASD — DRIVE', { sub:'SPACE — JUMP', color:'#fff6e9', bg:'rgba(0,0,0,0)', size:66, subSize:40, subColor:'#fff6e9' });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(11, 5.5), new THREE.MeshBasicMaterial({ map: tex, transparent:true }));
  plane.rotation.x = -Math.PI/2;
  plane.position.set(0, 0.03, 25);
  worldGroup.add(plane);
}

//////////////////////// TOPPLING "WELCOME" SIGN ////////////////////////

const toppleProps = [];
function addToppleSign(x, z, text){
  const pivot = new THREE.Group();
  pivot.position.set(x, 0, z);
  const w = 7.2, h = 3.4;
  const board = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.3), flatMat(0xc9432f));
  board.position.y = h/2;
  board.castShadow = true; board.receiveShadow = true;
  const tex = labelTexture(text, { color:'#fff6e9', size:110 });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w*0.88, h*0.6), new THREE.MeshBasicMaterial({ map: tex, transparent:true }));
  face.position.set(0, h/2, 0.16);
  pivot.add(board, face);
  worldGroup.add(pivot);
  toppleProps.push({ pivot, angle:0, toppled:false, dir:1 });
}
addToppleSign(0, 18, 'WELCOME');

//////////////////////// PLAYGROUND ZONE (west) ////////////////////////

addRamp(-58, 15, 0, 12, 6.5, 4.2, 0x938d7e);
addRamp(-30, -16, Math.PI, 12, 6.5, 4.2, 0x938d7e);

const dynProps = [];

function addBrick(x, z, y, sx, sy, sz, color){
  const geo = new THREE.BoxGeometry(sx, sy, sz);
  const mesh = new THREE.Mesh(geo, flatMat(color));
  mesh.castShadow = true; mesh.receiveShadow = true;
  worldGroup.add(mesh);
  const half = sy/2;
  dynProps.push({
    mesh, pos: new THREE.Vector3(x, y, z), vel: new THREE.Vector3(),
    rot: new THREE.Euler(0,Math.random()*0.1,0), angVel: new THREE.Vector3(),
    radius: Math.max(sx,sz)*0.6, restY: half, mass: sx*sy*sz
  });
}

function brickWall(cx, cz, rotY, cols, rows, brick, gap, color){
  const c = Math.cos(rotY), s = Math.sin(rotY);
  for (let r=0;r<rows;r++){
    for (let col=0; col<cols; col++){
      const lx = (col - (cols-1)/2) * (brick+gap);
      const y = brick/2 + r*brick;
      addBrick(cx + lx*c, cz - lx*s, y, brick, brick, brick, color);
    }
  }
}
brickWall(-52, 0, 0, 6, 3, 1.1, 0.05, 0xd9a441);
brickWall(-52, 6, 0, 6, 3, 1.1, 0.05, 0xb23b2e);

function addBarrel(x, z, color){
  const geo = new THREE.CylinderGeometry(0.85, 0.85, 1.7, 10);
  const mesh = new THREE.Mesh(geo, flatMat(color));
  mesh.castShadow = true; mesh.receiveShadow = true;
  worldGroup.add(mesh);
  dynProps.push({
    mesh, pos:new THREE.Vector3(x,0.85,z), vel:new THREE.Vector3(),
    rot:new THREE.Euler(), angVel:new THREE.Vector3(), radius:1.0, restY:0.85, mass:6, roll:true
  });
}
[[-24,10],[-22,4],[-20,-6],[-26,-12]].forEach(([x,z],i)=>addBarrel(x,z, i%2?0x3a5a78:0xa83232));

function addBall(x, z, r, color){
  const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), flatMat(color));
  mesh.castShadow = true; mesh.receiveShadow = true;
  worldGroup.add(mesh);
  dynProps.push({
    mesh, pos:new THREE.Vector3(x,r,z), vel:new THREE.Vector3(),
    rot:new THREE.Euler(), angVel:new THREE.Vector3(), radius:r, restY:r, mass:2, bouncy:true
  });
}
addBall(-38, 4, 1.3, 0xe0b544);
addBall(-40, -4, 1.6, 0x6a9c4c);
addBall(-16, -18, 1.1, 0xc9432f);

function addCone(x, z){
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.4, 8), flatMat(0xc9622a));
  mesh.castShadow = true; mesh.receiveShadow = true;
  worldGroup.add(mesh);
  dynProps.push({
    mesh, pos:new THREE.Vector3(x,0.7,z), vel:new THREE.Vector3(),
    rot:new THREE.Euler(), angVel:new THREE.Vector3(), radius:0.8, restY:0.7, mass:1
  });
}
[[-16,14],[-14,10],[-12,6],[-10,2]].forEach(([x,z])=>addCone(x,z));

//////////////////////// PROJECTS ZONE (north) ////////////////////////

const projectPods = [
  { x:-27, title:'Signal Garden',  sub:'generative audio-visual site' },
  { x:-9,  title:'Loop Street',    sub:'WebGL shopping experiment' },
  { x:9,   title:'Nightbloom',     sub:'interactive story book' },
  { x:27,  title:'Kite & Ember',   sub:'agency landing page' }
];
projectPods.forEach(p=>{
  addRamp(p.x, -40, Math.PI/2, 8, 5, 2.4, 0x938d7e);
  addPlateau(p.x, -48, Math.PI/2, 11, 8, 2.4, 0x938d7e);
  p.zone = { x:p.x, z:-56, r:9 };
});

//////////////////////// CONTACT ZONE (east) ////////////////////////

addRamp(25, 0, 0, 10, 6, 2.4, 0x938d7e);
addPlateau(35, 0, 0, 14, 9, 2.4, 0x938d7e);

//////////////////////// ENVIRONMENT — clumped placement recording ////////////////////////

// procedural fallbacks (only used if a kit GLB failed to parse)
function addTreeProc(x, z, scale){
  scale = scale || 1;
  if (inPond(x, z, 3)) return;
  const group = new THREE.Group();
  group.position.set(x, groundHeightAt(x,z), z);
  const trunkH = 3.4*scale;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16*scale, 0.28*scale, trunkH, 7), trunkMatA);
  trunk.position.y = trunkH/2;
  trunk.castShadow = true; trunk.receiveShadow = true;
  group.add(trunk);
  for (let i=0;i<4;i++){
    const r = (2.3 - i*0.45) * scale;
    const h = 2.2*scale;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), pineMats[i % pineMats.length]);
    cone.position.y = trunkH*0.8 + i*1.35*scale + h*0.3;
    cone.castShadow = true; cone.receiveShadow = true;
    group.add(cone);
  }
  worldGroup.add(group);
  envOccluders.push({ x, z, r: 3.0*scale, group, cur:1 });
}
function addRoundTreeProc(x, z, scale){
  scale = scale || 1;
  if (inPond(x, z, 3)) return;
  const group = new THREE.Group();
  group.position.set(x, groundHeightAt(x,z), z);
  const trunkH = 4.2*scale;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2*scale, 0.34*scale, trunkH, 7), trunkMatB);
  trunk.position.y = trunkH/2;
  trunk.castShadow = true; trunk.receiveShadow = true;
  group.add(trunk);
  for (let i=0;i<4;i++){
    const r = (1.4 + Math.random()*0.9)*scale;
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), leafMats[i%leafMats.length]);
    blob.position.set((Math.random()-0.5)*1.6*scale, trunkH + (Math.random()-0.2)*1.2*scale, (Math.random()-0.5)*1.6*scale);
    blob.castShadow = true; blob.receiveShadow = true;
    group.add(blob);
  }
  worldGroup.add(group);
  envOccluders.push({ x, z, r: 2.6*scale, group, cur:1 });
}
function addBushProc(x, z, scale){
  scale = scale || 1;
  if (inPond(x, z, 2)) return;
  const group = new THREE.Group();
  group.position.set(x, groundHeightAt(x,z), z);
  for (let i=0;i<3;i++){
    const r = (0.65 + Math.random()*0.35) * scale;
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), bushMats[i%bushMats.length]);
    m.position.set((Math.random()-0.5)*0.8*scale, r*0.7, (Math.random()-0.5)*0.8*scale);
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
  }
  worldGroup.add(group);
  envOccluders.push({ x, z, r: 1.5*scale, group, cur:1 });
}
function addRockProc(x, z, s){
  if (inPond(x, z, 1)) return;
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), flatMat(Math.random()<0.5?0x847c72:0x6e675f));
  m.position.set(x, s*0.4, z);
  m.scale.y = 0.55 + Math.random()*0.3;
  m.rotation.y = Math.random()*Math.PI;
  m.castShadow = true; m.receiveShadow = true;
  worldGroup.add(m);
}

function addFlowerCluster(x, z){
  if (inPond(x, z, 2)) return;
  const group = new THREE.Group();
  group.position.set(x, groundHeightAt(x,z), z);
  const petalColors = [0xffe066, 0xff8fa3, 0xffffff, 0xff6b4a];
  const count = 3 + Math.floor(Math.random()*3);
  for (let i=0;i<count;i++){
    const fx = (Math.random()-0.5)*1.6, fz = (Math.random()-0.5)*1.6;
    const stemH = 0.45 + Math.random()*0.2;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.025,stemH,4), flatMat(0x5c9a48));
    stem.position.set(fx, stemH/2, fz);
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12,0), flatMat(petalColors[i % petalColors.length]));
    head.position.set(fx, stemH, fz);
    group.add(stem, head);
  }
  worldGroup.add(group);
}

// clump recorder: overlapping trees, bushes hugging bases, rocks tucked in,
// thick grass rings around everything — instantiated once the kit is parsed
function addMeadow(x, z){
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(3.8 + Math.random()*3.2, 24),
    new THREE.MeshStandardMaterial({
      color:0x55923f, transparent:true, opacity:0.26, roughness:1,
      depthWrite:false, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2
    })
  );
  m.rotation.x = -Math.PI/2;
  m.position.set(x, 0.018, z);
  m.receiveShadow = true;
  worldGroup.add(m);
}
function pickTreeKind(){
  if (Math.random() < 0.65) return { kind:'pine', red:false };
  return { kind:'twisted', red: Math.random() < 0.35 };
}
function spawnCluster(cx, cz){
  if (inPond(cx, cz, 5)) return;
  addMeadow(cx, cz);
  const mainScale = 0.95 + Math.random()*0.6;
  const k0 = pickTreeKind();
  treePlacements.push({ kind:k0.kind, x:cx, z:cz, s:mainScale, red:k0.red });
  ringGrass(cx, cz, 9 + Math.floor(Math.random()*5), 0.9, 3.2);

  if (Math.random() < 0.8){
    const a = Math.random()*Math.PI*2, d = 1.6 + Math.random()*1.4;
    const tx = cx + Math.sin(a)*d, tz = cz + Math.cos(a)*d;
    const k1 = pickTreeKind();
    treePlacements.push({ kind:k1.kind, x:tx, z:tz, s:mainScale*0.72, red:k1.red });
    ringGrass(tx, tz, 6, 0.8, 2.4);
  }
  if (Math.random() < 0.35){
    const a = Math.random()*Math.PI*2, d = 2.4 + Math.random()*1.8;
    const k2 = pickTreeKind();
    treePlacements.push({ kind:k2.kind, x:cx + Math.sin(a)*d, z:cz + Math.cos(a)*d, s:mainScale*0.55, red:k2.red });
  }
  const nBush = 3 + Math.floor(Math.random()*3);
  for (let i=0;i<nBush;i++){
    const a = Math.random()*Math.PI*2, d = 1.3 + Math.random()*2.2;
    const bx = cx + Math.sin(a)*d, bz = cz + Math.cos(a)*d;
    bushPlacements.push({ x:bx, z:bz, s:0.85 + Math.random()*0.6 });
    ringGrass(bx, bz, 4, 0.5, 1.6);
  }
  const nRock = Math.floor(Math.random()*3);
  for (let i=0;i<nRock;i++){
    const a = Math.random()*Math.PI*2, d = 1.0 + Math.random()*2.6;
    const rx = cx + Math.sin(a)*d, rz = cz + Math.cos(a)*d;
    pebblePlacements.push({ x:rx, z:rz, s:1.7 + Math.random()*1.7, yMul:1.35 });
    ringGrass(rx, rz, 3, 0.4, 1.3);
  }
  if (Math.random() < 0.45){
    const a = Math.random()*Math.PI*2, d = 2.0 + Math.random()*2.0;
    addFlowerCluster(cx + Math.sin(a)*d, cz + Math.cos(a)*d);
  }
}

[Math.PI/4, 3*Math.PI/4, 5*Math.PI/4, 7*Math.PI/4].forEach(center=>{
  for (let i=0;i<5;i++){
    const a = center + (Math.random()-0.5)*0.9;
    const r = 22 + Math.random()*48;
    spawnCluster(Math.sin(a)*r, Math.cos(a)*r);
  }
});
[[-14, 32],[14, -26],[-34, -30],[52, 22],[-62, -8],[8, 52],[-50, 35],[38, 48],[-22, 18],[20, 20],[-65, 20],[55, -35],[-45, -45],[62, 12]].forEach(([x,z])=>spawnCluster(x, z));
for (let i=0;i<3;i++){
  const a = Math.random()*Math.PI*2;
  const d = POND.r + 4 + Math.random()*3;
  spawnCluster(POND.x + Math.sin(a)*d, POND.z + Math.cos(a)*d);
}
// boundary boulders (scaled-up pebbles)
for (let i=0;i<10;i++){
  const a = Math.random()*Math.PI*2;
  const r = 72 + Math.random()*6;
  pebblePlacements.push({ x:Math.sin(a)*r, z:Math.cos(a)*r, s:4.4 + Math.random()*2.2, yMul:2.1 });
}

// warm street lamps — crossroads plus scattered singles; every bulb glows
// via bloom, real PointLights only on a subset to keep the light count sane
function addLamp(x, z, withLight){
  const g = new THREE.Group();
  g.position.set(x, groundHeightAt(x, z), z);
  g.rotation.y = Math.random()*Math.PI*2;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 4.4, 7), flatMat(0x33393f, { metalness:0.4, roughness:0.6 }));
  post.position.y = 2.2; post.castShadow = true;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.28, 0.5), flatMat(0x2a2f34, { metalness:0.4 }));
  head.position.y = 4.5;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), new THREE.MeshBasicMaterial({ color:0xffd9a0 }));
  bulb.position.y = 4.34;
  g.add(post, head, bulb);
  if (withLight){
    const light = new THREE.PointLight(0xffc287, 0.7, 20, 1.6);
    light.position.y = 4.2;
    g.add(light);
  }
  worldGroup.add(g);
}
[[6.5,6.5],[-6.5,6.5],[6.5,-6.5],[-6.5,-6.5]].forEach(([x,z])=>addLamp(x, z, true));
[[-40,20],[30,-20],[15,42],[60,-5]].forEach(([x,z])=>addLamp(x, z, true));
[[-20,-30],[45,28],[-55,-15],[-8,55],[-30,44],[8,-52]].forEach(([x,z])=>addLamp(x, z, false));

// drifting clouds
const clouds = [];
{
  const cloudMat = flatMat(0xe8dcd4, { roughness:1 });
  for (let c=0;c<7;c++){
    const g = new THREE.Group();
    const scale = 1.4 + Math.random()*1.6;
    for (let i=0;i<4;i++){
      const r = (1.6 + Math.random()*1.6)*scale;
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), cloudMat);
      m.position.set(i*2.1*scale - 3*scale + Math.random(), (Math.random()-0.5)*0.8*scale, (Math.random()-0.5)*1.5*scale);
      m.scale.y = 0.55;
      g.add(m);
    }
    const a = Math.random()*Math.PI*2, r = 30 + Math.random()*90;
    g.position.set(Math.sin(a)*r, 40 + Math.random()*22, Math.cos(a)*r);
    scene.add(g);
    clouds.push({ g, speed: 0.6 + Math.random()*0.8 });
  }
}

//////////////////////// GRASS (instanced, wind + crush shader) ////////////////////////

const grassMat = new THREE.ShaderMaterial({
  uniforms: THREE.UniformsUtils.merge([
    THREE.UniformsLib['fog'],
    {
      uTime:   { value: 0 },
      uCarPos: { value: new THREE.Vector3(0, 0, 999) },
      uBase:   { value: new THREE.Color(0x3f8a33) },
      uTip:    { value: new THREE.Color(0x9ecf62) }
    }
  ]),
  vertexShader: `
    uniform float uTime;
    uniform vec3 uCarPos;
    varying float vShade;
    varying float vHash;
    #include <fog_pars_vertex>
    void main(){
      vec4 iPos = vec4(0.0, 0.0, 0.0, 1.0);
      #ifdef USE_INSTANCING
        iPos = instanceMatrix * iPos;
      #endif
      float w = clamp(position.y / 1.1, 0.0, 1.0);
      vec3 transformed = position;
      float sway  = sin(uTime*1.7 + iPos.x*0.6 + iPos.z*0.8);
      float sway2 = cos(uTime*1.3 + iPos.x*0.9 - iPos.z*0.5);
      transformed.x += sway  * 0.14 * w * w;
      transformed.z += sway2 * 0.10 * w * w;
      vec2 toCar = iPos.xz - uCarPos.xz;
      float cd = length(toCar);
      float crush = smoothstep(2.6, 0.5, cd);
      vec2 pushDir = cd > 0.001 ? toCar / cd : vec2(1.0, 0.0);
      transformed.x += pushDir.x * crush * 0.85 * w;
      transformed.z += pushDir.y * crush * 0.85 * w;
      transformed.y *= mix(1.0, 0.25, crush * w);
      vShade = w;
      vHash = fract(sin(dot(iPos.xz, vec2(12.9898, 78.233))) * 43758.5453);
      vec4 mvPosition = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        mvPosition = instanceMatrix * mvPosition;
      #endif
      mvPosition = modelViewMatrix * mvPosition;
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }
  `,
  fragmentShader: `
    uniform vec3 uBase;
    uniform vec3 uTip;
    varying float vShade;
    varying float vHash;
    #include <fog_pars_fragment>
    void main(){
      vec3 col = mix(uBase, uTip, vShade);
      col *= 0.85 + vHash * 0.3;
      gl_FragColor = vec4(col, 1.0);
      #include <fog_fragment>
    }
  `,
  side: THREE.DoubleSide,
  fog: true
});

function scatterGrass(totalCount){
  const mesh = new THREE.InstancedMesh(grassTuftGeometry(), grassMat, totalCount);
  mesh.frustumCulled = false;
  const dummy = new THREE.Object3D();
  let placed = 0;
  for (let i=0; i<grassClusterSpots.length && placed<totalCount; i++){
    const spot = grassClusterSpots[i];
    const x = spot[0], z = spot[1];
    if (inPond(x, z, 1.2)) continue;
    dummy.position.set(x + (Math.random()-0.5)*0.5, groundHeightAt(x,z), z + (Math.random()-0.5)*0.5);
    dummy.rotation.y = Math.random()*Math.PI*2;
    const s = 0.75 + Math.random()*0.85;
    dummy.scale.set(s, s*(0.85+Math.random()*0.5), s);
    dummy.updateMatrix();
    mesh.setMatrixAt(placed++, dummy.matrix);
  }
  while (placed < totalCount){
    let x = 0, z = 0, guard = 0;
    do {
      const a = Math.random()*Math.PI*2;
      const r = 12 + Math.random()*68;
      x = Math.sin(a)*r; z = Math.cos(a)*r;
      guard++;
    } while (inPond(x, z, 1.5) && guard < 8);
    dummy.position.set(x, groundHeightAt(x,z), z);
    dummy.rotation.y = Math.random()*Math.PI*2;
    const s = 0.6 + Math.random()*0.75;
    dummy.scale.set(s, s*(0.8+Math.random()*0.5), s);
    dummy.updateMatrix();
    mesh.setMatrixAt(placed++, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  worldGroup.add(mesh);
}

//////////////////////// FLYING PETALS (kit Petal_3 geometry) ////////////////////////

const petalSystems = [];
function makePetalSystem(count, tintHex){
  let geo, mat, baseS;
  if (KIT.petal && KIT.petal.geo){
    geo = KIT.petal.geo;
    baseS = KIT.petal.baseScale;
    mat = new THREE.MeshBasicMaterial({
      map: (KIT.petal.mat && KIT.petal.mat.map) || null,
      alphaTest: 0.45,
      side: THREE.DoubleSide,
      color: tintHex
    });
  } else {
    geo = new THREE.PlaneGeometry(0.5, 0.55);
    baseS = 0.45;
    mat = new THREE.MeshBasicMaterial({ color: tintHex, side: THREE.DoubleSide, transparent:true, opacity:0.95 });
  }
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;
  const parts = [];
  for (let i=0;i<count;i++){
    parts.push({
      x: (Math.random()-0.5)*120, y: 2 + Math.random()*16, z: (Math.random()-0.5)*120,
      vy: 0.55 + Math.random()*0.5,
      dx: (Math.random()-0.5)*0.8, dz: (Math.random()-0.5)*0.8,
      phase: Math.random()*Math.PI*2,
      flutter: 0.6 + Math.random()*0.9,
      spin: (Math.random()-0.5)*2.5,
      s: baseS * (0.85 + Math.random()*0.7)
    });
  }
  scene.add(mesh);
  petalSystems.push({ mesh, parts, dummy: new THREE.Object3D() });
}
function initPetalSystems(){
  makePetalSystem(60, 0xffffff);  // natural petal colors from the Flowers sheet
  makePetalSystem(55, 0xffb070);  // warm-tinted drifting leaves
}

// fallen petals resting on the ground (replaces the old square leaf litter)
function scatterPetalLitter(count, tintHex){
  if (!KIT.petal || !KIT.petal.geo) return;
  const mat = new THREE.MeshBasicMaterial({
    map: (KIT.petal.mat && KIT.petal.mat.map) || null,
    alphaTest: 0.45, side: THREE.DoubleSide, color: tintHex
  });
  const mesh = new THREE.InstancedMesh(KIT.petal.geo, mat, count);
  mesh.frustumCulled = false;
  const dummy = new THREE.Object3D();
  for (let i=0;i<count;i++){
    let x = 0, z = 0, guard = 0;
    do {
      const a = Math.random()*Math.PI*2;
      const r = 12 + Math.random()*68;
      x = Math.sin(a)*r; z = Math.cos(a)*r;
      guard++;
    } while (inPond(x, z, 1) && guard < 8);
    dummy.position.set(x, groundHeightAt(x, z) + 0.03, z);
    dummy.rotation.set((Math.random()-0.5)*0.25, Math.random()*Math.PI*2, (Math.random()-0.5)*0.25);
    dummy.scale.setScalar(KIT.petal.baseScale * (0.8 + Math.random()*0.8));
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  worldGroup.add(mesh);
}

function updatePetals(dt, t){
  for (const sys of petalSystems){
    const mesh = sys.mesh, parts = sys.parts, dummy = sys.dummy;
    for (let i=0;i<parts.length;i++){
      const p = parts[i];
      p.y -= p.vy * dt;
      p.x += (p.dx + Math.sin(t*p.flutter + p.phase) * 0.8) * dt;
      p.z += (p.dz + Math.cos(t*p.flutter*0.8 + p.phase) * 0.6) * dt;
      if (p.y < 0.25){
        p.y = 10 + Math.random()*10;
        p.x = car.x + (Math.random()-0.5)*90;
        p.z = car.z + (Math.random()-0.5)*90;
      }
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(
        Math.sin(t*p.flutter + p.phase) * 0.9,
        t*p.spin + p.phase,
        Math.cos(t*p.flutter*0.7 + p.phase) * 0.7
      );
      dummy.scale.setScalar(p.s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
}

//////////////////////// CAR — baked Range Rover + procedural wheels ////////////////////////

const car = {
  x:0, z:30, y:0, heading:Math.PI, speed:0, vy:0,
  pitch:0, dive:0, roll:0, grounded:true, jumpReady:true, wasGrounded:true
};

const carGroup = new THREE.Group();
carGroup.rotation.order = 'YXZ';
scene.add(carGroup);

const darkMat  = new THREE.MeshStandardMaterial({ color:0x20242a, roughness:0.75, metalness:0.2 });
const tireMat  = new THREE.MeshStandardMaterial({ color:0x141414, roughness:0.95, metalness:0 });
const rimMat   = new THREE.MeshStandardMaterial({ color:0xd7dde2, roughness:0.28, metalness:0.8 });

// measured from the GLB: wheelbase center z=-0.47, tire bottoms y=-1.33,
// tire centers x=+/-1.04 z=+1.29/-2.23, radius 0.53 -> at scale 0.75 the
// wheels sit at (+/-0.78, r=0.40, +/-1.32)
const CAR_SCALE = 0.75;
const WHEEL_RADIUS = 0.40;

const tireGeo = new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.38, 18);
tireGeo.rotateZ(Math.PI/2);
const rimGeo = new THREE.CylinderGeometry(0.21, 0.21, 0.4, 10);
rimGeo.rotateZ(Math.PI/2);
const hubGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.42, 8);
hubGeo.rotateZ(Math.PI/2);

function makeWheel(x, z){
  const pivot = new THREE.Object3D();
  pivot.position.set(x, WHEEL_RADIUS, z);
  const spin = new THREE.Group();
  const tire = new THREE.Mesh(tireGeo, tireMat);
  tire.castShadow = true;
  const rim = new THREE.Mesh(rimGeo, rimMat);
  const hub = new THREE.Mesh(hubGeo, darkMat);
  spin.add(tire, rim, hub);
  pivot.add(spin);
  carGroup.add(pivot);
  return { pivot, spin };
}
const wheelFL = makeWheel(0.78, 1.32);
const wheelFR = makeWheel(-0.78, 1.32);
const wheelRL = makeWheel(0.78, -1.32);
const wheelRR = makeWheel(-0.78, -1.32);

// underbody tub: closes the hollow look under the shell
const tub = new THREE.Mesh(
  new THREE.BoxGeometry(1.72, 0.55, 3.55),
  new THREE.MeshStandardMaterial({ color:0x1b1e24, roughness:0.9, metalness:0.1 })
);
tub.position.set(0, 0.62, 0);
tub.castShadow = true;
carGroup.add(tub);

// emissive dressing (feeds the bloom pass)
const bumperGlowMat = new THREE.MeshStandardMaterial({ color:0xff9a3c, emissive:0xff8a2c, emissiveIntensity:1.7, roughness:0.5 });
const bumperGlow = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.12, 0.06), bumperGlowMat);
bumperGlow.position.set(0, 0.42, 2.1);
carGroup.add(bumperGlow);

const lampMat = new THREE.MeshStandardMaterial({ color:0xffe9a8, emissive:0xffc84a, emissiveIntensity:1.6, roughness:0.4 });
const lightbar = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.09, 0.14), darkMat);
lightbar.position.set(0, 2.06, 0.35);
carGroup.add(lightbar);
[-0.4,-0.13,0.13,0.4].forEach(x=>{
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.09, 0.08), lampMat);
  lamp.position.set(x, 2.06, 0.43);
  lamp.castShadow = false;
  carGroup.add(lamp);
});

const headMat = new THREE.MeshStandardMaterial({ color:0xfff6e9, emissive:0xfff1c2, emissiveIntensity:1.1, roughness:0.3 });
const headL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.06), headMat);
headL.position.set(0.55, 0.78, 2.06);
const headR = headL.clone();
headR.position.x = -0.55;
carGroup.add(headL, headR);

const tailMat = new THREE.MeshStandardMaterial({ color:0xff3344, emissive:0x550000, emissiveIntensity:0.3, roughness:0.4 });
const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.06), tailMat);
tailL.position.set(0.62, 1.0, -2.05);
const tailR = tailL.clone();
tailR.position.x = -0.62;
carGroup.add(tailL, tailR);

const antennaPivot = new THREE.Object3D();
antennaPivot.position.set(-0.6, 2.05, -1.1);
const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.035, 1.0, 6), darkMat);
antenna.position.y = 0.5;
antennaPivot.add(antenna);
carGroup.add(antennaPivot);

const frontLight = new THREE.PointLight(0xffb066, 0.65, 14, 1.8);
frontLight.position.set(0, 0.8, 2.5);
carGroup.add(frontLight);
const underGlow = new THREE.PointLight(0xff8a4c, 0.35, 8, 1.8);
underGlow.position.set(0, 0.35, 0);
carGroup.add(underGlow);

function buildFallbackBody(){
  const bodyMat = flatMat(0xd95f2b, { roughness:0.55, metalness:0.05 });
  const lower = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.75, 4.3), bodyMat);
  lower.position.set(0, 0.88, 0);
  lower.castShadow = true; lower.receiveShadow = true;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.78, 2.3), flatMat(0x24333f, { roughness:0.3, metalness:0.2 }));
  cabin.position.set(0, 1.62, -0.3);
  cabin.castShadow = true;
  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 0.1), darkMat);
  grille.position.set(0, 0.7, 2.12);
  carGroup.add(lower, cabin, grille);
}

function assembleCar(){
  if (carRoot){
    const wrapper = new THREE.Group();
    wrapper.scale.setScalar(CAR_SCALE);
    carRoot.position.set(0, 1.33, 0.47);
    wrapper.add(carRoot);
    carGroup.add(wrapper);
  } else {
    buildFallbackBody();
  }
}

//////////////////////// BUILD + LOAD ////////////////////////

function instantiateTreeLike(entry, x, z, s, minR, altCardMat){
  if (inPond(x, z, 3)) return;
  const obj = entry.root.clone();
  if (altCardMat){
    obj.traverse(function(o){
      if (o.isMesh && o.material && (o.material.name || '').indexOf('Card_') === 0){
        o.material = altCardMat;
      }
    });
  }
  const sc = entry.baseScale * s;
  obj.scale.setScalar(sc);
  obj.rotation.y = Math.random()*Math.PI*2;
  obj.position.set(x, groundHeightAt(x, z) - 0.06, z);
  worldGroup.add(obj);
  const r = Math.max(minR, Math.max(entry.size.x, entry.size.z) * sc * 0.5);
  envOccluders.push({ x, z, r, group: obj, cur: 1 });
}

function buildEnvironment(){
  let redCardMat = null;
  if (KIT.twisted && foliageTex.red){
    redCardMat = new THREE.MeshStandardMaterial({
      map: foliageTex.red, alphaTest:0.45, side:THREE.DoubleSide,
      roughness:0.9, metalness:0, vertexColors:true
    });
    redCardMat.name = 'Card_Leaves_TwistedTree_Red';
    patchWind(redCardMat, 0.09, 16.0, false);
  }
  for (const p of treePlacements){
    const entry = KIT[p.kind];
    if (entry) instantiateTreeLike(entry, p.x, p.z, p.s, 1.6, (p.kind === 'twisted' && p.red) ? redCardMat : null);
    else if (p.kind === 'pine') addTreeProc(p.x, p.z, p.s);
    else addRoundTreeProc(p.x, p.z, p.s);
  }
  for (const p of bushPlacements){
    if (KIT.bush) instantiateTreeLike(KIT.bush, p.x, p.z, p.s, 1.0);
    else addBushProc(p.x, p.z, p.s);
  }
  if (KIT.pebble && KIT.pebble.geo){
    const list = pebblePlacements.filter(p => !inPond(p.x, p.z, 1));
    const im = new THREE.InstancedMesh(KIT.pebble.geo, KIT.pebble.mat, list.length);
    im.frustumCulled = false;
    im.castShadow = true; im.receiveShadow = true;
    const dummy = new THREE.Object3D();
    list.forEach(function(p, i){
      const w = KIT.pebble.baseScale * p.s;
      dummy.position.set(p.x, groundHeightAt(p.x, p.z), p.z);
      dummy.rotation.set(0, Math.random()*Math.PI*2, 0);
      dummy.scale.set(w, w * p.yMul, w);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
    });
    im.instanceMatrix.needsUpdate = true;
    worldGroup.add(im);
  } else {
    pebblePlacements.forEach(function(p){ addRockProc(p.x, p.z, 0.42*p.s); });
  }
  if (KIT.pathstone && KIT.pathstone.geo){
    const im = new THREE.InstancedMesh(KIT.pathstone.geo, KIT.pathstone.mat, pathStonePlacements.length);
    im.frustumCulled = false;
    im.receiveShadow = true;
    const dummy = new THREE.Object3D();
    pathStonePlacements.forEach(function(p, i){
      const w = KIT.pathstone.baseScale * p.s;
      dummy.position.set(p.x, groundHeightAt(p.x, p.z) + 0.03, p.z);
      dummy.rotation.set(0, p.rot, 0);
      dummy.scale.set(w, w, w);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
    });
    im.instanceMatrix.needsUpdate = true;
    worldGroup.add(im);
  } else {
    pathStonePlacements.forEach(function(p){
      const tile = new THREE.Mesh(new THREE.CylinderGeometry(0.9*p.s, 0.9*p.s, 0.1, 7), flatMat(0xe0b27e));
      tile.position.set(p.x, groundHeightAt(p.x,p.z)+0.05, p.z);
      tile.rotation.y = p.rot;
      tile.receiveShadow = true;
      worldGroup.add(tile);
    });
  }
  // drivable ramps & plateaus as giant flattened Pebble_Round slabs,
  // aligned to the exact collision frames
  if (KIT.pebble && KIT.pebble.geo && slabPlacements.length){
    const im = new THREE.InstancedMesh(KIT.pebble.geo, KIT.pebble.mat, slabPlacements.length);
    im.frustumCulled = false;
    im.castShadow = true; im.receiveShadow = true;
    const dummy = new THREE.Object3D();
    const qy = new THREE.Quaternion(), qz = new THREE.Quaternion();
    const Y = new THREE.Vector3(0,1,0), Z = new THREE.Vector3(0,0,1);
    slabPlacements.forEach(function(sl, i){
      const c = Math.cos(sl.rot), s = Math.sin(sl.rot);
      const cx = sl.x + (sl.len/2)*c, cz = sl.z - (sl.len/2)*s;
      if (sl.type === 'plateau'){
        dummy.position.set(cx, 0, cz);
        qy.setFromAxisAngle(Y, sl.rot);
        dummy.quaternion.copy(qy);
        dummy.scale.set(sl.len*1.18/0.41, sl.h/0.09, sl.w*1.3/0.45);
      } else {
        const hyp = Math.hypot(sl.len, sl.h);
        const pitch = Math.atan2(sl.h, sl.len);
        qy.setFromAxisAngle(Y, sl.rot);
        qz.setFromAxisAngle(Z, pitch);
        qy.multiply(qz);
        const n = new THREE.Vector3(0,1,0).applyQuaternion(qy);
        const thick = 1.1;
        dummy.position.set(cx - n.x*thick, sl.h/2 - n.y*thick, cz - n.z*thick);
        dummy.quaternion.copy(qy);
        dummy.scale.set(hyp*1.12/0.41, thick/0.09, sl.w*1.28/0.45);
      }
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
    });
    im.instanceMatrix.needsUpdate = true;
    worldGroup.add(im);
  } else {
    slabPlacements.forEach(function(sl){
      const g = new THREE.Group();
      g.position.set(sl.x, 0, sl.z);
      g.rotation.y = sl.rot;
      let mesh;
      if (sl.type === 'plateau'){
        mesh = new THREE.Mesh(new THREE.BoxGeometry(sl.len, sl.h, sl.w), flatMat(0x8a8478));
        mesh.position.set(sl.len/2, sl.h/2, 0);
      } else {
        mesh = new THREE.Mesh(wedgeGeometry(sl.len, sl.w, sl.h), flatMat(0x8a8478, { side: THREE.DoubleSide }));
      }
      mesh.castShadow = true; mesh.receiveShadow = true;
      g.add(mesh);
      worldGroup.add(g);
    });
  }
  scatterGrass(4200);
  initPetalSystems();
  scatterPetalLitter(210, 0xffffff);
  scatterPetalLitter(160, 0xe07a3f);
}

let assetsReady = false;
function onAssetsReady(){
  assetsReady = true;
  const btn = document.getElementById('startBtn');
  btn.disabled = false;
  btn.textContent = 'Start the engine';
}

const loadJobs = [
  loadGLB(ASSET_PATHS.car).then(function(r){ carRoot = prepareCar(r); })
    .catch(function(e){ console.error('car load failed', e); }),
  loadGLB(ASSET_PATHS.pine).then(function(r){
    KIT.pine = kitEntry(prepareKit(r, { amp:0.07, height:7.4 }), { targetHeight:8.0 });
  }).catch(function(e){ console.error('pine load failed', e); }),
  loadGLB(ASSET_PATHS.twisted).then(function(r){
    KIT.twisted = kitEntry(prepareKit(r, { amp:0.09, height:16.0 }), { targetHeight:6.4 });
  }).catch(function(e){ console.error('twisted tree load failed', e); }),
  loadGLB(ASSET_PATHS.bush).then(function(r){
    KIT.bush = kitEntry(prepareKit(r, { amp:0.06, height:1.6 }), { targetHeight:1.25 });
  }).catch(function(e){ console.error('bush load failed', e); }),
  loadGLB(ASSET_PATHS.pebble).then(function(r){
    KIT.pebble = kitEntry(prepareKit(r, null), { targetWidth:0.95 });
    if (KIT.pebble.mat) KIT.pebble.mat.color.setHex(0xccc7b8);   // cut the white blowout
  }).catch(function(e){ console.error('pebble load failed', e); }),
  loadGLB(ASSET_PATHS.pathstone).then(function(r){
    KIT.pathstone = kitEntry(prepareKit(r, null), { targetWidth:2.0 });
    if (KIT.pathstone.mat) KIT.pathstone.mat.color.setHex(0xccc7b8);
  }).catch(function(e){ console.error('path stone load failed', e); }),
  loadGLB(ASSET_PATHS.petal).then(function(r){
    KIT.petal = kitEntry(prepareKit(r, null), { targetWidth:0.30 });
  }).catch(function(e){ console.error('petal load failed', e); })
];
Promise.all(loadJobs).then(function(){
  // lush-green foliage: derive a green variant of the red twisted-tree leaves
  // and apply it to the twisted tree + bush; buildEnvironment keeps ~35% of
  // twisted trees on the original red map as autumn accents
  if (KIT.twisted && KIT.twisted.root){
    KIT.twisted.root.traverse(function(o){
      if (!foliageTex.red && o.isMesh && o.material && o.material.map && o.material.alphaTest > 0){
        foliageTex.red = o.material.map;
      }
    });
    foliageTex.green = foliageTex.red ? makeGreenVariant(foliageTex.red) : null;
    if (foliageTex.green){
      setCardTexture(KIT.twisted, foliageTex.green);
      setCardTexture(KIT.bush, foliageTex.green);
    }
  }
  assembleCar();
  buildEnvironment();
  onAssetsReady();
});

//////////////////////// DUST / SPLASH PARTICLES ////////////////////////

function softSpriteTexture(){
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(32,32,2, 32,32,30);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,64,64);
  return new THREE.CanvasTexture(cv);
}

const P_MAX = 260;
const pGeo = new THREE.BufferGeometry();
const pPositions = new Float32Array(P_MAX*3);
const pColors = new Float32Array(P_MAX*3);
const pData = [];
for (let i=0;i<P_MAX;i++){
  pPositions[i*3+1] = -100;
  pData.push({ life:0, vx:0, vy:0, vz:0 });
}
pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(pColors, 3));
const pMat = new THREE.PointsMaterial({
  size: 0.75, map: softSpriteTexture(), transparent: true, opacity: 0.7,
  depthWrite: false, vertexColors: true, sizeAttenuation: true
});
const points = new THREE.Points(pGeo, pMat);
points.frustumCulled = false;
scene.add(points);
let pCursor = 0;

function spawnParticle(x, y, z, vx, vy, vz, r, g, b, life){
  const i = pCursor % P_MAX;
  pCursor++;
  pPositions[i*3] = x; pPositions[i*3+1] = y; pPositions[i*3+2] = z;
  pColors[i*3] = r; pColors[i*3+1] = g; pColors[i*3+2] = b;
  const d = pData[i];
  d.life = life; d.vx = vx; d.vy = vy; d.vz = vz;
}

function updateParticles(dt){
  for (let i=0;i<P_MAX;i++){
    const d = pData[i];
    if (d.life > 0){
      d.life -= dt;
      d.vy -= 3.2*dt;
      pPositions[i*3]   += d.vx*dt;
      pPositions[i*3+1] += d.vy*dt;
      pPositions[i*3+2] += d.vz*dt;
      if (d.life <= 0 || pPositions[i*3+1] < -1) pPositions[i*3+1] = -100;
    }
  }
  pGeo.attributes.position.needsUpdate = true;
  pGeo.attributes.color.needsUpdate = true;
}

//////////////////////// INPUT ////////////////////////

const keys = {};
window.addEventListener('keydown', e=>{
  keys[e.code] = true;
  if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', e=>{ keys[e.code] = false; });

function readKeyboard(){
  let steer = 0, throttle = 0;
  if (keys.KeyA || keys.ArrowLeft || keys.KeyQ) steer -= 1;
  if (keys.KeyD || keys.ArrowRight) steer += 1;
  if (keys.KeyW || keys.ArrowUp || keys.KeyZ) throttle += 1;
  if (keys.KeyS || keys.ArrowDown) throttle -= 1;
  const jump = !!(keys.Space || keys.ShiftLeft || keys.ShiftRight);
  return { steer, throttle, jump };
}

window.addEventListener('wheel', e=>{
  camState.distance = Math.min(camState.maxDist, Math.max(camState.minDist, camState.distance + e.deltaY*0.012));
}, { passive:true });

const isTouch = matchMedia('(pointer:coarse)').matches;
if (isTouch) document.getElementById('mobile').classList.add('on');

const stick = document.getElementById('stick');
const knob = document.getElementById('stickKnob');
let stickTouchId = null;
const stickState = { x:0, y:0 };

function stickVector(clientX, clientY){
  const r = stick.getBoundingClientRect();
  const cx = r.left + r.width/2, cy = r.top + r.height/2;
  let dx = clientX - cx, dy = clientY - cy;
  const max = r.width/2;
  const len = Math.hypot(dx,dy);
  if (len > max){ dx = dx/len*max; dy = dy/len*max; }
  knob.style.left = (33 + dx) + 'px';
  knob.style.top = (33 + dy) + 'px';
  return { x: dx/max, y: dy/max };
}
stick.addEventListener('touchstart', e=>{
  const t = e.changedTouches[0];
  stickTouchId = t.identifier;
  const v = stickVector(t.clientX, t.clientY);
  stickState.x = v.x; stickState.y = v.y;
  e.preventDefault();
}, { passive:false });
stick.addEventListener('touchmove', e=>{
  for (const t of e.changedTouches){
    if (t.identifier === stickTouchId){
      const v = stickVector(t.clientX, t.clientY);
      stickState.x = v.x; stickState.y = v.y;
    }
  }
  e.preventDefault();
}, { passive:false });
function stickEnd(e){
  for (const t of e.changedTouches){
    if (t.identifier === stickTouchId){
      stickTouchId = null; stickState.x = 0; stickState.y = 0;
      knob.style.left = '33px'; knob.style.top = '33px';
    }
  }
}
stick.addEventListener('touchend', stickEnd);
stick.addEventListener('touchcancel', stickEnd);

let touchJump = false;
const jumpBtn = document.getElementById('jumpBtn');
jumpBtn.addEventListener('touchstart', e=>{ touchJump = true; e.preventDefault(); }, { passive:false });
jumpBtn.addEventListener('touchend', e=>{ touchJump = false; e.preventDefault(); }, { passive:false });
jumpBtn.addEventListener('touchcancel', ()=>{ touchJump = false; });

function readInput(){
  const kb = readKeyboard();
  const steer = Math.max(-1, Math.min(1, kb.steer + stickState.x));
  const throttle = Math.max(-1, Math.min(1, kb.throttle + (-stickState.y)));
  const jump = kb.jump || touchJump;
  return { steer, throttle, jump };
}

//////////////////////// AUDIO ////////////////////////

let audioCtx = null, engineOsc = null, engineGain = null;
function initAudio(){
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    engineOsc = audioCtx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineGain = audioCtx.createGain();
    engineGain.gain.value = 0;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 900;
    engineOsc.connect(filter).connect(engineGain).connect(audioCtx.destination);
    engineOsc.start();
  } catch(e){ /* audio unsupported */ }
}
function updateEngineSound(speedRatio, throttle){
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const freq = 55 + Math.abs(speedRatio)*160 + Math.abs(throttle)*35;
  engineOsc.frequency.setTargetAtTime(freq, t, 0.06);
  const vol = 0.015 + Math.min(Math.abs(speedRatio),1)*0.05 + Math.abs(throttle)*0.02;
  engineGain.gain.setTargetAtTime(vol, t, 0.12);
}
function playBump(strength){
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.value = 70 + Math.random()*70;
  const vol = Math.min(0.22, 0.05 + strength*0.015);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12 + Math.random()*0.1);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(t); osc.stop(t + 0.3);
}
function playJump(up){
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(up ? 220 : 340, t);
  osc.frequency.exponentialRampToValueAtTime(up ? 420 : 140, t + 0.14);
  gain.gain.setValueAtTime(0.09, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(t); osc.stop(t + 0.2);
}

//////////////////////// GAME START ////////////////////////

let started = false;
document.getElementById('startBtn').addEventListener('click', ()=>{
  if (started || !assetsReady) return;
  started = true;
  initAudio();
  document.getElementById('overlay').classList.add('hidden');
  document.getElementById('hud').classList.add('show');
  const hint = document.getElementById('hint');
  hint.classList.add('show');
  setTimeout(()=>hint.classList.remove('show'), 6500);
});

//////////////////////// SIMULATION ////////////////////////

let engineCat = 0;

function updateCar(dt, inp){
  const maxFwd = 24, maxRev = 11;
  const accel = 20, brakeDecel = 36, friction = 11;

  const prevSpeed = car.speed;

  if (inp.throttle > 0){
    car.speed += accel*dt*inp.throttle;
  } else if (inp.throttle < 0){
    if (car.speed > 0) car.speed += brakeDecel*dt*inp.throttle;
    else car.speed += accel*0.7*dt*inp.throttle;
  } else {
    const f = friction*dt;
    if (car.speed > 0) car.speed = Math.max(0, car.speed - f);
    else car.speed = Math.min(0, car.speed + f);
  }
  car.speed = Math.max(-maxRev, Math.min(maxFwd, car.speed));

  const inWater = inPond(car.x, car.z, -0.5);
  if (inWater) car.speed *= Math.max(0, 1 - 1.8*dt);

  const speedSign = car.speed >= 0 ? 1 : -1;
  const turnStrength = Math.min(Math.abs(car.speed)/5, 1);
  car.heading -= inp.steer * 2.1 * turnStrength * speedSign * dt;

  const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
  let nx = car.x + fx*car.speed*dt;
  let nz = car.z + fz*car.speed*dt;

  const dist = Math.hypot(nx, nz);
  const maxDist = 86;   // drive onto the beach, stop at the water's edge
  if (dist > maxDist){
    const s = maxDist/dist;
    nx *= s; nz *= s;
    if (Math.abs(car.speed) > 4) playBump(Math.abs(car.speed)*0.4);
    car.speed *= 0.4;
  }
  car.x = nx; car.z = nz;

  const groundY = groundHeightAt(car.x, car.z);
  if (car.grounded && inp.jump && car.jumpReady){
    car.vy = 11.5;
    car.grounded = false;
    car.jumpReady = false;
    playJump(true);
  }
  if (!inp.jump) car.jumpReady = true;

  car.vy -= GRAVITY*dt;
  car.y += car.vy*dt;
  if (car.y <= groundY){
    if (!car.grounded && car.vy < -6) playJump(false);
    car.y = groundY; car.vy = 0;
    if (!car.wasGrounded){
      for (let i=0;i<8;i++){
        spawnParticle(
          car.x + (Math.random()-0.5)*1.6, car.y + 0.2, car.z + (Math.random()-0.5)*1.6,
          (Math.random()-0.5)*3, 1 + Math.random()*1.5, (Math.random()-0.5)*3,
          0.83, 0.6, 0.4, 0.5 + Math.random()*0.3
        );
      }
    }
    car.grounded = true;
  } else {
    car.grounded = false;
  }
  car.wasGrounded = car.grounded;

  const targetPitch = car.grounded
    ? Math.max(-0.6, Math.min(0.6, groundPitchAt(car.x, car.z, car.heading)))
    : car.pitch * 0.92;
  car.pitch += (targetPitch - car.pitch) * Math.min(1, dt*9);

  const accelPerSec = dt > 0 ? (car.speed - prevSpeed)/dt : 0;
  const diveTarget = Math.max(-0.05, Math.min(0.08, -accelPerSec*0.0045));
  car.dive += (diveTarget - car.dive) * Math.min(1, dt*7);

  const rollTarget = Math.max(-0.11, Math.min(0.11, -inp.steer * Math.abs(car.speed) * 0.0055));
  car.roll += (rollTarget - car.roll) * Math.min(1, dt*7);

  const spin = (car.speed/WHEEL_RADIUS) * dt;
  [wheelFL, wheelFR, wheelRL, wheelRR].forEach(w=> w.spin.rotation.x += spin );
  const steerAngle = Math.max(-0.5, Math.min(0.5, -inp.steer*0.5));
  wheelFL.pivot.rotation.y = steerAngle;
  wheelFR.pivot.rotation.y = steerAngle;

  const antTarget = Math.max(-0.6, Math.min(0.6, -(car.speed - (updateCar._lastSpeed || 0))*2.2));
  updateCar._lastSpeed = car.speed;
  antennaPivot.rotation.x += (antTarget - antennaPivot.rotation.x) * Math.min(1, dt*6);

  const braking = (inp.throttle < 0 && car.speed > 0.5) || car.speed < -0.2;
  const wantTail = braking ? 1.6 : 0.3;
  tailMat.emissiveIntensity += (wantTail - tailMat.emissiveIntensity) * Math.min(1, dt*8);

  if (car.grounded && Math.abs(car.speed) > 6){
    const emitProb = Math.min(1, Math.abs(car.speed)*dt*0.55);
    [[0.8,-1.4],[-0.8,-1.4]].forEach(([lx,lz])=>{
      if (Math.random() < emitProb){
        const wx = car.x + lx*Math.cos(car.heading) + lz*Math.sin(car.heading);
        const wz = car.z - lx*Math.sin(car.heading) + lz*Math.cos(car.heading);
        if (inWater){
          spawnParticle(wx, car.y + 0.25, wz,
            -fx*1.5 + (Math.random()-0.5)*2, 2.2 + Math.random()*2, -fz*1.5 + (Math.random()-0.5)*2,
            0.55, 0.72, 0.85, 0.45 + Math.random()*0.3);
        } else {
          spawnParticle(wx, car.y + 0.18, wz,
            -fx*2 + (Math.random()-0.5)*1.5, 1 + Math.random()*1.2, -fz*2 + (Math.random()-0.5)*1.5,
            0.83, 0.6, 0.4, 0.5 + Math.random()*0.4);
        }
      }
    });
  }

  carGroup.position.set(car.x, car.y, car.z);
  carGroup.rotation.y = car.heading;
  carGroup.rotation.x = -car.pitch + car.dive;
  carGroup.rotation.z = car.roll;
  carPosUniform.value.set(car.x, car.y, car.z);

  updateEngineSound(car.speed/maxFwd, inp.throttle);

  const cat = car.speed > 1 ? 1 : (car.speed < -0.6 ? -1 : 0);
  if (cat !== engineCat){
    engineCat = cat;
    document.title = cat === 1 ? '🚙💨 Portfolio Drive' : cat === -1 ? '🚙↩️ Portfolio Drive' : '🚙 Portfolio Drive';
  }

  document.getElementById('speedo').textContent = Math.round(Math.abs(car.speed)*4.2) + ' mph';
}

function updateDynProps(dt){
  for (const p of dynProps){
    p.vel.y -= GRAVITY*dt;
    p.pos.addScaledVector(p.vel, dt);
    p.rot.x += p.angVel.x*dt;
    p.rot.y += p.angVel.y*dt;
    p.rot.z += p.angVel.z*dt;
    p.angVel.multiplyScalar(0.965);
    p.vel.x *= 0.965; p.vel.z *= 0.965;

    const gy = groundHeightAt(p.pos.x, p.pos.z) + p.restY;
    if (p.pos.y < gy){
      p.pos.y = gy;
      if (p.vel.y < 0) p.vel.y = p.bouncy ? -p.vel.y*0.55 : 0;
      if (Math.abs(p.vel.y) < 0.4) p.vel.y = 0;
    }

    const dx = p.pos.x - car.x, dz = p.pos.z - car.z;
    const distC = Math.hypot(dx, dz);
    const minDist = p.radius + CAR_RADIUS;
    if (distC < minDist && distC > 0.001 && Math.abs(p.pos.y - car.y) < 2.2){
      const nx = dx/distC, nz = dz/distC;
      const overlap = minDist - distC;
      const impulse = Math.max(Math.abs(car.speed), 3) * (1.6/Math.max(1,p.mass*0.15));
      p.vel.x += nx*impulse;
      p.vel.z += nz*impulse;
      p.vel.y += Math.min(6, Math.abs(car.speed)*0.28);
      if (!p.roll){
        p.angVel.x += (Math.random()-0.5)*impulse*0.6;
        p.angVel.z += (Math.random()-0.5)*impulse*0.6;
      } else {
        p.angVel.y += impulse*0.5*(Math.random()<0.5?-1:1);
      }
      car.x -= nx*overlap*0.6;
      car.z -= nz*overlap*0.6;
      car.speed *= 0.9;
      if (Math.abs(car.speed) > 2) playBump(Math.abs(car.speed));
    }

    if (p.roll){
      const speedMag = Math.hypot(p.vel.x, p.vel.z);
      p.rot.z += speedMag*dt*0.6;
    }

    p.mesh.position.copy(p.pos);
    p.mesh.rotation.set(p.rot.x, p.rot.y, p.rot.z);
  }
}

function updateToppleProps(dt){
  for (const t of toppleProps){
    if (!t.toppled){
      const dx = t.pivot.position.x - car.x, dz = t.pivot.position.z - car.z;
      const d = Math.hypot(dx, dz);
      if (d < 4.6 && Math.abs(car.speed) > 3){
        t.toppled = true;
        t.dir = (dx*Math.sin(car.heading) + dz*Math.cos(car.heading)) >= 0 ? 1 : -1;
        playBump(6);
      }
    } else if (t.angle < Math.PI/2 - 0.02){
      t.angle += dt*3.2;
      t.pivot.rotation.x = -t.dir * Math.min(t.angle, Math.PI/2);
    }
  }
}

function updateOccluders(dt){
  const cx = camera.position.x, cz = camera.position.z;
  const px = car.x - cx, pz = car.z - cz;
  const segLen2 = px*px + pz*pz;
  for (const o of envOccluders){
    const ox = o.x - cx, oz = o.z - cz;
    let t = segLen2 > 0.0001 ? (ox*px + oz*pz)/segLen2 : 0;
    t = Math.max(0, Math.min(1, t));
    const nx = cx + px*t, nz = cz + pz*t;
    const d = Math.hypot(o.x - nx, o.z - nz);
    const want = (d < o.r && t > 0.04 && t < 0.96) ? 0.12 : 1;
    o.cur += (want - o.cur) * Math.min(1, dt*6);
    o.group.scale.setScalar(o.cur);
  }
}

function updateCamera(dt){
  let wantTop = 0;
  for (const p of projectPods){
    const d = Math.hypot(p.zone.x - car.x, p.zone.z - car.z);
    if (d < p.zone.r) wantTop = Math.max(wantTop, 1 - d/p.zone.r);
  }
  camState.topDown += (wantTop - camState.topDown) * Math.min(1, dt*2.5);

  const fx = Math.sin(car.heading), fz = Math.cos(car.heading);

  const followPos = new THREE.Vector3(car.x, car.y, car.z)
    .addScaledVector(CAM_DIR, camState.distance * 1.15);
  const topPos = new THREE.Vector3(car.x, car.y + 26, car.z + 0.001);
  const desired = followPos.lerp(topPos, camState.topDown);
  camera.position.lerp(desired, 1 - Math.pow(0.005, dt));

  const lead = Math.min(2.5, Math.abs(car.speed)*0.09);
  const followLook = new THREE.Vector3(car.x + fx*lead, car.y + 0.8, car.z + fz*lead);
  const topLook = new THREE.Vector3(car.x, car.y, car.z);
  const desiredLook = followLook.lerp(topLook, camState.topDown);
  camState.look.lerp(desiredLook, 1 - Math.pow(0.003, dt));
  camera.lookAt(camState.look);

  sun.position.set(car.x - 40, 60, car.z + 30);
  sun.target.position.set(car.x, 0, car.z);
}

//////////////////////// LOOP ////////////////////////

const clock = new THREE.Clock();
function tick(){
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  skyMat.uniforms.uTime.value = t;
  grassMat.uniforms.uTime.value = t;
  waterMat.uniforms.uTime.value = t;
  oceanMat.uniforms.uTime.value = t;
  windUniform.value = t;
  grassMat.uniforms.uCarPos.value.copy(carPosUniform.value);
  for (const c of clouds){
    c.g.position.x += c.speed*dt;
    if (c.g.position.x > 150) c.g.position.x = -150;
  }
  if (started){
    const inp = readInput();
    updateCar(dt, inp);
    updateDynProps(dt);
    updateToppleProps(dt);
  }
  updatePetals(dt, t);
  updateParticles(dt);
  updateCamera(started ? dt : dt*0.3);
  updateOccluders(dt);
  composer.render();
}
tick();

} catch(err){
  console.error('Portfolio Drive failed to start:', err);
  const card = document.querySelector('#overlay .card');
  if (card){
    card.innerHTML = '<h1>Something stalled</h1>' +
      '<p class="tag">The 3D scene hit an error before it could start: ' +
      (err && err.message ? String(err.message) : String(err)) +
      '</p>';
  }
}
})();
