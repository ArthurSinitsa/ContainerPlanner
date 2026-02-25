from django.contrib import admin
from .models import ContainerType, Product, CalculationRequest, RequestItem, PackingResult


@admin.register(ContainerType)
class ContainerTypeAdmin(admin.ModelAdmin):
    list_display = ('name', 'length_mm', 'width_mm', 'height_mm', 'volume_m3', 'max_weight_kg')
    search_fields = ('name',)


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    # Что показываем в общем списке
    list_display = (
        'product_id', 'sku', 'name', 'category',
        'qty_of_pallet', 'pallet_weight_kg',
        'battery_flag', 'is_dangerous'
    )

    # По каким полям можно фильтровать список справа
    list_filter = (
        'category', 'battery_flag', 'is_dangerous',
        'is_stackable', 'can_be_unpalletized'
    )

    # По каким полям работает строка поиска
    search_fields = ('product_id', 'sku', 'name', 'ean')

    # Группировка полей внутри карточки конкретного товара
    fieldsets = (
        ('Основные данные', {
            'fields': (
                'product_id', 'sku', 'name', 'category', 'ean', 'spec_name', 'updated_at'
            )
        }),
        ('Габариты товара (мм)', {
            'fields': (
                ('product_length_mm', 'product_width_mm', 'product_height_mm'),
            )
        }),
        ('Мастербокс (мм)', {
            'fields': (
                ('masterbox_length_mm', 'masterbox_width_mm', 'masterbox_height_mm'),
                'qty_of_masterbox'
            )
        }),
        ('Паллета (мм и кг)', {
            'fields': (
                ('pallet_length_mm', 'pallet_width_mm', 'pallet_height_mm'),
                'qty_of_pallet', 'pallet_weight_kg'
            )
        }),
        ('Логистика и Правила заказа', {
            'fields': (
                'order_requirement',
                ('battery_flag', 'is_dangerous', 'is_stackable', 'can_be_unpalletized'),
            )
        }),
        ('Специфичные флаги', {
            'fields': (
                ('kj_flag', 'si_flag', 'eol_flag', 'gz_flag'),
            ),
            'classes': ('collapse',)
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