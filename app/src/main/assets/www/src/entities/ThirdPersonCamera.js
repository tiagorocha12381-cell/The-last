import * as THREE from 'three';
import { GAME_CONFIG } from '../config/constants.js';
import { clamp, damp } from '../utils/MathUtils.js';

export class ThirdPersonCamera {
  constructor(camera, input) {
    this.camera = camera;
    this.input = input;
    this.cfg = GAME_CONFIG.camera;
    this.yaw = Math.PI; // behind player looking -Z
    this.pitch = 0.32;
    this.distance = this.cfg.followDistance;
    this.currentPos = new THREE.Vector3();
    this.currentLook = new THREE.Vector3();
    this._initialized = false;
    this.vehicleMode = false;
  }

  setVehicleMode(on) {
    this.vehicleMode = !!on;
    this.distance = this.vehicleMode ? 7.5 : this.cfg.followDistance;
    if (this.vehicleMode) this.pitch = 0.28;
  }

  resetBehind(targetPos, playerYaw) {
    this.yaw = playerYaw + Math.PI;
    this.pitch = 0.32;
    this._updateVectors(targetPos, 1);
    this.currentPos.copy(this._desiredPos);
    this.currentLook.copy(this._desiredLook);
    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.currentLook);
    this._initialized = true;
  }

  _updateVectors(targetPos, dt) {
    const lookDelta = this.input.consumeLookDelta();
    const sens = this.input._touchMode ? this.cfg.touchLookSensitivity : this.cfg.lookSensitivity;
    const invY = this.cfg.invertY ? -1 : 1;
    this.yaw -= lookDelta.dx * sens;
    this.pitch -= lookDelta.dy * sens * invY;
    this.pitch = clamp(this.pitch, this.cfg.minPitch, this.cfg.maxPitch);

    const horizDist = Math.cos(this.pitch) * this.distance;
    const yOff = Math.sin(this.pitch) * this.distance + this.cfg.followHeight;
    const behindX = Math.sin(this.yaw) * horizDist;
    const behindZ = Math.cos(this.yaw) * horizDist;

    this._desiredPos = new THREE.Vector3(
      targetPos.x + behindX,
      targetPos.y + yOff,
      targetPos.z + behindZ
    );
    // keep camera above ground
    if (this._desiredPos.y < 0.8) this._desiredPos.y = 0.8;

    this._desiredLook = new THREE.Vector3(
      targetPos.x - Math.sin(this.yaw) * this.cfg.shoulder,
      targetPos.y + this.cfg.lookHeight,
      targetPos.z - Math.cos(this.yaw) * this.cfg.shoulder
    );

    const posLambda = 10;
    const lookLambda = 12;
    if (dt >= 1) {
      this.currentPos.copy(this._desiredPos);
      this.currentLook.copy(this._desiredLook);
    } else {
      this.currentPos.x = damp(this.currentPos.x, this._desiredPos.x, posLambda, dt);
      this.currentPos.y = damp(this.currentPos.y, this._desiredPos.y, posLambda, dt);
      this.currentPos.z = damp(this.currentPos.z, this._desiredPos.z, posLambda, dt);
      this.currentLook.x = damp(this.currentLook.x, this._desiredLook.x, lookLambda, dt);
      this.currentLook.y = damp(this.currentLook.y, this._desiredLook.y, lookLambda, dt);
      this.currentLook.z = damp(this.currentLook.z, this._desiredLook.z, lookLambda, dt);
    }
  }

  update(targetPos, dt) {
    if (!this._initialized) this.resetBehind(targetPos, 0);
    this._updateVectors(targetPos, dt);
    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.currentLook);
  }

  getYaw() { return this.yaw; }
}
