import shutil
import tempfile
from datetime import timedelta
from io import BytesIO
from types import SimpleNamespace
from unittest.mock import patch

from django.core.files.base import ContentFile
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from openpyxl import Workbook, load_workbook

from .models import CalculationExport, CalculationRequest, ContainerType, PackingResult, Product
from .serializers import CalculationRequestListSerializer
from .services.exporter import ExportFileService, PackingExcelExporter, PackingExportError
from .tasks import cleanup_old_files

XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'


class TempMediaMixin:
    """Изолированный MEDIA_ROOT на время теста, чтобы не мусорить в проекте."""

    @classmethod
    def setUpClass(cls):
        cls._media_root = tempfile.mkdtemp(prefix='cp-test-media-')
        cls._media_override = override_settings(MEDIA_ROOT=cls._media_root)
        cls._media_override.enable()
        super().setUpClass()

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        cls._media_override.disable()
        shutil.rmtree(cls._media_root, ignore_errors=True)


class ExportTestDataMixin:
    """Общая фикстура: заявка с двумя рассчитанными контейнерами."""

    def setUp(self):
        self.container_type = ContainerType.objects.create(
            name="40HQ", length_mm=12000, width_mm=2350, height_mm=2690,
            max_weight_kg=26000, volume_m3=76.0,
        )
        Product.objects.create(product_id=1024, sku="TV-55", name="Телевизор 55", category="TV")
        Product.objects.create(product_id=2048, sku="MON-27", name="Монитор 27", category="Monitor")

        self.calc_request = CalculationRequest.objects.create(status='COMPLETED', description="Тестовая заявка")
        PackingResult.objects.create(
            calculation_request=self.calc_request, container_number=1, container_type=self.container_type,
            total_weight_kg=6120.5, total_volume_m3=65.32,
            volume_utilization_percent=87.4, area_utilization_percent=95.1,
            products=[
                {"product_id": 1024, "product_name": "Устаревшее имя", "quantity": 120},
                {"product_id": 2048, "product_name": "Монитор 27", "quantity": 480},
            ],
            packing_layout=[],
        )
        PackingResult.objects.create(
            calculation_request=self.calc_request, container_number=2, container_type=self.container_type,
            total_weight_kg=2980.0, total_volume_m3=31.5,
            volume_utilization_percent=42.0, area_utilization_percent=61.3,
            products=[{"product_id": 1024, "product_name": "Телевизор 55", "quantity": 60}],
            packing_layout=[],
        )


