import math
from logistics.models import CalculationRequest, Product


class RequestPreprocessor:
    """
    Класс для подготовки данных перед запуском 3D-алгоритма упаковки.
    Превращает "Заявка: Товар А - 1500 шт" в список конкретных физических
    объектов (паллет или мастербоксов) с их габаритами и флагами.
    """

    def __init__(self, calculation_request_id: int):
        self.request_id = calculation_request_id
        self.calc_request = CalculationRequest.objects.prefetch_related('items__product').get(id=calculation_request_id)

    def _get_grouping_key(self, prod: Product) -> str:
        """
        Строковый тег для отладки. Реальная группировка — в PackingService (двухфазная).
        """
        if prod.is_dangerous:
            return 'dangerous'
        if prod.battery_flag:
            return 'battery'
        return 'standard'

    def process(self):
        """
        Возвращает список объектов для упаковки и список предупреждений.
        """
        packable_items = []
        warnings = []

        for req_item in self.calc_request.items.all():
            prod = req_item.product
            req_qty = req_item.quantity

            req_type = str(prod.order_requirement).strip().lower()
            req_category = str(prod.category).strip().lower()

            if req_category in ['tv']:
                unit_type = 'pallet'
                qty_in_unit = prod.qty_of_masterbox or 1
                length = prod.pallet_length_mm
                width = prod.pallet_width_mm
                height = prod.pallet_height_mm
                weight = prod.pallet_weight_kg
            elif req_category in ['monitor']:
                unit_type = 'product'
                qty_in_unit = 1
                length = prod.product_length_mm
                width = prod.product_width_mm
                height = prod.product_height_mm
                weight = (prod.masterbox_weight_kg / prod.qty_of_masterbox) if (
                        prod.masterbox_weight_kg and prod.qty_of_masterbox) else 0.1
            elif req_type in ['order by pallet', 'qty by pallet']:
                unit_type = 'pallet'
                qty_in_unit = prod.qty_of_pallet or 1
                length = prod.pallet_length_mm
                width = prod.pallet_width_mm
                height = prod.pallet_height_mm
                weight = prod.pallet_weight_kg
            else:
                unit_type = 'masterbox'
                qty_in_unit = prod.qty_of_masterbox or 1
                length = prod.masterbox_length_mm
                width = prod.masterbox_width_mm
                height = prod.masterbox_height_mm
                weight = prod.masterbox_weight_kg if prod.masterbox_weight_kg else 0.1

            group_key = self._get_grouping_key(prod)

            # Количество физических юнитов
            num_units = math.ceil(req_qty / qty_in_unit)

            if req_qty % qty_in_unit != 0:
                warnings.append(
                    f"Товар ID {prod.product_id}: заказано {req_qty} шт., "
                    f"округлено до {num_units} {unit_type} "
                    f"(кратно {qty_in_unit} шт.)"
                )

            # Генерируем физические юниты для 3D-движка
            for _ in range(num_units):
                packable_items.append({
                    'product_id': prod.product_id,
                    'product_name': prod.name or '',  # нужен в calculator для сводки
                    'item_type': unit_type,
                    'qty_per_unit': qty_in_unit,  # сколько товаров в одном юните
                    'length_mm': length,
                    'width_mm': width,
                    'height_mm': height,
                    'weight_kg': weight,
                    'battery_flag': bool(prod.battery_flag),
                    'is_dangerous': bool(prod.is_dangerous),
                    'is_stackable': prod.is_stackable if prod.is_stackable is not None else True,
                    'can_be_unpalletized': prod.can_be_unpalletized or False,
                    'group_key': group_key,
                })

        return packable_items, warnings
