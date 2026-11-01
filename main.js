import * as THREE from 'three';
import Lenis from 'lenis';

// Import shaders as raw strings using Vite's ?raw modifier
import terrainVertexShader from './shaders/terrain.vert?raw';
import terrainFragmentShader from './shaders/terrain.frag?raw';
import cloudVertexShader from './shaders/cloud.vert?raw';
import cloudFragmentShader from './shaders/cloud.frag?raw';
import skyVertexShader from './shaders/sky.vert?raw';
import skyFragmentShader from './shaders/sky.frag?raw';

// --- 1. SETUP SCENE & CAMERA ---
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050505);

// Extended far clipping plane (1000) to render the massive ocean and clouds
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 3.5, 11);
camera.lookAt(0, 3.5, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

// --- 2. VOLUMETRIC CLOUDS ---
// Lifted high into the atmosphere (y: 120) so the camera looks up at them
const boxCenter = new THREE.Vector3(0, 120, -150); 
const boxSize = new THREE.Vector3(800, 80, 500); 

const boxMin = new THREE.Vector3().subVectors(boxCenter, boxSize.clone().multiplyScalar(0.5));
const boxMax = new THREE.Vector3().addVectors(boxCenter, boxSize.clone().multiplyScalar(0.5));

const cloudGeometry = new THREE.BoxGeometry(boxSize.x, boxSize.y, boxSize.z);
cloudGeometry.translate(boxCenter.x, boxCenter.y, boxCenter.z);

const cloudMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uSunDirection: { value: new THREE.Vector3(-0.6, 0.45, -0.65) }, 
    uSunColor: { value: new THREE.Color(0xffffff) },
    uSkyColor: { value: new THREE.Color(0x3a6090) },
    uBoxMin: { value: boxMin },
    uBoxMax: { value: boxMax }
  },
  vertexShader: cloudVertexShader,
  fragmentShader: cloudFragmentShader,
  transparent: true,
  side: THREE.DoubleSide, // Guarantees rendering when looking up from outside the bounds
  depthWrite: false, 
});

const cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
scene.add(cloudMesh);


// --- 3. BACKGROUND SKY CARD ---
const skyGeometry = new THREE.PlaneGeometry(2, 2);
const skyMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 }
  },
  vertexShader: skyVertexShader,
  fragmentShader: skyFragmentShader,
  depthWrite: false, 
  depthTest: false, // Crucial for preventing the massive plane clipping
});

const skyMesh = new THREE.Mesh(skyGeometry, skyMaterial);
skyMesh.frustumCulled = false; 
skyMesh.renderOrder = -1; 

camera.add(skyMesh);
scene.add(camera);


// --- 4. NON-LINEAR PROCEDURAL OCEAN TERRAIN ---
const size = 800;
const segments = 512;
const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
geometry.rotateX(-Math.PI / 2);

// Shift the plane so the front edge sits just behind the camera
geometry.translate(0, 0, -(size / 2) + 20);

// Warp the grid density logarithmically to save polygons at the horizon
const pos = geometry.attributes.position;
for (let i = 0; i < pos.count; i++) {
  let z = pos.getZ(i);
  let normalizedZ = (20 - z) / size; 
  let warpedZ = Math.pow(normalizedZ, 2.5);
  let newZ = 20 - (warpedZ * size);
  pos.setZ(i, newZ);
}
geometry.computeVertexNormals();

const terrainMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uScrollProgress: { value: 0 },
  },
  vertexShader: terrainVertexShader,
  fragmentShader: terrainFragmentShader,
  wireframe: false, 
});

const terrain = new THREE.Mesh(geometry, terrainMaterial);
terrain.position.set(0, -3, 0);
scene.add(terrain);


// --- 5. SMOOTH SCROLL SETUP (Lenis) & WINDOW ELEMENTS ---
const lenis = new Lenis({
  lerp: 0.08,
  smoothWheel: true,
});

