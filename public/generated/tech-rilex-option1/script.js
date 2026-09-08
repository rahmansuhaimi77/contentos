import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js";

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
if (gsap && ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

function roundedRectShape(width, height, radius) {
  const x = -width / 2;
  const y = -height / 2;
  const s = new THREE.Shape();
  s.moveTo(x + radius, y);
  s.lineTo(x + width - radius, y);
  s.quadraticCurveTo(x + width, y, x + width, y + radius);
  s.lineTo(x + width, y + height - radius);
  s.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  s.lineTo(x + radius, y + height);
  s.quadraticCurveTo(x, y + height, x, y + height - radius);
  s.lineTo(x, y + radius);
  s.quadraticCurveTo(x, y, x + radius, y);
  return s;
}

function phoneGeometry() {
  const geo = new THREE.ExtrudeGeometry(roundedRectShape(2.12, 4.45, .3), {
    depth: .26,
    bevelEnabled: true,
    bevelSegments: 5,
    steps: 1,
    bevelSize: .07,
    bevelThickness: .055,
    curveSegments: 24,
  });
  geo.center();
  return geo;
}

function screenGeometry() {
  return new THREE.ShapeGeometry(roundedRectShape(1.92, 4.13, .23), 28);
}

function makePhone(initialColor = '#202428') {
  const root = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(initialColor),
    metalness: .82,
    roughness: .27,
  });
  const edge = new THREE.Mesh(phoneGeometry(), bodyMaterial);
  root.add(edge);

  const screen = new THREE.Mesh(
    screenGeometry(),
    new THREE.MeshPhysicalMaterial({
      color: 0x070807,
      metalness: .05,
      roughness: .18,
      clearcoat: 1,
      clearcoatRoughness: .12,
    }),
  );
  screen.position.z = .205;
  root.add(screen);

  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.63, 2.85),
    new THREE.MeshBasicMaterial({ color: 0xd7ff63, transparent: true, opacity: .88 }),
  );
  glow.position.set(0, -.12, .214);
  root.add(glow);

  const upper = new THREE.Mesh(
    new THREE.PlaneGeometry(1.64, 1.02),
    new THREE.MeshBasicMaterial({ color: 0x101310 }),
  );
  upper.position.set(0, 1.08, .216);
  root.add(upper);

  const speaker = new THREE.Mesh(
    new THREE.PlaneGeometry(.55, .08),
    new THREE.MeshBasicMaterial({ color: 0x000000 }),
  );
  speaker.position.set(0, 1.83, .219);
  root.add(speaker);

  const islandMaterial = new THREE.MeshStandardMaterial({ color: 0x1b1e1c, metalness: .65, roughness: .3 });
  const island = new THREE.Mesh(new THREE.BoxGeometry(.98, 1.12, .11), islandMaterial);
  island.position.set(-.48, .95, -.23);
  root.add(island);

  const lensMaterial = new THREE.MeshPhysicalMaterial({ color: 0x0a0d0c, metalness: .65, roughness: .12, clearcoat: 1 });
  [[-.66,1.15],[-.3,1.15],[-.48,.77]].forEach(([x,y]) => {
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(.16,.16,.1,32), lensMaterial);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(x, y, -.33);
    root.add(lens);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.16,.035,12,32), new THREE.MeshStandardMaterial({color:0x7f8783,metalness:.9,roughness:.2}));
    ring.position.set(x,y,-.39);
    root.add(ring);
  });

  const sideButton = new THREE.Mesh(new THREE.BoxGeometry(.05,.55,.08), bodyMaterial);
  sideButton.position.set(1.13,.56,.01);
  root.add(sideButton);
  const volume = new THREE.Mesh(new THREE.BoxGeometry(.05,.8,.08), bodyMaterial);
  volume.position.set(-1.13,.45,.01);
  root.add(volume);

  root.userData.bodyMaterial = bodyMaterial;
  return root;
}

function makeScene(canvas, { viewer = false } = {}) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(viewer ? 30 : 32, 1, .1, 100);
  camera.position.set(0, 0, viewer ? 9 : 10.2);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x111614, 2.2));
  const key = new THREE.DirectionalLight(0xffffff, 5.5); key.position.set(5,5,7); scene.add(key);
  const rim = new THREE.DirectionalLight(0xd7ff63, 3.8); rim.position.set(-5,1,-5); scene.add(rim);
  const fill = new THREE.PointLight(0x8bb7a2, 2.5, 20); fill.position.set(0,-4,4); scene.add(fill);

  const phone = makePhone();
  phone.rotation.set(viewer ? .12 : -.05, viewer ? -.5 : -.35, viewer ? -.03 : .05);
  phone.scale.setScalar(viewer ? 1.1 : 1.22);
  scene.add(phone);

  if (!viewer) {
    const phone2 = makePhone('#c5c8c5');
    phone2.rotation.set(.08,.6,-.18);
    phone2.position.set(-2.2,-.6,-1.25);
    phone2.scale.setScalar(.82);
    scene.add(phone2);
    phone.userData.secondary = phone2;
  }

  let targetX = phone.rotation.x;
  let targetY = phone.rotation.y;
  let dragging = false;
  let lastX = 0;
  const pointerMove = (e) => {
    if (viewer && dragging) {
      targetY += (e.clientX - lastX) * .009;
      lastX = e.clientX;
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / Math.max(rect.width, 1) - .5) * 2;
    const py = ((e.clientY - rect.top) / Math.max(rect.height, 1) - .5) * 2;
    targetY = (viewer ? -.15 : -.35) + px * (viewer ? .7 : .22);
    targetX = (viewer ? .08 : -.05) + py * -.12;
  };
  canvas.addEventListener('pointermove', pointerMove);
  if (viewer) {
    canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; canvas.setPointerCapture?.(e.pointerId); });
    canvas.addEventListener('pointerup', () => { dragging = false; });
    canvas.addEventListener('pointercancel', () => { dragging = false; });
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(rect.width, 1), h = Math.max(rect.height, 1);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  const observer = new ResizeObserver(resize); observer.observe(canvas);

  const clock = new THREE.Clock();
  function frame() {
    const t = clock.getElapsedTime();
    if (!reduceMotion) {
      phone.rotation.y += (targetY - phone.rotation.y) * .045;
      phone.rotation.x += (targetX - phone.rotation.x) * .04;
      phone.position.y = Math.sin(t * .7) * .055;
      if (phone.userData.secondary) phone.userData.secondary.position.y = -.6 + Math.sin(t * .6 + 1) * .04;
    }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  frame();
  return { phone, camera, renderer };
}

