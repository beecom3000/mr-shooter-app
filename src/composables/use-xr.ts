import { Text } from 'troika-three-text'
import * as THREE from 'three';
import { gsap } from 'gsap';
import { type GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import type { Globals } from '@/models/globals';
import { Object3D } from 'three';
import { XR_BUTTONS } from 'gamepad-wrapper';

export const useXr = () => {

  const bullets = {};
  const forwardVector = new THREE.Vector3(0, 0, -1);
  const bulletSpeed = 10;
  const bulletTimeToLive = 1;

  const blasterGroup = new THREE.Group();
  const targets = [];

  let score = 0;

  const scoreText = new Text();
  scoreText.fontSize = 0.52;
  scoreText.font = 'assets/SpaceMono-Bold.ttf';
  scoreText.position.z = -2;
  scoreText.color = 0xffa276;
  scoreText.anchorX = 'center';
  scoreText.anchorY = 'middle';

  let laserSound: THREE.PositionalAudio;
  let scoreSound: THREE.PositionalAudio;

  const updateScoreDisplay = () => {
    const clampedScore = Math.max(0, Math.min(9999, score));
    const displayScore = clampedScore.toString().padStart(4, '0');
    scoreText.text = displayScore;
    scoreText.sync();
  }

  const setupScene = (globals: Globals) => {

    const {
      scene,
      camera,
      renderer,
      player,
      controllers
    } = globals;

    const gltfLoader: GLTFLoader = new GLTFLoader();

    gltfLoader.load('assets/spacestation.glb', (gltf: GLTF) => {
      scene.add(gltf.scene);
    });

    gltfLoader.load('assets/blaster.glb', (gltf: GLTF) => {
      blasterGroup.add(gltf.scene);
    });

    gltfLoader.load('assets/target.glb', (gltf: GLTF) => {
      for (let i = 0; i < 3; i++) {
        const target = gltf.scene.clone();
        target.position.set(
          Math.random() * 10 - 5,
          i * 2 + 1,
          -Math.random() * 5 - 5,
        );
        scene.add(target);
        targets.push(target);
      }
    });

    scene.add(scoreText);
    scoreText.position.set(0, 0.67, -1.44);
    scoreText.rotateX(-Math.PI / 3.3);
    updateScoreDisplay();

    // Load and set up positional audio
    const listener = new THREE.AudioListener();
    camera.add(listener);

    const audioLoader = new THREE.AudioLoader();
    laserSound = new THREE.PositionalAudio(listener);
    audioLoader.load('assets/laser.ogg', (buffer) => {
      laserSound.setBuffer(buffer);
      blasterGroup.add(laserSound);
    });

    scoreSound = new THREE.PositionalAudio(listener);
    audioLoader.load('assets/score.ogg', (buffer: AudioBuffer) => {
      scoreSound.setBuffer(buffer);
      scoreText.add(scoreSound);
    });
  }

  // { scene, camera, renderer, player, controllers }: Globals,
  const onFrame = (
    delta: number,
    time: number,
    globals: Globals
  ) => {

    const {
      scene,
      camera,
      renderer,
      player,
      controllers
    } = globals;
    if (controllers.right) {
      const { gamepad, raySpace, mesh } = controllers.right;
      if (!raySpace.children.includes(blasterGroup)) {
        raySpace.add(blasterGroup);
        mesh.visible = false;
      }
      if (gamepad.getButtonClick(XR_BUTTONS.TRIGGER)) {
        try {
          gamepad.getHapticActuator(0).pulse(0.6, 100);
        } catch {
          // do nothing
        }

        // Play laser sound
        if (laserSound.isPlaying) laserSound.stop();
        laserSound.play();

        const bulletPrototype: Object3D = blasterGroup.getObjectByName('bullet');
        if (bulletPrototype) {
          const bullet = bulletPrototype.clone();
          scene.add(bullet);
          bulletPrototype.getWorldPosition(bullet.position);
          bulletPrototype.getWorldQuaternion(bullet.quaternion);

          const directionVector = forwardVector
            .clone()
            .applyQuaternion(bullet.quaternion);
          bullet.userData = {
            velocity: directionVector.multiplyScalar(bulletSpeed),
            timeToLive: bulletTimeToLive,
          };
          bullets[bullet.uuid] = bullet;
        }
      }
    }

    Object.values(bullets).forEach((bullet) => {
      if (bullet.userData.timeToLive < 0) {
        delete bullets[bullet.uuid];
        scene.remove(bullet);
        return;
      }
      const deltaVec = bullet.userData.velocity.clone().multiplyScalar(delta);
      bullet.position.add(deltaVec);
      bullet.userData.timeToLive -= delta;

      targets
        .filter((target) => target.visible)
        .forEach((target) => {
          const distance = target.position.distanceTo(bullet.position);
          if (distance < 1) {
            delete bullets[bullet.uuid];
            scene.remove(bullet);

            gsap.to(target.scale, {
              duration: 0.3,
              x: 0,
              y: 0,
              z: 0,
              onComplete: () => {
                target.visible = false;
                setTimeout(() => {
                  target.visible = true;
                  target.position.x = Math.random() * 10 - 5;
                  target.position.z = -Math.random() * 5 - 5;

                  // Scale back up the target
                  gsap.to(target.scale, {
                    duration: 0.3,
                    x: 1,
                    y: 1,
                    z: 1,
                  });
                }, 1000);
              },
            });

            score += 10;
            updateScoreDisplay();
            if (scoreSound.isPlaying) scoreSound.stop();
            scoreSound.play();
          }
        });
    });
    gsap.ticker.tick(delta);
  }

  return {
    updateScoreDisplay,
    setupScene,
    onFrame
  }
}
