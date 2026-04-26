// constellation.jsx
// Three.js star map. Renders nodes as instanced spheres with a glow halo,
// edges as additive lines, and a star-field background of additive points.
// Hover/click are dispatched via raycaster against an invisible pick layer.

const Constellation = ({
  graph,
  starFieldDensity = 0.6,
  surfaceLightness = 0,           // 0 = dark, 1 = light
  motionIntensity = 0.6,
  reticle,                        // {x,y,z} or null — search target
  cameraFocus,                    // {target, theta, phi, distance, bestPos} | null
  pulseIds,                       // Set<id> — search matches
  onHover,                        // (node | null, screenXY) => void
  onClick,                        // (node) => void
  selectedId,
  cameraRef,                      // ref to expose camera for minimap
  onCameraChange,                 // (camPos) => void
  indexingProgress = 1,           // 0..1 — fraction of nodes to reveal
}) => {
  const mountRef = React.useRef(null);
  const stateRef = React.useRef({});

  // ─── one-time three.js setup ────────────────────────────────────────────
  React.useEffect(() => {
    const THREE = window.THREE;
    const mount = mountRef.current;
    const w = mount.clientWidth, h = mount.clientHeight;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0a0f, 0.004);

    const camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 2000);
    camera.position.set(0, 0, 130);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.setClearColor(0x0a0a0f, 1);
    mount.appendChild(renderer.domElement);

    // Star-field backdrop (separate from constellation nodes)
    const starGeom = new THREE.BufferGeometry();
    const STAR_MAX = 4000;
    const starPos = new Float32Array(STAR_MAX * 3);
    const starCol = new Float32Array(STAR_MAX * 3);
    const STAR_PALETTE = [
      [0.75, 0.6, 0.23],   // amber
      [0.29, 0.43, 0.75],  // cobalt
      [0.29, 0.55, 0.36],  // sage
      [0.54, 0.36, 0.75],  // soft violet
      [0.78, 0.78, 0.92],  // soft white
    ];
    for (let i = 0; i < STAR_MAX; i++) {
      const r = 400 + Math.random() * 600;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPos[i*3]   = r * Math.sin(phi) * Math.cos(theta);
      starPos[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
      starPos[i*3+2] = r * Math.cos(phi);
      const c = STAR_PALETTE[Math.floor(Math.random() * STAR_PALETTE.length)];
      const dim = 0.3 + Math.random() * 0.7;
      starCol[i*3] = c[0]*dim; starCol[i*3+1] = c[1]*dim; starCol[i*3+2] = c[2]*dim;
    }
    starGeom.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starGeom.setAttribute('color', new THREE.BufferAttribute(starCol, 3));
    const starMat = new THREE.PointsMaterial({
      size: 1.6,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const starField = new THREE.Points(starGeom, starMat);
    scene.add(starField);

    // ── Cartesian grid backdrop ──────────────────────────────────────────
    // A 3D wireframe grid that visually frames the constellation as a
    // coordinate system. Three orthogonal grid planes through origin, each
    // with subtle gradient fade to keep the look airy.
    const gridGroup = new THREE.Group();
    const GRID_HALF = 240;
    const GRID_DIV = 24;
    const gridStep = (GRID_HALF * 2) / GRID_DIV;
    const gridColor = new THREE.Color(0x4a90d9);

    const buildGridPlane = (axis) => {
      // axis = 'xz' | 'xy' | 'yz'
      const positions = [];
      const colors = [];
      const fade = (d) => {
        // distance-from-center fade for a subtle vignette
        const t = Math.min(1, d / GRID_HALF);
        return Math.max(0.05, 1 - t * t * 0.85);
      };
      for (let i = 0; i <= GRID_DIV; i++) {
        const v = -GRID_HALF + i * gridStep;
        // Lines parallel to two axes
        for (const dir of [0, 1]) {
          let a, b;
          if (axis === 'xz') {
            a = dir === 0 ? [v, 0, -GRID_HALF] : [-GRID_HALF, 0, v];
            b = dir === 0 ? [v, 0,  GRID_HALF] : [ GRID_HALF, 0, v];
          } else if (axis === 'xy') {
            a = dir === 0 ? [v, -GRID_HALF, 0] : [-GRID_HALF, v, 0];
            b = dir === 0 ? [v,  GRID_HALF, 0] : [ GRID_HALF, v, 0];
          } else { // yz
            a = dir === 0 ? [0, v, -GRID_HALF] : [0, -GRID_HALF, v];
            b = dir === 0 ? [0, v,  GRID_HALF] : [0,  GRID_HALF, v];
          }
          positions.push(...a, ...b);
          // Brighten the central axis lines slightly
          const isAxis = Math.abs(v) < 0.01;
          const baseDim = isAxis ? 0.55 : 0.18;
          const dimA = baseDim * fade(Math.hypot(a[0], a[1], a[2]));
          const dimB = baseDim * fade(Math.hypot(b[0], b[1], b[2]));
          colors.push(gridColor.r * dimA, gridColor.g * dimA, gridColor.b * dimA);
          colors.push(gridColor.r * dimB, gridColor.g * dimB, gridColor.b * dimB);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      const m = new THREE.LineBasicMaterial({
        vertexColors: true, transparent: true, opacity: 0.35,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      return new THREE.LineSegments(g, m);
    };
    const gridXZ = buildGridPlane('xz');
    const gridXY = buildGridPlane('xy');
    const gridYZ = buildGridPlane('yz');
    gridGroup.add(gridXZ, gridXY, gridYZ);
    // Cluster the planes a little behind the action
    gridGroup.position.set(0, 0, 0);
    scene.add(gridGroup);

    // Tick markers on the central axes for "coordinate plane" cues
    const tickGroup = new THREE.Group();
    const tickMat = new THREE.LineBasicMaterial({
      color: 0x7b52c0, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const tickPos = [];
    for (let i = -GRID_HALF; i <= GRID_HALF; i += gridStep * 2) {
      // X-axis ticks
      tickPos.push(i, -2, 0,  i, 2, 0);
      // Z-axis ticks
      tickPos.push(0, -2, i,  0, 2, i);
      // Y-axis ticks
      tickPos.push(-2, i, 0,  2, i, 0);
    }
    const tickGeom = new THREE.BufferGeometry();
    tickGeom.setAttribute('position', new THREE.Float32BufferAttribute(tickPos, 3));
    tickGroup.add(new THREE.LineSegments(tickGeom, tickMat));
    scene.add(tickGroup);

    // ── Distant nebula clouds (large additive sprites) ───────────────────
    const cloudCanvas = document.createElement('canvas');
    cloudCanvas.width = cloudCanvas.height = 256;
    const cctx = cloudCanvas.getContext('2d');
    const cloudGrad = cctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    cloudGrad.addColorStop(0,   'rgba(255,255,255,0.55)');
    cloudGrad.addColorStop(0.4, 'rgba(255,255,255,0.18)');
    cloudGrad.addColorStop(1,   'rgba(255,255,255,0)');
    cctx.fillStyle = cloudGrad;
    cctx.fillRect(0, 0, 256, 256);
    const cloudTex = new THREE.CanvasTexture(cloudCanvas);

    const distantCloudGroup = new THREE.Group();
    const CLOUD_PRESETS = [
      { color: 0x4a90d9, pos: [ 420,  -90, -520], scale: 420, op: 0.28 }, // cobalt nebula
      { color: 0x7b52c0, pos: [-340, -260, -380], scale: 280, op: 0.30 }, // violet nebula
      { color: 0xf5a623, pos: [ 320,  280, -420], scale: 240, op: 0.20 }, // amber nebula
      { color: 0x4a8c5c, pos: [ -60,  380, -500], scale: 220, op: 0.20 }, // sage nebula
    ];
    CLOUD_PRESETS.forEach(p => {
      const m = new THREE.SpriteMaterial({
        map: cloudTex, color: p.color, transparent: true, opacity: p.op,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const s = new THREE.Sprite(m);
      s.position.set(...p.pos);
      s.scale.setScalar(p.scale);
      distantCloudGroup.add(s);
    });
    scene.add(distantCloudGroup);

    // ── Distant galaxy spirals (tiny additive sprites) ────────────────────
    const galaxyCanvas = document.createElement('canvas');
    galaxyCanvas.width = galaxyCanvas.height = 128;
    const gctx = galaxyCanvas.getContext('2d');
    gctx.translate(64, 64);
    // Spiral arms
    for (let arm = 0; arm < 2; arm++) {
      gctx.rotate(Math.PI);
      for (let r = 4; r < 56; r += 0.5) {
        const a = r * 0.18;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r * 0.45;
        gctx.fillStyle = `rgba(255,255,255,${(1 - r / 56) * 0.6})`;
        gctx.beginPath();
        gctx.arc(x, y, 1.2, 0, Math.PI * 2);
        gctx.fill();
      }
    }
    // Bright core
    const coreGrad = gctx.createRadialGradient(0, 0, 0, 0, 0, 14);
    coreGrad.addColorStop(0, 'rgba(255,255,255,1)');
    coreGrad.addColorStop(1, 'rgba(255,255,255,0)');
    gctx.fillStyle = coreGrad;
    gctx.fillRect(-64, -64, 128, 128);
    const galaxyTex = new THREE.CanvasTexture(galaxyCanvas);

    const galaxyGroup = new THREE.Group();
    const GALAXY_PRESETS = [
      { color: 0xc8c4d8, pos: [ 540,  220, -780], scale: 50,  rot: 0.3 },
      { color: 0xf5a623, pos: [-620, -180, -820], scale: 38,  rot: 1.2 },
      { color: 0x4a90d9, pos: [ 200, -420, -880], scale: 30,  rot: -0.6 },
      { color: 0x7b52c0, pos: [-280,  460, -780], scale: 42,  rot: 0.9 },
    ];
    GALAXY_PRESETS.forEach(p => {
      const m = new THREE.SpriteMaterial({
        map: galaxyTex, color: p.color, transparent: true, opacity: 0.5,
        blending: THREE.AdditiveBlending, depthWrite: false, rotation: p.rot,
      });
      const s = new THREE.Sprite(m);
      s.position.set(...p.pos);
      s.scale.setScalar(p.scale);
      galaxyGroup.add(s);
    });
    scene.add(galaxyGroup);

    // ── Pulsars: distant blinking points (subtle, atmospheric) ───────────
    // Reuse the soft star sprite but at varying scales + per-pulsar phases.
    const pulsarGroup = new THREE.Group();
    const PULSAR_PRESETS = [
      { color: 0xffe9c2, pos: [ 280,  340, -640], scale: 6.5, phase: 0.0, freq: 0.7 },
      { color: 0xc7d8ff, pos: [-440,  -80, -700], scale: 5.5, phase: 1.6, freq: 0.5 },
      { color: 0xd4ffe1, pos: [-180,  220, -560], scale: 4.5, phase: 0.8, freq: 0.6 },
      { color: 0xe7d1ff, pos: [ 480,   40, -660], scale: 6.0, phase: 3.1, freq: 0.4 },
      { color: 0xfff2c2, pos: [-240, -380, -620], scale: 4.0, phase: 1.2, freq: 1.1 },
    ];
    PULSAR_PRESETS.forEach(p => {
      const m = new THREE.SpriteMaterial({
        map: cloudTex, color: p.color, transparent: true, opacity: 0.6,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const s = new THREE.Sprite(m);
      s.position.set(...p.pos);
      s.scale.setScalar(p.scale);
      s.userData = { phase: p.phase, freq: p.freq, baseScale: p.scale };
      pulsarGroup.add(s);
    });
    scene.add(pulsarGroup);

    // ── Comet: a small drifting body with a tail ─────────────────────────
    const cometCanvas = document.createElement('canvas');
    cometCanvas.width = cometCanvas.height = 128;
    const cometCtx = cometCanvas.getContext('2d');
    const cometGrad = cometCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
    cometGrad.addColorStop(0,    'rgba(255,255,255,1)');
    cometGrad.addColorStop(0.25, 'rgba(220,235,255,0.7)');
    cometGrad.addColorStop(0.6,  'rgba(180,210,255,0.15)');
    cometGrad.addColorStop(1,    'rgba(180,210,255,0)');
    cometCtx.fillStyle = cometGrad;
    cometCtx.fillRect(0, 0, 128, 128);
    const cometTex = new THREE.CanvasTexture(cometCanvas);

    // Tail texture: elongated streak (a wide gradient mapped to a narrow sprite)
    const tailCanvas = document.createElement('canvas');
    tailCanvas.width = 256; tailCanvas.height = 64;
    const tctx = tailCanvas.getContext('2d');
    const tailGrad = tctx.createLinearGradient(0, 32, 256, 32);
    tailGrad.addColorStop(0,    'rgba(180,210,255,0)');
    tailGrad.addColorStop(0.4,  'rgba(200,220,255,0.18)');
    tailGrad.addColorStop(0.85, 'rgba(255,255,255,0.65)');
    tailGrad.addColorStop(1,    'rgba(255,255,255,0.95)');
    tctx.fillStyle = tailGrad;
    tctx.fillRect(0, 0, 256, 64);
    // Soft vertical falloff
    const tailFalloff = tctx.createLinearGradient(0, 0, 0, 64);
    tailFalloff.addColorStop(0,   'rgba(0,0,0,1)');
    tailFalloff.addColorStop(0.5, 'rgba(0,0,0,0)');
    tailFalloff.addColorStop(1,   'rgba(0,0,0,1)');
    tctx.globalCompositeOperation = 'destination-out';
    tctx.fillStyle = tailFalloff;
    tctx.fillRect(0, 0, 256, 64);
    const tailTex = new THREE.CanvasTexture(tailCanvas);

    const cometGroup = new THREE.Group();
    const cometHeadMat = new THREE.SpriteMaterial({
      map: cometTex, color: 0xeaf1ff, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const cometHead = new THREE.Sprite(cometHeadMat);
    cometHead.scale.setScalar(8);
    const cometTailMat = new THREE.SpriteMaterial({
      map: tailTex, color: 0xc8d8ff, transparent: true, opacity: 0.6,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const cometTail = new THREE.Sprite(cometTailMat);
    cometTail.scale.set(60, 14, 1);
    // Tail anchored so its bright end (right side of texture) sits on the head
    cometTail.center.set(1.0, 0.5);
    cometGroup.add(cometTail);
    cometGroup.add(cometHead);
    scene.add(cometGroup);

    // ── Shooting stars: ephemeral streaks with a fading trail ────────────
    // We pre-allocate a small pool of line segments and animate them in.
    const SHOOTER_COUNT = 4;
    const shooterGroup = new THREE.Group();
    const shooters = [];
    for (let i = 0; i < SHOOTER_COUNT; i++) {
      const positions = new Float32Array(2 * 3);
      const colors = new Float32Array(2 * 3);
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const mat = new THREE.LineBasicMaterial({
        vertexColors: true, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const line = new THREE.Line(geom, mat);
      shooterGroup.add(line);
      shooters.push({
        line, mat,
        active: false,
        t: 0, dur: 0,
        from: new THREE.Vector3(),
        dir: new THREE.Vector3(),
        len: 50,
        cooldown: 2 + Math.random() * 5,
      });
    }
    scene.add(shooterGroup);

    // ── Cluster halos: large color-tinted sprites behind dense clusters ──
    // (Materialized in the graph (re)build effect below; container here.)
    const clusterHaloGroup = new THREE.Group();
    scene.add(clusterHaloGroup);

    // Group for nodes/edges so we can clear it when graph changes
    const graphGroup = new THREE.Group();
    scene.add(graphGroup);

    // Reticle — a soft white ring
    const reticleGeom = new THREE.RingGeometry(2.4, 2.8, 48);
    const reticleMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0,
      side: THREE.DoubleSide, depthWrite: false,
    });
    const reticleMesh = new THREE.Mesh(reticleGeom, reticleMat);
    scene.add(reticleMesh);
    // Inner reticle ring
    const reticleGeom2 = new THREE.RingGeometry(0.6, 0.85, 32);
    const reticleMesh2 = new THREE.Mesh(reticleGeom2, reticleMat.clone());
    scene.add(reticleMesh2);

    // Selection ring — a single steady ring around the selected node.
    // Distinct from the (pulsing) reticle: this is calm, persistent, and
    // anchored to the node, marking "this is the open file".
    const selRingGeom = new THREE.RingGeometry(1.6, 1.78, 64);
    const selRingMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0,
      side: THREE.DoubleSide, depthWrite: false,
    });
    const selRingMesh = new THREE.Mesh(selRingGeom, selRingMat);
    scene.add(selRingMesh);

    stateRef.current = {
      THREE, scene, camera, renderer, mount,
      starField, starMat, graphGroup,
      gridGroup, tickGroup, distantCloudGroup, galaxyGroup, clusterHaloGroup,
      pulsarGroup, cometGroup, cometHead, cometTail, cometTailMat, cometHeadMat,
      shooters, shooterGroup,
      reticleMesh, reticleMesh2,
      selRingMesh,
      selRingCurOpacity: 0,
      nodeMeshes: [],     // {mesh, glow, node}
      edgeLine: null,
      raycaster: new THREE.Raycaster(),
      pointer: new THREE.Vector2(),
      pickPositions: [],
      hovered: null,
      camTarget: new THREE.Vector3(0, 0, 0),
      camDistance: 130,
      camPhi: Math.PI / 2,
      camTheta: 0,
      autoSpin: true,
      time: 0,
      reticleTarget: null,
      reticleCurrent: new THREE.Vector3(0, 0, 0),
      pulseIds: new Set(),
      selectedId: null,
      indexingProgress: 1,
      motionIntensity: 0.6,
      starDensity: 0.6,
    };

    // ─── interaction (pan/zoom/hover/click) ───────────────────────────────
    let pointerDown = false;
    let pointerStart = { x: 0, y: 0 };
    let pointerMoved = false;
    let lastP = { x: 0, y: 0 };
    const dom = renderer.domElement;
    dom.style.touchAction = 'none';
    dom.style.cursor = 'grab';

    const onPointerDown = (e) => {
      pointerDown = true; pointerMoved = false;
      pointerStart = { x: e.clientX, y: e.clientY };
      lastP = { x: e.clientX, y: e.clientY };
      dom.style.cursor = 'grabbing';
      stateRef.current.autoSpin = false;
    };
    const onPointerMove = (e) => {
      const rect = dom.getBoundingClientRect();
      stateRef.current.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      stateRef.current.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      stateRef.current.pointerScreen = { x: e.clientX, y: e.clientY };

      if (pointerDown) {
        const dx = e.clientX - lastP.x;
        const dy = e.clientY - lastP.y;
        if (Math.abs(e.clientX - pointerStart.x) + Math.abs(e.clientY - pointerStart.y) > 4) {
          pointerMoved = true;
          // User has started panning — abandon any active fly-to so they can
          // freely manipulate the camera from wherever they are now.
          stateRef.current.cameraFocus = null;
        }
        stateRef.current.camTheta -= dx * 0.005;
        stateRef.current.camPhi = Math.max(0.2, Math.min(Math.PI - 0.2, stateRef.current.camPhi - dy * 0.005));
        lastP = { x: e.clientX, y: e.clientY };
      }
    };
    const onPointerUp = () => {
      pointerDown = false;
      dom.style.cursor = 'grab';
    };
    const onWheel = (e) => {
      e.preventDefault();
      const st = stateRef.current;
      const factor = Math.exp(e.deltaY * 0.001);
      // Zoom is independent of pan/orbit. If a fly-to is in progress we let
      // the user dolly in/out along the focus distance directly so the
      // camera keeps converging on the highlighted target — no jarring
      // mid-flight jumps from a reset.
      if (st.cameraFocus) {
        st.cameraFocus.distance = Math.max(40, Math.min(420, st.cameraFocus.distance * factor));
      }
      st.camDistance = Math.max(40, Math.min(420, st.camDistance * factor));
    };
    const onClickInner = (e) => {
      if (pointerMoved) return;
      // Raycast against pick spheres
      const st = stateRef.current;
      st.raycaster.setFromCamera(st.pointer, st.camera);
      const hits = st.raycaster.intersectObjects(st.nodeMeshes.map(m => m.pickMesh));
      if (hits.length > 0) {
        const node = hits[0].object.userData.node;
        if (st.onClick) st.onClick(node);
      }
    };

    dom.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    dom.addEventListener('wheel', onWheel, { passive: false });
    dom.addEventListener('click', onClickInner);

    // ─── animate loop ─────────────────────────────────────────────────────
    let running = true;
    const tick = () => {
      if (!running) return;
      const st = stateRef.current;
      st.time += 0.016;
      const motion = st.motionIntensity;

      // Auto-spin (suspended while a search focus is active)
      if (st.autoSpin && !st.cameraFocus) {
        st.camTheta += 0.0008 * motion;
      }

      // Camera focus — one-shot fly-to: ease toward target, then release control
      if (st.cameraFocus) {
        const f = st.cameraFocus;
        // Unwrap theta on first frame so we take the short path
        if (!f._initialized) {
          let dth = f.theta - st.camTheta;
          while (dth >  Math.PI) dth -= 2 * Math.PI;
          while (dth < -Math.PI) dth += 2 * Math.PI;
          f._unwrappedTheta = st.camTheta + dth;
          f._initialized = true;
        }
        const k = 0.05;
        st.camTarget.lerp(f.target, k);
        st.camTheta += (f._unwrappedTheta - st.camTheta) * k;
        st.camPhi   += (f.phi      - st.camPhi  ) * k;
        st.camDistance += (f.distance - st.camDistance) * k;

        // Release focus once we've effectively arrived — user is now free to
        // drag/zoom from here without the focus snapping them back.
        const targDist = st.camTarget.distanceTo(f.target);
        const dTheta = Math.abs(f._unwrappedTheta - st.camTheta);
        const dPhi   = Math.abs(f.phi - st.camPhi);
        const dDist  = Math.abs(f.distance - st.camDistance);
        if (targDist < 1.2 && dTheta < 0.02 && dPhi < 0.02 && dDist < 1.2) {
          st.cameraFocus = null;
        }
      }

      // Camera orbit
      const cx = st.camDistance * Math.sin(st.camPhi) * Math.cos(st.camTheta);
      const cy = st.camDistance * Math.cos(st.camPhi);
      const cz = st.camDistance * Math.sin(st.camPhi) * Math.sin(st.camTheta);
      st.camera.position.set(cx, cy, cz);
      st.camera.lookAt(st.camTarget);
      if (st.onCameraChange) st.onCameraChange(st.camera.position);

      // Star field — subtle drift (rotate the points group)
      st.starField.rotation.y += 0.0002 * motion;
      st.starField.rotation.x += 0.0001 * motion;
      st.starMat.opacity = 0.3 + 0.45 * st.starDensity;

      // Subtle drift on distant cosmic backdrop
      st.distantCloudGroup.rotation.y += 0.00005 * motion;
      st.galaxyGroup.rotation.y += 0.00012 * motion;
      // Galaxy spin (sprite rotation)
      st.galaxyGroup.children.forEach((s, i) => {
        s.material.rotation += 0.0015 * motion * (i % 2 ? 1 : -1);
      });

      // Pulsars — slow blink + tiny scale breathing
      st.pulsarGroup.children.forEach(s => {
        const ud = s.userData;
        const v = 0.5 + 0.5 * Math.sin(st.time * ud.freq + ud.phase);
        // Sharpen the blink so it reads as a pulse, not a sine
        const pulse = Math.pow(v, 3);
        s.material.opacity = (0.18 + 0.7 * pulse) * (0.4 + 0.6 * st.starDensity);
        s.scale.setScalar(ud.baseScale * (0.9 + 0.25 * pulse));
      });

      // Comet — orbit slowly through the deep field, tail trails behind
      {
        const T = st.time * 0.04 * (motion || 0.0001);
        const r = 520, rZ = -560;
        const px = Math.cos(T) * r;
        const py = 80 + Math.sin(T * 0.7) * 60;
        const pz = rZ + Math.sin(T) * 80;
        st.cometGroup.position.set(px, py, pz);
        // Tangent direction → tail rotation (so it streams behind motion)
        const dx = -Math.sin(T) * r;
        const dz = Math.cos(T) * 80;
        const ang = Math.atan2(dz, dx);
        st.cometTailMat.rotation = ang;
        // Brighten head subtly
        st.cometHeadMat.opacity = 0.7 + 0.15 * Math.sin(st.time * 1.6);
      }

      // Shooting stars — randomly trigger short streaks
      st.shooters.forEach(sh => {
        if (!sh.active) {
          sh.cooldown -= 0.016 * (motion || 0.0001);
          if (sh.cooldown <= 0) {
            // Spawn at a random distant point, choose a direction along screen
            const r = 320 + Math.random() * 160;
            const theta = Math.random() * Math.PI * 2;
            const phi = (Math.random() - 0.5) * Math.PI * 0.8;
            sh.from.set(
              r * Math.cos(phi) * Math.cos(theta),
              r * Math.sin(phi),
              r * Math.cos(phi) * Math.sin(theta) - 200
            );
            // Direction: a perpendicular-ish tangent so it streaks across the field
            sh.dir.set(
              -Math.sin(theta) + (Math.random() - 0.5) * 0.4,
              (Math.random() - 0.5) * 0.6,
              Math.cos(theta) + (Math.random() - 0.5) * 0.4
            ).normalize();
            sh.len = 60 + Math.random() * 80;
            sh.dur = 0.6 + Math.random() * 0.4;
            sh.t = 0;
            sh.active = true;
          }
        } else {
          sh.t += 0.016;
          const k = sh.t / sh.dur;
          if (k >= 1) {
            sh.active = false;
            sh.mat.opacity = 0;
            sh.cooldown = 3 + Math.random() * 7;
            return;
          }
          // Update line positions: head leads, tail follows the streak length
          const head = sh.from.clone().addScaledVector(sh.dir, k * sh.len * 1.2);
          const tail = head.clone().addScaledVector(sh.dir, -sh.len * (0.4 + 0.6 * (1 - k)));
          const pos = sh.line.geometry.attributes.position;
          pos.setXYZ(0, tail.x, tail.y, tail.z);
          pos.setXYZ(1, head.x, head.y, head.z);
          pos.needsUpdate = true;
          const col = sh.line.geometry.attributes.color;
          col.setXYZ(0, 0.7, 0.85, 1.0); // tail (cool)
          col.setXYZ(1, 1.0, 1.0, 1.0);  // head (white)
          col.needsUpdate = true;
          // Ease in/out the opacity
          const fade = Math.sin(Math.PI * k);
          sh.mat.opacity = 0.85 * fade;
        }
      });

      // Cluster halo breathing
      st.clusterHaloGroup.children.forEach((s, i) => {
        const baseOp = s.userData.baseOpacity || 0.35;
        s.material.opacity = baseOp * (0.85 + 0.15 * Math.sin(st.time * 0.6 + i));
      });
      // Grid opacity tracks star density a touch so it never overpowers
      const gridFade = 0.55 - 0.15 * st.starDensity;
      st.gridGroup.children.forEach(c => { c.material.opacity = gridFade; });
      st.tickGroup.children.forEach(c => { c.material.opacity = gridFade * 0.8; });

      // Hover detection
      st.raycaster.setFromCamera(st.pointer, st.camera);
      const hits = st.raycaster.intersectObjects(st.nodeMeshes.map(m => m.pickMesh));
      const hoveredNode = hits.length > 0 ? hits[0].object.userData.node : null;
      if (hoveredNode !== st.hovered) {
        st.hovered = hoveredNode;
        if (st.onHover) st.onHover(hoveredNode, st.pointerScreen || null);
        dom.style.cursor = hoveredNode ? 'pointer' : (pointerDown ? 'grabbing' : 'grab');
      }

      // Animate each node mesh: bloom on hover/select/pulse, gentle breathing
      st.nodeMeshes.forEach((nm, i) => {
        const isHover = st.hovered && st.hovered.id === nm.node.id;
        const isSelect = st.selectedId === nm.node.id;
        const isPulse = st.pulseIds.has(nm.node.id);
        const visible = i / st.nodeMeshes.length <= st.indexingProgress;
        nm.mesh.visible = visible;
        nm.glow.visible = visible;

        const breathe = 1 + 0.04 * Math.sin(st.time * 1.2 + i * 0.7) * motion;
        const baseScale = nm.node.size * breathe;
        const target = isHover || isSelect ? 1.6 : (isPulse ? 1.3 + 0.2 * Math.sin(st.time * 6) : 1.0);
        nm.scaleCur = (nm.scaleCur || 1) + (target - (nm.scaleCur || 1)) * 0.15;
        nm.mesh.scale.setScalar(baseScale * nm.scaleCur);

        // Glow halo opacity
        const glowTarget = isHover || isSelect ? 0.85 : (isPulse ? 0.65 : 0.18);
        nm.glowOpacityCur = (nm.glowOpacityCur || 0.18) + (glowTarget - (nm.glowOpacityCur || 0.18)) * 0.12;
        nm.glow.material.opacity = nm.glowOpacityCur * (visible ? 1 : 0);
        nm.glow.scale.setScalar(baseScale * nm.scaleCur * 3.2);
      });

      // Edge fade-in based on indexing progress
      if (st.edgeLine) {
        st.edgeLine.material.opacity = 0.18 * Math.max(0, (st.indexingProgress - 0.6) / 0.4);
      }

      // Reticle
      if (st.reticleTarget) {
        st.reticleCurrent.lerp(st.reticleTarget, 0.05);
        st.reticleMesh.position.copy(st.reticleCurrent);
        st.reticleMesh2.position.copy(st.reticleCurrent);
        // Always face camera
        st.reticleMesh.lookAt(st.camera.position);
        st.reticleMesh2.lookAt(st.camera.position);
        const op = 0.6 + 0.4 * Math.sin(st.time * 3);
        st.reticleMesh.material.opacity = op;
        st.reticleMesh2.material.opacity = op;
        // Drift camera target toward reticle ONLY if no focus is taking over
        if (!st.cameraFocus) {
          st.camTarget.lerp(st.reticleTarget, 0.02);
        }
      } else {
        st.reticleMesh.material.opacity *= 0.92;
        st.reticleMesh2.material.opacity *= 0.92;
        if (!st.cameraFocus) {
          st.camTarget.lerp(new THREE.Vector3(0, 0, 0), 0.02);
        }
      }

      // Selection ring — anchored to selected node, faces camera, steady
      if (st.selRingMesh) {
        const sel = st.selectedId != null ? st.nodeMeshes.find(nm => nm.node.id === st.selectedId) : null;
        if (sel) {
          const node = sel.node;
          st.selRingMesh.position.set(node.x, node.y, node.z);
          st.selRingMesh.lookAt(st.camera.position);
          // Size ring to wrap the (animated) node radius
          const baseScale = node.size * (sel.scaleCur || 1);
          st.selRingMesh.scale.setScalar(Math.max(1.1, baseScale * 1.4));
          st.selRingCurOpacity = (st.selRingCurOpacity || 0) + (0.9 - (st.selRingCurOpacity || 0)) * 0.18;
          st.selRingMesh.material.opacity = st.selRingCurOpacity;
          st.selRingMesh.visible = true;
        } else {
          st.selRingCurOpacity = (st.selRingCurOpacity || 0) * 0.85;
          st.selRingMesh.material.opacity = st.selRingCurOpacity;
          if (st.selRingCurOpacity < 0.01) st.selRingMesh.visible = false;
        }
      }

      st.renderer.render(st.scene, st.camera);
      requestAnimationFrame(tick);
    };
    tick();

    // Resize
    const onResize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      stateRef.current.camera.aspect = w / h;
      stateRef.current.camera.updateProjectionMatrix();
      stateRef.current.renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // expose camera ref
    if (cameraRef) cameraRef.current = stateRef.current;

    return () => {
      running = false;
      dom.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('wheel', onWheel);
      dom.removeEventListener('click', onClickInner);
      window.removeEventListener('resize', onResize);
      stateRef.current.renderer.dispose();
      mount.removeChild(stateRef.current.renderer.domElement);
    };
  // eslint-disable-next-line
  }, []);

  // ─── (re)build graph when it changes ────────────────────────────────────
  React.useEffect(() => {
    const st = stateRef.current;
    if (!st || !st.scene) return;
    const THREE = st.THREE;

    // Clear old
    while (st.graphGroup.children.length) {
      const c = st.graphGroup.children.pop();
      if (c.geometry) c.geometry.dispose();
      if (c.material) {
        if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
        else c.material.dispose();
      }
    }
    st.nodeMeshes = [];

    if (!graph) return;

    // ── Cluster halos: tinted nebula behind each cluster ──────────────────
    // Clusters whose files share the same mime get a stronger gradient halo
    // so visually-uniform groups read as distinct "regions of space."
    while (st.clusterHaloGroup.children.length) {
      const c = st.clusterHaloGroup.children.pop();
      if (c.material) c.material.dispose();
    }
    // Reuse the cloud texture if available, otherwise build a fresh one.
    const haloCloudCanvas = document.createElement('canvas');
    haloCloudCanvas.width = haloCloudCanvas.height = 256;
    const hcctx = haloCloudCanvas.getContext('2d');
    const hcgrad = hcctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    hcgrad.addColorStop(0,   'rgba(255,255,255,0.7)');
    hcgrad.addColorStop(0.5, 'rgba(255,255,255,0.18)');
    hcgrad.addColorStop(1,   'rgba(255,255,255,0)');
    hcctx.fillStyle = hcgrad;
    hcctx.fillRect(0, 0, 256, 256);
    const haloCloudTex = new THREE.CanvasTexture(haloCloudCanvas);

    // Gather per-cluster centroids + dominant mime + uniformity score
    const byCluster = new Map();
    graph.nodes.forEach(n => {
      const arr = byCluster.get(n.cluster) || { nodes: [], mimes: {} };
      arr.nodes.push(n);
      arr.mimes[n.mime] = (arr.mimes[n.mime] || 0) + 1;
      byCluster.set(n.cluster, arr);
    });
    byCluster.forEach((info) => {
      if (info.nodes.length < 4) return;
      const cx = info.nodes.reduce((s, n) => s + n.x, 0) / info.nodes.length;
      const cy = info.nodes.reduce((s, n) => s + n.y, 0) / info.nodes.length;
      const cz = info.nodes.reduce((s, n) => s + n.z, 0) / info.nodes.length;
      // Dominant mime + uniformity (how much the cluster is one type)
      const mimeEntries = Object.entries(info.mimes).sort((a,b) => b[1]-a[1]);
      const dominant = mimeEntries[0][0];
      const uniformity = mimeEntries[0][1] / info.nodes.length; // 0..1
      const colorHex = window.MIME_COLORS[dominant] || '#ffffff';
      // Halo radius: cluster spread + size proxy
      const spread = Math.sqrt(
        info.nodes.reduce((s, n) =>
          s + (n.x - cx) ** 2 + (n.y - cy) ** 2 + (n.z - cz) ** 2, 0
        ) / info.nodes.length
      );
      const radius = Math.max(22, spread * 2.2 + info.nodes.length * 0.6);
      // Bigger, brighter halo for more uniform clusters (≥0.7)
      const baseOp = 0.22 + 0.35 * Math.max(0, uniformity - 0.35);
      const m = new THREE.SpriteMaterial({
        map: haloCloudTex,
        color: colorHex,
        transparent: true,
        opacity: baseOp,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const s = new THREE.Sprite(m);
      s.position.set(cx, cy, cz);
      s.scale.setScalar(radius);
      s.userData.baseOpacity = baseOp;
      st.clusterHaloGroup.add(s);

      // Inner brighter core for very uniform clusters — gives them a true
      // "nebula gradient" look (bright core fading into the halo)
      if (uniformity >= 0.7) {
        const m2 = new THREE.SpriteMaterial({
          map: haloCloudTex,
          color: colorHex,
          transparent: true,
          opacity: baseOp * 0.9,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const s2 = new THREE.Sprite(m2);
        s2.position.set(cx, cy, cz);
        s2.scale.setScalar(radius * 0.55);
        s2.userData.baseOpacity = baseOp * 0.9;
        st.clusterHaloGroup.add(s2);
      }
    });

    // Glow halo sprite — draw a radial gradient in canvas
    const haloCanvas = document.createElement('canvas');
    haloCanvas.width = haloCanvas.height = 128;
    const hctx = haloCanvas.getContext('2d');
    const grad = hctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, 'rgba(255,255,255,0.6)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    hctx.fillStyle = grad;
    hctx.fillRect(0, 0, 128, 128);
    const haloTex = new THREE.CanvasTexture(haloCanvas);

    const sphereGeom = new THREE.SphereGeometry(1, 16, 12);

    graph.nodes.forEach((node) => {
      const colorHex = window.MIME_COLORS[node.mime] || '#ffffff';
      const color = new THREE.Color(colorHex);

      // Core node
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 });
      const mesh = new THREE.Mesh(sphereGeom, mat);
      mesh.position.set(node.x, node.y, node.z);
      mesh.scale.setScalar(node.size);
      mesh.userData.node = node;
      st.graphGroup.add(mesh);

      // Glow halo (sprite)
      const glowMat = new THREE.SpriteMaterial({
        map: haloTex,
        color,
        transparent: true,
        opacity: 0.18,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const glow = new THREE.Sprite(glowMat);
      glow.position.set(node.x, node.y, node.z);
      glow.scale.setScalar(node.size * 3.2);
      st.graphGroup.add(glow);

      // Pick mesh — slightly larger, invisible, for raycasting
      const pickMat = new THREE.MeshBasicMaterial({ visible: false });
      const pickMesh = new THREE.Mesh(sphereGeom, pickMat);
      pickMesh.position.set(node.x, node.y, node.z);
      pickMesh.scale.setScalar(Math.max(node.size * 1.8, 1.5));
      pickMesh.userData.node = node;
      st.graphGroup.add(pickMesh);

      st.nodeMeshes.push({ mesh, glow, pickMesh, node });
    });

    // Edges — single LineSegments with vertex colors
    const edgePositions = new Float32Array(graph.edges.length * 6);
    const edgeColors = new Float32Array(graph.edges.length * 6);
    graph.edges.forEach((e, i) => {
      const a = graph.nodes[e.a], b = graph.nodes[e.b];
      edgePositions[i*6  ] = a.x; edgePositions[i*6+1] = a.y; edgePositions[i*6+2] = a.z;
      edgePositions[i*6+3] = b.x; edgePositions[i*6+4] = b.y; edgePositions[i*6+5] = b.z;
      const cA = new THREE.Color(window.MIME_COLORS[a.mime] || '#ffffff');
      const cB = new THREE.Color(window.MIME_COLORS[b.mime] || '#ffffff');
      const sim = e.similarity;
      edgeColors[i*6  ] = cA.r * sim; edgeColors[i*6+1] = cA.g * sim; edgeColors[i*6+2] = cA.b * sim;
      edgeColors[i*6+3] = cB.r * sim; edgeColors[i*6+4] = cB.g * sim; edgeColors[i*6+5] = cB.b * sim;
    });
    const edgeGeom = new THREE.BufferGeometry();
    edgeGeom.setAttribute('position', new THREE.BufferAttribute(edgePositions, 3));
    edgeGeom.setAttribute('color', new THREE.BufferAttribute(edgeColors, 3));
    const edgeMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const edgeLine = new THREE.LineSegments(edgeGeom, edgeMat);
    st.graphGroup.add(edgeLine);
    st.edgeLine = edgeLine;
  }, [graph]);

  // ─── push live props into the animator ──────────────────────────────────
  React.useEffect(() => {
    const st = stateRef.current;
    if (!st) return;
    st.starDensity = starFieldDensity;
    st.motionIntensity = motionIntensity;
    st.indexingProgress = indexingProgress;
    st.pulseIds = pulseIds || new Set();
    st.selectedId = selectedId;
    st.onHover = onHover;
    st.onClick = onClick;
    st.onCameraChange = onCameraChange;
    if (reticle) {
      st.reticleTarget = new st.THREE.Vector3(reticle.x, reticle.y, reticle.z);
    } else {
      st.reticleTarget = null;
    }
    if (cameraFocus) {
      st.cameraFocus = {
        target: new st.THREE.Vector3(cameraFocus.target.x, cameraFocus.target.y, cameraFocus.target.z),
        theta: cameraFocus.theta,
        phi: cameraFocus.phi,
        distance: cameraFocus.distance,
        // unwrap theta to nearest equivalent angle to avoid spinning the long way
        _initialized: false,
      };
      st.autoSpin = false;  // pause auto-spin once we've taken control
    } else {
      st.cameraFocus = null;
    }
  }, [starFieldDensity, motionIntensity, indexingProgress, pulseIds, selectedId, onHover, onClick, onCameraChange, reticle, cameraFocus]);

  return <div ref={mountRef} style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }} />;
};

window.Constellation = Constellation;
