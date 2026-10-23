/* CYBERHOOD — hero 3D: a Hunter holds a tablet that projects a holographic ring of Genesis NFTs.
   Needs THREE (r147), THREE.GLTFLoader, THREE.SkeletonUtils and MeshoptDecoder as globals.
   CHHolo.start(canvas, { model, idle, atlas, items, onPick, onReady, focusX }) -> { setItems, dispose } */
(function () {
  'use strict';
  const T = window.THREE;
  const RARITY = { Common: '#9aa3b5', Rare: '#3fa9ff', Epic: '#b45cff', Legendary: '#ffb800', Mythic: '#ff2a6d' };
  const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function loadGlb(url) {
    return fetch(url).then((r) => {
      if (!r.ok) throw new Error('model ' + r.status);
      return r.arrayBuffer();
    }).then((buf) => new Promise((res, rej) => {
      const l = new T.GLTFLoader();
      if (window.MeshoptDecoder) l.setMeshoptDecoder(window.MeshoptDecoder);
      l.parse(buf, '', res, rej);
    }));
  }

  /** Card texture: pixel sprite from the atlas over a rarity glow, name and price below */
  function cardTexture(atlas, it, i) {
    const W = 256, H = 352;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    const col = RARITY[it.rarity] || '#05f0ff';
    g.fillStyle = 'rgba(6,4,20,0.82)';
    g.fillRect(0, 0, W, H);
    const grd = g.createRadialGradient(W / 2, 230, 10, W / 2, 230, 200);
    grd.addColorStop(0, col + 'aa'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, W, 260);
    g.imageSmoothingEnabled = false;
    if (atlas) { const cs = atlas.width / 6; g.drawImage(atlas, (i % 6) * cs, Math.floor(i / 6) * cs, cs, cs, 32, 24, 192, 192); }
    g.strokeStyle = col; g.lineWidth = 4; g.strokeRect(4, 4, W - 8, H - 8);
    g.fillStyle = col; g.fillRect(4, 4, 70, 20);
    g.fillStyle = '#05020c'; g.font = '700 13px "JetBrains Mono", monospace'; g.textBaseline = 'middle';
    g.fillText(it.rarity.toUpperCase().slice(0, 8), 10, 14);
    g.fillStyle = '#ffffff'; g.font = '700 22px "Chakra Petch", sans-serif';
    g.fillText(it.name, 16, 252, W - 32);
    g.fillStyle = col; g.font = '700 26px "Chakra Petch", sans-serif';
    g.fillText(it.price.toFixed(2) + ' ETH', 16, 292);
    g.fillStyle = 'rgba(255,255,255,.55)'; g.font = '500 13px "JetBrains Mono", monospace';
    g.fillText('#' + String(i + 1).padStart(4, '0') + ' · GENESIS', 16, 326);
    const t = new T.CanvasTexture(c);
    t.encoding = T.sRGBEncoding;
    t.anisotropy = 4;
    return t;
  }

  /** Dashed ring texture for the projector rings */
  function ringTexture(segments, color) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 16;
    const g = c.getContext('2d');
    for (let i = 0; i < segments; i++) {
      const x = (i / segments) * 512;
      g.fillStyle = color;
      g.globalAlpha = i % 5 === 0 ? 1 : 0.55;
      g.fillRect(x, 0, (512 / segments) * (i % 3 === 0 ? 0.8 : 0.45), 16);
    }
    const t = new T.CanvasTexture(c);
    t.wrapS = T.RepeatWrapping;
    return t;
  }

  const beamMat = () => new T.ShaderMaterial({
    transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
    uniforms: { time: { value: 0 }, color: { value: new T.Color('#2ee9ff') } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform float time; uniform vec3 color; varying vec2 vUv;' +
      'void main(){ float fade = smoothstep(0.0,0.15,vUv.y) * (1.0 - vUv.y);' +
      ' float scan = 0.55 + 0.45 * sin(vUv.y * 60.0 - time * 6.0);' +
      ' float stripes = 0.6 + 0.4 * step(0.5, fract(vUv.x * 24.0 + time * 0.2));' +
      ' gl_FragColor = vec4(color * scan * stripes, fade * 0.26); }',
  });

  function start(canvas, opts) {
    const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setClearColor(0x000000, 0);
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(30, 1, 0.1, 60);
    const look = new T.Vector3(0, 1.12, 0);

    scene.add(new T.HemisphereLight(0x9a7dff, 0x0a0420, 0.9));
    const key = new T.DirectionalLight(0xffe2f4, 1.6); key.position.set(-2.5, 3.5, 3); scene.add(key);
    const rimC = new T.DirectionalLight(0x22e6ff, 2.6); rimC.position.set(2.8, 2.2, -2.5); scene.add(rimC);
    const rimM = new T.DirectionalLight(0xff2a8a, 2.2); rimM.position.set(-3, 1.4, -2.2); scene.add(rimM);
    const holoLight = new T.PointLight(0x37e8ff, 2.4, 3.2, 1.6); scene.add(holoLight);

    const root = new T.Group(); scene.add(root);

    // Floor: neon rings + soft disc under the Hunter
    const floor = new T.Group(); root.add(floor);
    const disc = new T.Mesh(new T.CircleGeometry(1.6, 64), new T.MeshBasicMaterial({ color: 0x120a2e, transparent: true, opacity: 0.55, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2; floor.add(disc);
    [[1.05, 1.1, 0xff2a8a, 0.9], [1.45, 1.47, 0x22e6ff, 0.6], [0.55, 0.57, 0x22e6ff, 0.5]].forEach(([a, b, c, o]) => {
      const m = new T.Mesh(new T.RingGeometry(a, b, 96), new T.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: T.AdditiveBlending, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.y = 0.005; floor.add(m);
    });

    // Tablet + hologram
    const tablet = new T.Group(); root.add(tablet);
    const body = new T.Mesh(new T.BoxGeometry(0.34, 0.016, 0.23), new T.MeshStandardMaterial({ color: 0x15131f, metalness: 0.8, roughness: 0.35 }));
    tablet.add(body);
    const scrC = document.createElement('canvas'); scrC.width = 256; scrC.height = 170;
    const scrT = new T.CanvasTexture(scrC); scrT.encoding = T.sRGBEncoding;
    const screen = new T.Mesh(new T.PlaneGeometry(0.31, 0.2), new T.MeshBasicMaterial({ map: scrT, toneMapped: false }));
    screen.rotation.x = -Math.PI / 2; screen.position.y = 0.0095; tablet.add(screen);
    function drawScreen(t) {
      const g = scrC.getContext('2d');
      g.fillStyle = '#04121e'; g.fillRect(0, 0, 256, 170);
      g.strokeStyle = '#22e6ff'; g.lineWidth = 2;
      for (let r = 0; r < 4; r++) { g.beginPath(); g.arc(128, 85, 18 + r * 16 + ((t * 30) % 16), 0, Math.PI * 2); g.globalAlpha = 0.8 - r * 0.18; g.stroke(); }
      g.globalAlpha = 1; g.fillStyle = '#ff2a8a'; g.font = '700 16px "Chakra Petch", sans-serif'; g.fillText('GENESIS', 10, 22);
      g.fillStyle = '#7dffb0'; g.font = '600 12px "JetBrains Mono", monospace'; g.fillText('● PROJECTING', 150, 22);
      scrT.needsUpdate = true;
    }
    drawScreen(0);

    const holo = new T.Group(); root.add(holo);
    const HOLO_R = 0.78, HOLO_H = 0.56;
    const beam = new T.Mesh(new T.CylinderGeometry(HOLO_R, 0.14, HOLO_H, 64, 1, true), beamMat());
    beam.position.y = HOLO_H / 2; holo.add(beam);
    const rings = [];
    [[0.0, 0.16, 0.2, '#22e6ff', 32], [HOLO_H * 0.55, HOLO_R * 0.62, HOLO_R * 0.64, '#ff2a8a', 48], [HOLO_H, HOLO_R, HOLO_R + 0.025, '#22e6ff', 64]].forEach(([y, a, b, c, seg]) => {
      const tex = ringTexture(seg, c);
      const m = new T.Mesh(new T.RingGeometry(a, b, 128, 1), new T.MeshBasicMaterial({ map: tex, transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, toneMapped: false }));
      m.rotation.x = -Math.PI / 2; m.position.y = y; holo.add(m); rings.push(m);
    });
    // rising particles inside the beam
    const PN = REDUCE ? 40 : 140;
    const pGeo = new T.BufferGeometry();
    const pPos = new Float32Array(PN * 3), pSeed = new Float32Array(PN);
    for (let i = 0; i < PN; i++) { pSeed[i] = Math.random(); }
    pGeo.setAttribute('position', new T.BufferAttribute(pPos, 3));
    const pts = new T.Points(pGeo, new T.PointsMaterial({ color: 0x8ff6ff, size: 0.018, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false }));
    holo.add(pts);

    // NFT cards orbiting on the top ring
    const cards = new T.Group(); holo.add(cards);
    let cardMeshes = [];
    let atlasImg = null;
    function buildCards(items) {
      cardMeshes.forEach((m) => { m.material.map.dispose(); m.material.dispose(); m.geometry.dispose(); cards.remove(m); });
      cardMeshes = [];
      const n = Math.min(items.length, 8);
      for (let k = 0; k < n; k++) {
        const it = items[k];
        const mat = new T.MeshBasicMaterial({ map: cardTexture(atlasImg, it, it.i ?? k), transparent: true, opacity: 0.95, side: T.DoubleSide, toneMapped: false, depthWrite: false });
        const m = new T.Mesh(new T.PlaneGeometry(0.3, 0.41), mat);
        m.userData = { a: (k / n) * Math.PI * 2, item: it };
        cards.add(m); cardMeshes.push(m);
      }
    }

    // Hunter
    let model = null, mixer = null, bones = {};
    const tmp = { a: new T.Vector3(), b: new T.Vector3(), q: new T.Quaternion(), q2: new T.Quaternion(), d1: new T.Vector3(), d2: new T.Vector3() };
    /** Two-bone aim: turn `bone` so its child points at `target` (world space) */
    function aim(bone, child, target, weight) {
      bone.getWorldPosition(tmp.a); child.getWorldPosition(tmp.b);
      tmp.d1.subVectors(tmp.b, tmp.a).normalize();
      tmp.d2.subVectors(target, tmp.a).normalize();
      tmp.q.setFromUnitVectors(tmp.d1, tmp.d2);
      if (weight < 1) tmp.q.slerp(new T.Quaternion(), 1 - weight);
      bone.getWorldQuaternion(tmp.q2);
      tmp.q2.premultiply(tmp.q);
      const pq = new T.Quaternion(); bone.parent.getWorldQuaternion(pq);
      bone.quaternion.copy(pq.invert().multiply(tmp.q2));
      bone.updateMatrixWorld(true);
    }
    const L = (x, y, z) => new T.Vector3(x, y, z);
    // Targets in the Hunter's space (feet at origin, facing +z, 1.75 m tall)
    const TGT = { lElbow: L(0.25, 1.06, 0.12), lHand: L(0.15, 1.06, 0.36), rElbow: L(-0.25, 1.06, 0.12), rHand: L(-0.15, 1.06, 0.36), tablet: L(0, 1.07, 0.38) };

    Promise.all([loadGlb(opts.model), opts.idle ? loadGlb(opts.idle) : null, new Promise((res) => {
      if (!opts.atlas) return res(null);
      const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = opts.atlas;
    })]).then(([g, idle, atlas]) => {
      atlasImg = atlas;
      buildCards(opts.items || []);
      model = T.SkeletonUtils ? T.SkeletonUtils.clone(g.scene) : g.scene;
      // Size from the skeleton (mesh bounds of quantized skinned meshes are unreliable): head-to-feet ≈ 89% of height
      model.updateMatrixWorld(true);
      let minY = Infinity, headY = -Infinity;
      const wv = new T.Vector3();
      model.traverse((o) => { if (o.isBone) { o.getWorldPosition(wv); minY = Math.min(minY, wv.y); if (/Head/.test(o.name)) headY = Math.max(headY, wv.y); } });
      const hgt = headY > minY ? (headY - minY) / 0.89 : 1.75;
      const s = 1.75 / hgt;
      model.scale.setScalar(s);
      model.position.y = -minY * s + 0.02;
      model.traverse((o) => {
        if (o.isBone) bones[o.name] = o;
        if (o.isMesh) { o.frustumCulled = false; if (o.material && o.material.map) { o.material.emissiveMap = o.material.map; o.material.emissive = new T.Color(0xffffff); o.material.emissiveIntensity = 0.12; } }
      });
      root.add(model);
      mixer = new T.AnimationMixer(model);
      const clip = (idle && idle.animations[0]) || g.animations[0];
      if (clip) {
        clip.tracks = clip.tracks.filter((t) => !/(Hips|mixamorig:Hips)\.position/.test(t.name));
        mixer.clipAction(clip).play();
      }
      if (opts.onReady) opts.onReady();
    }).catch((e) => { console.warn('holo hero:', e); if (opts.onError) opts.onError(e); });

    // Layout: keep the Hunter at focusX of the canvas width (0..1)
    let W = 0, H = 0;
    function resize() {
      const r = canvas.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, W < 700 ? 1.5 : 1.75));
      renderer.setSize(W, H, false);
      camera.aspect = W / H;
      const narrow = W / H < 1;
      camera.fov = narrow ? 36 : 31;
      const fx = narrow ? 0.5 : (opts.focusX ?? 0.66);
      camera.position.set(0, 1.3, narrow ? 5.6 : 4.9);
      camera.updateProjectionMatrix();
      // shift the Hunter sideways by moving the view window
      camera.setViewOffset(W, H, (0.5 - fx) * W, 0, W, H);
    }
    resize();
    const ro = new ResizeObserver(resize); ro.observe(canvas);

    // Pointer parallax + picking
    const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
    const ray = new T.Raycaster(), nd = new T.Vector2();
    const onMove = (e) => {
      const r = canvas.getBoundingClientRect();
      ptr.tx = ((e.clientX - r.left) / r.width - 0.5) * 2; ptr.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      nd.set(ptr.tx, -ptr.ty); ray.setFromCamera(nd, camera);
      canvas.style.cursor = ray.intersectObjects(cardMeshes).length ? 'pointer' : '';
    };
    const onClick = (e) => {
      const r = canvas.getBoundingClientRect();
      nd.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(nd, camera);
      const hit = ray.intersectObjects(cardMeshes)[0];
      if (hit && opts.onPick) opts.onPick(hit.object.userData.item);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    canvas.addEventListener('click', onClick);

    let running = true, visible = true, last = performance.now(), t = 0, spin = 0;
    const io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible && running) requestAnimationFrame(loop); });
    io.observe(canvas);
    const wTablet = new T.Vector3(), wp = new T.Vector3();

    function loop(now) {
      if (!running || !visible) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      ptr.x += (ptr.tx - ptr.x) * 0.05; ptr.y += (ptr.ty - ptr.y) * 0.05;
      root.rotation.y = -0.32 + ptr.x * 0.18;
      camera.position.y = 1.3 - ptr.y * 0.12;
      camera.lookAt(look);
      if (mixer) mixer.update(dt);
      if (model) {
        model.updateMatrixWorld(true);
        const b = bones;
        const toW = (v) => model.parent.localToWorld(v.clone());
        if (b.LeftArm && b.LeftForeArm && b.LeftHand) { aim(b.LeftArm, b.LeftForeArm, toW(TGT.lElbow), 1); aim(b.LeftForeArm, b.LeftHand, toW(TGT.lHand), 1); }
        if (b.RightArm && b.RightForeArm && b.RightHand) { aim(b.RightArm, b.RightForeArm, toW(TGT.rElbow), 1); aim(b.RightForeArm, b.RightHand, toW(TGT.rHand), 1); }
        if (b.Head) { b.Head.rotation.x += 0.28; b.Head.updateMatrixWorld(true); }
      }
      // Tablet floats a little in the hands; hologram stands on it
      tablet.position.copy(TGT.tablet); tablet.position.y += Math.sin(t * 1.6) * 0.004;
      tablet.rotation.set(-0.42, 0, 0);
      tablet.getWorldPosition(wTablet);
      holo.position.copy(TGT.tablet); holo.position.y += 0.03;
      holoLight.position.copy(wTablet).add(wp.set(0, 0.35, 0.2));
      holoLight.intensity = 2.2 + Math.sin(t * 9) * 0.25;
      beam.material.uniforms.time.value = t;
      rings[0].rotation.z = t * 1.4; rings[1].rotation.z = -t * 0.6; rings[2].rotation.z = t * 0.35;
      spin += dt * (REDUCE ? 0.08 : 0.32);
      const n = cardMeshes.length;
      for (let k = 0; k < n; k++) {
        const m = cardMeshes[k];
        const a = m.userData.a + spin;
        m.position.set(Math.sin(a) * HOLO_R * 0.98, HOLO_H + 0.26 + Math.sin(t * 1.3 + k) * 0.03, Math.cos(a) * HOLO_R * 0.98);
        m.lookAt(camera.position.x, m.getWorldPosition(wp).y, camera.position.z);
        const front = Math.cos(a) * 0.5 + 0.5;
        m.material.opacity = 0.35 + front * 0.62 + (Math.random() < 0.01 ? -0.3 : 0);
        m.scale.setScalar(0.82 + front * 0.28);
      }
      const P = pGeo.attributes.position.array;
      for (let i = 0; i < PN; i++) {
        const s = pSeed[i], h = (s * 7.3 + t * (0.12 + s * 0.2)) % 1;
        const ang = s * 91.7 + t * 0.4, rad = 0.12 + h * HOLO_R * 0.9 * (0.4 + (s * 13.1 % 1) * 0.6);
        P[i * 3] = Math.cos(ang) * rad; P[i * 3 + 1] = h * HOLO_H; P[i * 3 + 2] = Math.sin(ang) * rad;
      }
      pGeo.attributes.position.needsUpdate = true;
      if (Math.floor(t * 10) % 3 === 0) drawScreen(t);
      renderer.render(scene, camera);
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    return {
      setItems(items) { buildCards(items); },
      dispose() {
        running = false; ro.disconnect(); io.disconnect();
        window.removeEventListener('pointermove', onMove); canvas.removeEventListener('click', onClick);
        renderer.dispose();
      },
    };
  }

  window.CHHolo = { start };
})();
