import { createBrowserRouter } from "react-router-dom";
import { Suspense, lazy } from "react";
import { DashboardPage } from "../pages/dashboard-page";

const CalculationPage = lazy(() => import("../pages/calculation-page").then((m) => ({ default: m.CalculationPage })));
const ContainersPage = lazy(() => import("../pages/containers-page").then((m) => ({ default: m.ContainersPage })));

export const router = createBrowserRouter([
  {
    path: "/",
    element: <DashboardPage />
  },
  {
    path: "/calculations/:id",
    element: (
      <Suspense fallback={<div className="card">Загрузка 3D...</div>}>
        <CalculationPage />
      </Suspense>
    )
  },
  {
    path: "/containers",
    element: (
      <Suspense fallback={<div className="card">Загрузка контейнеров...</div>}>
        <ContainersPage />
      </Suspense>
    )
  }
]);
