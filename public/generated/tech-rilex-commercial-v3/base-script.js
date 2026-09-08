import * as THREE from 'https://esm.sh/three@0.164.1';
import { OrbitControls } from 'https://esm.sh/three@0.164.1/examples/jsm/controls/OrbitControls.js';

const canvas = document.getElementById('product-canvas');
const viewerPanel = canvas?.closest('.viewer-panel');
let renderer, scene, camera, controls, phone, bodyMaterial;

function initViewer(){
  if(!canvas || !viewerPanel) return;
  renderer = new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,2));
  renderer.shadowMap.enabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(32,1,.1,100);
  camera.position.set(0,.1,7.3);
  controls = new OrbitControls(camera,canvas);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 5.6;
  controls.maxDistance = 9;
  controls.minPolarAngle = Math.PI*.25;
  controls.maxPolarAngle = Math.PI*.75;
  controls.autoRotate = true;
  controls.autoRotateSpeed = .72;

  scene.add(new THREE.HemisphereLight(0xffffff,0x5d5144,2.4));
  const key = new THREE.DirectionalLight(0xffffff,4.3); key.position.set(4,5,6); key.castShadow=true; scene.add(key);
  const rim = new THREE.DirectionalLight(0xd6b987,2.1); rim.position.set(-4,1,-3); scene.add(rim);
  phone = new THREE.Group(); scene.add(phone);

  const shape = new THREE.Shape();
  const w=2.8,h=5.7,r=.34,x=-w/2,y=-h/2;
  shape.moveTo(x+r,y); shape.lineTo(x+w-r,y); shape.quadraticCurveTo(x+w,y,x+w,y+r); shape.lineTo(x+w,y+h-r); shape.quadraticCurveTo(x+w,y+h,x+w-r,y+h); shape.lineTo(x+r,y+h); shape.quadraticCurveTo(x,y+h,x,y+h-r); shape.lineTo(x,y+r); shape.quadraticCurveTo(x,y,x+r,y);
  const bodyGeo = new THREE.ExtrudeGeometry(shape,{depth:.24,bevelEnabled:true,bevelThickness:.07,bevelSize:.07,bevelSegments:7,curveSegments:16}); bodyGeo.center();
  bodyMaterial = new THREE.MeshStandardMaterial({color:0x22262a,metalness:.82,roughness:.28});
  const body = new THREE.Mesh(bodyGeo,bodyMaterial); body.castShadow=true; body.receiveShadow=true; phone.add(body);

  const texCanvas=document.createElement('canvas'); texCanvas.width=720; texCanvas.height=1440; const ctx=texCanvas.getContext('2d');
  const g=ctx.createLinearGradient(0,0,720,1440); g.addColorStop(0,'#d4b177'); g.addColorStop(.42,'#7d6a53'); g.addColorStop(1,'#1a1f1c'); ctx.fillStyle=g; ctx.fillRect(0,0,720,1440);
  ctx.fillStyle='rgba(255,255,255,.16)'; for(let yy=0;yy<1440;yy+=90) ctx.fillRect(0,yy,720,1);
  ctx.fillStyle='#f6f1e8'; ctx.font='700 44px Arial'; ctx.fillText('TECH RILEX',72,122); ctx.font='800 86px Arial'; ctx.fillText('CHECK',72,1030); ctx.fillText('BEFORE',72,1122); ctx.fillText('YOU BUY.',72,1214); ctx.font='600 28px Arial'; ctx.fillText('MODEL / SPEC / CONDITION',72,1328);
  const texture=new THREE.CanvasTexture(texCanvas); texture.colorSpace=THREE.SRGBColorSpace;
  const screen=new THREE.Mesh(new THREE.PlaneGeometry(2.47,5.22),new THREE.MeshBasicMaterial({map:texture})); screen.position.z=.195; phone.add(screen);
  const island=new THREE.Mesh(new THREE.CapsuleGeometry(.12,.48,8,16),new THREE.MeshStandardMaterial({color:0x0a0b0a,roughness:.35})); island.rotation.z=Math.PI/2; island.position.set(0,2.23,.218); phone.add(island);
  const plate=new THREE.Mesh(new THREE.BoxGeometry(1.22,1.34,.11),new THREE.MeshStandardMaterial({color:0x2c3133,metalness:.65,roughness:.25})); plate.position.set(-.64,1.78,-.19); plate.rotation.y=Math.PI; phone.add(plate);
  const addLens=(lx,ly)=>{const lens=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,.09,48),new THREE.MeshPhysicalMaterial({color:0x0d1113,metalness:.7,roughness:.08,clearcoat:1})); lens.rotation.x=Math.PI/2; lens.position.set(lx,ly,-.255); phone.add(lens);};
  addLens(-.88,2.04); addLens(-.42,2.04); addLens(-.65,1.56);
  phone.rotation.set(-.08,-.5,-.03);
  const floor=new THREE.Mesh(new THREE.CircleGeometry(3.5,64),new THREE.ShadowMaterial({opacity:.18})); floor.rotation.x=-Math.PI/2; floor.position.y=-3.2; floor.receiveShadow=true; scene.add(floor);

  const resize=()=>{const rect=viewerPanel.getBoundingClientRect(); const width=Math.max(1,Math.floor(rect.width)),height=Math.max(1,Math.floor(rect.height)); renderer.setSize(width,height,false); camera.aspect=width/height; camera.updateProjectionMatrix();};
  let t=0; const render=()=>{resize(); t+=.01; phone.position.y=Math.sin(t*1.2)*.08; controls.update(); renderer.render(scene,camera); requestAnimationFrame(render);}; render();
  let interacting=false; controls.addEventListener('start',()=>{interacting=true;controls.autoRotate=false;}); controls.addEventListener('end',()=>{clearTimeout(window.__trRotateTimer);window.__trRotateTimer=setTimeout(()=>{if(interacting){controls.autoRotate=true;interacting=false;}},1500);});
  window.addEventListener('resize',resize,{passive:true});
}
initViewer();

