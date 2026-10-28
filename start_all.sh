#!/usr/bin/env bash

# Arrêter tous les processus en arrière-plan proprement lors de Ctrl+C
trap 'kill 0' EXIT SIGINT SIGTERM

echo "🚀 Démarrage de LIXAR..."

# 1. Vérifier si Docker est disponible pour MySQL & Redis
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    if ! docker ps | grep -q "deepguard-mysql"; then
        echo "⚠️ Conteneur deepguard-mysql non détecté. Lancement de docker compose..."
        docker compose up -d 2>/dev/null || true
    fi
else
    echo "ℹ️ Docker daemon non actif. LIXAR utilise automatiquement la persistance SQLite et l'exécution directe."
fi

# 2. Lancer Backend FastAPI
echo "🌐 Lancement du Backend FastAPI (http://127.0.0.1:8000)..."
(cd backend && ../.venv/bin/uvicorn main:app --reload --host 127.0.0.1 --port 8000) &

# 3. Lancer Celery Worker si Redis est disponible
if command -v redis-cli >/dev/null 2>&1 && redis-cli ping >/dev/null 2>&1; then
    echo "⚙️ Lancement du Worker Celery..."
    (cd backend && ../.venv/bin/celery -A celery_app worker --loglevel=info) &
else
    echo "ℹ️ Redis non détecté. LIXAR utilise l'exécution multi-thread directe dans FastAPI."
fi

# 4. Lancer Frontend React
echo "💻 Lancement du Frontend React (http://localhost:3000)..."
(cd frontend && npm start) &

wait
