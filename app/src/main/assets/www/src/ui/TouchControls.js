export class TouchControls {
  constructor(input) {
    this.input = input;
    this.root = document.getElementById('touch-controls');
    this.joystickZone = document.getElementById('joystick-zone');
    this.joystickBase = document.getElementById('joystick-base');
    this.joystickKnob = document.getElementById('joystick-knob');
    this.lookZone = document.getElementById('look-zone');
    this.btnCrouch = document.getElementById('btn-crouch');
    this.btnRun = document.getElementById('btn-run');
    this.btnJump = document.getElementById('btn-jump');
    this.btnInteract = document.getElementById('btn-interact');
    this.btnInv = document.getElementById('btn-inv');
    this.btnMission = document.getElementById('btn-mission');
    this.btnAtk = document.getElementById('btn-atk');
    this.btnSpecial = document.getElementById('btn-special');
    this.btnReload = document.getElementById('btn-reload');
    this.btnCycle = document.getElementById('btn-cycle');

    this.active = false;
    this.joyPointerId = null;
    this.lookPointerId = null;
    this.joyCenter = { x: 0, y: 0 };
    this.joyRadius = 55;
    this.lookLast = { x: 0, y: 0 };
    this.runHeld = false;

    this._bind();
  }

  _isTouchDevice() {
    return (navigator.maxTouchPoints > 0) || 'ontouchstart' in window;
  }

  show() {
    if (!this._isTouchDevice()) return;
    this.active = true;
    this.input.setTouchMode(true);
    this.root.classList.remove('hidden');
    this.root.setAttribute('aria-hidden', 'false');
  }

  hide() {
    this.active = false;
    this.input.setTouchMode(false);
    this.root.classList.add('hidden');
  }

  _bind() {
    this.joystickZone.addEventListener('pointerdown', (e) => {
      if (this.joyPointerId !== null) return;
      this.joyPointerId = e.pointerId;
      this.joystickZone.setPointerCapture?.(e.pointerId);
      const rect = this.joystickBase.getBoundingClientRect();
      this.joyCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      this.joyRadius = rect.width * 0.38;
      this._updateJoystick(e.clientX, e.clientY);
      e.preventDefault();
    });
    this.joystickZone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.joyPointerId) return;
      this._updateJoystick(e.clientX, e.clientY);
      e.preventDefault();
    });
    const endJoy = (e) => {
      if (e.pointerId !== this.joyPointerId) return;
      this.joyPointerId = null;
      this.joystickKnob.style.transform = 'translate(0px, 0px)';
      this.input.moveX = 0;
      this.input.moveY = 0;
      e.preventDefault();
    };
    this.joystickZone.addEventListener('pointerup', endJoy);
    this.joystickZone.addEventListener('pointercancel', endJoy);

    this.lookZone.addEventListener('pointerdown', (e) => {
      if (this.lookPointerId !== null) return;
      this.lookPointerId = e.pointerId;
      this.lookZone.setPointerCapture?.(e.pointerId);
      this.lookLast = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    });
    this.lookZone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.lookPointerId) return;
      const dx = e.clientX - this.lookLast.x;
      const dy = e.clientY - this.lookLast.y;
      this.lookLast = { x: e.clientX, y: e.clientY };
      this.input.lookDeltaX += dx;
      this.input.lookDeltaY += dy;
      e.preventDefault();
    });
    const endLook = (e) => {
      if (e.pointerId !== this.lookPointerId) return;
      this.lookPointerId = null;
      e.preventDefault();
    };
    this.lookZone.addEventListener('pointerup', endLook);
    this.lookZone.addEventListener('pointercancel', endLook);

    this.btnCrouch?.addEventListener('pointerdown', (e) => {
      this.input.crouch = !this.input.crouch;
      this.btnCrouch.classList.toggle('active', !!this.input.crouch);
      e.preventDefault();
    });
    this.btnRun.addEventListener('pointerdown', (e) => { this.runHeld = true; this.input.run = true; this.input.crouch = false; this.btnCrouch?.classList.remove('active'); this.btnRun.classList.add('active'); e.preventDefault(); });
    const endRun = (e) => { this.runHeld = false; this.input.run = false; this.btnRun.classList.remove('active'); e.preventDefault(); };
    this.btnRun.addEventListener('pointerup', endRun);
    this.btnRun.addEventListener('pointercancel', endRun);
    this.btnRun.addEventListener('pointerleave', endRun);

    this.btnJump.addEventListener('pointerdown', (e) => { this.input.jumpQueued = true; this.btnJump.classList.add('active'); e.preventDefault(); });
    const endJump = (e) => { this.btnJump.classList.remove('active'); e.preventDefault(); };
    this.btnJump.addEventListener('pointerup', endJump);
    this.btnJump.addEventListener('pointercancel', endJump);

    this.btnInteract?.addEventListener('pointerdown', (e) => { this.input.interactQueued = true; this.btnInteract.classList.add('active'); e.preventDefault(); });
    const endInteract = (e) => { this.btnInteract?.classList.remove('active'); e.preventDefault(); };
    this.btnInteract?.addEventListener('pointerup', endInteract);
    this.btnInteract?.addEventListener('pointercancel', endInteract);

    this.btnInv?.addEventListener('pointerdown', (e) => { this.input.inventoryToggleQueued = true; this.btnInv.classList.add('active'); e.preventDefault(); });
    const endInv = (e) => { this.btnInv?.classList.remove('active'); e.preventDefault(); };
    this.btnInv?.addEventListener('pointerup', endInv);
    this.btnInv?.addEventListener('pointercancel', endInv);

    this.btnMission?.addEventListener('pointerdown', (e) => { this.input.missionToggleQueued = true; this.btnMission.classList.add('active'); e.preventDefault(); });
    const endMission = (e) => { this.btnMission?.classList.remove('active'); e.preventDefault(); };
    this.btnMission?.addEventListener('pointerup', endMission);
    this.btnMission?.addEventListener('pointercancel', endMission);

    this.btnAtk?.addEventListener('pointerdown', (e) => { this.input.attackQueued = true; this.btnAtk.classList.add('active'); e.preventDefault(); });
    const endAtk = (e) => { this.btnAtk?.classList.remove('active'); e.preventDefault(); };
    this.btnAtk?.addEventListener('pointerup', endAtk);
    this.btnAtk?.addEventListener('pointercancel', endAtk);

    this.btnSpecial?.addEventListener('pointerdown', (e) => { this.input.specialQueued = true; this.btnSpecial.classList.add('active'); e.preventDefault(); });
    const endSpecial = (e) => { this.btnSpecial?.classList.remove('active'); e.preventDefault(); };
    this.btnSpecial?.addEventListener('pointerup', endSpecial);
    this.btnSpecial?.addEventListener('pointercancel', endSpecial);

    this.btnReload?.addEventListener('pointerdown', (e) => { this.input.reloadQueued = true; this.btnReload.classList.add('active'); e.preventDefault(); });
    const endReload = (e) => { this.btnReload?.classList.remove('active'); e.preventDefault(); };
    this.btnReload?.addEventListener('pointerup', endReload);
    this.btnReload?.addEventListener('pointercancel', endReload);

    this.btnCycle?.addEventListener('pointerdown', (e) => { this.input.weaponCycleQueued = true; this.btnCycle.classList.add('active'); e.preventDefault(); });
    const endCycle = (e) => { this.btnCycle?.classList.remove('active'); e.preventDefault(); };
    this.btnCycle?.addEventListener('pointerup', endCycle);
    this.btnCycle?.addEventListener('pointercancel', endCycle);
  }

  _updateJoystick(cx, cy) {
    let dx = cx - this.joyCenter.x;
    let dy = cy - this.joyCenter.y;
    const dist = Math.hypot(dx, dy);
    const max = this.joyRadius;
    if (dist > max) { dx = (dx / dist) * max; dy = (dy / dist) * max; }
    this.joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    this.input.moveX = dx / max;
    this.input.moveY = -(dy / max);
  }
}