const finishName=document.getElementById('finish-name');
document.querySelectorAll('.swatch').forEach(button=>button.addEventListener('click',()=>{
  document.querySelectorAll('.swatch').forEach(item=>item.classList.remove('active')); button.classList.add('active'); if(finishName) finishName.textContent=button.dataset.name;
  if(!bodyMaterial) return; const target=new THREE.Color(button.dataset.color); const start=bodyMaterial.color.clone(); const proxy={p:0};
  if(window.gsap) window.gsap.to(proxy,{p:1,duration:.55,ease:'power2.out',onUpdate:()=>bodyMaterial.color.copy(start.clone().lerp(target,proxy.p))}); else bodyMaterial.color.copy(target);
}));

const reduceMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
if(reduceMotion){document.querySelectorAll('.reveal-up,.reveal-card,.reveal-scale').forEach(el=>{el.style.opacity=1;el.style.transform='none';}); if(controls) controls.autoRotate=false;}
else if(window.gsap&&window.ScrollTrigger){window.gsap.registerPlugin(window.ScrollTrigger);window.gsap.to('.reveal-scale',{opacity:1,scale:1,duration:1.05,ease:'power3.out',delay:.12});window.gsap.to('.product-hero .reveal-up',{opacity:1,y:0,duration:.9,ease:'power3.out',delay:.06});document.querySelectorAll('.reveal-up').forEach(el=>{if(el.closest('.product-hero'))return;window.gsap.to(el,{opacity:1,y:0,duration:.8,ease:'power2.out',scrollTrigger:{trigger:el,start:'top 86%',once:true}});});document.querySelectorAll('.reveal-card').forEach(el=>window.gsap.to(el,{opacity:1,y:0,scale:1,duration:.85,ease:'power2.out',scrollTrigger:{trigger:el,start:'top 86%',once:true}}));}
else{const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.style.opacity=1;entry.target.style.transform='none';observer.unobserve(entry.target);}}),{threshold:.12});document.querySelectorAll('.reveal-up,.reveal-card,.reveal-scale').forEach(el=>observer.observe(el));}

