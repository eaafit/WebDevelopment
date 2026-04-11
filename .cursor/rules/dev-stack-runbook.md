## Dev‑стек и порядок запуска (pnpm + Docker + NX)

### Правило

- **Запускай локально в фиксированном порядке**:
  - `pnpm install`
  - `docker-compose up` (инфраструктура: PostgreSQL, MinIO; опционально Prometheus/Grafana)
  - `pnpm nx serve web` (frontend)
- **Не хардкодь секреты**: используй переменные окружения; `.env` не коммить.
- **S3/MinIO параметры** должны соответствовать `.env.example`; для API на хосте используй `S3_ENDPOINT=http://127.0.0.1:<port>`.

### Почему

- Так воспроизводимее окружение и меньше “у меня работает”.

### Источники в репозитории

- `docs/developer-setup.md`
- `docker-compose.yaml`
- `.env.example`
