# 📦 ContainerPlanner

![Python](https://img.shields.io/badge/python-3.13-blue.svg)
![Django](https://img.shields.io/badge/django-5.1-green.svg)
![Celery](https://img.shields.io/badge/celery-async-yellowgreen)
![Docker](https://img.shields.io/badge/docker-compose-blue)

**ContainerPlanner** — это логистический API-сервис для автоматического расчета и оптимизации 3D-упаковки товаров в грузовые контейнеры (20ft, 40ft, 40HQ).

Проект решает классическую задачу упаковки в контейнеры (3D Bin Packing Problem), учитывая специфические бизнес-правила (например, разделение батарейных и небатарейных грузов), и использует асинхронную обработку для ресурсоемких математических вычислений.

---

## 🚀 Ключевые возможности

- **3D-Упаковка:** Расчет оптимального расположения товаров в контейнерах с использованием жадного алгоритма (под капотом `py3dbp`).
- **Бизнес-правила:** Умная группировка товаров. Товары с несовместимыми свойствами (например, содержащие батареи) автоматически распределяются по разным контейнерам.
- **Асинхронные вычисления:** Тяжелые математические расчеты вынесены в фоновые задачи **Celery**, чтобы не блокировать API.
- **Импорт данных:** Интеграция с **Google Sheets** и поддержка загрузки локальных `.xlsx`/`.csv` файлов для обновления базы товаров.
- **Мониторинг:** Встроенная интеграция с **Prometheus** и **Grafana** для отслеживания метрик приложения, базы данных и железа.
- **RESTful API:** Документированное API на базе Django REST Framework с автогенерацией Swagger/Redoc.

## 🛠 Технологический стек

- **Backend:** Python 3.13, Django, Django REST Framework (DRF)
- **Background Jobs:** Celery, Redis (Broker & Result Backend)
- **Database:** PostgreSQL
- **DevOps / Инфраструктура:** Docker, Docker Compose, Gunicorn
- **Мониторинг:** Prometheus, Grafana, PostgreSQL Exporter
- **Упаковка:** `py3dbp` (3D Bin Packing)

## 🏗 Архитектура проекта

Проект следует принципам "Толстые модели, тонкие представления". Вся сложная бизнес-логика вынесена в отдельную директорию `services/`:

```text
logistics/
├── services/
│   ├── calculator.py   # Логика 3D-размещения и расчет утилизации объема/площади
│   ├── loader.py       # Парсинг данных из Google Sheets, CSV, Excel
│   └── preprocessor.py # Подготовка данных, генерация ключей группировки
├── tasks.py            # Celery-воркеры для фоновых расчетов
├── views.py            # API эндпоинты (DRF)
└── models.py           # Структура БД
```
## ⚙️ Быстрый старт (Запуск через Docker)

Проект полностью контейнеризирован. Для запуска вам потребуется только установленный **Docker** и **Docker Compose**.

1. **Клонируйте репозиторий:**
   ```bash
   git clone [https://github.com/ArthurSinitsa/ContainerPlanner.git](https://github.com/ArthurSinitsa/ContainerPlanner.git)
   cd ContainerPlanner
   ```

2. **Запустите проект:**
   ```bash
   docker compose up -d --build
   ```

3. **Проверьте работоспособность:**
    - API и Swagger UI: `http://localhost:8000/api/docs/`
    - Админ-панель Django: `http://localhost:8000/admin/`
    - Grafana (Мониторинг): `http://localhost:3000/` *(логин/пароль: admin/admin)*
    - Prometheus: `http://localhost:9090/`

*(Примечание: при первом запуске Docker Compose автоматически накатит миграции БД)*.

## 📡 Примеры использования API

Подробная документация по всем эндпоинтам доступна в Swagger (`/api/docs/`).

Основной флоу работы:
1. Загрузить список товаров (через `/api/products/sync-google/` или загрузку файла).
2. Создать заявку на расчет, передав ID контейнера и список `product_id` + `quantity`.
3. Получить `task_id` и опрашивать статус `/api/calculate/{id}/status/`.
4. После завершения расчета получить детальные 3D-координаты каждого предмета в контейнерах.

## 🛣 Roadmap (Планы по развитию)

- [ ] Визуализация результатов (3D-рендер контейнера на Frontend).
- [ ] Учет штабелируемости (stackability) товаров.
- [ ] Учет распределения веса (оси контейнера) для соблюдения транспортных нормативов.
- [ ] Покрытие бизнес-логики (`services/`) unit-тестами.

## 🤝 Вклад в проект (Contributing)

Буду рад любым Pull Requests! Если вы нашли баг или у вас есть идея для новой фичи — смело открывайте Issue.

1. Форкните проект
2. Создайте ветку для вашей фичи (`git checkout -b feature/AmazingFeature`)
3. Закоммитьте изменения (`git commit -m 'Add some AmazingFeature'`)
4. Запушьте ветку (`git push origin feature/AmazingFeature`)
5. Откройте Pull Request

---
*Создано с ❤️ для оптимизации логистики.*