const track=document.getElementById('gallery-track');
if(track){const slides=[...track.children],dots=[...document.querySelectorAll('.gallery-dots span')];const current=()=>{const center=track.scrollLeft+track.clientWidth/2;let best=0,d=Infinity;slides.forEach((slide,i)=>{const sd=Math.abs(slide.offsetLeft+slide.offsetWidth/2-center);if(sd<d){d=sd;best=i;}});return best;};const setDot=i=>dots.forEach((dot,idx)=>dot.classList.toggle('active',idx===i));const move=delta=>{const next=Math.max(0,Math.min(slides.length-1,current()+delta));slides[next].scrollIntoView({behavior:reduceMotion?'auto':'smooth',block:'nearest',inline:'center'});setDot(next);};document.querySelector('.gallery-arrow.prev')?.addEventListener('click',()=>move(-1));document.querySelector('.gallery-arrow.next')?.addEventListener('click',()=>move(1));let timer;track.addEventListener('scroll',()=>{clearTimeout(timer);timer=setTimeout(()=>setDot(current()),80);},{passive:true});}

const stickyBar=document.getElementById('sticky-bar'); const hero=document.querySelector('.product-hero');
if(stickyBar&&hero){const observer=new IntersectionObserver(([entry])=>{const show=!entry.isIntersecting&&window.scrollY>hero.offsetHeight*.45;stickyBar.classList.toggle('visible',show);stickyBar.setAttribute('aria-hidden',show?'false':'true');},{threshold:.08});observer.observe(hero);}

const backdrop=document.getElementById('enquiry-backdrop');const closeSheet=document.getElementById('sheet-close');const form=document.getElementById('phone-request-form');const modelInput=document.getElementById('request-model');const storageInput=document.getElementById('request-storage');const colourInput=document.getElementById('request-colour');const budgetInput=document.getElementById('request-budget');const notesInput=document.getElementById('request-notes');const generated=document.getElementById('generated-message');const status=document.getElementById('copy-status');
const buildMessage=()=>{const model=modelInput?.value.trim(),storage=storageInput?.value.trim(),colour=colourInput?.value.trim(),budget=budgetInput?.value.trim(),notes=notesInput?.value.trim();if(!model)return 'Tell us the phone model above and we will prepare your enquiry message.';let msg=`Hi Tech Rilex, I’m looking for ${model}`;const prefs=[];if(storage)prefs.push(storage);if(colour)prefs.push(colour);if(budget)prefs.push(`budget ${budget}`);if(prefs.length)msg+=`, preferably ${prefs.join(' / ')}`;msg+='. Can you check the current options and details for me?';if(notes)msg+=`\n\nAdditional note: ${notes}`;return msg;};
const refreshMessage=()=>{if(generated)generated.textContent=buildMessage();if(status)status.textContent='';};[modelInput,storageInput,colourInput,budgetInput,notesInput].forEach(input=>input?.addEventListener('input',refreshMessage));
const openSheet=()=>{if(!backdrop)return;backdrop.hidden=false;document.body.style.overflow='hidden';setTimeout(()=>modelInput?.focus(),0);refreshMessage();};const closeEnquiry=()=>{if(!backdrop)return;backdrop.hidden=true;document.body.style.overflow='';};document.querySelectorAll('[data-enquire]').forEach(button=>button.addEventListener('click',openSheet));closeSheet?.addEventListener('click',closeEnquiry);backdrop?.addEventListener('click',event=>{if(event.target===backdrop)closeEnquiry();});document.addEventListener('keydown',event=>{if(event.key==='Escape'&&backdrop&&!backdrop.hidden)closeEnquiry();});
form?.addEventListener('submit',async event=>{event.preventDefault();if(!modelInput?.value.trim()){modelInput?.focus();if(status)status.textContent='Please enter the phone model first.';return;}const message=buildMessage();if(generated)generated.textContent=message;try{await navigator.clipboard.writeText(message);if(status)status.textContent='Enquiry message copied. You can paste it into WhatsApp or your preferred chat.';}catch{if(status)status.textContent='Copy is not available in this browser. Select the message above and copy it manually.';}});