class PackingExcelExporterTests(ExportTestDataMixin, TestCase):

    def _workbook(self, calc_request=None):
        stream = PackingExcelExporter(calc_request or self.calc_request).build()
        self.assertIsInstance(stream, BytesIO)
        return load_workbook(stream)

    def test_filename_contains_request_id(self):
        exporter = PackingExcelExporter(self.calc_request)
        self.assertEqual(exporter.filename, f"raskladka_{self.calc_request.id}.xlsx")

    def test_workbook_has_two_sheets(self):
        self.assertEqual(self._workbook().sheetnames, ["Сводка", "Раскладка"])

    def test_summary_row_per_container(self):
        sheet = self._workbook()["Сводка"]
        rows = [r for r in sheet.iter_rows(min_row=5, values_only=True) if r[0] in (1, 2)]
        self.assertEqual(len(rows), 2)

        first = rows[0]
        self.assertEqual(first[0], 1)                # № контейнера
        self.assertEqual(first[1], "40HQ")           # тип
        self.assertAlmostEqual(first[2], 87.4)       # заполнение по объёму
        self.assertAlmostEqual(first[3], 65.32)      # объём груза
        self.assertAlmostEqual(first[4], 6120.5)     # вес груза
        self.assertEqual(first[5], 2)                # позиций
        self.assertEqual(first[6], 600)              # всего единиц

    def test_summary_totals(self):
        sheet = self._workbook()["Сводка"]
        totals = next(r for r in sheet.iter_rows(min_row=5, values_only=True) if r[0] == "ИТОГО")
        self.assertAlmostEqual(totals[3], 96.82)                 # суммарный объём
        self.assertAlmostEqual(totals[4], 9100.5)                # суммарный вес
        self.assertEqual(totals[5], 2)                           # уникальных товаров во всей заявке
        self.assertEqual(totals[6], 660)                         # всего единиц

    def test_layout_contains_sku_from_catalog(self):
        sheet = self._workbook()["Раскладка"]
        rows = [r for r in sheet.iter_rows(values_only=True) if r[0] in (1024, 2048)]
        self.assertEqual(len(rows), 3)  # 1024 встречается в обоих контейнерах

        by_id = {}
        for row in rows:
            by_id.setdefault(row[0], []).append(row)

        # SKU подтягивается из справочника — в JSON результата его нет
        self.assertEqual(by_id[1024][0][2], "TV-55")
        self.assertEqual(by_id[2048][0][2], "MON-27")
        # Имя берётся из актуальной карточки товара, а не из «замороженного» JSON
        self.assertEqual(by_id[1024][0][1], "Телевизор 55")
        # Количество — именно в этом контейнере
        self.assertEqual([row[3] for row in by_id[1024]], [120, 60])

    def test_unknown_product_falls_back_to_stored_name(self):
        result = PackingResult.objects.get(calculation_request=self.calc_request, container_number=1)
        result.products = [{"product_id": 9999, "product_name": "Товар вне справочника", "quantity": 7}]
        result.save()

        sheet = self._workbook()["Раскладка"]
        row = next(r for r in sheet.iter_rows(values_only=True) if r[0] == 9999)
        self.assertEqual(row[1], "Товар вне справочника")
        self.assertEqual(row[2], "—")
        self.assertEqual(row[3], 7)

    def test_request_without_results_raises(self):
        empty = CalculationRequest.objects.create(status='COMPLETED')
        with self.assertRaises(PackingExportError):
            PackingExcelExporter(empty).build()


