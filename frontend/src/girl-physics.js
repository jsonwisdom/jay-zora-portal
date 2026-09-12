const PHI = 1.61803398875;
const ROOT2 = 1.41421356237;
const ROOT3 = 1.73205080757;

function phaseFor(index) {
  return (index + 1) * PHI * Math.PI;
}

function setVar(el, name, value) {
  if (el) el.style.setProperty(name, value);
}

export function activateGirlPhysics() {
  if (typeof window === "undefined") return () => {};

  const root = document.documentElement;
  let raf = 0;
  let pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2, active: false };
  let softPointer = { ...pointer };

  function onPointerMove(event) {
    pointer = { x: event.clientX, y: event.clientY, active: true };
    root.classList.add("presence-awake");
  }

  function onPointerLeave() {
    pointer.active = false;
    root.classList.remove("presence-awake");
  }

  function tick(now) {
    const t = now * 0.001;
    softPointer.x += (pointer.x - softPointer.x) * 0.065;
    softPointer.y += (pointer.y - softPointer.y) * 0.065;

    const nodes = document.querySelectorAll(".grove-node");
    nodes.forEach((node, index) => {
      const phase = phaseFor(index);
      const swayX = Math.sin(t * 0.31 + phase) * 4 + Math.sin(t * 0.137 + phase * ROOT2) * 1.5;
      const swayY = Math.cos(t * 0.23 + phase) * 3 + Math.sin(t * 0.173 + phase * ROOT3) * 1.25;

      const rect = node.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = softPointer.x - cx;
      const dy = softPointer.y - cy;
      const dist = Math.max(1, Math.hypot(dx, dy));
      const gravity = pointer.active ? Math.max(0, 1 - dist / 360) : 0;
      const pullX = (dx / dist) * gravity * 5.5;
      const pullY = (dy / dist) * gravity * 5.5;
      const glow = 0.72 + Math.sin(t * 0.19 + phase) * 0.12 + Math.sin(t * 0.071 + phase * PHI) * 0.08 + gravity * 0.18;

      setVar(node, "--sway-x", `${(swayX + pullX).toFixed(2)}px`);
      setVar(node, "--sway-y", `${(swayY + pullY).toFixed(2)}px`);
      setVar(node, "--alive-glow", glow.toFixed(3));
      setVar(node, "--presence-pull", gravity.toFixed(3));
    });

    const camera = document.querySelector(".forest-camera");
    if (camera && pointer.active) {
      const nx = (softPointer.x / window.innerWidth - 0.5) * 10;
      const ny = (softPointer.y / window.innerHeight - 0.5) * 8;
      setVar(camera, "--attention-x", `${nx.toFixed(2)}px`);
      setVar(camera, "--attention-y", `${ny.toFixed(2)}px`);
    }

    const paths = document.querySelectorAll(".observer-path, .ghost-path");
    paths.forEach((path, index) => {
      const phase = phaseFor(index);
      const breathe = 0.16 + Math.sin(t * 0.11 + phase) * 0.04 + Math.sin(t * 0.047 + phase * ROOT2) * 0.03;
      path.style.opacity = Math.max(0.06, Math.min(0.34, breathe)).toFixed(3);
    });

    raf = window.requestAnimationFrame(tick);
  }

  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerleave", onPointerLeave, { passive: true });
  raf = window.requestAnimationFrame(tick);

  return () => {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerleave", onPointerLeave);
    window.cancelAnimationFrame(raf);
  };
}
