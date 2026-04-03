import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { ContainerType } from "../lib/types";
import { api } from "../lib/api";
import { Modal } from "../components/modal";
import { useToast } from "../app/toast-context";
import { extractApiErrorMessage } from "../lib/api-error";

type ContainerModalMode = "add" | "edit";

function toNumberOrNaN(v: string) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

type ContainerFormState = {
  name: string;
  length_mm: string;
  width_mm: string;
  height_mm: string;
  max_weight_kg: string;
  volume_m3: string;
};

export function ContainersPage() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const containersQuery = useQuery({
    queryKey: ["containers"],
    queryFn: api.getContainers
  });

  const [modalMode, setModalMode] = useState<ContainerModalMode | null>(null);
  const [activeContainer, setActiveContainer] = useState<ContainerType | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<ContainerType | null>(null);

  const openAdd = () => {
    setActiveContainer(null);
    setModalMode("add");
  };

  const openEdit = (c: ContainerType) => {
    setActiveContainer(c);
    setModalMode("edit");
  };

  const closeForm = () => {
    setModalMode(null);
    setActiveContainer(null);
  };

  const formInitial = useMemo(() => {
    const base = activeContainer
      ? {
          name: activeContainer.name,
          length_mm: String(activeContainer.length_mm),
          width_mm: String(activeContainer.width_mm),
          height_mm: String(activeContainer.height_mm),
          max_weight_kg: String(activeContainer.max_weight_kg),
          volume_m3: String(activeContainer.volume_m3)
        }
      : {
          name: "",
          length_mm: "",
          width_mm: "",
          height_mm: "",
          max_weight_kg: "",
          volume_m3: ""
        };
    return base;
  }, [activeContainer]);

  const [form, setForm] = useState<ContainerFormState>(formInitial);
  // Keep local form in sync when modal switches containers.
  useEffect(() => {
    setForm(formInitial);
  }, [formInitial]);

  const createOrUpdate = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        length_mm: toNumberOrNaN(form.length_mm),
        width_mm: toNumberOrNaN(form.width_mm),
        height_mm: toNumberOrNaN(form.height_mm),
        max_weight_kg: toNumberOrNaN(form.max_weight_kg),
        volume_m3: toNumberOrNaN(form.volume_m3)
      };

      if (!payload.name) throw new Error("Название контейнера не может быть пустым.");
      if (
        [payload.length_mm, payload.width_mm, payload.height_mm, payload.max_weight_kg, payload.volume_m3].some(
          (n) => !Number.isFinite(n) || n < 0
        )
      ) {
        throw new Error("Числовые поля должны быть корректными (>= 0).");
      }

      if (modalMode === "add") {
        return api.createContainer(payload);
      }
      if (!activeContainer) throw new Error("Нет контейнера для редактирования.");
      return api.updateContainer(activeContainer.id, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["containers"] });
      toast.pushToast({
        type: "success",
        title: "Успех",
        message: modalMode === "add" ? "Контейнер успешно добавлен" : "Контейнер успешно обновлен"
      });
      closeForm();
    },
    onError: (err) => {
      const msg = extractApiErrorMessage(err, "Не удалось выполнить запрос.");
      toast.pushToast({
        type: "error",
        title: "Ошибка",
        message:
          modalMode === "add"
            ? `Ошибка добавления/обновления контейнера: ${msg}`
            : `Ошибка добавления/обновления контейнера: ${msg}`
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteContainer(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["containers"] });
      toast.pushToast({
        type: "success",
        title: "Удалено",
        message: "Контейнер удалён"
      });
      setConfirmDelete(null);
    },
    onError: (err) => {
      const msg = extractApiErrorMessage(err, "Не удалось удалить контейнер.");
      toast.pushToast({
        type: "error",
        title: "Ошибка",
        message: `Ошибка удаления контейнера: ${msg}`
      });
    }
  });

  const isLoading = containersQuery.isLoading;

  if (isLoading) {
    return (
      <main className="layout">
        <div className="card">Загрузка контейнеров...</div>
      </main>
    );
  }

  if (containersQuery.isError || !containersQuery.data) {
    return (
      <main className="layout">
        <div className="card">
          Не удалось загрузить контейнеры.
          <div className="error" style={{ marginTop: 12 }}>
            {extractApiErrorMessage(containersQuery.error, "unknown error")}
          </div>
        </div>
      </main>
    );
  }

  const containers = containersQuery.data;
  const volumeMax = useMemo(() => Math.max(1, ...containers.map((c) => c.volume_m3)), [containers]);
  const weightMax = useMemo(() => Math.max(1, ...containers.map((c) => c.max_weight_kg)), [containers]);

  return (
    <main className="layout">
      <header className="hero row between" style={{ marginBottom: 16 }}>
        <div>
          <h1>Контейнеры</h1>
          <p>Управление типами контейнеров</p>
        </div>
        <div className="row" style={{ margin: 0 }}>
          <button className="button primary" type="button" onClick={openAdd}>
            Добавить контейнер
          </button>
        </div>
      </header>

      <section className="tileGrid">
        {containers.map((c) => (
          <div
            key={c.id}
            role="button"
            tabIndex={0}
            className="tileCard"
            onClick={() => openEdit(c)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") openEdit(c);
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontWeight: 900, fontSize: 16 }}>{c.name}</div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <div style={{ color: "#a9b2c6", fontSize: 13 }}>Длина</div>
                <div style={{ color: "#eef3ff", fontSize: 13, fontWeight: 700 }}>{c.length_mm} мм</div>
                <div style={{ color: "#a9b2c6", fontSize: 13 }}>Ширина</div>
                <div style={{ color: "#eef3ff", fontSize: 13, fontWeight: 700 }}>{c.width_mm} мм</div>
                <div style={{ color: "#a9b2c6", fontSize: 13 }}>Высота</div>
                <div style={{ color: "#eef3ff", fontSize: 13, fontWeight: 700 }}>{c.height_mm} мм</div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, color: "#a9b2c6" }}>Объем</div>
                  <div style={{ fontWeight: 900, marginTop: 2 }}>{c.volume_m3.toFixed(3)} м3</div>
                  <div className="miniBar" style={{ marginBottom: 0, marginTop: 8 }}>
                    <div
                      className="miniBarFill volume"
                      style={{ width: `${Math.min(100, (c.volume_m3 / volumeMax) * 100)}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#a9b2c6" }}>Макс. вес</div>
                  <div style={{ fontWeight: 900, marginTop: 2 }}>{c.max_weight_kg.toFixed(0)} кг</div>
                  <div className="miniBar" style={{ marginBottom: 0, marginTop: 8 }}>
                    <div
                      className="miniBarFill weight"
                      style={{ width: `${Math.min(100, (c.max_weight_kg / weightMax) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="tileDelete">
              <button
                className="button danger"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDelete(c);
                }}
              >
                Удалить
              </button>
            </div>
          </div>
        ))}
      </section>

      <Modal
        open={modalMode === "add" || modalMode === "edit"}
        onClose={() => {
          if (!createOrUpdate.isPending) closeForm();
        }}
        title={modalMode === "add" ? "Добавление контейнера" : "Редактирование контейнера"}
      >
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            await createOrUpdate.mutateAsync();
          }}
        >
          <label className="field">
            <span>Название</span>
            <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          </label>

          <div className="row" style={{ alignItems: "flex-start" }}>
            <label className="field" style={{ marginBottom: 0, flex: 1 }}>
              <span>Длина (мм)</span>
              <input
                type="number"
                value={form.length_mm}
                onChange={(e) => setForm((p) => ({ ...p, length_mm: e.target.value }))}
              />
            </label>
            <label className="field" style={{ marginBottom: 0, flex: 1 }}>
              <span>Ширина (мм)</span>
              <input
                type="number"
                value={form.width_mm}
                onChange={(e) => setForm((p) => ({ ...p, width_mm: e.target.value }))}
              />
            </label>
          </div>

          <div className="row" style={{ alignItems: "flex-start" }}>
            <label className="field" style={{ marginBottom: 0, flex: 1 }}>
              <span>Высота (мм)</span>
              <input
                type="number"
                value={form.height_mm}
                onChange={(e) => setForm((p) => ({ ...p, height_mm: e.target.value }))}
              />
            </label>
            <label className="field" style={{ marginBottom: 0, flex: 1 }}>
              <span>Макс. вес (кг)</span>
              <input
                type="number"
                value={form.max_weight_kg}
                onChange={(e) => setForm((p) => ({ ...p, max_weight_kg: e.target.value }))}
              />
            </label>
          </div>

          <label className="field">
            <span>Полезный объем (м3)</span>
            <input
              type="number"
              step="0.01"
              value={form.volume_m3}
              onChange={(e) => setForm((p) => ({ ...p, volume_m3: e.target.value }))}
            />
          </label>

          <div className="row" style={{ justifyContent: "flex-end", margin: 0 }}>
            <button className="button secondary" type="button" onClick={closeForm} disabled={createOrUpdate.isPending}>
              Отмена
            </button>
            <button className="button primary" type="submit" disabled={createOrUpdate.isPending}>
              {createOrUpdate.isPending ? "Сохранение..." : modalMode === "add" ? "Добавить" : "Сохранить"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!confirmDelete}
        onClose={() => {
          if (!deleteMutation.isPending) setConfirmDelete(null);
        }}
        title="Подтверждение удаления"
        widthClassName="modalCardNarrow"
      >
        {confirmDelete ? (
          <div className="stack">
            <p style={{ margin: 0, color: "#d6deff" }}>
              Удалить контейнер <strong>{confirmDelete.name}</strong>?
            </p>
            <div className="row" style={{ justifyContent: "flex-end", margin: 0 }}>
              <button className="button secondary" type="button" disabled={deleteMutation.isPending} onClick={() => setConfirmDelete(null)}>
                Отмена
              </button>
              <button
                className="button danger"
                type="button"
                disabled={deleteMutation.isPending}
                onClick={async () => {
                  await deleteMutation.mutateAsync(confirmDelete.id);
                }}
              >
                {deleteMutation.isPending ? "Удаляем..." : "Удалить"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </main>
  );
}

