import math
from logistics.models import CalculationRequest

class RequestPreprocessor:
    """
    Класс для подготовки данных перед запуском 3D-алгоритма упаковки.
    Превращает "Заявка: Товар А - 1500 шт" в список конкретных физических
    объектов (паллет или мастербоксов) с их габаритами и флагами.
    """

    def __init__(self, calculation_request_id: int):
        self.request_id = calculation_request_id
        self.calc_request = CalculationRequest.objects.prefetch_related('items__product').get(id=calculation_request_id)

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

            if req_type in ['order by pallet', 'qty by pallet']:
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

            # 2. Считаем количество физических юнитов
            num_units = math.ceil(req_qty / qty_in_unit)

            if req_qty % qty_in_unit != 0:
                warnings.append(
                    f"Товар ID {prod.product_id}: заказано {req_qty} шт., округлено до {num_units} {unit_type} "
                    f"(так как кратно {qty_in_unit} шт.)"
                )

            # 3. Генерируем "кубики" для 3D-движка
            for _ in range(num_units):
                packable_items.append({
                    'product_id': prod.product_id,
                    'item_type': unit_type,
                    'length_mm': length,
                    'width_mm': width,
                    'height_mm': height,
                    'weight_kg': weight,

                    'is_dangerous': prod.is_dangerous or False,
                    'is_stackable': prod.is_stackable if prod.is_stackable is not None else True,
                    'can_be_unpalletized': prod.can_be_unpalletized or False
                })

        return packable_items, warnings