let scrollProgress = 0;
const infoWindow = document.getElementById('info-window');
const projectWindow = document.getElementById('project-details-window');
const profileWindow = document.getElementById('profile-details-window');


// --- 6. PROJECT DATA & INTERACTIVITY ---
const projectData = {
  editor: {
    title: "3D Web Environment Editor",
    stack: "JavaScript, Three.js, Vite, GLSL",
    desc: "A custom web-based 3D environment editor. Engineered with a layered texture painting system resembling Photoshop, multi-scene management, vertex groups, sculpting tools, and procedural splat-mapping functionality."
  },
  renderer: {
    title: "Cross-Platform 3D Renderer",
    stack: "C++, Vulkan, GLFW, CMake",
    desc: "A low-level graphics renderer built to explore rendering pipeline mechanics. Implements direct CPU/GPU memory management, physical memory allocation, and analytical shading through custom vertex and fragment pipelines."
  },
  memorybox: {
    title: "MemoryBox",
    stack: "Java, Android, Firebase, Material Design 3",
    desc: "A mobile Android application utilizing Material Design 3 styling and Firebase backend infrastructure to facilitate the seamless storage, retrieval, and management of user text and image entries."
  }
};

const projectItems = document.querySelectorAll('.project-item');
const closeProjectBtn = document.getElementById('close-project');
const pTitle = document.getElementById('proj-title');
const pStack = document.getElementById('proj-stack');
const pDesc = document.getElementById('proj-desc');

projectItems.forEach(item => {
  item.addEventListener('click', () => {
    // Close the profile window if it's open
    if (profileWindow) profileWindow.classList.remove('visible');
    
    const data = projectData[item.dataset.project];
    pTitle.textContent = data.title;
    pStack.textContent = data.stack;
    pDesc.textContent = data.desc;
    
    infoWindow.classList.add('project-open');
    projectWindow.classList.add('visible');
  });
});

closeProjectBtn.addEventListener('click', () => {
  infoWindow.classList.remove('project-open');
  projectWindow.classList.remove('visible');
});


// --- 7. PROFILE WINDOW INTERACTIVITY ---
const profileTrigger = document.getElementById('profile-trigger');
const closeProfileBtn = document.getElementById('close-profile');

if (profileTrigger && profileWindow) {
  profileTrigger.addEventListener('click', () => {
    // Close the project window if it's open
    projectWindow.classList.remove('visible');
    
    infoWindow.classList.add('project-open');
    profileWindow.classList.add('visible');
  });

  closeProfileBtn.addEventListener('click', () => {
    infoWindow.classList.remove('project-open');
    profileWindow.classList.remove('visible');
  });
}


// --- 8. SCROLL EVENT LISTENER ---
lenis.on('scroll', (e) => {
  scrollProgress = e.progress;
  
  if (scrollProgress > 0.15) {
    infoWindow.classList.add('visible');
  } else {
    // Hide everything if user scrolls back to top
    infoWindow.classList.remove('visible');
    infoWindow.classList.remove('project-open');
    projectWindow.classList.remove('visible');
    if (profileWindow) profileWindow.classList.remove('visible');
  }
});


// --- 9. ANIMATION & RENDER LOOP ---
const lerp = (start, end, factor) => start + (end - start) * factor;
let currentProgress = 0;

function animate(time) {
  // Drive Lenis animations
  lenis.raf(time);
  
  requestAnimationFrame(animate);

  // Native high-resolution timer mapped to seconds
  const elapsedTime = time * 0.001; 
  currentProgress = lerp(currentProgress, scrollProgress, 0.05);

  terrainMaterial.uniforms.uTime.value = elapsedTime;
  terrainMaterial.uniforms.uScrollProgress.value = currentProgress;
  cloudMaterial.uniforms.uTime.value = elapsedTime;
  skyMaterial.uniforms.uTime.value = elapsedTime;
  
  renderer.render(scene, camera);
}
// Pass 0 to kickstart the first frame correctly
animate(0);


// --- 10. HANDLE RESIZE ---
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});