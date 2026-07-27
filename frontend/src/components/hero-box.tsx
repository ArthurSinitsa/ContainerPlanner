import { useEffect, useRef } from "react";
import { HeroFrame } from "./icons";

const SPRING_K = 0.075;
const SPRING_DAMP = 0.85;
const GLOW_DECAY = 0.975;
const GLOW_PER_CLICK = 0.34;
const GLOW_MAX = 2.6;
const CLICK_SLOP_PX = 6;
const WOBBLE_COOLDOWN_MS = 900;
const FALLBACK_ACCENT_RGB = "177,140,255";

/**
 * Декоративный каркас контейнера в hero дашборда — «пасхалка», с которой можно играть:
 * перетаскивание по всему экрану с пружинным возвратом, накопление свечения по кликам
 * и покачивание при наведении.
 *
 * Вся физика живёт в ref-ах и правит DOM напрямую — React-стейта здесь нет, чтобы
 * ни один кадр анимации не вызывал ре-рендер. Цикл requestAnimationFrame стартует
 * только на взаимодействие и сам останавливается, когда коробка вернулась на место
 * и свечение погасло, — в покое нагрузки нет.
 */
export function HeroBox() {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const wobbleRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Позиция (p), скорость (v) и цель (t) пружины + текущая яркость свечения
  const motion = useRef({ tx: 0, ty: 0, px: 0, py: 0, vx: 0, vy: 0, glow: 0 });
  const rafRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const dragRef = useRef<{ sx: number; sy: number } | null>(null);
  const wobbleAtRef = useRef(0);

  useEffect(() => {
    const accentRgb = () => {
      const el = boxRef.current;
      if (!el) return FALLBACK_ACCENT_RGB;
      const value = getComputedStyle(el).getPropertyValue("--accent-rgb").trim();
      return value || FALLBACK_ACCENT_RGB;
    };

    const applyGlow = () => {
      const svg = svgRef.current;
      if (!svg) return;

      const g = motion.current.glow;
      if (g < 0.008) {
        svg.style.filter = "";
        return;
      }

      const c = Math.min(1, g);
      const rgb = accentRgb();
      svg.style.filter =
        `drop-shadow(0 0 ${3 + c * 8}px rgba(${rgb},${Math.min(0.85, 0.3 + c * 0.55)})) ` +
        `drop-shadow(0 0 ${c * 30}px rgba(${rgb},${Math.min(0.9, c * 0.8)})) ` +
        `drop-shadow(0 0 ${c * 60}px rgba(${rgb},${c * 0.8})) ` +
        `drop-shadow(0 0 ${c * 100}px rgba(${rgb},${c * 0.55})) ` +
        `saturate(${1 + c * 1.4})`;
    };

    const ensureLoop = () => {
      if (runningRef.current) return;
      runningRef.current = true;

      const loop = () => {
        const m = motion.current;

        m.vx = (m.vx + (m.tx - m.px) * SPRING_K) * SPRING_DAMP;
        m.vy = (m.vy + (m.ty - m.py) * SPRING_K) * SPRING_DAMP;
        m.px += m.vx;
        m.py += m.vy;

        if (boxRef.current) {
          boxRef.current.style.transform = `translate(${m.px.toFixed(2)}px, ${m.py.toFixed(2)}px)`;
        }
        if (!dragRef.current) m.glow *= GLOW_DECAY;
        applyGlow();

        const rest = Math.abs(m.vx) + Math.abs(m.vy) + Math.abs(m.tx - m.px) + Math.abs(m.ty - m.py);
        if (dragRef.current || rest > 0.15 || m.glow > 0.01) {
          rafRef.current = requestAnimationFrame(loop);
          return;
        }

        // Пришли в покой — обнуляем и глушим цикл
        m.px = 0;
        m.py = 0;
        m.vx = 0;
        m.vy = 0;
        m.glow = 0;
        if (boxRef.current) boxRef.current.style.transform = "";
        applyGlow();
        runningRef.current = false;
        rafRef.current = null;
      };

      rafRef.current = requestAnimationFrame(loop);
    };

    const onPointerMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      motion.current.tx = e.clientX - drag.sx;
      motion.current.ty = e.clientY - drag.sy;
      ensureLoop();
    };

    const onPointerUp = (e: PointerEvent) => {
      const drag = dragRef.current;
      dragRef.current = null;

      if (boxRef.current) boxRef.current.style.cursor = "grab";
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);

      motion.current.tx = 0;
      motion.current.ty = 0;

      // Почти без смещения — считаем это кликом и подкидываем свечение
      if (drag && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < CLICK_SLOP_PX) {
        motion.current.glow = Math.min(GLOW_MAX, motion.current.glow + GLOW_PER_CLICK);
      }
      ensureLoop();
    };

    const onPointerDown = (e: PointerEvent) => {
      dragRef.current = { sx: e.clientX, sy: e.clientY };
      const box = boxRef.current;
      if (box) {
        box.style.cursor = "grabbing";
        try {
          box.setPointerCapture(e.pointerId);
        } catch {
          /* капчур не обязателен — слушатели всё равно на window */
        }
      }
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      ensureLoop();
    };

    const onPointerEnter = () => {
      const wobble = wobbleRef.current;
      if (dragRef.current || !wobble?.animate) return;

      const now = Date.now();
      if (now - wobbleAtRef.current < WOBBLE_COOLDOWN_MS) return;
      wobbleAtRef.current = now;

      wobble.animate(
        [
          { transform: "rotate(0deg)" },
          { transform: "rotate(-4deg)" },
          { transform: "rotate(3deg)" },
          { transform: "rotate(-1.5deg)" },
          { transform: "rotate(0deg)" }
        ],
        { duration: 680, easing: "ease-in-out" }
      );
    };

    const box = boxRef.current;
    box?.addEventListener("pointerdown", onPointerDown);
    box?.addEventListener("pointerenter", onPointerEnter);

    return () => {
      box?.removeEventListener("pointerdown", onPointerDown);
      box?.removeEventListener("pointerenter", onPointerEnter);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      runningRef.current = false;
    };
  }, []);

  return (
    <div className="heroBox" ref={boxRef} title="Потяни меня :)">
      <div ref={wobbleRef} style={{ willChange: "transform" }}>
        <div className="heroBoxFloat">
          <HeroFrame ref={svgRef} className="heroBoxSvg" />
        </div>
      </div>
    </div>
  );
}
