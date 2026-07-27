import os

from rest_framework import serializers
from .models import Product, ContainerType, PackingResult, RequestItem, CalculationRequest


class ErrorResponseSerializer(serializers.Serializer):
    """Единый формат ошибки во всех эндпоинтах: {"error": "..."}"""
    error = serializers.CharField(help_text="Описание ошибки")


class CalculationAcceptedSerializer(serializers.Serializer):
    """Ответ на создание заявки: расчёт принят и выполняется в фоне"""
    message = serializers.CharField(help_text="Человекочитаемое подтверждение")
    request_id = serializers.IntegerField(help_text="ID созданной заявки")
    task_id = serializers.UUIDField(help_text="ID задачи в Celery")
    status_url = serializers.CharField(help_text="URL для опроса статуса расчёта")


class PositionSerializer(serializers.Serializer):
    x = serializers.FloatField(help_text="Координата X")
    y = serializers.FloatField(help_text="Координата Y")
    z = serializers.FloatField(help_text="Координата Z")


class DimensionsSerializer(serializers.Serializer):
    width = serializers.FloatField(help_text="Ширина в мм")
    height = serializers.FloatField(help_text="Высота в мм")
    length = serializers.FloatField(help_text="Длина в мм")


class PackedItemLayoutSerializer(serializers.Serializer):
    type = serializers.CharField(help_text="Тип объекта (pallet/masterbox/product)")
    position = PositionSerializer()
    dimensions = DimensionsSerializer()
    product_id = serializers.IntegerField(help_text="ID товара в БД")


class PackedItemProductsSerializer(serializers.Serializer):
    product_id = serializers.IntegerField(help_text="ID товара в БД")
    product_name = serializers.CharField(required=True, allow_blank=True, help_text="Наименование товара")
    quantity = serializers.IntegerField(required=True, help_text="Количество товара")


class ProductSerializer(serializers.ModelSerializer):
    """
    Сериализатор для модели Product.
    """

    class Meta:
        model = Product
        fields = '__all__'


class FileUploadSerializer(serializers.Serializer):
    """
    Вспомогательный сериализатор для эндпоинта загрузки Excel.
    Он нужен только для того, чтобы DRF знал, что мы ожидаем файл,
    и мог отобразить удобное поле загрузки в веб-интерфейсе (Swagger/Browsable API).
    """
    file = serializers.FileField(required=True, help_text="Excel файл с товарами (.xlsx)")


class ContainerTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContainerType
        fields = '__all__'


class RequestItemSerializer(serializers.ModelSerializer):
    """Сериализатор для одной позиции в заявке"""
    # Разрешаем передавать просто числовой ID товара
    product_id = serializers.IntegerField(source='product.product_id')

    class Meta:
        model = RequestItem
        fields = ['product_id', 'quantity']


class CalculationRequestCreateSerializer(serializers.Serializer):
    """Сериализатор для ручного создания заявки (через JSON)"""
    container_type_id = serializers.IntegerField(required=True, help_text="ID выбранного типа контейнера")
    description = serializers.CharField(required=False, allow_blank=True)
    items = RequestItemSerializer(many=True)


class CalculationFileUploadSerializer(serializers.Serializer):
    """Сериализатор для загрузки файла с заказом (.xlsx или .csv)"""
    container_type_id = serializers.IntegerField(required=True, help_text="ID выбранного типа контейнера")
    file = serializers.FileField(required=True, help_text="Файл заказа (.xlsx или .csv). Поля: ID, Qty")
    description = serializers.CharField(required=False, allow_blank=True)


class PackingResultSerializer(serializers.ModelSerializer):
    """Сериализатор для результатов упаковки (один контейнер)"""
    products = PackedItemProductsSerializer(many=True)
    packing_layout = PackedItemLayoutSerializer(many=True)

    class Meta:
        model = PackingResult
        fields = '__all__'


class SourceFileNameMixin(serializers.Serializer):
    """
    Добавляет читаемое имя исходного файла заявки.

    Поле source_file DRF отдаёт как URL, а FileSystemStorage.url() прогоняет имя
    через filepath_to_uri() — кириллица превращается в %D0%9A%D0... Поэтому имя
    для отображения берём напрямую из значения в БД.
    """
    source_file_name = serializers.SerializerMethodField()

    def get_source_file_name(self, obj) -> str | None:
        if not obj.source_file:
            return None
        return os.path.basename(obj.source_file.name)


class CalculationRequestListSerializer(SourceFileNameMixin, serializers.ModelSerializer):
    """Краткий сериализатор для списка заявок (без тяжелой 3D-геометрии)"""

    class Meta:
        model = CalculationRequest
        fields = ['id', 'created_at', 'status', 'description', 'source_file', 'source_file_name']


class CalculationRequestDetailSerializer(SourceFileNameMixin, serializers.ModelSerializer):
    """Детальный сериализатор, включающий товары и готовую расстановку в контейнерах"""
    items = RequestItemSerializer(many=True, read_only=True)
    results = PackingResultSerializer(many=True, read_only=True)

    class Meta:
        model = CalculationRequest
        fields = ['id', 'created_at', 'status', 'description', 'source_file', 'source_file_name',
                  'items', 'results']


class CalculationStatusResponseSerializer(serializers.Serializer):
    """Сериализатор для документации ответа эндпоинта status"""
    id = serializers.IntegerField(help_text="ID заявки")
    status = serializers.CharField(help_text="Системный статус (PENDING, PROCESSING, etc)")
    status_display = serializers.CharField(help_text="Человекочитаемый статус")
    task_id = serializers.CharField(allow_null=True, required=False, help_text="ID задачи в Celery")
    error_message = serializers.CharField(allow_null=True, required=False, help_text="Текст ошибки, если есть")


class SyncResponseSerializer(serializers.Serializer):
    """Сериализатор для документации ответа синхронизации"""
    status = serializers.CharField()
    message = serializers.CharField()
    created = serializers.IntegerField()
    updated = serializers.IntegerField()
