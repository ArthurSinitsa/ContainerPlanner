from rest_framework import serializers
from .models import Product, ContainerType, PackingResult, RequestItem, CalculationRequest

class ProductSerializer(serializers.ModelSerializer):
    """
    Сериализатор для модели Product.
    """
    class Meta:
        model = Product
        fields = '__all__' # Берем абсолютно все поля из модели


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
    class Meta:
        model = PackingResult
        fields = '__all__'

class CalculationRequestListSerializer(serializers.ModelSerializer):
    """Краткий сериализатор для списка заявок (без тяжелой 3D-геометрии)"""
    class Meta:
        model = CalculationRequest
        fields = ['id', 'created_at', 'description', 'source_file']

class CalculationRequestDetailSerializer(serializers.ModelSerializer):
    """Детальный сериализатор, включающий товары и готовую расстановку в контейнерах"""
    items = RequestItemSerializer(many=True, read_only=True)
    results = PackingResultSerializer(many=True, read_only=True)

    class Meta:
        model = CalculationRequest
        fields = ['id', 'created_at', 'description', 'source_file', 'items', 'results']