import multiprocessing

# Сетевые настройки
bind = "0.0.0.0:8000"

# Количество воркеров
workers = multiprocessing.cpu_count()

# Максимальное число ожидающих запросов
backlog = 2048

# Таймауты
timeout = 120
keepalive = 5

# Настройки логирования
loglevel = "info"
accesslog = "-"
errorlog = "-"

# Имя процесса
proc_name = "planner_gunicorn"