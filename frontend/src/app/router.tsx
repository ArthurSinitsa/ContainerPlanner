import { createBrowserRouter } from "react-router-dom";
import { Suspense, lazy } from "react";
import { DashboardPage } from "../pages/dashboard-page";

const CalculationPage = lazy(() => import("../pages/calculation-page").then((m) => ({ default: m.CalculationPage })));
const ContainersPage = lazy(() => import("../pages/containers-page").then((m) => ({ default: m.ContainersPage })));
const HistoryPage = lazy(() => import("../pages/history-page").then((m) => ({ default: m.HistoryPage })));
const ProductsPage = lazy(() => import("../pages/products-page").then((m) => ({ default: m.ProductsPage })));

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
  },
  {
    path: "/history",
    element: (
      <Suspense fallback={<div className="card">Загрузка истории...</div>}>
        <HistoryPage />
      </Suspense>
    )
  },
  {
    path: "/products",
    element: (
      <Suspense fallback={<div className="card">Загрузка товаров...</div>}>
        <ProductsPage />
      </Suspense>
    )
  }
]);