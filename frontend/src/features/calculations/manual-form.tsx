import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import type { ContainerType, Product } from "../../lib/types";

const itemSchema = z.object({
  product_id: z.coerce.number().int().positive("Выбери товар"),
  quantity: z.coerce.number().int().min(1, "Минимум 1")
});

const manualFormSchema = z.object({
  container_type_id: z.coerce.number().int().positive("Выбери контейнер"),
  description: z.string().optional(),
  items: z.array(itemSchema).min(1, "Добавь минимум одну позицию")
});

type ManualFormInput = z.input<typeof manualFormSchema>;
type ManualFormValues = z.output<typeof manualFormSchema>;

interface ManualFormProps {
  containers: ContainerType[];
  products: Product[];
  isSubmitting: boolean;
  onSubmit: (payload: ManualFormValues) => Promise<void>;
}

interface ProductSearchSelectProps {
  value: number;
  products: Product[];
  onChange: (id: number) => void;
}

function getProductLabel(product: Product): string {
  const name = product.name ?? "Без названия";
  const sku = product.sku ?? "-";
  return `${product.product_id} | ${name} | SKU: ${sku}`;
}

function ProductSearchSelect({ value, products, onChange }: ProductSearchSelectProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const selectedProduct = useMemo(() => products.find((item) => item.id === value) ?? null, [products, value]);

  useEffect(() => {
    if (!selectedProduct) return;
    setQuery(getProductLabel(selectedProduct));
  }, [selectedProduct]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const base = normalized
      ? products.filter((product) => {
          const pid = String(product.product_id).toLowerCase();
          const name = (product.name ?? "").toLowerCase();
          const sku = (product.sku ?? "").toLowerCase();
          return pid.includes(normalized) || name.includes(normalized) || sku.includes(normalized);
        })
      : products;
    return base.slice(0, 80);
  }, [products, query]);

  return (
    <div className="productSearch" ref={wrapperRef}>
      <input
        value={query}
        placeholder="Найди по product_id, названию или SKU"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
      />
      {open ? (
        <div className="productSearchDropdown">
          {filtered.length ? (
            filtered.map((product) => (
              <button
                type="button"
                className="productSearchOption"
                key={product.id}
                onClick={() => {
                  onChange(product.id);
                  setQuery(getProductLabel(product));
                  setOpen(false);
                }}
              >
                {getProductLabel(product)}
              </button>
            ))
          ) : (
            <div className="productSearchEmpty">Ничего не найдено</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function ManualCalculationForm({
  containers,
  products,
  isSubmitting,
  onSubmit
}: ManualFormProps) {
  const form = useForm<ManualFormInput>({
    resolver: zodResolver(manualFormSchema),
    defaultValues: {
      container_type_id: 0,
      description: "",
      items: [{ product_id: 0, quantity: 1 }]
    }
  });

  const itemsArray = useFieldArray({
    control: form.control,
    name: "items"
  });

  return (
    <form
      className="stack"
      onSubmit={form.handleSubmit(async (rawValues: ManualFormInput) => {
        const payload = manualFormSchema.parse(rawValues);
        await onSubmit(payload);
      })}
    >
      <h2>Новый расчет (ручной ввод)</h2>

      <label className="field">
        <span>Тип контейнера</span>
        <select {...form.register("container_type_id")}>
          <option value={0}>Выбери контейнер</option>
          {containers.map((container) => (
            <option key={container.id} value={container.id}>
              {container.name} ({container.length_mm}x{container.width_mm}x{container.height_mm} мм)
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Описание</span>
        <input {...form.register("description")} placeholder="Например: тестовая заявка" />
      </label>

      <div className="row between">
        <h3>Товары</h3>
        <button
          className="button secondary"
          type="button"
          onClick={() => itemsArray.append({ product_id: 0, quantity: 1 })}
        >
          + Добавить
        </button>
      </div>

      <div className="stack compact">
        {itemsArray.fields.map((field, index) => (
          <div className="row" key={field.id}>
            <ProductSearchSelect
              value={Number(form.watch(`items.${index}.product_id`) || 0)}
              products={products}
              onChange={(id) => {
                form.setValue(`items.${index}.product_id`, id, { shouldDirty: true, shouldValidate: true });
              }}
            />
            <input className="qtyInput" type="number" min={1} {...form.register(`items.${index}.quantity`)} />
            <button
              className="button danger"
              type="button"
              disabled={itemsArray.fields.length === 1}
              onClick={() => itemsArray.remove(index)}
            >
              Удалить
            </button>
          </div>
        ))}
      </div>

      {form.formState.errors.items?.message ? (
        <p className="errorText">{form.formState.errors.items.message}</p>
      ) : null}

      <button type="submit" className="button primary" disabled={isSubmitting}>
        {isSubmitting ? "Отправка..." : "Рассчитать"}
      </button>
    </form>
  );
}
