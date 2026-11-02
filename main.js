import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GrassManager } from './grass.js';

// Import shaders
import terrainVertexShader from './shaders/terrain.vert?raw';
import terrainFragmentShader from './shaders/terrain.frag?raw';
import skyVertexShader from './shaders/sky.vert?raw';
import skyFragmentShader from './shaders/sky.frag?raw';
import ps2FragmentShader from './shaders/ps2.frag?raw';

// --- 1. SETUP SCENE & CAMERA ---
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a1128); 

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(4, 8.5, 10);

const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(1);
container.appendChild(renderer.domElement);

// --- 2. POST-PROCESSING (PS1 / PS2) ---
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const ps2Pass = new ShaderPass({
    uniforms: {
        'tDiffuse': { value: null },
        'uResolution': { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: ps2FragmentShader
});
composer.addPass(ps2Pass);

// --- 3. LIGHTING ---
scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const sunLight = new THREE.DirectionalLight(0xfff5e6, 4.2);
sunLight.position.set(10, 20, 10);
scene.add(sunLight);

// --- 4. BACKGROUND SKY ---
const skyMaterial = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 } },
  vertexShader: skyVertexShader,
  fragmentShader: skyFragmentShader,
  depthWrite: false, 
  depthTest: false,
});
const skyMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), skyMaterial);
skyMesh.frustumCulled = false; 
skyMesh.renderOrder = -1; 
camera.add(skyMesh);
scene.add(camera);

// --- 5. OCEAN TERRAIN ---
const oceanSize = 800;
const terrainGeo = new THREE.PlaneGeometry(oceanSize, oceanSize, 128, 128);
terrainGeo.rotateX(-Math.PI / 2);
terrainGeo.translate(0, 0, -(oceanSize / 2) + 20);

const terrainMaterial = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uScrollProgress: { value: 0 } },
  vertexShader: terrainVertexShader,
  fragmentShader: terrainFragmentShader,
  wireframe: false, 
});
const terrain = new THREE.Mesh(terrainGeo, terrainMaterial);
terrain.position.set(0, -4.5, 0);
scene.add(terrain);

// --- 6. MOUSE TRACKING & GRASS MANAGER ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const grassManager = new GrassManager();

window.addEventListener('mousemove', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.0);
    const target = new THREE.Vector3();
    
    if (raycaster.ray.intersectPlane(groundPlane, target)) {
        grassManager.updateMouse(target);
    }
});

// --- 7. IMPORT BLENDER SCENE & INIT GRASS ---
const loader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
loader.setDRACOLoader(dracoLoader);

loader.load('/models/cheapisland.glb', (gltf) => {
    const importedIsland = gltf.scene;
    importedIsland.scale.set(4, 4, 4);
    importedIsland.position.set(0, 1.0, 0);
    scene.add(importedIsland);
    importedIsland.updateMatrixWorld(true);

    let grassMesh = null;
    importedIsland.traverse((child) => {
        if (child.isMesh && child.name.toLowerCase().includes('grass')) {
            grassMesh = child;
        }
    });

    if (grassMesh) {
        grassMesh.visible = true;
        grassManager.createInstancedGrass(grassMesh, scene); 
    }

    // --- BULLETPROOF ANTI POP-IN LOGIC ---
    
    // 1. Force WebGL to compile all shaders in memory
    // --- BULLETPROOF ANTI POP-IN LOGIC ---
    renderer.compile(scene, camera);
    composer.render();

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const loadingScreen = document.getElementById('loading-screen');
            if (loadingScreen) {
                // Fade out using inline styles
                loadingScreen.style.opacity = '0';
                loadingScreen.style.visibility = 'hidden';
                
                // Wait 1.5 seconds for the fade to finish before sliding the UI in
                setTimeout(() => {
                    const infoWindow = document.getElementById('info-window');
                    if (infoWindow) infoWindow.classList.add('visible');
                }, 1500);
            }
        });
    });
});

// --- 8. HTML UI INTERACTIVITY & WINDOW SLIDING ---
const infoWindow = document.getElementById('info-window');
const projectWindow = document.getElementById('project-details-window');
const profileWindow = document.getElementById('profile-details-window');

