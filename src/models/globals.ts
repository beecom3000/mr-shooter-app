import * as THREE from 'three';
import type { Controller } from '@/models/controller';

export interface Globals {
  scene: THREE.Scene;
  camera: THREE.Camera;
  renderer: THREE.WebGLRenderer
  player: THREE.Group;
  controllers: Controller;
}
