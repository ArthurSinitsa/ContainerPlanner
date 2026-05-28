from django.db import models
from django.core.validators import MinValueValidator
from django.db.models import (JSONField, CharField, PositiveIntegerField, BigIntegerField, IntegerField, FloatField,
                              BooleanField, DateTimeField, FileField, TextField, ForeignKey)


class ContainerType(models.Model):
    """
    Справочник типов контейнеров (20ft, 40ft, 40HQ).
    """
    name: CharField = CharField(max_length=50, unique=True, verbose_name="Название (например, 40HQ)")

    # Внутренние габариты
    length_mm: PositiveIntegerField = PositiveIntegerField(verbose_name="Длина (мм)")
    width_mm: PositiveIntegerField = PositiveIntegerField(verbose_name="Ширина (мм)")
    height_mm: PositiveIntegerField = PositiveIntegerField(verbose_name="Высота (мм)")

    max_weight_kg: PositiveIntegerField = PositiveIntegerField(verbose_name="Макс. вес (кг)")
    volume_m3: FloatField = FloatField(verbose_name="Полезный объем (м3)")

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "Тип контейнера"
        verbose_name_plural = "Типы контейнеров"


class Product(models.Model):
    # 1. Основные идентификаторы
    product_id: IntegerField = IntegerField(unique=True, null=False, blank=False, default=0, verbose_name="ID")
    sku: CharField = CharField(max_length=100, blank=True, null=True, verbose_name="SKU")
    name: CharField = CharField(max_length=255, blank=True, null=True, verbose_name="Name")
    category: CharField = CharField(max_length=100, blank=True, null=True, verbose_name="Category")
    ean: BigIntegerField = BigIntegerField(blank=True, null=True, verbose_name="EAN")
    spec_name: CharField = CharField(max_length=255, blank=True, null=True, verbose_name="Spec-n Name")

    # 2. Габариты товара (мм)
    product_length_mm: FloatField = FloatField(default=0, null=True, verbose_name="Length Products (mm)")
    product_width_mm: FloatField = FloatField(default=0, null=True, verbose_name="Width Products (mm)")
    product_height_mm: FloatField = FloatField(default=0, null=True, verbose_name="Height Products (mm)")

    # 3. Габариты Мастербокса
    masterbox_length_mm: FloatField = FloatField(default=0, null=True, verbose_name="Length Masterbox (mm)")
    masterbox_width_mm: FloatField = FloatField(default=0, null=True, verbose_name="Width Masterbox (mm)")
    masterbox_height_mm: FloatField = FloatField(default=0, null=True, verbose_name="Height Masterbox (mm)")
    qty_of_masterbox: PositiveIntegerField = PositiveIntegerField(default=1, verbose_name="Qty of master box")
    masterbox_weight_kg: FloatField = FloatField(null=True, blank=True, verbose_name="Вес мастербокса (кг)")

    # 4. Габариты и Вес Паллеты
    pallet_length_mm: FloatField = FloatField(default=0, null=True, verbose_name="Length Pallet (mm)")
    pallet_width_mm: FloatField = FloatField(default=0, null=True, verbose_name="Width Pallet (mm)")
    pallet_height_mm: FloatField = FloatField(default=0, null=True, verbose_name="Height Pallet (mm)")
    qty_of_pallet: PositiveIntegerField = PositiveIntegerField(default=1, verbose_name="Qty of pallet")
    pallet_weight_kg: FloatField = FloatField(default=0, null=True, verbose_name="Pallet Weight (kg)")

    # 5. Логистические правила и флаги
    order_requirement: CharField = CharField(max_length=50, blank=True, null=True, verbose_name="Order requirement")

    kj_flag: CharField = CharField(max_length=50, blank=True, null=True, verbose_name="k/j")
    si_flag: CharField = CharField(max_length=50, blank=True, null=True, verbose_name="SI")
    eol_flag: CharField = CharField(max_length=50, blank=True, null=True, verbose_name="EOL")
    gz_flag: CharField = CharField(max_length=50, blank=True, null=True, verbose_name="GZ")
    battery_flag: BooleanField = BooleanField(default=False, verbose_name="Battery")

    is_dangerous: BooleanField = BooleanField(null=True, blank=True, verbose_name="Опасный груз")
    is_stackable: BooleanField = BooleanField(null=True, blank=True, verbose_name="Можно штабелировать")
    can_be_unpalletized: BooleanField = BooleanField(null=True, blank=True, verbose_name="Можно распалечивать")

    updated_at: DateTimeField = DateTimeField(auto_now=True)

    def __str__(self):
        return f"ID:{self.product_id} | {self.sku or 'No SKU'} | {self.name}"

    class Meta:
        verbose_name = "Товар"
        verbose_name_plural = "Товары"


class CalculationRequest(models.Model):
    """
    Заголовок запроса на расчет.
    Хранит исходный файл (если был) и мета-информацию.
    """
    STATUS_CHOICES = (
        ('PENDING', 'В очереди'),
        ('PROCESSING', 'Рассчитывается'),
        ('COMPLETED', 'Завершено'),
        ('FAILED', 'Ошибка'),
    )

    created_at: DateTimeField = DateTimeField(auto_now_add=True, verbose_name="Дата расчета")
    source_file: FileField = FileField(upload_to='requests_xls/', null=True, blank=True,
                                   verbose_name="Исходный файл заказа")
    description: CharField = CharField(max_length=255, blank=True, verbose_name="Примечание")
    status: CharField = CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING', verbose_name="Статус")
    task_id: CharField = CharField(max_length=255, blank=True, null=True, verbose_name="ID задачи Celery")
    error_message: TextField = TextField(blank=True, null=True, verbose_name="Сообщение об ошибке")

    class Meta:
        verbose_name = "Запрос на расчет"
        verbose_name_plural = "Запросы на расчет"


class RequestItem(models.Model):
    """
    Строки запроса: Какой товар и сколько.
    """
    calculation_request: ForeignKey = ForeignKey(CalculationRequest, related_name='items', on_delete=models.CASCADE)
    product: ForeignKey = ForeignKey(Product, on_delete=models.CASCADE, verbose_name="Товар")
    quantity: PositiveIntegerField = PositiveIntegerField(validators=[MinValueValidator(1)], verbose_name="Количество")

    def __str__(self):
        return f"{self.product.sku} - {self.quantity} шт."


class PackingResult(models.Model):
    """
    Результат расчета: Список необходимых контейнеров.
    """
    calculation_request: ForeignKey = ForeignKey(CalculationRequest, related_name='results', on_delete=models.CASCADE)

    container_number: PositiveIntegerField = PositiveIntegerField()
    container_type: ForeignKey = ForeignKey(ContainerType, on_delete=models.PROTECT)

    total_weight_kg: FloatField = FloatField(verbose_name="Вес груза (кг)")
    total_volume_m3: FloatField = FloatField(verbose_name="Объем груза (м3)")

    volume_utilization_percent: FloatField = FloatField(verbose_name="Заполнение по объему (%)")
    area_utilization_percent: FloatField = FloatField(verbose_name="Заполнение по полу (%)")

    products: JSONField = JSONField(verbose_name="Список товаров в контейнере", default=list)
    packing_layout: JSONField = JSONField(verbose_name="Схема расстановки (JSON)", default=list)

    class Meta:
        ordering = ['container_number']
        verbose_name = "Результат (Контейнер)"
        verbose_name_plural = "Результаты (Контейнеры)"
