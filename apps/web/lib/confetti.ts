import confetti from "canvas-confetti";

const COLORS = ["#f5c542", "#4ade80", "#60a5fa", "#f472b6", "#ffffff"];

export function fireWinConfetti() {
  const duration = 2800;
  const end = Date.now() + duration;

  const frame = () => {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.65 },
      colors: COLORS,
      zIndex: 9999,
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.65 },
      colors: COLORS,
      zIndex: 9999,
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  };

  confetti({
    particleCount: 120,
    spread: 80,
    origin: { y: 0.55 },
    colors: COLORS,
    zIndex: 9999,
  });
  frame();
}
