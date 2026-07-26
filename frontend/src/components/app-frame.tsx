import { PropsWithChildren, useEffect, useRef } from "react";
import { Header } from "./header";

/**
 * Каркас страницы: тёмный «безграничный» фон, «фонарик» за курсором
 * (обновляет CSS-переменные --gx/--gy на корне и --mx/--my на каждой [data-glow]
 * карточке — без ре-рендера), sticky-blur шапка и контентный контейнер 1520px.
 */
export function AppFrame({ children }: PropsWithChildren) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const onMove = (e: PointerEvent) => {
      root.style.setProperty("--gx", `${e.clientX}px`);
      root.style.setProperty("--gy", `${e.clientY}px`);
      const cards = root.querySelectorAll<HTMLElement>("[data-glow]");
      cards.forEach((el) => {
        const b = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${e.clientX - b.left}px`);
        el.style.setProperty("--my", `${e.clientY - b.top}px`);
      });
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <div className="appRoot" ref={rootRef}>
      <div className="bgFlashlight" aria-hidden />
      <div className="bgGrid" aria-hidden />
      <div className="pageContainer">
        <Header />
        {children}
      </div>
    </div>
  );
}
