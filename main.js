import "./style.css";

import * as THREE from "three";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createNoise3D } from "simplex-noise";

import Stats from "three/addons/libs/stats.module.js";
import { GPUStatsPanel } from "three/addons/utils/GPUStatsPanel.js";
import { GUI } from "three/addons/libs/lil-gui.module.min.js";

let isMobile = window.matchMedia("(max-width: 767px)").matches;
let stats, gpuPanel;
let gui;
let showGUI = false;
let isOrbitControlsEnabled = false;

const noise3D = createNoise3D();
const showHelperAxis = false;
const isOrtho = true; // use orthographic or perspective camera
const gridResolution = isMobile ? 10 : 28;

// colors set by a sequence of r, g, b numbers,
// so the first 3 are one color and so on
const colors = [0, 0, 0, 0, 0.3, 1];
const points = [0, 0, 0, 0, 0, 1];

let lineWidth = 10;
let lineHeight = isMobile ? 80 : 180;
let noiseSpeed = 0.00003;
let noiseIncrementX = isMobile ? 0.048 : 0.015;
let noiseIncrementY = isMobile ? 0.063 : 0.05;
let hasXrotation = true;
let hasYrotation = true;
let hasZrotation = false;

/**
 * Randomly the last 3 numbers in the colors array
 */
const randomColour = () => {
  colors[3] = Math.random();
  colors[4] = Math.random();
  colors[5] = Math.random();

  lines.forEach((line) => line.geometry.setColors(colors));
};

/**
 * Re-maps a number from one range to another
 *
 * @param {number} current
 * @param {number} in_min
 * @param {number} in_max
 * @param {number} out_min
 * @param {number} out_max
 * @returns
 */
const mapNoise = (current, in_min, in_max, out_min, out_max) => {
  return (
    ((current - in_min) * (out_max - out_min)) / (in_max - in_min) + out_min
  );
};

/**
 * Calculates the vertices (x, y) and noise value per line
 *
 * The vertices array is a sequence pair of x, y values to store the lines coordinates
 * The noise array contains the height value per line
 * This setup makes the vertices array to have twice the values as the noise array
 *
 * @param {number} _width
 * @param {number} _height
 * @returns vertices
 */

const getVertices = (_width, _height) => {
  const vertices = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * gridResolution - _width / 2;
      const y = r * gridResolution - _height / 2;
      vertices.push(x, y);
    }
  }

  return { vertices };
};

/**
 * Initial threejs scene setup.
 *
 * This will create a scene that will fillin the entire screen
 * the global `isOrtho` boolean controls the camera type (orthographic or perspective)
 *
 * @returns width, height, scene, camera, renderer, controls
 */
const setup = () => {
  const width = window.innerWidth;
  const height = window.innerHeight;

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
        10000
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

  return { width, height, scene, camera, renderer, controls };
};

const { width, height, scene, camera, renderer, controls } = setup();
const rows = Math.ceil(height / gridResolution);
const cols = Math.ceil(width / gridResolution);

/**
 * Creates the lines grid
 *
 * The colors and points arrays, most be of equal length,
 * they store the line points in a sequence of r, g, b numbers for the * colors and x, y, z sequence for the points arrays
 *
 * @returns lines, pivots
 */
const initLinesGrid = () => {
  const lines = [];
  const pivots = [];

  const { vertices } = getVertices(width, height);

  let noiseIndex = 0; // vertices has double the amount of indices as noise, this is to keep track the matching verctice and noise pair per line

  for (let v = 0; v < vertices.length; v += 2) {
    const x = vertices[v];
    const y = vertices[v + 1];

    const material = new LineMaterial({
      color: 0xffffff,
      vertexColors: true,
      linewidth: lineWidth,
      resolution: new THREE.Vector2(width, height),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      alphaToCoverage: false,
    });

    const geometry = new LineGeometry();
    geometry.setPositions(points);
    geometry.setColors(colors);

    const line = new Line2(geometry, material);
    line.geometry.verticesNeedUpdate = true;

    lines.push(line);

    const pivot = new THREE.Group();
    pivot.add(line);
    pivot.position.set(x, y, 0);
    scene.add(pivot);
    pivots.push(pivot);

    noiseIndex++;
  }

  return { lines, pivots };
};
const { lines, pivots } = initLinesGrid();

/**
 * Drawing loop
 *
 * zoff, xoff and yoff are values used to calculate/control the noise value returned by noise3D()
 */
let zoff = 0;
const draw = () => {
  requestAnimationFrame(draw);

  stats.update();

  let lineIndex = 0;
  let yoff = 0;
  for (let y = 0; y < rows; y++) {
    let xoff = 0;

    for (let x = 0; x < cols; x++) {
      const n = noise3D(xoff, yoff, zoff);
      const angle = mapNoise(n, -1, 1, 0, Math.PI);

      lines[lineIndex].material.opacity = mapNoise(n, -1, 1, 0, 1);
      lines[lineIndex].scale.z = mapNoise(n, -1, 1, 0, lineHeight);
      lines[lineIndex].material.linewidth = mapNoise(n, -1, 1, 1, lineWidth);
      pivots[lineIndex].rotation.y = hasXrotation ? angle : 0;
      pivots[lineIndex].rotation.x = hasYrotation ? angle : 0;
      pivots[lineIndex].rotation.z = hasZrotation ? angle : 0;

      lineIndex++;
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
    "Line width": lineWidth,
    "Line height": lineHeight,
    "Noise speed": noiseSpeed,
    "Noise increment x": noiseIncrementX,
    "Noise increment y": noiseIncrementY,
    "Change random colour": () => randomColour(),
    "Allow rotation on X": hasXrotation,
    "Allow rotation on Y": hasYrotation,
    "Toggle mouse camera controls": isOrbitControlsEnabled,
  };

  gui
    .add(settings, "Line width", 1, 20, 1)
    .onChange((val) => (lineWidth = val));
  gui
    .add(settings, "Line height", 50, 300, 1)
    .onChange((val) => (lineHeight = val));

  gui
    .add(settings, "Noise speed", 0.00001, 0.0005, 0.00001)
    .onChange((val) => (noiseSpeed = val));

  gui
    .add(settings, "Noise increment x", 0.001, 0.1, 0.001)
    .onChange((val) => (noiseIncrementX = val));

  gui
    .add(settings, "Noise increment y", 0.001, 0.1, 0.001)
    .onChange((val) => (noiseIncrementY = val));

  gui.add(settings, "Change random colour");
  gui
    .add(settings, "Allow rotation on X")
    .onChange(() => (hasXrotation = !hasXrotation));
  gui
    .add(settings, "Allow rotation on Y")
    .onChange(() => (hasYrotation = !hasYrotation));

  gui.add(settings, "Toggle mouse camera controls").onChange(() => {
    isOrbitControlsEnabled = !isOrbitControlsEnabled;
    controls.enabled = isOrbitControlsEnabled;
  });

  if (isMobile) {
    instructions.style.display = "none";
  }
  window.addEventListener("keydown", (e) => {
    if (e.key.toLocaleLowerCase() === "h" && !isMobile) {
      showGUI = !showGUI;
      const instructions = document.querySelector("#instructions");

      if (showGUI) {
        gui.show();
        document.body.appendChild(stats.dom);
        instructions.style.display = "none";
      } else {
        gui.hide();
        document.body.removeChild(stats.dom);
        instructions.style.display = "block";
      }
    }
  });
};
setupGUI();
