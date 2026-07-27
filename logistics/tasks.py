import logging
from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.utils import timezone

from .models import CalculationExport, CalculationRequest, ContainerType, PackingResult
from .services.preprocessor import RequestPreprocessor
from .services.calculator import PackingService

logger = logging.getLogger(__name__)

@shared_task(bind=True)
def run_packing_task(self, calc_request_id, container_type_id):
    """
    Фоновая задача для 3D упаковки.
    Мы передаем только ID, так как Celery принимает только простые типы данных (числа, строки).
    """

    calc_request = CalculationRequest.objects.get(id=calc_request_id)
    container_type = ContainerType.objects.get(id=container_type_id)

    try:
        calc_request.status = 'PROCESSING'
        calc_request.task_id = self.request.id
        calc_request.save()

        # 1. Препроцессинг
        preprocessor = RequestPreprocessor(calc_request.id)
        packable_items, warnings = preprocessor.process()

        # 2. 3D Упаковка (Тот самый тяжелый процесс)
        calculator = PackingService(packable_items, container_type)
        packing_results_data = calculator.calculate()

        # 3. Сохраняем результаты
        packing_result_objects = []
        for res in packing_results_data:
            packing_result_objects.append(PackingResult(
                calculation_request=calc_request,
                container_number=res['container_index'],
                container_type_id=res['container_type_id'],
                total_weight_kg=res['total_weight_kg'],
                total_volume_m3=res['total_volume_m3'],
                volume_utilization_percent=res['volume_utilization_percent'],
                area_utilization_percent=res['area_utilization_percent'],
                products=res['products'],
                packing_layout=res['layout']
            ))

        PackingResult.objects.bulk_create(packing_result_objects)

        calc_request.status = 'COMPLETED'
        calc_request.save()

        return {
            "status": "success",
            "message": "Расчет успешно выполнен",
            "request_id": calc_request.id,
            "containers_used": len(packing_results_data),
            "warnings": warnings
        }

    except Exception as e:
        logger.exception("Packing task failed for request_id=%s: %s", calc_request_id, e)
        if 'calc_request' in locals():
            calc_request.status = 'FAILED'
            calc_request.error_message = f"{type(e).__name__}: {str(e)}"
            calc_request.save()
        return {"status": "error", "message": str(e)}


@shared_task
def cleanup_old_files(retention_days: int | None = None):
    """
    Периодическая чистка файлов в MEDIA_ROOT (по расписанию из CELERY_BEAT_SCHEDULE).

    Удаляет:
      * файлы раскладок (exports/) вместе с записями CalculationExport —
        при следующем скачивании они будут сгенерированы заново;
      * исходные файлы заявок (requests_xls/) — после загрузки они больше
        не читаются, разбор происходит сразу во вьюхе.

    Значение поля source_file в БД при этом НЕ очищается: имя файла нужно
    истории расчётов для колонки «Источник».
    """
    days = retention_days if retention_days is not None else settings.FILE_RETENTION_DAYS
    cutoff = timezone.now() - timedelta(days=days)

    exports_removed = 0
    for export in CalculationExport.objects.filter(created_at__lt=cutoff):
        export.delete()  # файл с диска убирает post_delete-сигнал
        exports_removed += 1

    sources_removed = 0
    old_requests = CalculationRequest.objects.filter(created_at__lt=cutoff).exclude(source_file='')
    for calc_request in old_requests:
        storage = calc_request.source_file.storage
        name = calc_request.source_file.name
        if not storage.exists(name):
            continue
        try:
            storage.delete(name)
            sources_removed += 1
        except Exception as e:
            logger.warning("Не удалось удалить исходный файл %s: %s", name, e)

    logger.info(
        "cleanup_old_files: удалено раскладок=%s, исходных файлов=%s (старше %s дн.)",
        exports_removed, sources_removed, days
    )
    return {"exports_removed": exports_removed, "sources_removed": sources_removed, "retention_days": days}
