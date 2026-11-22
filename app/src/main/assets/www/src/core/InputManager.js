export class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pointerLocked = false;
    this.lookDeltaX = 0;
    this.lookDeltaY = 0;
    this.moveX = 0; // -1..1
    this.moveY = 0; // -1..1 (forward positive)
    this.run = false;
    this.crouch = false;
    this.crouchToggleQueued = false;
    this.jumpQueued = false;
    this.interactQueued = false;
    this.inventoryToggleQueued = false;
    this.missionToggleQueued = false;
    this.mapToggleQueued = false;
    this.charToggleQueued = false;
    this.attackQueued = false;
    this.specialQueued = false;
    this.reloadQueued = false;
    this.weaponCycleQueued = false;
    this.quickSlotQueued = null; // 0-3
    this.enabled = true;
    this.menuActive = false;

    this._onKeyDown = (e) => {
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Tab'].includes(e.code)) e.preventDefault();
      this.keys.add(e.code);
      if (e.code === 'Space') this.jumpQueued = true;
      if (e.code === 'KeyE' || e.code === 'Enter') this.interactQueued = true;
      if (e.code === 'KeyI' || e.code === 'Tab') { e.preventDefault(); this.inventoryToggleQueued = true; }
      if (e.code === 'KeyM') { this.missionToggleQueued = true; }
      if (e.code === 'KeyN') { this.mapToggleQueued = true; }
      if (e.code === 'KeyC') { this.charToggleQueued = true; }
      if (e.code === 'ControlLeft' || e.code === 'ControlRight') { this.crouch = true; }
      if (e.code === 'KeyF' || e.code === 'KeyJ') this.attackQueued = true;
      if (e.code === 'KeyQ') this.specialQueued = true;
      if (e.code === 'KeyR') this.reloadQueued = true;
      if (e.code === 'KeyV') this.weaponCycleQueued = true;
      if (e.code === 'Digit1') this.quickSlotQueued = 0;
      if (e.code === 'Digit2') this.quickSlotQueued = 1;
      if (e.code === 'Digit3') this.quickSlotQueued = 2;
      if (e.code === 'Digit4') this.quickSlotQueued = 3;
    };
    this._onKeyUp = (e) => { this.keys.delete(e.code); if (e.code === 'ControlLeft' || e.code === 'ControlRight') this.crouch = this.keys.has('ControlLeft') || this.keys.has('ControlRight'); };
    this._onMouseMove = (e) => {
      if (!this.pointerLocked) return;
      this.lookDeltaX += e.movementX || 0;
      this.lookDeltaY += e.movementY || 0;
    };
    this._onPointerLockChange = () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
    };
    this._onClick = () => {
      if (this._touchMode) return;
      if (this.menuActive) return;
      if (document.pointerLockElement !== this.canvas) this.canvas.requestPointerLock?.();
      else this.attackQueued = true;
    };

    this._touchMode = false;
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
    this.canvas.addEventListener('click', this._onClick);
  }

  setTouchMode(on) { this._touchMode = on; }

  consumeLookDelta() {
    const dx = this.lookDeltaX;
    const dy = this.lookDeltaY;
    this.lookDeltaX = 0;
    this.lookDeltaY = 0;
    return { dx, dy };
  }

  consumeJump() { const j = this.jumpQueued; this.jumpQueued = false; return j; }
  consumeInteract() { const v = this.interactQueued; this.interactQueued = false; return v; }
  consumeInventoryToggle() { const v = this.inventoryToggleQueued; this.inventoryToggleQueued = false; return v; }
  consumeMissionToggle() { const v = this.missionToggleQueued; this.missionToggleQueued = false; return v; }
  consumeMapToggle() { const v = this.mapToggleQueued; this.mapToggleQueued = false; return v; }
  consumeCharToggle() { const v = this.charToggleQueued; this.charToggleQueued = false; return v; }
  consumeAttack() { const v = this.attackQueued; this.attackQueued = false; return v; }
  consumeSpecial() { const v = this.specialQueued; this.specialQueued = false; return v; }
  consumeReload() { const v = this.reloadQueued; this.reloadQueued = false; return v; }
  consumeWeaponCycle() { const v = this.weaponCycleQueued; this.weaponCycleQueued = false; return v; }
  consumeQuickSlot() { const v = this.quickSlotQueued; this.quickSlotQueued = null; return v; }
  consumeCrouchToggle() { const v = this.crouchToggleQueued; this.crouchToggleQueued = false; return v; }

  getMovement() {
    let x = this.moveX;
    let y = this.moveY;
    let run = this.run;

    const kx = (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0);
    const ky = (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) - (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0);
    if (kx !== 0 || ky !== 0) { x = kx; y = ky; }
    if (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) run = true;
    const crouch = !!this.crouch;

    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y, run, crouch };
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
    this.canvas.removeEventListener('click', this._onClick);
  }
}
