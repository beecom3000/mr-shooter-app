<template>
  <div id="container" ref="container"></div>
</template>

<script setup lang="ts">

import { onMounted, ref, useTemplateRef } from 'vue';
import { metaQuest3, XRDevice } from 'iwer';
import * as THREE from 'three'
import { DevUI } from '@iwer/devui';

import { useXr } from '@/composables/use-xr';
import type { Globals } from '@/models/globals';
import { GamepadWrapper } from 'gamepad-wrapper';
import type { XRController } from 'iwer/lib/device/XRController';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { VRButton } from 'three/examples/jsm/webxr/VRButton';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory';

const container = useTemplateRef<HTMLDivElement>('container');

const { setupScene , onFrame } = useXr();

onMounted(() => {
  // if (navigator.xr) {
  //   navigator.xr.isSessionSupported('immersive-vr').then((isSupported) => {
  //     alert(`onMounted Native Web XR Support: ${isSupported}`);
  //     alert('In the promise land')
  //   })
  // }
  //
  // alert('somewhere outside')

  init(setupScene, onFrame);
})

const nativeWebXRSupport = ref<boolean>(false);

const init = async (setupScene = (globals: Globals) => {},
                    onFrame = (delta: number, time: number, globals: Globals) => {}) => {
  // iwer setup
  if (navigator.xr) {
    nativeWebXRSupport.value = await navigator.xr.isSessionSupported('immersive-vr');
  }
  alert(`Native Web XR Support: ${nativeWebXRSupport.value}`)
  nativeWebXRSupport.value = true;
  if (!nativeWebXRSupport.value) {
    alert('Not supported')
    const xrDevice = new XRDevice(metaQuest3);
    xrDevice.installRuntime();
    xrDevice.fovy = (75 / 180) * Math.PI;		// fovy is the vertical field of view angle, it only has the y so that it's clear the fov is keeping the vertical angle the same
    xrDevice.ipd = 0;
    window.xrdevice = xrDevice;
    xrDevice.controllers.right.position.set(0.15649, 1.43474, -0.38368);
    xrDevice.controllers.right.quaternion.set(
      0.14766305685043335,
      0.02471366710960865,
      -0.0037767395842820406,
      0.9887216687202454,
    );
    xrDevice.controllers.left.position.set(-0.15649, 1.43474, -0.38368);
    xrDevice.controllers.left.quaternion.set(
      0.14766305685043335,
      0.02471366710960865,
      -0.0037767395842820406,
      0.9887216687202454,
    );
    new DevUI(xrDevice);
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x808080);

  const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    100,
  );

  camera.position.set(0, 1.6, 3);

  const controls = new OrbitControls(camera, container.value);
  controls.target.set(0, 1.6, 0);
  controls.update();

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  container.value!.appendChild(renderer.domElement);

  const environment = new RoomEnvironment(renderer);
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  scene.environment = pmremGenerator.fromScene(environment).texture;

  const player = new THREE.Group();
  scene.add(player);
  player.add(camera);

  const controllerModelFactory = new XRControllerModelFactory();
  const controllers = {
    left: null,
    right: null,
  }
  for (let i = 0; i < 2; i++) {
    const raySpace = renderer.xr.getController(i);
    const gripSpace = renderer.xr.getControllerGrip(i);
    const mesh = controllerModelFactory.createControllerModel(gripSpace);
    gripSpace.add(mesh);
    player.add(raySpace, gripSpace);
    raySpace.visible = false;
    gripSpace.visible = false;
    gripSpace.addEventListener('connected', (e) => {
      raySpace.visible = true;
      gripSpace.visible = true;
      const handedness = e.data.handedness;
      controllers[handedness] = {
        raySpace,
        gripSpace,
        mesh,
        gamepad: new GamepadWrapper(e.data.gamepad),
      };
    });
    gripSpace.addEventListener('disconnected', (e) => {
      raySpace.visible = false;
      gripSpace.visible = false;
      const handedness = e.data.handedness;
      controllers[handedness] = null;
    });
  }

  const onWindowResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  window.addEventListener('resize', onWindowResize);

  const globals = {
    scene,
    camera,
    renderer,
    player,
    controllers,
  };

  setupScene(globals);

  const clock = new THREE.Clock();
  function animate() {
    const delta = clock.getDelta();
    const time = clock.getElapsedTime();
    Object.values(controllers).forEach((controller: XRController) => {
      if (controller?.gamepad) {
        controller.gamepad.update();
      }
    });
    onFrame(delta, time, globals);
    renderer.render(scene, camera);
  }

  renderer.setAnimationLoop(animate);

  document.body.appendChild(VRButton.createButton(renderer));
}
</script>
