import os
from django.conf import settings
from django.db import transaction
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiResponse

from .models import Product, ContainerType, RequestItem
from .serializers import (ProductSerializer, FileUploadSerializer, ContainerTypeSerializer,
                          CalculationFileUploadSerializer, CalculationRequest, CalculationRequestCreateSerializer,
                          CalculationRequestListSerializer, CalculationRequestDetailSerializer,
                          CalculationStatusResponseSerializer, SyncGoogleResponseSerializer)
from .services.loader import GoogleSheetsLoader, FileLoader
from .tasks import run_packing_task

class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API для работы с товарами.
    """
    queryset = Product.objects.all().order_by('product_id')
    serializer_class = ProductSerializer

    @extend_schema(
        summary="Синхронизация с Google Sheets",
        description="Скачивает данные из таблицы и обновляет базу товаров.",
        responses={200: SyncGoogleResponseSerializer}
    )
    @action(detail=False, methods=['post'], url_path='sync-google')
    def sync_google(self, request):
        """
        Эндпоинт для запуска синхронизации с Google Sheets.
        POST /api/products/sync-google/
        """
        creds_path = os.path.join(settings.BASE_DIR, 'logistics/services/google_credentials.json')

        sheet_url = 'https://docs.google.com/spreadsheets/d/1XIk7mO6DLrg5XtK8UtxUkcxei4tnAUMXbh3Y9G350rw/edit'

        sheet = 'Spravka'

        if not os.path.exists(creds_path):
            return Response(
                {"error": "Файл google_credentials.json не найден в корне проекта."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        try:
            loader = GoogleSheetsLoader(creds_path, sheet_url, sheet)
            created, updated = loader.load_to_db()
            return Response({
                "message": "Синхронизация с Google Sheets прошла успешно!",
                "created": created,
                "updated": updated
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {"error": f"Ошибка при синхронизации: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['post'], url_path='sync-excel', serializer_class=FileUploadSerializer)
    def sync_file(self, request):
        """
        Эндпоинт для загрузки Excel-файла вручную.
        POST /api/products/sync-excel/
        """
        serializer = FileUploadSerializer(data=request.data)

        if serializer.is_valid():
            uploaded_file = serializer.validated_data['file']

            try:
                loader = FileLoader(uploaded_file)
                created, updated = loader.load_to_db()
                return Response({
                    "message": "Данные из Excel успешно загружены!",
                    "created": created,
                    "updated": updated
                }, status=status.HTTP_200_OK)

            except Exception as e:
                return Response(
                    {"error": f"Ошибка при обработке файла: {str(e)}"},
                    status=status.HTTP_400_BAD_REQUEST
                )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class ContainerTypeViewSet(viewsets.ModelViewSet):
    """
    API для управления типами контейнеров.
    Поддерживает GET (список), POST (создать), PUT/PATCH (изменить), DELETE (удалить).
    """
    queryset = ContainerType.objects.all()
    serializer_class = ContainerTypeSerializer

class CalculationViewSet(viewsets.GenericViewSet):
    """
    API для создания заявок на расчёт контейнеров.
    """
    queryset = CalculationRequest.objects.all()
    # @staticmethod
    # def _run_packing_pipeline(calc_request: CalculationRequest, container_type: ContainerType) -> Response:
    #     """
    #     Вспомогательный метод.
    #     Запускает общую логику препроцессинга, 3D-упаковки и сохранения результатов.
    #     """
    #     try:
    #         # 1. Препроцессинг (перевод штук в паллеты/коробки)
    #         preprocessor = RequestPreprocessor(calc_request.id)
    #         packable_items, warnings = preprocessor.process()
    #
    #         # 2. 3D Упаковка (передаем выбранный пользователем контейнер)
    #         calculator = PackingService(packable_items, container_type)
    #         packing_results_data = calculator.calculate()
    #
    #         # 3. Сохраняем результаты в БД
    #         packing_result_objects = []
    #         for res in packing_results_data:
    #             packing_result_objects.append(PackingResult(
    #                 calculation_request=calc_request,
    #                 container_number=res['container_index'],
    #                 container_type_id=res['container_type_id'],
    #                 total_weight_kg=res['total_weight_kg'],
    #                 total_volume_m3=res['total_volume_m3'],
    #                 volume_utilization_percent=res['volume_utilization_percent'],
    #                 area_utilization_percent=res['area_utilization_percent'],
    #                 packing_layout=res['layout']
    #             ))
    #
    #         PackingResult.objects.bulk_create(packing_result_objects)
    #
    #         return Response({
    #             "message": "Расчет успешно выполнен",
    #             "request_id": calc_request.id,
    #             "containers_used": len(packing_results_data),
    #             "warnings": warnings
    #         }, status=status.HTTP_201_CREATED)
    #
    #     except Exception as e:
    #         # Если математика упала, удаляем созданную заявку, чтобы не оставлять мусор в БД
    #         calc_request.delete()
    #         return Response(
    #             {"error": f"Ошибка при расчете 3D упаковки: {str(e)}"},
    #             status=status.HTTP_500_INTERNAL_SERVER_ERROR
    #         )

    @extend_schema(
        summary="Создать заявку вручную",
        description="Создает заявку на основе переданного JSON списка товаров и запускает фоновый расчет.",
        request=CalculationRequestCreateSerializer,
        responses={
            202: OpenApiResponse(description="Заявка принята. Расчет начался."),
            400: OpenApiResponse(description="Ошибка валидации данных")
        }
    )
    @action(detail=False, methods=['post'], serializer_class=CalculationRequestCreateSerializer)
    def manual(self, request):
        """Создание заявки вручную передачей JSON."""
        serializer = CalculationRequestCreateSerializer(data=request.data)

        if serializer.is_valid():
            container_type_id = serializer.validated_data['container_type_id']
            items_data = serializer.validated_data['items']
            description = serializer.validated_data.get('description', '')

            try:
                container_type = ContainerType.objects.get(id=container_type_id)
            except ContainerType.DoesNotExist:
                return Response({"error": f"Контейнер с ID {container_type_id} не найден."}, status=status.HTTP_404_NOT_FOUND)

            try:
                with transaction.atomic():
                    calc_request = CalculationRequest.objects.create(description=description)

                    request_items = []
                    for item in items_data:
                        prod_id = item['product']['product_id']

                        try:
                            product = Product.objects.get(product_id=prod_id)
                        except Product.DoesNotExist:
                            raise ValueError(f"Товар с ID {prod_id} не найден в базе.")

                        request_items.append(
                            RequestItem(calculation_request=calc_request, product=product, quantity=item['quantity'])
                        )

                    RequestItem.objects.bulk_create(request_items)
            except ValueError as e:
                return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

            task = run_packing_task.delay(calc_request.id, container_type.id)

            return Response({
                "message": "Расчет добавлен в очередь и выполняется в фоне.",
                "request_id": calc_request.id,
                "task_id": task.id
            }, status=status.HTTP_202_ACCEPTED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @extend_schema(
        summary="Загрузить заявку через файл",
        description="Создает заявку из загруженного Excel (.xlsx) или CSV файла и запускает расчет в фоне.",
        request=CalculationFileUploadSerializer,
        responses={
            202: OpenApiResponse(description="Файл загружен. Расчет начался."),
            400: OpenApiResponse(description="Ошибка валидации или обработки файла")
        }
    )
    @action(detail=False, methods=['post'], serializer_class=CalculationFileUploadSerializer)
    def upload_file(self, request):
        """Создание заявки путем загрузки .xlsx или .csv файла."""
        serializer = CalculationFileUploadSerializer(data=request.data)

        if serializer.is_valid():
            uploaded_file = serializer.validated_data['file']
            container_type_id = serializer.validated_data['container_type_id']
            description = serializer.validated_data.get('description', f"Из файла {uploaded_file.name}")

            try:
                container_type = ContainerType.objects.get(id=container_type_id)
            except ContainerType.DoesNotExist:
                return Response({"error": f"Контейнер с ID {container_type_id} не найден."}, status=status.HTTP_404_NOT_FOUND)

            try:
                loader = FileLoader(uploaded_file)
                df = loader.get_dataframe()

                df.columns = df.columns.str.lower()
                id_col = 'id' if 'id' in df.columns else 'product_id'
                qty_col = 'qty' if 'qty' in df.columns else 'quantity'

                if id_col not in df.columns or qty_col not in df.columns:
                    return Response({"error": f"В файле не найдены колонки {id_col} и/или {qty_col}."}, status=status.HTTP_400_BAD_REQUEST)

                df = df.dropna(subset=[id_col, qty_col])

                with transaction.atomic():
                    calc_request = CalculationRequest.objects.create(
                        description=description,
                        source_file=uploaded_file
                    )

                    request_items = []
                    for index, row in df.iterrows():
                        prod_id = int(row[id_col])
                        qty = int(row[qty_col])

                        try:
                            product = Product.objects.get(product_id=prod_id)
                        except Product.DoesNotExist:
                            raise ValueError(f"Товар с ID {prod_id} не найден в базе.")

                        request_items.append(
                            RequestItem(calculation_request=calc_request, product=product, quantity=qty)
                        )

                    RequestItem.objects.bulk_create(request_items)

            except ValueError as e:
                return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
            except Exception as e:
                return Response({"error": f"Ошибка обработки файла: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

            task = run_packing_task.delay(calc_request.id, container_type.id)

            return Response({
                "message": "Расчет добавлен в очередь и выполняется в фоне.",
                "request_id": calc_request.id,
                "task_id": task.id,
                "status_url": f"/api/calculate/{calc_request.id}/status/"
            }, status=status.HTTP_202_ACCEPTED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @extend_schema(
        summary="Получить список заявок",
        description="Возвращает историю всех расчетов (без детальной геометрии, чтобы не грузить сеть).",
        responses={200: CalculationRequestListSerializer(many=True)}
    )
    def list(self, request):
        """
        GET /api/calculate/
        Возвращает историю всех расчетов (без детальной геометрии, чтобы не грузить сеть).
        """
        queryset = CalculationRequest.objects.all().order_by('-id')
        serializer = CalculationRequestListSerializer(queryset, many=True)
        return Response(serializer.data)

    @extend_schema(
        summary="Детали заявки и расстановка",
        description="Возвращает полную детализацию заявки по ID вместе с результатами упаковки (3D-координатами).",
        responses={
            200: CalculationRequestDetailSerializer,
            404: OpenApiResponse(description="Заявка не найдена")
        }
    )
    def retrieve(self, request, pk=None):
        """
        GET /api/calculate/{id}/
        Возвращает полную детализацию заявки по ID вместе с результатами упаковки (3D-координатами).
        """
        # Используем prefetch_related, чтобы достать все связанные товары и результаты
        # за 1-2 SQL запроса, а не спамить базу сотнями запросов
        queryset = CalculationRequest.objects.prefetch_related('items__product', 'results')

        try:
            calc_request = queryset.get(pk=pk)
        except CalculationRequest.DoesNotExist:
            return Response({"error": "Заявка не найдена"}, status=status.HTTP_404_NOT_FOUND)

        serializer = CalculationRequestDetailSerializer(calc_request)
        return Response(serializer.data)

    @extend_schema(
        summary="Узнать статус расчета",
        description="Возвращает текущий статус фоновой задачи упаковки.",
        responses={
            200: CalculationStatusResponseSerializer,
            404: OpenApiResponse(description="Заявка не найдена")
        }
    )
    @action(detail=True, methods=['get'])
    def status(self, request, pk=None):
        """
        GET /api/calculate/{id}/status/
        Возвращает текущий статус расчета.
        """
        try:
            calc_request = CalculationRequest.objects.get(pk=pk)
            return Response({
                "id": calc_request.id,
                "status": calc_request.status,
                "status_display": calc_request.get_status_display(),
                "task_id": calc_request.task_id,
                "error_message": calc_request.error_message
            })
        except CalculationRequest.DoesNotExist:
            return Response({"error": "Заявка не найдена"}, status=status.HTTP_404_NOT_FOUND)