const projectDataMap = {
  editor: { title: "3D Web Environment Editor", stack: "JavaScript, Three.js, Vite, GLSL", desc: "A custom web-based 3D environment editor with layered texture painting and multi-scene management." },
  renderer: { title: "Cross-Platform 3D Renderer", stack: "C++, Vulkan, GLFW, CMake", desc: "A low-level graphics renderer built to explore rendering pipeline mechanics." },
  memorybox: { title: "MemoryBox", stack: "Java, Android, Firebase", desc: "A mobile Android application utilizing Material Design 3 and Firebase backend." }
};

document.querySelectorAll('.project-item[data-project]').forEach(item => {
  item.addEventListener('click', () => {
    if (profileWindow) profileWindow.classList.remove('visible');
    const data = projectDataMap[item.dataset.project];
    if (data) {
        document.getElementById('proj-title').textContent = data.title;
        document.getElementById('proj-stack').textContent = data.stack;
        document.getElementById('proj-desc').textContent = data.desc;
    }
    if (infoWindow) infoWindow.classList.add('project-open');
    if (projectWindow) projectWindow.classList.add('visible');
  });
});

document.getElementById('close-project')?.addEventListener('click', () => {
  if (infoWindow) infoWindow.classList.remove('project-open');
  if (projectWindow) projectWindow.classList.remove('visible');
});

const profileTrigger = document.getElementById('profile-trigger');
if (profileTrigger && profileWindow) {
  profileTrigger.addEventListener('click', () => {
    if (projectWindow) projectWindow.classList.remove('visible');
    if (infoWindow) infoWindow.classList.add('project-open');
    profileWindow.classList.add('visible');
  });

  document.getElementById('close-profile')?.addEventListener('click', () => {
    if (infoWindow) infoWindow.classList.remove('project-open');
    profileWindow.classList.remove('visible');
  });
}

// --- 9. 3D SIGN INTERACTIVITY ---
const menuData = [
    { title: "3D Web Environment Editor", desc: "Engineered with a layered texture painting system resembling Photoshop, multi-scene management, vertex groups, and sculpting tools." },
    { title: "Cross-Platform 3D Renderer", desc: "Built in C++ with Vulkan and GLFW. Implements direct CPU/GPU memory allocation and custom vertex/fragment pipelines." },
    { title: "Welcome Info", desc: "Explore the retro island. Click sign to return to the menu." }
];

let currentSelectedIndex = 0;
let activeDetailSection = null;

// Assuming 'board' represents your interactive sign mesh
window.addEventListener('click', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const hitSign = raycaster.intersectObjects(scene.children, true).find(i => i.object.name === "interactiveSign");
    
    if (hitSign) {
        activeDetailSection = (activeDetailSection === null) ? menuData[currentSelectedIndex] : null;
        hitSign.object.material.map = createSignTexture(currentSelectedIndex, activeDetailSection);
        hitSign.object.material.needsUpdate = true;
    }
});

window.addEventListener('keydown', (e) => {
    if (activeDetailSection !== null) return;
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        currentSelectedIndex = (currentSelectedIndex - 1 + 3) % 3;
    } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        currentSelectedIndex = (currentSelectedIndex + 1) % 3;
    } else if (e.key === 'Enter') {
        activeDetailSection = menuData[currentSelectedIndex];
    }
    
    const signObj = scene.getObjectByName('interactiveSign');
    if (signObj) {
        signObj.material.map = createSignTexture(currentSelectedIndex, activeDetailSection);
        signObj.material.needsUpdate = true;
    }
});

// --- 10. RENDER LOOP ---
function animate(time) {
    requestAnimationFrame(animate);
    const elapsedTime = time * 0.001;

    terrainMaterial.uniforms.uTime.value = elapsedTime;
    skyMaterial.uniforms.uTime.value = elapsedTime;
    grassManager.updateTime(elapsedTime);

    composer.render();
}
animate(0);

// --- 11. HANDLE RESIZE ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    ps2Pass.uniforms['uResolution'].value.set(window.innerWidth, window.innerHeight);
});