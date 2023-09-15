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

let stats, gpuPanel;
let gui;

const noise3D = createNoise3D();
const showHelperAxis = false;
const isOrtho = true; // use orthographic or perspective camera
const scl = 28;

// colors set by a sequence of r, g, b numbers,
// so the first 3 are one color and so on
const colors = [0, 0, 0, 0, 0.3, 1];
const points = [0, 0, 0, 0, 0, 1];

let lineWidth = 12;
let lineHeight = 150;
let noiseSpeed = 0.00003;
let noiseIncrementX = 0.04;
let noiseIncrementY = 0.04;

const randomColour = () => {
  colors[3] = Math.random();
  colors[4] = Math.random();
  colors[5] = Math.random();

  lines.forEach((line) => line.geometry.setColors(colors));
};

/**
 * Given a value min/max range to another
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
  // camera.position.x = isOrtho ? 300 : 0;
  camera.position.y = isOrtho ? 100 : 0;
  camera.position.z = isOrtho ? 500 : 2000;

  const controls = new OrbitControls(camera, renderer.domElement);
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
const rows = Math.ceil(height / scl);
const cols = Math.ceil(width / scl);

/**
 * Calculates the vertices (x, y) and noise value per line
 *
 * The vertices array is a sequence pair of x, y values to store the lines coordinates
 * The noise array contains the height value per line
 * This setup makes the vertices array to have twice the values as the noise array
 *
 * @returns vertices and noise arrays
 */
const getVertices = () => {
  const vertices = [];
  const noise = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * scl - width / 2;
      const y = r * scl - height / 2;

      noise.push(noise3D(x, y, 0));

      vertices.push(x, y);
    }
  }

  return { vertices, noise };
};

/**
 * Creates a points grid
 *
 * @returns grid
 */
const initGrid = () => {
  const { vertices } = getVertices();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 2)
  );

  const material = new THREE.PointsMaterial({ color: 0xff00ff, size: 4 });
  const grid = new THREE.Points(geometry, material);
  scene.add(grid);

  return { grid };
};
// const { grid } = initGrid();

/**
 * Creates the lines grid
 */
const initLinesGrid = () => {
  const lines = [];
  const pivots = [];

  const { vertices, noise } = getVertices();

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
 * Drawing loop, to animate the lines
 *
 * zoff, xoff and yoff are values used to calculate/control the noise factor returned by noise3D()
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
      const angle = n * Math.PI;

      // lines[lineIndex].rotation.set(0, 0, angle);
      lines[lineIndex].material.opacity = mapNoise(n, -1, 1, 0, 1);
      // pivots[lineIndex].rotation.z = angle;
      lines[lineIndex].scale.z = mapNoise(n, -1, 1, 0, lineHeight);
      pivots[lineIndex].rotation.y = angle;
      lines[lineIndex].material.linewidth = lineWidth;
      pivots[lineIndex].rotation.x = angle;
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

const setupGUI = () => {
  gui = new GUI({ width: 310 });

  const settings = {
    "line width": 12,
    "line height": 150,
    "noise speed": 0.03,
    "noise increment x": 0.4,
    "noise increment y": 0.4,
    "change random colour": () => randomColour(),
  };

  gui
    .add(settings, "line width", 1, 20, 1)
    .onChange((val) => (lineWidth = val));
  gui
    .add(settings, "line height", 50, 300, 1)
    .onChange((val) => (lineHeight = val));

  gui
    .add(settings, "noise speed", 0.01, 0.5, 0.01)
    .onChange((val) => (noiseSpeed = val / 10000));

  gui
    .add(settings, "noise increment x", 0.01, 1, 0.01)
    .onChange((val) => (noiseIncrementX = val / 10));

  gui
    .add(settings, "noise increment y", 0.01, 1, 0.01)
    .onChange((val) => (noiseIncrementY = val / 10));

  gui.add(settings, "change random colour");
};
setupGUI();
