import { NavLink } from "react-router-dom";

export function Header() {
  return (
    <header className="appHeader">
      <NavLink to="/" className="appLogo" end>
        <span className="appLogoName">Container Planner</span>
        <span className="appLogoSub">// 3D LOADING OPTIMIZER</span>
      </NavLink>
      <nav className="appNav">
        <NavLink to="/containers" className={({ isActive }) => `appNavLink${isActive ? " active" : ""}`}>
          Контейнеры
        </NavLink>
        <NavLink to="/products" className={({ isActive }) => `appNavLink${isActive ? " active" : ""}`}>
          База товаров
        </NavLink>
        <NavLink to="/history" className={({ isActive }) => `appNavLink${isActive ? " active" : ""}`}>
          История расчётов
        </NavLink>
      </nav>
    </header>
  );
}
