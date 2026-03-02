import os
from celery import Celery

# Устанавливаем дефолтные настройки Django для Celery
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ContainerPlanner.settings')

app = Celery('ContainerPlanner')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()
