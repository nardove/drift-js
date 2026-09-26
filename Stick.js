import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { mapNoise } from './utils/utils';

export default class Stick {
  constructor(_lineWidth, _lineHeight, _x, _y, _width, _height, _scene) {
    // The colors and points arrays, most be of equal length,
    // they store the line points in a sequence of r, g, b numbers for the * colors and x, y, z sequence for the points arrays
    this.colors = [0, 0, 0, 0, 0.3, 1];
    this.points = [0, 0, 0, 0, 0, 1];

    this.lineWidth = _lineWidth;
    this.lineHeight = _lineHeight;
    this.rotationAngle = 0;

    this.x = _x;
    this.y = _y;
    this.width = _width;
    this.height = _height;

    this.line;
    this.pivot = new THREE.Group();
    this.scene = _scene;

    this.directionX = 1;
    this.directionY = 0;
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

  update(_noise, _deltaTime) {
    const stickHeight = mapNoise(_noise, -1, 1, 0, this.lineHeight);
    this.line.scale.z = stickHeight;
    this.line.material.opacity = mapNoise(_noise, -1, 1, 0, 1);

    const targetAngle = _noise * Math.PI;
    const targetX = Math.cos(targetAngle);
    const targetY = Math.sin(targetAngle);
    const blend = 1 - Math.exp(-4 * _deltaTime);

    this.directionX += (targetX - this.directionX) * blend;
    this.directionY += (targetY - this.directionY) * blend;

    const directionLength = Math.hypot(this.directionX, this.directionY) || 1;
    const tilt = mapNoise(_noise, -1, 1, 0.2, 0.8);

    this.pivot.rotation.set(
      (this.directionX / directionLength) * tilt,
      (this.directionY / directionLength) * tilt,
      0,
    );
  }
}
