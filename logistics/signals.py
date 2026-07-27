import logging

from django.db.models.signals import post_delete
from django.dispatch import receiver

from .models import CalculationExport

logger = logging.getLogger(__name__)


@receiver(post_delete, sender=CalculationExport)
def delete_export_file(sender, instance: CalculationExport, **kwargs):
    """
    Django не удаляет файлы FileField при удалении объекта — делаем это сами.

    Срабатывает и при каскадном удалении заявки, поэтому осиротевших
    .xlsx в MEDIA_ROOT/exports/ не остаётся.
    """
    if not instance.file:
        return

    try:
        instance.file.storage.delete(instance.file.name)
    except Exception as e:
        logger.warning("Не удалось удалить файл раскладки %s: %s", instance.file.name, e)
