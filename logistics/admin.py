from django.contrib import admin
from .models import ContainerType, Product, CalculationRequest, RequestItem, PackingResult


@admin.register(ContainerType)
class ContainerTypeAdmin(admin.ModelAdmin):
    list_display = ('name', 'length_mm', 'width_mm', 'height_mm', 'volume_m3', 'max_weight_kg')
    search_fields = ('name',)


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('id', 'sku', 'name', 'item_weight_kg', 'is_dangerous', 'is_stackable', 'can_be_unpalletized', 'moq')
    list_filter = ('is_dangerous', 'is_stackable', 'can_be_unpalletized')
    search_fields = ('sku', 'name')
    fieldsets = (
        ('Основное', {
            'fields': ('id', 'sku', 'name', 'updated_at')
        }),
        ('Габариты единицы', {
            'fields': (('item_length_mm', 'item_width_mm', 'item_height_mm'), 'item_weight_kg')
        }),
        ('Паллетизация', {
            'fields': (('pallet_length_mm', 'pallet_width_mm', 'pallet_height_mm'), 'items_per_pallet')
        }),
        ('Логистика', {
            'fields': ('is_dangerous', 'is_stackable', 'can_be_unpalletized', 'items_per_masterbox', 'moq')
        }),
    )
    readonly_fields = ('updated_at',)


# Чтобы видеть товары внутри заявки прямо на странице заявки
class RequestItemInline(admin.TabularInline):
    model = RequestItem
    extra = 0  # Не показывать пустые строки по умолчанию
    autocomplete_fields = ['product']  # Удобный поиск, если товаров тысячи


@admin.register(CalculationRequest)
class CalculationRequestAdmin(admin.ModelAdmin):
    list_display = ('id', 'created_at', 'description', 'items_count')
    inlines = [RequestItemInline]

    def items_count(self, obj):
        return obj.items.count()

    items_count.short_description = "Кол-во позиций"


@admin.register(PackingResult)
class PackingResultAdmin(admin.ModelAdmin):
    list_display = ('id', 'calculation_request_link', 'container_type', 'volume_utilization_percent',
                    'area_utilization_percent')
    list_filter = ('container_type',)

    def calculation_request_link(self, obj):
        return f"Заявка #{obj.calculation_request.id}"

    calculation_request_link.short_description = "Заявка"