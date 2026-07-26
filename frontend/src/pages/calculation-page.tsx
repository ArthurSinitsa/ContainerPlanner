import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppFrame } from "../components/app-frame";
import { ArrowLeftIcon, DownloadIcon } from "../components/icons";
import { Layout3DViewer } from "../features/calculations/layout-3d-viewer";
import { extractPackedBoxes } from "../features/calculations/extract-layout";
import { useToast } from "../app/toast-context";
import { api } from "../lib/api";
import type { CalculationRequestDetail, Product, StatusEnum } from "../lib/types";

function StatusPill({ status }: { status: string }) {
  const s = status.toUpperCase();
  if (s === "COMPLETED") {
    return (
      <div className="statusPill success">
        <span className="statusDot" />
        РАСЧЁТ ЗАВЕРШЁН
      </div>
    );
  }
  if (s === "FAILED") {
    return (
      <div className="statusPill failed">
        <span className="statusDot" />
        ОШИБКА РАСЧЁТА
      </div>
    );
  }
  return (
    <div className="statusPill running">
      <span className="statusDot" />
      РАСЧЁТ ИДЁТ
    </div>
  );
}

export function CalculationPage() {
  const { id } = useParams();
  const toast = useToast();
  const numericId = Number(id);
  const [activeContainerIndex, setActiveContainerIndex] = useState(0);
  const [exporting, setExporting] = useState(false);

  const statusQuery = useQuery({
    queryKey: ["calculation-status", numericId],
    queryFn: () => api.getCalculationStatus(numericId),
    enabled: Number.isFinite(numericId),
    refetchInterval: (query) => {
      const status = query.state.data?.status as StatusEnum | string | undefined;
      if (status === "COMPLETED" || status === "FAILED") return false;
      return 2000;
    }
  });

  const isCompleted = String(statusQuery.data?.status ?? "").toUpperCase() === "COMPLETED";

  const detailsQuery = useQuery<CalculationRequestDetail>({
    queryKey: ["calculation", numericId],
    queryFn: () => api.getCalculationById(numericId),
    enabled: isCompleted
  });

  const containersQuery = useQuery({ queryKey: ["containers"], queryFn: api.getContainers });
  const productsQuery = useQuery({ queryKey: ["products"], queryFn: api.getProducts, enabled: isCompleted });

  const status = statusQuery.data?.status ?? null;
  const resultCards = detailsQuery.data?.results ?? [];
  const activeResult = resultCards[activeContainerIndex];

  const boxes = useMemo(() => (activeResult ? extractPackedBoxes({ results: [activeResult] }) : []), [activeResult]);

  const containerNameById = useMemo(() => {
    const map = new Map<number, string>();
    containersQuery.data?.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [containersQuery.data]);

  const productByProductId = useMemo(() => {
    const map = new Map<number, Product>();
    productsQuery.data?.forEach((p) => map.set(p.product_id, p));
    return map;
  }, [productsQuery.data]);

  const activeContainerType = useMemo(() => {
    if (!activeResult || !containersQuery.data) return null;
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

  const containerByProduct = useMemo(() => {
    const map = new Map<number, number>();
    resultCards.forEach((r) => {
      r.products.forEach((p) => {
        if (!map.has(p.product_id)) map.set(p.product_id, r.container_number);
      });
    });
    return map;
  }, [resultCards]);

  useEffect(() => {
    if (resultCards.length && activeContainerIndex > resultCards.length - 1) {
      setActiveContainerIndex(0);
    }
  }, [activeContainerIndex, resultCards.length]);

  const activeContainerName = activeResult ? `Контейнер #${activeResult.container_number}` : "";

  const downloadLayout = async () => {
    setExporting(true);
    try {
      await api.downloadRequestExport(numericId);
    } catch {
      toast.pushToast({
        type: "info",
        title: "Раскладка недоступна",
        message: "Серверная выгрузка раскладки ещё не реализована."
      });
    } finally {
      setExporting(false);
    }
  };

  if (!Number.isFinite(numericId)) {
    return (
      <AppFrame>
        <div className="card">Некорректный ID заявки.</div>
      </AppFrame>
    );
  }

  if (statusQuery.isLoading) {
    return (
      <AppFrame>
        <div className="card">Опрашиваем статус расчёта...</div>
      </AppFrame>
    );
  }

  if (statusQuery.isError || !statusQuery.data) {
    return (
      <AppFrame>
        <div className="card">Не удалось загрузить статус расчёта.</div>
      </AppFrame>
    );
  }

  const subtitle = isCompleted
    ? `${resultCards.length} ${resultCards.length === 1 ? "контейнер" : "контейнера"} · ${
        detailsQuery.data?.items.length ?? 0
      } SKU`
    : statusQuery.data.status_display || String(status);

  return (
    <AppFrame>
      <div className="calcHeaderRow">
        <div className="calcTitleGroup">
          <Link to="/" className="backBtn" aria-label="Назад">
            <ArrowLeftIcon size={18} />
          </Link>
          <div>
            <h1 className="calcTitle">Заявка #{numericId}</h1>
            <div className="calcSubtitle">{subtitle}</div>
          </div>
        </div>
        <div className="row">
          {isCompleted ? (
            <button className="btn btn-invert" type="button" onClick={downloadLayout} disabled={exporting}>
              <DownloadIcon size={16} />
              Скачать раскладку
            </button>
          ) : null}
          <StatusPill status={String(status)} />
        </div>
      </div>

      {String(status).toUpperCase() === "FAILED" ? (
        <div className="error">
          Расчёт завершился с ошибкой. Попробуйте создать заявку повторно или обратитесь к администратору.
        </div>
      ) : (
        <>
          <div className="calcGrid">
            <article className="card viewerCard" data-glow>
              {isCompleted && detailsQuery.data ? (
                boxes.length > 0 ? (
                  <Layout3DViewer boxes={boxes} showLabels={false} activeName={activeContainerName} containerShell={containerShell} />
                ) : (
                  <div className="emptyPanel">
                    <p>Не удалось распознать раскладку (packing_layout).</p>
                    <p>Объектов в выбранном контейнере: {activeResult?.packing_layout?.length ?? 0}</p>
                  </div>
                )
              ) : (
                <div className="emptyPanel">
                  <p>Расчёт ещё не завершён — 3D-раскладка появится автоматически.</p>
                  <p>
                    Текущий статус: <strong>{statusQuery.data.status_display || status}</strong>
                  </p>
                </div>
              )}
            </article>

            <div className="containerPanel">
              <div className="containerPanelHead">
                <span className="monoLabel">Раскладка по контейнерам</span>
                <span className="monoLabel" style={{ color: "var(--accent)" }}>
                  {resultCards.length || ""}
                </span>
              </div>
              <div className="containerPanelList">
                {resultCards.length ? (
                  resultCards.map((result, index) => {
                    const isActive = index === activeContainerIndex;
                    const typeName = containerNameById.get(result.container_type) ?? `ID ${result.container_type}`;
                    return (
                      <button
                        key={result.id}
                        type="button"
                        className={`containerCard${isActive ? " active" : ""}`}
                        onClick={() => setActiveContainerIndex(index)}
                      >
                        <div className="containerCardHead">
                          <div>
                            <div className="containerCardName">Контейнер #{result.container_number}</div>
                            <div className="containerCardType">{typeName}</div>
                          </div>
                          <div className="containerCardWeight">
                            {result.total_weight_kg.toFixed(0)} <span>кг</span>
                          </div>
                        </div>
                        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 8 }}>
                          <div>
                            <div className="barHead">
                              <span className="muted">Объём</span>
                              <span className="accentText">{result.volume_utilization_percent.toFixed(1)}%</span>
                            </div>
                            <div className="bar">
                              <div className="barFill accent" style={{ width: `${Math.min(100, result.volume_utilization_percent)}%` }} />
                            </div>
                          </div>
                          <div>
                            <div className="barHead">
                              <span className="muted">Площадь пола</span>
                              <span className="muted">{result.area_utilization_percent.toFixed(1)}%</span>
                            </div>
                            <div className="bar">
                              <div className="barFill neutral" style={{ width: `${Math.min(100, result.area_utilization_percent)}%` }} />
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="emptyPanel" style={{ padding: 24 }}>
                    {isCompleted ? "Результаты пока отсутствуют." : "Появятся после завершения расчёта."}
                  </div>
                )}
              </div>
            </div>
          </div>

          {activeResult?.products?.length ? (
            <article className="card" data-glow style={{ marginTop: 20, padding: "24px 28px" }}>
              <div className="cardHeader">
                <span className="cardTitle">Товары в контейнере #{activeResult.container_number}</span>
                <span className="monoLabel">{activeResult.products.length} позиций</span>
              </div>
              <div className="gtHead" style={{ gridTemplateColumns: "90px 1fr 150px 90px" }}>
                <span>ID</span>
                <span>Название</span>
                <span>SKU</span>
                <span>Кол-во</span>
              </div>
              {activeResult.products.map((p) => (
                <div key={p.product_id} className="gtRow" style={{ gridTemplateColumns: "90px 1fr 150px 90px" }}>
                  <span className="cellId">{p.product_id}</span>
                  <span className="cellName">{p.product_name || "—"}</span>
                  <span className="cellMono">{productByProductId.get(p.product_id)?.sku ?? "—"}</span>
                  <span className="cellQty">{p.quantity}</span>
                </div>
              ))}
            </article>
          ) : null}

          {detailsQuery.data?.items?.length ? (
            <article className="card" data-glow style={{ marginTop: 20, padding: "24px 28px" }}>
              <div className="cardHeader">
                <span className="cardTitle">Все товары в заявке</span>
                <span className="monoLabel">{detailsQuery.data.items.length} позиций</span>
              </div>
              <div className="gtHead" style={{ gridTemplateColumns: "90px 1fr 150px 90px 120px" }}>
                <span>ID</span>
                <span>Название</span>
                <span>SKU</span>
                <span>Кол-во</span>
                <span>Контейнер</span>
              </div>
              {detailsQuery.data.items.map((it) => {
                const p = productByProductId.get(it.product_id);
                const contNo = containerByProduct.get(it.product_id);
                return (
                  <div key={it.product_id} className="gtRow" style={{ gridTemplateColumns: "90px 1fr 150px 90px 120px" }}>
                    <span className="cellId">{it.product_id}</span>
                    <span className="cellName">{p?.name ?? "—"}</span>
                    <span className="cellMono">{p?.sku ?? "—"}</span>
                    <span className="cellQty">{it.quantity}</span>
                    <span className="cellMono">{contNo != null ? `Конт. #${contNo}` : "—"}</span>
                  </div>
                );
              })}
            </article>
          ) : null}
        </>
      )}
    </AppFrame>
  );
}
