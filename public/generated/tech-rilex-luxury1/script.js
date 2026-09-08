import * as THREE from 'https://esm.sh/three@0.164.1';
import { OrbitControls } from 'https://esm.sh/three@0.164.1/examples/jsm/controls/OrbitControls.js';

const canvas = document.getElementById('product-canvas');
const viewerPanel = canvas.closest('.viewer-panel');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
camera.position.set(0, 0.1, 7.3);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 5.6;
controls.maxDistance = 9;
controls.minPolarAngle = Math.PI * 0.25;
controls.maxPolarAngle = Math.PI * 0.75;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.72;

scene.add(new THREE.HemisphereLight(0xffffff, 0x5d5144, 2.4));
const key = new THREE.DirectionalLight(0xffffff, 4.3);
key.position.set(4, 5, 6);
key.castShadow = true;
scene.add(key);
const rim = new THREE.DirectionalLight(0xd6b987, 2.1);
rim.position.set(-4, 1, -3);
scene.add(rim);

const phone = new THREE.Group();
scene.add(phone);

function roundedRectShape(width, height, radius) {
  const x = -width / 2;
  const y = -height / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}

const bodyMaterial = new THREE.MeshStandardMaterial({
  color: 0x22262a,
  metalness: 0.82,
  roughness: 0.28,
});

const bodyGeometry = new THREE.ExtrudeGeometry(roundedRectShape(2.8, 5.7, 0.34), {
  depth: 0.24,
  bevelEnabled: true,
  bevelThickness: 0.07,
  bevelSize: 0.07,
  bevelSegments: 7,
  curveSegments: 16,
});
bodyGeometry.center();
const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
body.castShadow = true;
body.receiveShadow = true;
phone.add(body);

function createScreenTexture() {
  const c = document.createElement('canvas');
  c.width = 720;
  c.height = 1440;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, c.width, c.height);
  g.addColorStop(0, '#d4b177');
  g.addColorStop(0.42, '#7d6a53');
  g.addColorStop(1, '#1a1f1c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = 'rgba(255,255,255,.16)';
  for (let y = 0; y < c.height; y += 90) ctx.fillRect(0, y, c.width, 1);
  ctx.fillStyle = '#f6f1e8';
  ctx.font = '700 44px Arial';
  ctx.fillText('TECH RILEX', 72, 122);
  ctx.font = '800 86px Arial';
  ctx.fillText('CHECK', 72, 1030);
  ctx.fillText('BEFORE', 72, 1122);
  ctx.fillText('YOU BUY.', 72, 1214);
  ctx.font = '600 28px Arial';
  ctx.fillText('MODEL / SPEC / CONDITION', 72, 1328);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const screen = new THREE.Mesh(
  new THREE.PlaneGeometry(2.47, 5.22),
  new THREE.MeshBasicMaterial({ map: createScreenTexture() })
);
screen.position.z = 0.195;
phone.add(screen);

const island = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.12, 0.48, 8, 16),
  new THREE.MeshStandardMaterial({ color: 0x0a0b0a, metalness: 0.1, roughness: 0.35 })
);
island.rotation.z = Math.PI / 2;
island.position.set(0, 2.23, 0.218);
phone.add(island);

const cameraPlate = new THREE.Mesh(
  new THREE.BoxGeometry(1.22, 1.34, 0.11),
  new THREE.MeshStandardMaterial({ color: 0x2c3133, metalness: 0.65, roughness: 0.25 })
);
cameraPlate.position.set(-0.64, 1.78, -0.19);
cameraPlate.rotation.y = Math.PI;
phone.add(cameraPlate);

function addLens(x, y) {
  const lens = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.09, 48),
    new THREE.MeshPhysicalMaterial({ color: 0x0d1113, metalness: 0.7, roughness: 0.08, clearcoat: 1 })
  );
  lens.rotation.x = Math.PI / 2;
  lens.position.set(x, y, -0.255);
  phone.add(lens);
  const glass = new THREE.Mesh(
    new THREE.CircleGeometry(0.13, 48),
    new THREE.MeshBasicMaterial({ color: 0x4a5960 })
  );
  glass.rotation.y = Math.PI;
  glass.position.set(x, y, -0.307);
  phone.add(glass);
}
addLens(-0.88, 2.04);
addLens(-0.42, 2.04);
addLens(-0.65, 1.56);

const sideButton = new THREE.Mesh(
  new THREE.BoxGeometry(0.08, 0.75, 0.12),
  bodyMaterial
);
sideButton.position.set(1.48, 0.8, 0);
phone.add(sideButton);

