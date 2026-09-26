import './style.css';

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createNoise3D } from 'simplex-noise';

import Stats from 'three/addons/libs/stats.module.js';
import { GPUStatsPanel } from 'three/addons/utils/GPUStatsPanel.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import Stick from './Stick';

const isMobile = window.matchMedia('(max-width: 767px)').matches;
const noise3D = createNoise3D();
const showHelperAxis = false;
const isOrtho = true; // use orthographic or perspective camera
const width = window.innerWidth;
const height = window.innerHeight;
const gridResolution = isMobile ? 10 : 25;
const rows = Math.ceil(height / gridResolution);
const cols = Math.ceil(width / gridResolution);

let stats, gpuPanel;
let gui;
let showGUI = false;
let isOrbitControlsEnabled = true;

let lineWidth = 4;
let lineHeight = isMobile ? 60 : 100;
let noiseSpeed = 0.00003;
let noiseIncrementX = isMobile ? 0.048 : 0.015;
let noiseIncrementY = isMobile ? 0.063 : 0.025;

/**
 * Initial threejs scene setup.
 *
 * This will create a scene that will fillin the entire screen
 * the global `isOrtho` boolean controls the camera type (orthographic or perspective)
 *
 * @returns width, height, scene, camera, renderer, controls
 */
const setup = () => {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0x000000, 1.0);
  renderer.setSize(width, height);

  const scene = new THREE.Scene();
  const camera = isOrtho
    ? new THREE.OrthographicCamera(
        width / -2,
        width / 2,
        height / 2,
        height / -2,
        1,
        10000,
      )
    : new THREE.PerspectiveCamera(45, width / height, 1, 10000);

  // By offsetting the camera, the line cap artefacts goes away
  // camera.position.x = isOrtho ? 100 : 0;
  camera.position.y = isOrtho ? 100 : 0;
  camera.position.z = isOrtho ? height / 2 : 2000;
  camera.zoom = isMobile ? 1.2 : 1.1;

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enabled = isOrbitControlsEnabled;
  document.body.appendChild(renderer.domElement);

  showHelperAxis && scene.add(new THREE.AxesHelper(200));

  // GUI
  stats = new Stats();
  document.body.appendChild(stats.dom);

  gpuPanel = new GPUStatsPanel(renderer.getContext());
  stats.addPanel(gpuPanel);
  stats.showPanel(0);

  return { scene, camera, renderer, controls };
};
const { scene, camera, renderer, controls } = setup();

/**
 * Creates the sticks grid
 *
 * @returns lines, pivots
 */
const initSticksGrid = () => {
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * gridResolution - width / 2;
      const y = r * gridResolution - height / 2;
      cells.push(x, y);
    }
  }

  const sticks = [];
  for (let v = 0; v < cells.length; v += 2) {
    const x = cells[v];
    const y = cells[v + 1];

    const stick = new Stick(lineWidth, lineHeight, x, y, width, height, scene);
    stick.init();
    sticks.push(stick);
  }

  return { sticks, cells };
};
const { sticks, cells } = initSticksGrid();

/**
 * Drawing loop
 *
 * zoff, xoff and yoff are values used to calculate/control the noise value returned by noise3D()
 */

let zoff = 0;
let previousFrameTime;
const draw = (timestamp) => {
  requestAnimationFrame(draw);

  const deltaTime =
    previousFrameTime === undefined
      ? 0
      : Math.min((timestamp - previousFrameTime) / 1000, 0.05);
  previousFrameTime = timestamp;

  stats.update();

  let yoff = 0;
  for (let y = 0; y < rows; y++) {
    let xoff = 0;

    for (let x = 0; x < cols; x++) {
      const stickIndex = y * cols + x;
      const n = noise3D(xoff, yoff, zoff);
      sticks[stickIndex].update(n, deltaTime);
      xoff += noiseIncrementX;
    }
    yoff += noiseIncrementY;
    zoff += noiseSpeed;
  }

  controls.update();
  renderer.render(scene, camera);
  renderer.clearDepth();
};
draw();

/**
 * Sets and reders GUI controls and stats
 */
const setupGUI = () => {
  gui = new GUI({ width: 340 });
  gui.hide();
  document.body.removeChild(stats.dom);

  const settings = {
    'Line width': lineWidth,
    'Line height': lineHeight,
    'Noise speed': noiseSpeed,
    'Noise increment x': noiseIncrementX,
    'Noise increment y': noiseIncrementY,
    'Change random colour': () => {
      const colors = new Array(6).fill(0);
      colors[3] = Math.random();
      colors[4] = Math.random();
      colors[5] = Math.random();

      sticks.forEach((stick) => stick.line.geometry.setColors(colors));
    },
    'Toggle mouse camera controls': isOrbitControlsEnabled,
  };

  gui.add(settings, 'Line width', 1, 20, 1).onChange((val) => {
    sticks.forEach((stick) => {
      stick.line.material.linewidth = val;
    });
  });
  gui.add(settings, 'Line height', 50, 300, 1).onChange((val) => {
    sticks.forEach((stick) => {
      stick.lineHeight = val;
    });
  });

  gui
    .add(settings, 'Noise speed', 0.00001, 0.0005, 0.00001)
    .onChange((val) => (noiseSpeed = val));

  gui
    .add(settings, 'Noise increment x', 0.001, 0.1, 0.001)
    .onChange((val) => (noiseIncrementX = val));

  gui
    .add(settings, 'Noise increment y', 0.001, 0.1, 0.001)
    .onChange((val) => (noiseIncrementY = val));

  gui.add(settings, 'Change random colour');

  gui.add(settings, 'Toggle mouse camera controls').onChange(() => {
    isOrbitControlsEnabled = !isOrbitControlsEnabled;
    controls.enabled = isOrbitControlsEnabled;
  });

  if (isMobile) {
    instructions.style.display = 'none';
  }
  window.addEventListener('keydown', (e) => {
    if (e.key.toLocaleLowerCase() === 'h' && !isMobile) {
      showGUI = !showGUI;
      const instructions = document.querySelector('#instructions');

      if (showGUI) {
        gui.show();
        document.body.appendChild(stats.dom);
        instructions.style.display = 'none';
      } else {
        gui.hide();
        document.body.removeChild(stats.dom);
        instructions.style.display = 'block';
      }
    }
  });
};
setupGUI();
