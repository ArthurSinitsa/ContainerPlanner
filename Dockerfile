FROM python:3.13-slim
LABEL authors="artur"

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

WORKDIR /app

RUN apt update && apt install -y --no-install-recommends \
    gcc g++ \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

COPY . /app/

# Собираем C++ модуль и устанавливаем в site-packages
RUN pip install --no-cache-dir ./bin_packer/
