from py3dbp import Packer, Bin, Item
from logistics.models import ContainerType

class PackingService:
    """
    Сервис для 3D-упаковки списка объектов в контейнеры.
    """
    def __init__(self, packable_items: list, container_type: ContainerType):
        self.packable_items = packable_items
        self.container_type = container_type

    def calculate(self):
        """
        Запускает жадный алгоритм: берет один контейнер, забивает его по максимуму,
        если остались товары — открывает следующий такой же контейнер, и так далее.
        """
        results = []
        container_index = 1

        items_to_pack = {}
        for idx, item in enumerate(self.packable_items):
            unique_id = f"item_{idx}_{item['product_id']}"
            items_to_pack[unique_id] = item

        total_floor_area_mm2 = float(self.container_type.width_mm * self.container_type.length_mm)

        while items_to_pack:
            packer = Packer()

            # Добавляем 1 контейнер (Bin). В py3dbp порядок: Имя, Ширина(W), Высота(H), Глубина(D), Вес(W)
            # Внимание: обычно D - это длина (length), H - высота (height).
            bin_name = f"{self.container_type.name}-{container_index}"
            packer.add_bin(Bin(
                bin_name,
                self.container_type.width_mm,
                self.container_type.height_mm,
                self.container_type.length_mm,
                self.container_type.max_weight_kg or 999999 # Если вес не указан, ставим огромный
            ))

            for uid, item in items_to_pack.items():
                weight = item['weight_kg'] if item['weight_kg'] > 0 else 0.1

                packer.add_item(Item(
                    uid,
                    item['width_mm'],
                    item['height_mm'],
                    item['length_mm'],
                    weight
                ))

            packer.pack()

            packed_bin = packer.bins[0]

            if not packed_bin.items:
                raise ValueError(f"Оставшиеся товары слишком большие для контейнера {self.container_type.name}!")

            layout = []
            used_floor_area_mm2: float = 0.0
            used_volume_m3: float = 0.0
            for packed_item in packed_bin.items:
                orig_item = items_to_pack[packed_item.name]

                pos_y = float(packed_item.position[1])
                dim_w = float(packed_item.get_dimension()[0])
                dim_l = float(packed_item.get_dimension()[2])

                layout.append({
                    "product_id": orig_item["product_id"],
                    "type": orig_item["item_type"],
                    "position": {
                        "x": float(packed_item.position[0]),
                        "y": pos_y,
                        "z": float(packed_item.position[2])
                    },
                    "dimensions": {
                        "width": dim_w,
                        "height": float(packed_item.get_dimension()[1]),
                        "length": dim_l
                    }
                })

                if pos_y == 0.0:
                    used_floor_area_mm2 += (dim_w * dim_l)

                used_volume_m3 += (float(packed_item.get_volume()) / 1000000000)

                del items_to_pack[packed_item.name]

            volume_utilization: float = (used_volume_m3 * 100) / (float(packed_bin.get_volume()) / 1000000000)
            area_utilization: float = (used_floor_area_mm2 * 100) / total_floor_area_mm2 if total_floor_area_mm2 > 0 \
                else 0

            results.append({
                "container_index": container_index,
                "container_type_id": self.container_type.id,
                "total_weight_kg": float(packed_bin.get_total_weight()),
                "total_volume_m3": used_volume_m3,
                "volume_utilization_percent": round(volume_utilization, 2),
                "area_utilization_percent": round(area_utilization, 2),
                "layout": layout
            })

            container_index += 1

        return results
