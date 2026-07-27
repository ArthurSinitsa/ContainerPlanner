from django.apps import AppConfig


class LogisticsConfig(AppConfig):
    name = 'logistics'

    def ready(self):
        # Регистрируем обработчики сигналов (удаление файлов раскладок с диска)
        from . import signals  # noqa: F401
