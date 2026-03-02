from celery import shared_task
from .models import CalculationRequest, ContainerType, PackingResult
from .services.preprocessor import RequestPreprocessor
from .services.calculator import PackingService

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
        if 'calc_request' in locals():
            calc_request.status = 'FAILED'
            calc_request.error_message = str(e)
            calc_request.save()
        return {"status": "error", "message": str(e)}