phone.rotation.set(-0.08, -0.5, -0.03);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(3.5, 64),
  new THREE.ShadowMaterial({ opacity: 0.18 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -3.2;
floor.receiveShadow = true;
scene.add(floor);

function resizeRenderer() {
  const rect = viewerPanel.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));
  if (canvas.width !== width || canvas.height !== height) {
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
}

let t = 0;
function render() {
  resizeRenderer();
  t += 0.01;
  phone.position.y = Math.sin(t * 1.2) * 0.08;
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}
render();

let userInteracting = false;
controls.addEventListener('start', () => { userInteracting = true; controls.autoRotate = false; });
controls.addEventListener('end', () => {
  window.clearTimeout(window.__trRotateTimer);
  window.__trRotateTimer = window.setTimeout(() => { if (!userInteracting) return; controls.autoRotate = true; userInteracting = false; }, 1500);
});

const finishName = document.getElementById('finish-name');
document.querySelectorAll('.swatch').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.swatch').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    finishName.textContent = button.dataset.name;
    const target = new THREE.Color(button.dataset.color);
    const start = bodyMaterial.color.clone();
    const proxy = { p: 0 };
    if (window.gsap) {
      window.gsap.to(proxy, { p: 1, duration: .55, ease: 'power2.out', onUpdate: () => bodyMaterial.color.copy(start.clone().lerp(target, proxy.p)) });
    } else {
      bodyMaterial.color.copy(target);
    }
  });
});

const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (reduceMotion) {
  document.querySelectorAll('.reveal-up,.reveal-card,.reveal-scale').forEach((el) => {
    el.style.opacity = 1;
    el.style.transform = 'none';
  });
  controls.autoRotate = false;
} else if (window.gsap && window.ScrollTrigger) {
  window.gsap.registerPlugin(window.ScrollTrigger);
  window.gsap.to('.reveal-scale', { opacity: 1, scale: 1, duration: 1.05, ease: 'power3.out', delay: .12 });
  window.gsap.to('.product-hero .reveal-up', { opacity: 1, y: 0, duration: .9, ease: 'power3.out', delay: .06 });
  document.querySelectorAll('.reveal-up').forEach((el) => {
    if (el.closest('.product-hero')) return;
    window.gsap.to(el, { opacity: 1, y: 0, duration: .8, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 86%', once: true } });
  });
  document.querySelectorAll('.reveal-card').forEach((el) => {
    window.gsap.to(el, { opacity: 1, y: 0, scale: 1, duration: .85, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 86%', once: true } });
  });
} else {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.style.opacity = 1;
      entry.target.style.transform = 'none';
      observer.unobserve(entry.target);
    });
  }, { threshold: .12 });
  document.querySelectorAll('.reveal-up,.reveal-card,.reveal-scale').forEach((el) => observer.observe(el));
}

const track = document.getElementById('gallery-track');
const slides = [...track.children];
const dots = [...document.querySelectorAll('.gallery-dots span')];
function currentSlideIndex() {
  const center = track.scrollLeft + track.clientWidth / 2;
  let best = 0;
  let distance = Infinity;
  slides.forEach((slide, index) => {
    const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
    const d = Math.abs(slideCenter - center);
    if (d < distance) { distance = d; best = index; }
  });
  return best;
}
function setDot(index) {
  dots.forEach((dot, i) => dot.classList.toggle('active', i === index));
}
function scrollGallery(delta) {
  const current = currentSlideIndex();
  const next = Math.max(0, Math.min(slides.length - 1, current + delta));
  slides[next].scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest', inline: 'center' });
  setDot(next);
}
document.querySelector('.gallery-arrow.prev')?.addEventListener('click', () => scrollGallery(-1));
document.querySelector('.gallery-arrow.next')?.addEventListener('click', () => scrollGallery(1));
let galleryScrollTimer;
track.addEventListener('scroll', () => {
  clearTimeout(galleryScrollTimer);
  galleryScrollTimer = setTimeout(() => setDot(currentSlideIndex()), 80);
}, { passive: true });

const stickyBar = document.getElementById('sticky-bar');
const hero = document.querySelector('.product-hero');
const heroObserver = new IntersectionObserver(([entry]) => {
  const show = !entry.isIntersecting && window.scrollY > hero.offsetHeight * .45;
  stickyBar.classList.toggle('visible', show);
  stickyBar.setAttribute('aria-hidden', show ? 'false' : 'true');
}, { threshold: .08 });
heroObserver.observe(hero);

const backdrop = document.getElementById('enquiry-backdrop');
const closeSheet = document.getElementById('sheet-close');
function openSheet() {
  backdrop.hidden = false;
  document.body.style.overflow = 'hidden';
  setTimeout(() => closeSheet.focus(), 0);
}
function closeEnquiry() {
  backdrop.hidden = true;
  document.body.style.overflow = '';
}
document.querySelectorAll('[data-enquire]').forEach((button) => button.addEventListener('click', openSheet));
closeSheet.addEventListener('click', closeEnquiry);
backdrop.addEventListener('click', (event) => { if (event.target === backdrop) closeEnquiry(); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !backdrop.hidden) closeEnquiry(); });

const message = "Hi Tech Rilex, I’m looking for [phone model], preferably [storage / colour / budget]. Can you check the current options?";
document.getElementById('copy-message').addEventListener('click', async () => {
  const status = document.getElementById('copy-status');
  try {
    await navigator.clipboard.writeText(message);
    status.textContent = 'Message copied.';
  } catch {
    status.textContent = 'Copy is not available in this preview. You can still use the suggested message above.';
  }
});

window.addEventListener('resize', resizeRenderer, { passive: true });
