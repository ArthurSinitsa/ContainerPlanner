# 📦 Container Planner

![Python](https://img.shields.io/badge/python-3.13-blue.svg)
![Django](https://img.shields.io/badge/django-5.1-green.svg)
![React](https://img.shields.io/badge/react-18-blue.svg)
![TypeScript](https://img.shields.io/badge/typescript-5-blue.svg)
![Celery](https://img.shields.io/badge/celery-async-yellowgreen)
![Docker](https://img.shields.io/badge/docker-compose-blue)
![License](https://img.shields.io/badge/license-Apache%202.0-blue)

**Container Planner** — это full-stack сервис для автоматического расчета и оптимизации 3D-упаковки товаров в грузовые контейнеры (20ft, 40ft, 40HQ). 

Проект решает классическую задачу упаковки (3D Bin Packing Problem), учитывает специфические бизнес-правила логистики (например, разделение батарейных и небатарейных грузов), использует асинхронную обработку для ресурсоемких математических вычислений и предоставляет удобный веб-интерфейс с 3D-визуализацией результатов.

---

## ✨ Ключевые возможности

- **Алгоритм 3D-упаковки:** Расчет оптимального расположения товаров в контейнерах с использованием жадного алгоритма (на базе `py3dbp`).
- **Асинхронные вычисления:** Тяжелые математические расчеты вынесены в фоновые задачи **Celery**, чтобы не блокировать API.
- **Интерактивный UI:** Просмотр слоев упаковки в 3D прямо в браузере (через `three.js`).
- **Синхронизация данных:** Импорт номенклатуры товаров напрямую из Google Sheets.
- **Мониторинг:** Встроенная интеграция с **Prometheus** и **Grafana** для отслеживания метрик приложения, базы данных и железа.
- **Бизнес-правила:** Умная группировка товаров. Товары с несовместимыми свойствами (например, содержащие батареи) автоматически распределяются по разным контейнерам.
- **Импорт данных:** Интеграция с **Google Sheets** и поддержка загрузки локальных `.xlsx`/`.csv` файлов для обновления базы товаров.
- **RESTful API:** Документированное API на базе Django REST Framework с автогенерацией Swagger/Redoc.

---

## 🛠 Стек технологий

**Бэкенд:**
* Python 3.13 / Django 5.1 / Django REST Framework
* Celery + Redis (Task Queue)
* PostgreSQL 15 (База данных)
* drf-spectacular (Генерация OpenAPI / Swagger)

**Фронтенд:**
* React + TypeScript + Vite
* TanStack Query (Управление серверным состоянием)
* React Router (SPA роутинг)
* React Three Fiber / Three.js (3D визуализация)

**Инфраструктура & Мониторинг:**
* Docker & Docker Compose
* Nginx (Раздача статики и reverse-proxy)
* Prometheus + Grafana

---

## 🚀 Быстрый старт (Docker Compose)

Самый простой способ запустить весь проект (БД, кэш, API, воркеры, фронтенд и мониторинг) — использовать Docker.

1. Склонируйте репозиторий:
   ```bash
   git clone [https://github.com/your-username/ContainerPlanner.git](https://github.com/your-username/ContainerPlanner.git)
   cd ContainerPlanner
   ```

2.  Запустите сборку и старт контейнеров:

    ```bash
    docker-compose up -d --build
    ```

3.  **Доступные сервисы:**

   * **Web UI (Frontend):** [http://localhost](https://www.google.com/search?q=http://localhost)
   * **API Swagger Docs:** [http://localhost/api/docs/](https://www.google.com/search?q=http://localhost/api/docs/)
   * **Grafana (Мониторинг):** [http://localhost:3000](https://www.google.com/search?q=http://localhost:3000) *(Логин/Пароль: admin / admin)*
   * **Prometheus:** [http://localhost:9090](https://www.google.com/search?q=http://localhost:9090)

*(Примечание: при первом запуске Docker Compose автоматически накатит миграции базы данных).*

---

## 💻 Локальная разработка (Без Docker)

Если вы хотите запустить проект локально для разработки:

### Бэкенд

1.  Создайте и активируйте виртуальное окружение: `python -m venv .venv`
2.  Установите зависимости: `pip install -r requirements.txt`
3.  Убедитесь, что локально запущены PostgreSQL и Redis, пропишите доступы в окружении (или в `settings.py`).
4.  Примените миграции: `python manage.py migrate`
5.  Запустите сервер: `python manage.py runserver`
6.  Запустите Celery воркер: `celery -A ContainerPlanner worker -l info`

### Фронтенд

1.  Перейдите в папку фронтенда: `cd frontend`
2.  Установите пакеты: `npm install`
3.  Создайте файл `.env` и укажите URL API: `VITE_API_BASE_URL=http://localhost:8000`
4.  Запустите dev-сервер: `npm run dev` (будет доступен на `http://localhost:5173`)

---

## 🛣 Roadmap (Планы по развитию)

**API & Логика:**

* [ ] Учет штабелируемости (stackability) товаров.
* [ ] Учет распределения веса (оси контейнера) для соблюдения транспортных нормативов.
* [ ] Покрытие бизнес-логики (`services/`) unit-тестами.

**UI/UX (Frontend):**

* [x] Drag-and-drop загрузка `.xlsx` файлов для заявок.
* [x] Каталог товаров с поиском и фильтрацией для удобного ручного ввода.
* [ ] Анимация процесса укладки в 3D (пошаговое появление коробок).
* [ ] Сохранение пользовательских настроек (пресетов) локально.

---

## 🤝 Вклад в проект (Contributing)

Буду рад любым Pull Requests\! Если вы нашли баг или у вас есть идея для новой фичи — смело открывайте Issue.

1.  Форкните проект.
2.  Создайте ветку для вашей фичи (`git checkout -b feature/AmazingFeature`).
3.  Закоммитьте изменения (`git commit -m 'Add some AmazingFeature'`).
4.  Запушьте ветку (`git push origin feature/AmazingFeature`).
5.  Откройте Pull Request.

---

## 📄 Лицензия

Проект распространяется под лицензией **Apache 2.0**. Вы можете свободно использовать, изменять и распространять этот код, в том числе в коммерческих целях. Подробности смотрите в файле [LICENSE](LICENSE).

---
*Создано с ❤️ для оптимизации логистики.*