const heroCanvas = document.querySelector('#hero-canvas');
const viewerCanvas = document.querySelector('#viewer-canvas');
const heroScene = heroCanvas ? makeScene(heroCanvas) : null;
const viewerScene = viewerCanvas ? makeScene(viewerCanvas, { viewer: true }) : null;

for (const swatch of document.querySelectorAll('.swatch')) {
  swatch.addEventListener('click', () => {
    document.querySelectorAll('.swatch').forEach((s) => s.classList.remove('active'));
    swatch.classList.add('active');
    const color = swatch.dataset.color;
    if (viewerScene?.phone.userData.bodyMaterial && color) viewerScene.phone.userData.bodyMaterial.color.set(color);
  });
}

const nav = document.querySelector('#nav');
window.addEventListener('scroll', () => nav?.classList.toggle('scrolled', window.scrollY > 50), { passive: true });

if (gsap && ScrollTrigger && !reduceMotion) {
  gsap.from('.nav', { y: -40, opacity: 0, duration: .8, ease: 'power3.out' });
  gsap.from('.hero-kicker', { y: 20, opacity: 0, duration: .7, delay: .15 });
  gsap.from('.hero-title', { y: 55, opacity: 0, duration: 1.15, delay: .2, ease: 'power4.out' });
  gsap.from('.hero-lede', { y: 28, opacity: 0, duration: .85, delay: .45 });
  gsap.from('.hero-actions', { y: 28, opacity: 0, duration: .85, delay: .6 });
  gsap.from('.hero-product', { scale: .82, opacity: 0, duration: 1.6, delay: .3, ease: 'power3.out' });
  gsap.from('.hero-tag', { opacity: 0, scale: .8, stagger: .15, delay: 1.15, duration: .6 });

  gsap.utils.toArray('.reveal-up').forEach((el) => {
    gsap.to(el, { scrollTrigger: { trigger: el, start: 'top 86%' }, y: 0, opacity: 1, duration: .9, ease: 'power3.out' });
  });
  gsap.utils.toArray('.reveal-card').forEach((el, i) => {
    gsap.to(el, { scrollTrigger: { trigger: el, start: 'top 88%' }, y: 0, scale: 1, opacity: 1, duration: .9, delay: Math.min(i * .08, .24), ease: 'power3.out' });
  });
  gsap.utils.toArray('.reveal-scale').forEach((el) => {
    gsap.to(el, { scrollTrigger: { trigger: el, start: 'top 82%' }, scale: 1, opacity: 1, duration: 1.2, ease: 'power3.out' });
  });

  if (heroScene) {
    gsap.to(heroScene.phone.rotation, {
      y: .5,
      x: .08,
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1.2 },
    });
    gsap.to(heroScene.phone.scale, {
      x: .92, y: .92, z: .92,
      scrollTrigger: { trigger: '.hero', start: '45% top', end: 'bottom top', scrub: 1.1 },
    });
  }

  if (viewerScene) {
    gsap.fromTo(viewerScene.phone.rotation, { y: -.8, x: .18 }, {
      y: .45, x: -.02,
      scrollTrigger: { trigger: '.viewer-shell', start: 'top 82%', end: 'bottom 30%', scrub: 1.5 },
    });
    gsap.fromTo(viewerScene.phone.scale, { x: .82, y: .82, z: .82 }, {
      x: 1.15, y: 1.15, z: 1.15,
      scrollTrigger: { trigger: '.viewer-shell', start: 'top 85%', end: 'center 45%', scrub: 1.2 },
    });
  }

  gsap.utils.toArray('.story-line').forEach((line) => {
    gsap.from(line.querySelectorAll('span,h3,p'), {
      scrollTrigger: { trigger: line, start: 'top 86%' },
      y: 24, opacity: 0, stagger: .08, duration: .7, ease: 'power2.out',
    });
  });
} else {
  document.querySelectorAll('.reveal-up,.reveal-card,.reveal-scale').forEach((el) => {
    el.style.opacity = '1'; el.style.transform = 'none';
  });
}
