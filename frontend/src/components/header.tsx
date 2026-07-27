import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { BurgerIcon, CrossIcon } from "./icons";

const NAV_LINKS = [
  { to: "/containers", label: "Контейнеры" },
  { to: "/products", label: "База товаров" },
  { to: "/history", label: "История расчётов" }
];

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  return (
    <>
      <header className="appHeader">
        <NavLink to="/" className="appLogo" end onClick={() => setMenuOpen(false)}>
          <span className="appLogoName">Container Planner</span>
          <span className="appLogoSub">// 3D LOADING OPTIMIZER</span>
        </NavLink>

        <nav className="appNav">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => `appNavLink${isActive ? " active" : ""}`}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <button
          type="button"
          className="burgerBtn"
          title="Меню"
          aria-label="Меню"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <CrossIcon size={20} strokeWidth={2} /> : <BurgerIcon size={20} />}
        </button>
      </header>

      <AnimatePresence>
        {menuOpen ? (
          <>
            <div className="navMenuOverlay" onClick={() => setMenuOpen(false)} />
            <motion.nav
              className="navMenu"
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.2, 0.7, 0.2, 1] }}
            >
              {NAV_LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) => `navMenuLink${isActive ? " active" : ""}`}
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </NavLink>
              ))}
            </motion.nav>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}
