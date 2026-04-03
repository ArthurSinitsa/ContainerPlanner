import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Layout3DViewer } from "../features/calculations/layout-3d-viewer";
import { extractPackedBoxes } from "../features/calculations/extract-layout";
import { api } from "../lib/api";
import type { CalculationRequestDetail, Product, StatusEnum } from "../lib/types";

export function CalculationPage() {
  const { id } = useParams();
  const numericId = Number(id);
  const [activeContainerIndex, setActiveContainerIndex] = useState(0);

  const statusQuery = useQuery({
    queryKey: ["calculation-status", numericId],
    queryFn: () => api.getCalculationStatus(numericId),
    enabled: Number.isFinite(numericId),
    refetchInterval: (query) => {
      const status = query.state.data?.status as StatusEnum | string | undefined;
      if (!status) return 2000;
      if (status === "COMPLETED" || status === "FAILED") return false;
      return 2000;
    }
  });

  const detailsQuery = useQuery<CalculationRequestDetail>({
    queryKey: ["calculation", numericId],
    queryFn: () => api.getCalculationById(numericId),
    enabled: String(statusQuery.data?.status ?? "").toUpperCase() === "COMPLETED"
  });

  const containersQuery = useQuery({
    queryKey: ["containers"],
    queryFn: api.getContainers
  });

  const productsQuery = useQuery({
    queryKey: ["products"],
    queryFn: api.getProducts,
    enabled: String(statusQuery.data?.status ?? "").toUpperCase() === "COMPLETED"
  });

  const status = statusQuery.data?.status ?? null;
  const statusDisplay = statusQuery.data?.status_display ?? "";

  const resultCards = detailsQuery.data?.results ?? [];
  const activeResult = resultCards[activeContainerIndex];

  const boxes = useMemo(() => {
    if (!activeResult) return [];
    return extractPackedBoxes({ results: [activeResult] });
  }, [activeResult]);

  const containerNameById = useMemo(() => {
    const map = new Map<number, string>();
    if (!containersQuery.data) return map;
    for (const item of containersQuery.data) {
      map.set(item.id, item.name);
    }
    return map;
  }, [containersQuery.data]);

  const productByProductId = useMemo(() => {
    const map = new Map<number, Product>();
    if (!productsQuery.data) return map;
    for (const p of productsQuery.data) map.set(p.product_id, p);
    return map;
  }, [productsQuery.data]);

  const activeContainerType = useMemo(() => {
    if (!activeResult) return null;
    if (!containersQuery.data) return null;
    return containersQuery.data.find((c) => c.id === activeResult.container_type) ?? null;
  }, [activeResult, containersQuery.data]);

  const containerShell = useMemo(() => {
    if (!activeResult || !activeContainerType) return undefined;
    return {
      width: activeContainerType.width_mm,
      height: activeContainerType.height_mm,
      depth: activeContainerType.length_mm,
      volumeUtilizationPercent: activeResult.volume_utilization_percent,
      areaUtilizationPercent: activeResult.area_utilization_percent,
      usedVolumeM3: activeResult.total_volume_m3,
      capacityVolumeM3: activeContainerType.volume_m3
    };
  }, [activeResult, activeContainerType]);

  useEffect(() => {
    if (!resultCards.length) return;
    if (activeContainerIndex > resultCards.length - 1) {
      setActiveContainerIndex(0);
    }
  }, [activeContainerIndex, resultCards.length]);

  if (!Number.isFinite(numericId)) {
    return (
      <main className="layout">
        <div className="card">Некорректный ID заявки.</div>
      </main>
    );
  }

  if (statusQuery.isLoading) {
    return (
      <main className="layout">
        <div className="card">Опрашиваем статус расчета...</div>
      </main>
    );
  }

  if (statusQuery.isError || !statusQuery.data) {
    return (
      <main className="layout">
        <div className="card">Не удалось загрузить статус расчета.</div>
      </main>
    );
  }

  if (String(status).toUpperCase() === "FAILED") {
    return (
      <main className="layout">
        <header className="hero row between">
          <div>
            <h1>Заявка #{numericId}</h1>
            <p>Ошибка выполнения</p>
          </div>
          <Link to="/" className="button secondary">
            ← Назад
          </Link>
        </header>
        <div className="error">{statusQuery.data.error_message ?? "Неизвестная ошибка."}</div>
      </main>
    );
  }

  return (
    <main className="layout">
      <header className="hero row between">
        <div>
          <h1>Заявка #{numericId}</h1>
          <p>
            Статус: <strong>{statusDisplay || status}</strong>
          </p>
        </div>
        <Link to="/" className="button secondary">
          ← Назад
        </Link>
      </header>

      <div className="stack" style={{ gap: 16 }}>
        <section className="grid">
          <article className="card full">
            {detailsQuery.isLoading || String(status).toUpperCase() !== "COMPLETED" ? (
              <div className="emptyPanel">
                <p>Расчет ещё не завершен. Мы скоро покажем 3D layout.</p>
                <p>
                  Текущий статус: <strong>{statusDisplay || status}</strong>
                </p>
              </div>
            ) : detailsQuery.data ? (
              boxes.length > 0 ? (
                <Layout3DViewer boxes={boxes} showLabels={false} containerShell={containerShell} />
              ) : (
                <div className="emptyPanel">
                  <p>Не удалось распознать раскладку (packing_layout).</p>
                  <p>В выбранном контейнере объектов: {activeResult?.packing_layout?.length ?? 0}</p>
                </div>
              )
            ) : null}
          </article>
          <article className="card full">
            <h2>Расчет по контейнерам</h2>
            {detailsQuery.data ? resultCards.length ? (
              <div className="resultGrid">
                {resultCards.map((result, index) => {
                  const isActive = index === activeContainerIndex;
                  const containerName = containerNameById.get(result.container_type) ?? `ID ${result.container_type}`;
                  return (
                    <button
                      key={result.id}
                      className={`resultCard ${isActive ? "active" : ""}`}
                      type="button"
                      onClick={() => setActiveContainerIndex(index)}
                    >
                      <div className="resultHeader">
                        <strong>Контейнер #{result.container_number}</strong>
                        <span>{containerName}</span>
                      </div>
                      <div className="resultMetric">
                        <span>Вес</span>
                        <strong>{result.total_weight_kg.toFixed(2)} кг</strong>
                      </div>
                      <div className="resultMetric">
                        <span>Объем</span>
                        <strong>{result.total_volume_m3.toFixed(2)} м3</strong>
                      </div>
                      <div className="resultMetric">
                        <span>Заполнение по объему</span>
                        <strong>{result.volume_utilization_percent.toFixed(2)}%</strong>
                      </div>
                      <div className="miniBar">
                        <div
                          className="miniBarFill volume"
                          style={{ width: `${Math.min(100, result.volume_utilization_percent)}%` }}
                        />
                      </div>
                      <div className="resultMetric">
                        <span>Заполнение по площади</span>
                        <strong>{result.area_utilization_percent.toFixed(2)}%</strong>
                      </div>
                      <div className="miniBar">
                        <div
                          className="miniBarFill area"
                          style={{ width: `${Math.min(100, result.area_utilization_percent)}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="emptyPanel">
                <p>Результаты для этой заявки пока отсутствуют.</p>
              </div>
            ) : (
              <div className="emptyPanel">
                <p>Детали появятся после завершения расчета.</p>
              </div>
            )}
          </article>
        </section>

        <section>
          <article className="card full">
            <h2>Товары в заявке</h2>
            {detailsQuery.data ? (
              detailsQuery.data.items?.length ? (
                productsQuery.isLoading && productsQuery.data == null ? (
                  <div className="emptyPanel">Загрузка товаров...</div>
                ) : (
                  <table className="tableLike">
                    <thead>
                      <tr>
                        <th>product_id</th>
                        <th>Название</th>
                        <th>SKU</th>
                        <th>Количество</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailsQuery.data.items.map((it) => {
                        const p = productByProductId.get(it.product_id);
                        return (
                          <tr key={`${it.product_id}`}>
                            <td>{it.product_id}</td>
                            <td>{p?.name ?? "-"}</td>
                            <td>{p?.sku ?? "-"}</td>
                            <td>{it.quantity}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )
              ) : (
                <div className="emptyPanel">В заявке нет товаров.</div>
              )
            ) : (
              <div className="emptyPanel">Детали появятся после завершения расчета.</div>
            )}
          </article>
        </section>
      </div>
    </main>
  );
}
