from logistics.models import ContainerType


class PackingService:
    """
    Сервис для 3D-упаковки списка объектов в контейнеры.

    Правила совместимости грузов в одном контейнере:
      - Опасный груз (is_dangerous) едет ТОЛЬКО с батарейным (battery_flag).
      - Батарейный и небатарейный НЕ-опасный груз едут вместе.
      - Небатарейный с опасным — ЗАПРЕЩЕНО.

    Алгоритм двух фаз:
      Фаза 1 (если есть опасные): пакуем [опасный + батарейный].
              Контейнеры без ни одного опасного товара «разбираем» обратно → фаза 2.
      Фаза 2: пакуем [небатарейный + батарейный из фазы 1, которому не нашлось места рядом с опасным].
    """

    def __init__(self, packable_items: list[dict], container_type: ContainerType):
        self.packable_items = packable_items
        self.container_type = container_type

    def calculate(self):
        try:
            import fast_bin_packer
            return self._fast_calculate(fast_bin_packer)
        except ImportError:
            return self._calculate_py3dbp()

    # ── Вспомогательные методы ────────────────────────────────────────────

    def _container_metrics(self) -> tuple[float, float]:
        vol_mm3 = float(
            self.container_type.width_mm *
            self.container_type.length_mm *
            self.container_type.height_mm
        )
        floor_mm2 = float(self.container_type.width_mm * self.container_type.length_mm)
        return vol_mm3 / 1e9, floor_mm2

    @staticmethod
    def _to_cpp_item(fbp, raw: dict):
        item = fbp.Item()
        item.product_id   = int(raw['product_id'])
        item.product_name = str(raw.get('product_name', ''))
        item.qty_per_unit = int(raw.get('qty_per_unit', 1))
        item.item_type    = str(raw.get('item_type', ''))
        item.w            = int(raw.get('width_mm') or 1)
        item.l            = int(raw.get('length_mm') or 1)
        item.h            = int(raw.get('height_mm') or 1)
        item.weight       = float(raw.get('weight_kg') or 0.1)
        item.is_dangerous = bool(raw.get('is_dangerous', False))
        item.battery_flag = bool(raw.get('battery_flag', False))
        item.group_key    = str(raw.get('group_key', ''))
        return item

    @staticmethod
    def _from_cpp_item(it) -> dict:
        return {
            'product_id':   it.product_id,
            'product_name': it.product_name,
            'qty_per_unit': it.qty_per_unit,
            'item_type':    it.item_type,
            'width_mm':     it.w,
            'length_mm':    it.l,
            'height_mm':    it.h,
            'weight_kg':    it.weight,
            'is_dangerous': it.is_dangerous,
            'battery_flag': it.battery_flag,
            'group_key':    it.group_key,
        }

    def _pack_cpp(self, fbp, items_raw: list[dict]) -> list:
        cpp_items = [self._to_cpp_item(fbp, raw) for raw in items_raw]
        return fbp.pack_items(
            cpp_items,
            self.container_type.width_mm,
            self.container_type.length_mm,
            self.container_type.height_mm,
            float(self.container_type.max_weight_kg or 999_999),
        )

    def _build_container_result(
        self, res, container_index: int,
        container_volume_m3: float, floor_area_mm2: float
    ) -> dict:
        layout = []
        raw_packed = []
        used_volume_mm3 = 0.0
        used_floor_area = 0.0

        for it in res.packed_items:
            layout.append({
                'product_id': it.product_id,
                'type':       it.item_type,
                'position':   {'x': it.x, 'y': it.y, 'z': it.z},
                'dimensions': {'width': it.w, 'height': it.h, 'length': it.l},
            })
            raw_packed.append({
                'product_id':   it.product_id,
                'product_name': it.product_name,
                'qty_per_unit': it.qty_per_unit,
            })
            used_volume_mm3 += it.w * it.l * it.h
            if it.y == 0:
                used_floor_area += it.w * it.l

        used_volume_m3 = used_volume_mm3 / 1e9
        vol_util  = (used_volume_m3 / container_volume_m3 * 100) if container_volume_m3 > 0 else 0
        area_util = (used_floor_area / floor_area_mm2 * 100)     if floor_area_mm2 > 0    else 0

        return {
            'container_index':            container_index,
            'container_type_id':          self.container_type.id,
            'total_weight_kg':            res.total_weight,
            'total_volume_m3':            round(used_volume_m3, 4),
            'volume_utilization_percent': round(vol_util, 2),
            'area_utilization_percent':   round(area_util, 2),
            'products':                   self._build_products_summary(raw_packed),
            'layout':                     layout,
        }

    @staticmethod
    def _build_products_summary(packed_items_raw: list[dict]) -> list[dict]:
        counts: dict[int, dict] = {}
        for it in packed_items_raw:
            pid = it['product_id']
            if pid not in counts:
                counts[pid] = {
                    'product_id':   pid,
                    'product_name': it.get('product_name', ''),
                    'quantity':     0,
                }
            counts[pid]['quantity'] += it.get('qty_per_unit', 1)
        return list(counts.values())

    # ── Основной расчёт: C++ ──────────────────────────────────────────────

    def _fast_calculate(self, fbp) -> list[dict]:
        dangerous = [i for i in self.packable_items if i.get('is_dangerous')]
        battery   = [i for i in self.packable_items if i.get('battery_flag') and not i.get('is_dangerous')]
        standard  = [i for i in self.packable_items if not i.get('is_dangerous') and not i.get('battery_flag')]

        container_volume_m3, floor_area_mm2 = self._container_metrics()
        all_results: list[dict] = []
        container_index = 1

        # Пул для фазы 2: стартует со всех небатарейных небопасных товаров
        phase2_pool = list(standard)

        if dangerous:
            # Фаза 1: опасный + батарейный вместе.
            # Опасный идёт первым — C++ получает их в начале списка.
            for res in self._pack_cpp(fbp, dangerous + battery):
                if any(it.is_dangerous for it in res.packed_items):
                    # Контейнер содержит опасный груз — оставляем
                    all_results.append(
                        self._build_container_result(res, container_index, container_volume_m3, floor_area_mm2)
                    )
                    container_index += 1
                else:
                    # Чисто батарейный контейнер — разбираем, товары идут в фазу 2
                    phase2_pool.extend(self._from_cpp_item(it) for it in res.packed_items)
        else:
            # Нет опасных — все товары едут вместе в фазе 2
            phase2_pool = list(self.packable_items)

        # Фаза 2: небатарейный + «переработанный» батарейный
        if phase2_pool:
            for res in self._pack_cpp(fbp, phase2_pool):
                all_results.append(
                    self._build_container_result(res, container_index, container_volume_m3, floor_area_mm2)
                )
                container_index += 1

        return all_results

    # ── Fallback: py3dbp ──────────────────────────────────────────────────

    def _calculate_py3dbp(self) -> list[dict]:
        from py3dbp import Packer, Bin, Item as Py3Item

        dangerous = [i for i in self.packable_items if i.get('is_dangerous')]
        battery   = [i for i in self.packable_items if i.get('battery_flag') and not i.get('is_dangerous')]
        standard  = [i for i in self.packable_items if not i.get('is_dangerous') and not i.get('battery_flag')]

        # Те же две группы что и в C++ ветке (без переработки — py3dbp fallback)
        groups: list[list[dict]] = []
        if dangerous or battery:
            groups.append(dangerous + battery)
        if standard:
            groups.append(standard)

        results: list[dict] = []
        container_index = 1
        container_volume_m3, floor_area_mm2 = self._container_metrics()

        for group_items in groups:
            items_to_pack = {
                f"item_{idx}_{item['product_id']}": item
                for idx, item in enumerate(group_items)
            }

            while items_to_pack:
                packer = Packer()
                packer.add_bin(Bin(
                    f"{self.container_type.name}-{container_index}",
                    self.container_type.width_mm,
                    self.container_type.height_mm,
                    self.container_type.length_mm,
                    self.container_type.max_weight_kg or 999_999,
                ))
                for uid, item in items_to_pack.items():
                    packer.add_item(Py3Item(
                        uid,
                        item['width_mm'],
                        item['height_mm'],
                        item['length_mm'],
                        item['weight_kg'] if item.get('weight_kg', 0) > 0 else 0.1,
                    ))
                packer.pack(bigger_first=True)
                packed_bin = packer.bins[0]

                if not packed_bin.items:
                    raise ValueError(
                        f"Товар слишком большой для контейнера {self.container_type.name}!"
                    )

                layout = []
                raw_packed = []
                used_floor_area = 0.0
                used_volume_m3  = 0.0

                for packed_item in packed_bin.items:
                    orig  = items_to_pack[packed_item.name]
                    pos_x = float(packed_item.position[0])
                    pos_y = float(packed_item.position[1])
                    pos_z = float(packed_item.position[2])
                    dim_w = float(packed_item.get_dimension()[0])
                    dim_h = float(packed_item.get_dimension()[1])
                    dim_l = float(packed_item.get_dimension()[2])

                    layout.append({
                        'product_id': orig['product_id'],
                        'type':       orig['item_type'],
                        'position':   {'x': pos_x, 'y': pos_y, 'z': pos_z},
                        'dimensions': {'width': dim_w, 'height': dim_h, 'length': dim_l},
                    })
                    raw_packed.append({
                        'product_id':   orig['product_id'],
                        'product_name': orig.get('product_name', ''),
                        'qty_per_unit': orig.get('qty_per_unit', 1),
                    })
                    if pos_y == 0.0:
                        used_floor_area += dim_w * dim_l
                    used_volume_m3 += float(packed_item.get_volume()) / 1e9
                    del items_to_pack[packed_item.name]

                vol_util  = (used_volume_m3 / container_volume_m3 * 100) if container_volume_m3 > 0 else 0
                area_util = (used_floor_area / floor_area_mm2 * 100)     if floor_area_mm2 > 0    else 0

                results.append({
                    'container_index':            container_index,
                    'container_type_id':          self.container_type.id,
                    'total_weight_kg':            float(packed_bin.get_total_weight()),
                    'total_volume_m3':            round(used_volume_m3, 4),
                    'volume_utilization_percent': round(vol_util, 2),
                    'area_utilization_percent':   round(area_util, 2),
                    'products':                   self._build_products_summary(raw_packed),
                    'layout':                     layout,
                })
                container_index += 1

        return results