class ExportEndpointTests(TempMediaMixin, ExportTestDataMixin, TestCase):

    def download(self, url) -> tuple:
        """
        GET + вычитывание тела + освобождение файлового дескриптора.

        FileResponse держит файл открытым, а в Windows занятый файл нельзя ни
        удалить, ни перезаписать. В бою дескриптор закрывает WSGI-сервер после
        отдачи ответа; здесь закрываем только сам файл, а не response целиком —
        response.close() шлёт сигнал request_finished, который рвёт соединение
        с БД внутри тестовой транзакции.
        """
        response = self.client.get(url)
        content = b"".join(response.streaming_content) if response.streaming else response.content

        file_to_stream = getattr(response, 'file_to_stream', None)
        if file_to_stream is not None:
            file_to_stream.close()

        return response, content

    def test_template_download(self):
        response, content = self.download('/api/calculate/template/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], XLSX_CONTENT_TYPE)
        self.assertIn('attachment', response['Content-Disposition'])
        self.assertIn('request_template.xlsx', response['Content-Disposition'])
        self.assertTrue(content.startswith(b'PK'))  # zip-контейнер xlsx

    def test_export_returns_xlsx(self):
        response, content = self.download(f'/api/calculate/{self.calc_request.id}/export/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], XLSX_CONTENT_TYPE)
        self.assertIn(f'raskladka_{self.calc_request.id}.xlsx', response['Content-Disposition'])
        self.assertEqual(load_workbook(BytesIO(content)).sheetnames, ["Сводка", "Раскладка"])

    def test_export_unknown_request_returns_404(self):
        response, _ = self.download('/api/calculate/999999/export/')
        self.assertEqual(response.status_code, 404)
        self.assertIn('error', response.json())

    def test_export_unfinished_request_returns_409(self):
        self.calc_request.status = 'PROCESSING'
        self.calc_request.save()

        response, _ = self.download(f'/api/calculate/{self.calc_request.id}/export/')
        self.assertEqual(response.status_code, 409)
        self.assertIn('error', response.json())

    def test_export_completed_without_results_returns_409(self):
        empty = CalculationRequest.objects.create(status='COMPLETED')
        response, _ = self.download(f'/api/calculate/{empty.id}/export/')
        self.assertEqual(response.status_code, 409)
        self.assertIn('error', response.json())

    def test_export_is_stored_and_reused(self):
        url = f'/api/calculate/{self.calc_request.id}/export/'

        self.download(url)
        self.assertEqual(CalculationExport.objects.count(), 1)
        export = CalculationExport.objects.get()
        self.assertTrue(export.file.storage.exists(export.file.name))
        first_name = export.file.name

        # Повторное скачивание не плодит записи и отдаёт тот же файл
        response, _ = self.download(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(CalculationExport.objects.count(), 1)
        self.assertEqual(CalculationExport.objects.get().file.name, first_name)

    def test_export_regenerated_if_file_missing(self):
        url = f'/api/calculate/{self.calc_request.id}/export/'
        self.download(url)

        export = CalculationExport.objects.get()
        export.file.storage.delete(export.file.name)  # имитируем чистку по ретеншену
        self.assertFalse(export.file.storage.exists(export.file.name))

        response, content = self.download(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(CalculationExport.objects.count(), 1)
        self.assertEqual(load_workbook(BytesIO(content)).sheetnames, ["Сводка", "Раскладка"])

    def test_export_download_name_is_stable(self):
        response, _ = self.download(f'/api/calculate/{self.calc_request.id}/export/')
        self.assertIn(f'raskladka_{self.calc_request.id}.xlsx', response['Content-Disposition'])

    def test_deleting_request_removes_export_file(self):
        self.download(f'/api/calculate/{self.calc_request.id}/export/')
        export = CalculationExport.objects.get()
        storage, name = export.file.storage, export.file.name

        self.calc_request.delete()

        self.assertEqual(CalculationExport.objects.count(), 0)
        self.assertFalse(storage.exists(name))


class SourceFileNameTests(TempMediaMixin, TestCase):
    """Кириллица в имени исходного файла не должна доезжать до фронта в percent-энкоде."""

    def test_serializer_returns_readable_name(self):
        calc_request = CalculationRequest.objects.create(status='COMPLETED')
        calc_request.source_file.save("Заявка №5.xlsx", ContentFile(b"x"), save=True)

        data = CalculationRequestListSerializer(calc_request).data

        self.assertNotIn('%D0', data['source_file_name'])
        self.assertTrue(data['source_file_name'].startswith("Заявка"))
        self.assertTrue(data['source_file_name'].endswith(".xlsx"))
        # А в source_file (URL) энкод как раз ожидаем — поле оставлено для совместимости
        self.assertIn('%D0', data['source_file'])

    def test_serializer_returns_none_for_manual_request(self):
        calc_request = CalculationRequest.objects.create(status='COMPLETED')
        self.assertIsNone(CalculationRequestListSerializer(calc_request).data['source_file_name'])


class CalculationDescriptionTests(TempMediaMixin, TestCase):
    """Описание заявки приходит с фронта и должно доезжать до БД обоими путями."""

    def setUp(self):
        self.container_type = ContainerType.objects.create(
            name="40HQ", length_mm=12000, width_mm=2350, height_mm=2690,
            max_weight_kg=26000, volume_m3=76.0,
        )
        Product.objects.create(product_id=1024, sku="TV-55", name="Телевизор 55")

    @staticmethod
    def _order_file() -> SimpleUploadedFile:
        workbook = Workbook()
        sheet = workbook.active
        sheet.append(["ID", "Qty"])
        sheet.append([1024, 5])
        stream = BytesIO()
        workbook.save(stream)
        return SimpleUploadedFile(
            "order.xlsx", stream.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )

    @patch('logistics.views.run_packing_task.delay')
    def test_manual_request_keeps_description(self, delay_mock):
        delay_mock.return_value = SimpleNamespace(id='00000000-0000-0000-0000-000000000000')

        response = self.client.post(
            '/api/calculate/manual/',
            data={
                "container_type_id": self.container_type.id,
                "description": "Экспорт RU→KZ, паллеты",
                "items": [{"product_id": 1024, "quantity": 5}],
            },
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 202)
        calc_request = CalculationRequest.objects.get(pk=response.json()['request_id'])
        self.assertEqual(calc_request.description, "Экспорт RU→KZ, паллеты")
        # И возвращается фронту в списке заявок
        self.assertEqual(
            CalculationRequestListSerializer(calc_request).data['description'],
            "Экспорт RU→KZ, паллеты"
        )

    @patch('logistics.views.run_packing_task.delay')
    def test_upload_request_keeps_description(self, delay_mock):
        delay_mock.return_value = SimpleNamespace(id='00000000-0000-0000-0000-000000000000')

        response = self.client.post(
            '/api/calculate/upload_file/',
            data={
                "container_type_id": self.container_type.id,
                "description": "Ноябрьская отгрузка",
                "file": self._order_file(),
            },
        )

        self.assertEqual(response.status_code, 202)
        calc_request = CalculationRequest.objects.get(pk=response.json()['request_id'])
        self.assertEqual(calc_request.description, "Ноябрьская отгрузка")

    @patch('logistics.views.run_packing_task.delay')
    def test_upload_without_description_falls_back_to_file_name(self, delay_mock):
        delay_mock.return_value = SimpleNamespace(id='00000000-0000-0000-0000-000000000000')

        response = self.client.post(
            '/api/calculate/upload_file/',
            data={"container_type_id": self.container_type.id, "file": self._order_file()},
        )

        self.assertEqual(response.status_code, 202)
        calc_request = CalculationRequest.objects.get(pk=response.json()['request_id'])
        self.assertIn("order.xlsx", calc_request.description)


class CleanupOldFilesTests(TempMediaMixin, ExportTestDataMixin, TestCase):

    def _aged_request(self, days: int, filename: str = "старая_заявка.xlsx") -> CalculationRequest:
        calc_request = CalculationRequest.objects.create(status='COMPLETED')
        calc_request.source_file.save(filename, ContentFile(b"x"), save=True)
        CalculationRequest.objects.filter(pk=calc_request.pk).update(
            created_at=timezone.now() - timedelta(days=days)
        )
        return calc_request

    def test_removes_old_source_files_but_keeps_db_value(self):
        old = self._aged_request(days=40)
        name = old.source_file.name
        storage = old.source_file.storage

        result = cleanup_old_files(retention_days=30)

        self.assertEqual(result['sources_removed'], 1)
        self.assertFalse(storage.exists(name))
        # Имя в БД сохраняется — иначе история потеряет колонку «Источник»
        old.refresh_from_db()
        self.assertEqual(old.source_file.name, name)

    def test_keeps_fresh_source_files(self):
        fresh = self._aged_request(days=1, filename="свежая_заявка.xlsx")

        result = cleanup_old_files(retention_days=30)

        self.assertEqual(result['sources_removed'], 0)
        self.assertTrue(fresh.source_file.storage.exists(fresh.source_file.name))

    def test_removes_old_exports_with_files(self):
        export = ExportFileService(self.calc_request).get_or_create()
        storage, name = export.file.storage, export.file.name
        CalculationExport.objects.filter(pk=export.pk).update(
            created_at=timezone.now() - timedelta(days=40)
        )

        result = cleanup_old_files(retention_days=30)

        self.assertEqual(result['exports_removed'], 1)
        self.assertEqual(CalculationExport.objects.count(), 0)
        self.assertFalse(storage.exists(name))

    def test_keeps_fresh_exports(self):
        ExportFileService(self.calc_request).get_or_create()

        result = cleanup_old_files(retention_days=30)

        self.assertEqual(result['exports_removed'], 0)
        self.assertEqual(CalculationExport.objects.count(), 1)
