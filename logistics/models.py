from django.db import models
from django.core.validators import MinValueValidator


class ContainerType(models.Model):
    """
    Справочник типов контейнеров (20ft, 40ft, 40HQ).
    Данные обычно статичны, но можно добавлять свои.
    """
    name = models.CharField(max_length=50, unique=True, verbose_name="Название (например, 40HQ)")

    # Внутренние габариты (в миллиметрах для точности расчетов)
    length_mm = models.PositiveIntegerField(verbose_name="Длина (мм)")
    width_mm = models.PositiveIntegerField(verbose_name="Ширина (мм)")
    height_mm = models.PositiveIntegerField(verbose_name="Высота (мм)")

    max_weight_kg = models.PositiveIntegerField(verbose_name="Макс. вес (кг)")
    volume_m3 = models.FloatField(verbose_name="Полезный объем (м3)")

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "Тип контейнера"
        verbose_name_plural = "Типы контейнеров"


class Product(models.Model):
    """
    Основная информация о товаре.
    """
    # Идентификаторы
    id = models.IntegerField(primary_key=True, verbose_name="ID", unique=True)
    sku = models.CharField(max_length=100, unique=True, verbose_name="Артикул (SKU)")
    name = models.CharField(max_length=255, verbose_name="Наименование товара")

    # 1. Габариты ЕДИНИЦЫ товара (самой коробки с товаром)
    item_length_mm = models.PositiveIntegerField(verbose_name="Длина товара (мм)")
    item_width_mm = models.PositiveIntegerField(verbose_name="Ширина товара (мм)")
    item_height_mm = models.PositiveIntegerField(verbose_name="Высота товара (мм)")
    item_weight_kg = models.FloatField(verbose_name="Вес товара (кг)")

    # 2. Габариты ПАЛЛЕТЫ с этим товаром (по ТЗ: у каждого товара свои размеры паллеты)
    pallet_length_mm = models.PositiveIntegerField(verbose_name="Длина паллеты (мм)")
    pallet_width_mm = models.PositiveIntegerField(verbose_name="Ширина паллеты (мм)")
    # Высота загруженной паллеты (включая высоту самой деревянной паллеты)
    pallet_height_mm = models.PositiveIntegerField(verbose_name="Высота паллеты с грузом (мм)")

    items_per_pallet = models.PositiveIntegerField(verbose_name="Кол-во товаров на паллете")

    # 3. Логистические характеристики
    is_dangerous = models.BooleanField(default=False, verbose_name="Опасный груз")
    is_stackable = models.BooleanField(default=True, verbose_name="Можно штабелировать")

    # "Можно распалечивать или нет":
    # False = товар едет только целыми паллетами (если паллета неполная - место все равно занято как под целую)
    # True = можно снимать коробки и заполнять ими пустоты
    can_be_unpalletized = models.BooleanField(default=False, verbose_name="Можно распалечивать")

    # 4. Данные о заказе (Masterbox и MOQ)
    # Если товар идет штучно, здесь будет 1
    items_per_masterbox = models.PositiveIntegerField(default=1, verbose_name="Штук в мастербоксе")
    # Минимальное кол-во для заказа (должно быть кратно items_per_masterbox)
    moq = models.PositiveIntegerField(default=1, verbose_name="Min кол-во заказа (MOQ)")

    updated_at = models.DateTimeField(auto_now=True, verbose_name="Дата последнего обновления")

    def __str__(self):
        return f"{self.sku} - {self.name}"

    class Meta:
        verbose_name = "Товар"
        verbose_name_plural = "Товары"


class CalculationRequest(models.Model):
    """
    Заголовок запроса на расчет.
    Хранит исходный файл (если был) и мета-информацию.
    """
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Дата расчета")
    source_file = models.FileField(upload_to='requests_xls/', null=True, blank=True,
                                   verbose_name="Исходный файл заказа")
    description = models.CharField(max_length=255, blank=True, verbose_name="Примечание")

    class Meta:
        verbose_name = "Запрос на расчет"
        verbose_name_plural = "Запросы на расчет"


class RequestItem(models.Model):
    """
    Строки запроса: Какой товар и сколько.
    """
    calculation_request = models.ForeignKey(CalculationRequest, related_name='items', on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, verbose_name="Товар")
    quantity = models.PositiveIntegerField(validators=[MinValueValidator(1)], verbose_name="Количество")

    def __str__(self):
        return f"{self.product.sku} - {self.quantity} шт."


class PackingResult(models.Model):
    """
    Результат расчета: Список необходимых контейнеров.
    """
    calculation_request = models.ForeignKey(CalculationRequest, related_name='results', on_delete=models.CASCADE)

    # Порядковый номер контейнера в партии (№1, №2...)
    container_number = models.PositiveIntegerField()
    container_type = models.ForeignKey(ContainerType, on_delete=models.PROTECT)

    # Итоговая статистика заполнения конкретно этого контейнера
    total_weight_kg = models.FloatField(verbose_name="Вес груза (кг)")
    total_volume_m3 = models.FloatField(verbose_name="Объем груза (м3)")

    volume_utilization_percent = models.FloatField(verbose_name="Заполнение по объему (%)")
    area_utilization_percent = models.FloatField(verbose_name="Заполнение по полу (%)")

    # Самое важное для фронтенда и 3D: JSON со схемой укладки.
    # Структура JSON:
    # [
    #   {"sku": "A1", "x": 0, "y": 0, "z": 0, "dx": 500, "dy": 400, "dz": 300, "type": "pallet"},
    #   {"sku": "A1", "x": 500, ... "type": "box"}
    # ]
    packing_layout = models.JSONField(verbose_name="Схема расстановки (JSON)", default=dict)

    class Meta:
        ordering = ['container_number']
        verbose_name = "Результат (Контейнер)"
        verbose_name_plural = "Результаты (Контейнеры)"