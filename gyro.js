/* gyro.js — Blickparallaxe ueber den Lagesensor des Telefons.
   Schwenken / Drehen / Kippen bewegt die Ansicht genauso wie sonst die Maus:
   das Modul schreibt ausschliesslich in window.__rb.state.mx / .my — kein Eingriff
   in die Kamera, keine Abhaengigkeit zur Szene. Faellt es aus, bleibt alles beim Alten.

   iOS 13+ verlangt eine Nutzergeste fuer den Sensor -> kleiner MOTION-Chip.
   Android/Desktop-Touch: still verbinden, ohne Chip.
*/
(function () {
  'use strict';

  if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return;
  if (matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  // nur Geraete mit Lagesensor — auf dem Desktop nichts anfassen
  if (!(matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints > 0)) return;

  var DEG = Math.PI / 180;
  var YAW_RANGE   = 26 * DEG;   // volle Auslenkung mx = ±1 bei 26° Schwenk
  var PITCH_RANGE = 20 * DEG;   // volle Auslenkung my = ±1 bei 20° Kippen
  var YAW_SIGN    = -1;         // Telefon nach rechts gedreht -> mx positiv (wie Maus nach rechts)
  var PITCH_SIGN  = -1;         // Oberkante vom Koerper weg -> my negativ (Blick hebt sich)
  var RECENTER_HALFLIFE = 9;    // s — gehaltene Schraeglage driftet langsam zurueck auf neutral
  var TOUCH_BLOCK = 520;        // ms — waehrend/nach einer Wischgeste hat der Finger Vorrang
  var SMOOTH = 0.11;

  var rb = null, THREE = null;
  var q, qRef, qRel, qAux, q1, euler, zee;
  var target = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
  var calibrated = false, attached = false, running = false;
  var lastTouch = 0, lastEvent = 0, lastTick = 0, live = false;
  var chip = null;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // Geraete-Quaternion nach W3C-Konvention (alpha/beta/gamma + Bildschirmdrehung)
  function devQuat(out, alpha, beta, gamma, orient) {
    euler.set(beta, alpha, -gamma, 'YXZ');
    out.setFromEuler(euler);
    out.multiply(q1);                                   // Bildschirm zeigt nach hinten
    out.multiply(qAux.setFromAxisAngle(zee, -orient));  // Hoch-/Querformat
    return out;
  }

  function screenAngle() {
    var a = (screen.orientation && typeof screen.orientation.angle === 'number')
      ? screen.orientation.angle
      : (typeof window.orientation === 'number' ? window.orientation : 0);
    return a * DEG;
  }

  function onOrient(e) {
    if (e.alpha == null && e.beta == null && e.gamma == null) return;
    devQuat(q, (e.alpha || 0) * DEG, (e.beta || 0) * DEG, (e.gamma || 0) * DEG, screenAngle());

    var now = performance.now();
    if (!calibrated) { qRef.copy(q); calibrated = true; lastEvent = now; markLive(); return; }

    qRel.copy(qRef).invert().multiply(q);
    euler.setFromQuaternion(qRel, 'YXZ');

    target.x = clamp(YAW_SIGN * euler.y / YAW_RANGE, -1, 1);
    target.y = clamp(PITCH_SIGN * euler.x / PITCH_RANGE, -1, 1);

    // traege Selbstzentrierung: die Ruhelage wandert dem Nutzer nach
    var dt = Math.min(0.25, (now - lastEvent) / 1000); lastEvent = now;
    qRef.slerp(q, 1 - Math.pow(0.5, dt / RECENTER_HALFLIFE));
    markLive();
  }

  function markLive() {
    if (live) return;
    live = true;
    if (chip) { chip.remove(); chip = null; }
  }

  function tick(now) {
    requestAnimationFrame(tick);
    if (!calibrated || !rb || !rb.state) return;
    var dt = Math.min(0.05, (now - lastTick) / 1000); lastTick = now;
    if (now - lastTouch < TOUCH_BLOCK) return;          // Finger schlaegt Sensor
    var k = 1 - Math.pow(1 - SMOOTH, dt * 60);
    // im Cockpit darf der Kopf weiter wandern — das ist der Blick des Astronauten
    var gain = 1 + 0.55 * (rb.state.cock || 0);
    cur.x += (target.x * gain - cur.x) * k;
    cur.y += (target.y * gain - cur.y) * k;
    rb.state.mx = clamp(cur.x, -1.6, 1.6);
    rb.state.my = clamp(cur.y, -1.6, 1.6);
  }

  function attach() {
    if (attached) return;
    attached = true;
    addEventListener('deviceorientation', onOrient, { passive: true });
    if (!running) { running = true; lastTick = performance.now(); requestAnimationFrame(tick); }
  }

  function recenter() { calibrated = false; target.x = target.y = 0; }

  function makeChip() {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = 'Motion';
    b.setAttribute('aria-label', 'Bewegungssensor aktivieren');
    b.style.cssText = [
      'position:fixed', 'left:50%', 'transform:translateX(-50%)',
      'bottom:calc(max(20px, env(safe-area-inset-bottom)) + 74px)',
      'z-index:12', 'appearance:none', 'cursor:pointer',
      'padding:9px 15px', 'border-radius:999px',
      'border:1px solid rgba(244,244,242,.14)',
      'background:rgba(10,14,22,.42)',
      '-webkit-backdrop-filter:blur(14px) saturate(140%)',
      'backdrop-filter:blur(14px) saturate(140%)',
      'color:rgba(244,244,242,.62)',
      'font:500 11px/1 "JetBrains Mono", ui-monospace, monospace',
      'letter-spacing:.2em', 'text-transform:uppercase',
      'opacity:0', 'transition:opacity .9s cubic-bezier(.22,.61,.36,1) 1.6s'
    ].join(';');
    b.addEventListener('click', function (ev) {
      ev.stopPropagation();
      DeviceOrientationEvent.requestPermission().then(function (r) {
        if (r === 'granted') { attach(); b.remove(); chip = null; }
        else { b.textContent = 'Motion off'; setTimeout(function () { b.remove(); chip = null; }, 1600); }
      }).catch(function () { b.remove(); chip = null; });
    });
    document.body.appendChild(b);
    requestAnimationFrame(function () { b.style.opacity = '1'; });
    return b;
  }

  function start() {
    rb = window.__rb;
    if (!rb || !rb.state || !rb.THREE) return false;
    THREE = rb.THREE;
    q = new THREE.Quaternion(); qRef = new THREE.Quaternion();
    qRel = new THREE.Quaternion(); qAux = new THREE.Quaternion();
    q1 = new THREE.Quaternion(-Math.SQRT1_2, 0, 0, Math.SQRT1_2);
    euler = new THREE.Euler(); zee = new THREE.Vector3(0, 0, 1);

    var mark = function () { lastTouch = performance.now(); };
    addEventListener('touchstart', mark, { passive: true, capture: true });
    addEventListener('touchmove', mark, { passive: true, capture: true });
    addEventListener('touchend', mark, { passive: true, capture: true });
    addEventListener('orientationchange', recenter, { passive: true });
    if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', recenter);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) recenter(); });

    if (typeof DeviceOrientationEvent.requestPermission === 'function') chip = makeChip();  // iOS
    else attach();                                                                          // alle anderen

    rb.gyro = {
      recenter: recenter,
      enable: attach,
      disable: function () { if (attached) { removeEventListener('deviceorientation', onOrient); attached = false; calibrated = false; } },
      state: function () { return { attached: attached, calibrated: calibrated, live: live, target: { x: target.x, y: target.y } }; },
      tune: function (o) {
        if (!o) return;
        if (o.yawDeg) YAW_RANGE = o.yawDeg * DEG;
        if (o.pitchDeg) PITCH_RANGE = o.pitchDeg * DEG;
        if (o.yawSign) YAW_SIGN = o.yawSign;
        if (o.pitchSign) PITCH_SIGN = o.pitchSign;
      }
    };
    return true;
  }

  // __rb entsteht erst, wenn das Modul-Script der Seite gelaufen ist
  if (!start()) {
    var tries = 0;
    var iv = setInterval(function () { if (start() || ++tries > 200) clearInterval(iv); }, 60);
  }
})();
