import * as THREE from "three";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { mapNoise } from "./utils/utils";

export default class Stick {
  constructor(_lineWidth, _lineHeight, _x, _y, _width, _height, _scene) {
    // The colors and points arrays, most be of equal length,
    // they store the line points in a sequence of r, g, b numbers for the * colors and x, y, z sequence for the points arrays
    this.colors = [0, 0, 0, 0, 0.3, 1];
    this.points = [0, 0, 0, 0, 0, 1];

    this.lineWidth = _lineWidth;
    this.lineHeight = _lineHeight;

    this.x = _x;
    this.y = _y;
    this.width = _width;
    this.height = _height;

    this.line;
    this.pivot = new THREE.Group();
    this.scene = _scene;
  }

  init() {
    const material = new LineMaterial({
      color: 0xffffff,
      vertexColors: true,
      linewidth: this.lineWidth,
      resolution: new THREE.Vector2(this.width, this.height),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      alphaToCoverage: false,
    });

    const geometry = new LineGeometry();
    geometry.setPositions(this.points);
    geometry.setColors(this.colors);

    this.line = new Line2(geometry, material);
    this.line.geometry.verticesNeedUpdate = true;

    this.pivot.position.set(this.x, this.y, 0);
    this.pivot.add(this.line);
    this.scene.add(this.pivot);
  }

  update(_noise) {
    const stickHeight = mapNoise(_noise, -1, 1, 0, this.lineHeight);
    this.line.scale.z = stickHeight;

    // update line opacity based on noise
    const opacity = mapNoise(_noise, -1, 1, 0, 1);
    this.line.material.opacity = opacity;

    const angle = _noise * Math.PI * 2;
    // create vector from angle
    const x = Math.cos(angle);
    const y = Math.sin(angle);
    const z = 0;
    const vector = new THREE.Vector3(x, y, z);

    // get vector direction
    vector.normalize();

    // set rotation from vector
    const euler = new THREE.Euler();
    euler.setFromVector3(vector);
    this.pivot.rotation.copy(euler);

    // rotate on x and y axis based on noise
    // const rotX = mapNoise(_noise, -1, 1, 0, Math.PI * 2);
    // const rotY = mapNoise(_noise, -1, 1, 0, Math.PI * 2);
    // this.pivot.rotation.set(rotX, rotY, 0);
  }
}
