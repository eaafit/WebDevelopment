# Головатый Константин — Загрузка и управление файлами (PDF/изображения)

## Контекст
- **Разделы:** `/applicant/documents`, внедряется в карточки заявок и модуль оценки  
- **Роли:** Заявитель / Нотариус / Администратор (по правам)  
- **Связанные файлы:** `libs/web/shared/ui/src/lib/`

---

## Задача
Реализовать универсальный компонент загрузки и управления файлами: Drag&Drop, предпросмотр, переименование, теги, статусы, удаление. Компонент переиспользуется во всех кабинетах.

---

## Маршрут

| Маршрут | Компонент | Описание |
|---|---|---|
| `/applicant/documents` | `DocumentsPageComponent` | Страница документов заявителя |

---

## Генерация компонентов

```bash
# Shared-компоненты — переиспользуются везде
pnpm nx g @nx/angular:component libs/web/shared/ui/src/lib/file-upload/file-upload-zone/file-upload-zone --standalone
pnpm nx g @nx/angular:component libs/web/shared/ui/src/lib/file-upload/file-list/file-list --standalone
pnpm nx g @nx/angular:component libs/web/shared/ui/src/lib/file-upload/file-item/file-item --standalone
pnpm nx g @nx/angular:component libs/web/shared/ui/src/lib/file-upload/file-preview-modal/file-preview-modal --standalone
# Страница в кабинете заявителя
pnpm nx g @nx/angular:component libs/web/applicant/src/lib/features/documents/documents-page/documents-page --standalone
```

Экспортировать все shared-компоненты из `libs/web/shared/ui/src/index.ts`.

---

## API-контракты (`@notary-portal/api-contracts`)

| Метод | Запрос | Ответ | Где |
|---|---|---|---|
| `DocumentService.listDocuments` | `{ assessmentId? }` или без фильтра | `{ documents[] }` | Список файлов |
| `DocumentService.createDocument` | `{ assessmentId, fileName, documentType, fileSize }` | `{ document }` | «Загрузка» (создание записи) |
| `DocumentService.deleteDocument` | `{ id }` | `{ success }` | Удаление |
| `DocumentService.getDocument` | `{ id }` | `{ document }` | Предпросмотр / скачивание |

> **Важно:** реального файлового хранилища нет — `createDocument` создаёт только **метаданные** (имя, тип, размер). Содержимое файла не загружается. Для предпросмотра — использовать `URL.createObjectURL(file)` из локального файла сразу после выбора.

---

## Ключевые функции

### `FileUploadZoneComponent` (Drag&Drop зона)
- Визуальная зона: «Перетащите файлы или нажмите для выбора»
- `hostlistener dragover`, `dragleave`, `drop`
- `input[file]` hidden, клик на зону открывает диалог
- Допустимые форматы: PDF, JPG, JPEG, PNG
- Ограничение размера: max 20 МБ на файл
- При нарушении — показать ошибку под зоной
- `@Output() filesSelected: EventEmitter<File[]>`

### `FileListComponent` + `FileItemComponent`
- Список загруженных файлов
- Каждый `FileItemComponent`:
  - Иконка типа (PDF / изображение)
  - Имя файла (кликабельное — открывает предпросмотр)
  - Размер файла (форматировать: «1.2 МБ»)
  - **Тег/тип документа** — `DocumentType` select inline (редактируемый)
  - **Статус:** «Загружено» / «На проверке» / «Принято» — цветной бейдж (mock-статусы)
  - Кнопка **«Переименовать»** — inline edit поля имени
  - Кнопка **«Удалить»** → диалог подтверждения → `DocumentService.deleteDocument`
  - Индикатор загрузки при создании записи

### `FilePreviewModalComponent`
- Открывается по клику на имя файла
- Для изображений: `<img>` с `URL.createObjectURL`
- Для PDF: `<iframe src="...">` или ссылка «Открыть в новой вкладке»
- Кнопка «Скачать» (`a[download]`)
- Кнопка «Закрыть»

### `DocumentsPageComponent` (`/applicant/documents`)
- Интегрирует все компоненты выше
- Загружает список документов через `DocumentService.listDocuments`
- При выборе файлов → `DocumentService.createDocument` (создать метаданные) → добавить в список

---

## Технические требования
- `DocumentType` enum из `@notary-portal/api-contracts`
- Форматирование размера: `(bytes: number) => bytes < 1024*1024 ? (bytes/1024).toFixed(1)+' КБ' : (bytes/1024/1024).toFixed(1)+' МБ'`
- Drag&Drop: CSS-класс `--dragging` при dragover
- Обновить `applicant.routes.ts` — добавить `{ path: 'documents', component: DocumentsPageComponent }`

---

## Критерии готовности
- [ ] Drag&Drop работает (dragover-визуал, drop с файлами)
- [ ] Валидация формата и размера с сообщением об ошибке
- [ ] Список файлов загружается из API
- [ ] Создание записи документа при загрузке файла
- [ ] Предпросмотр изображений работает
- [ ] Удаление с подтверждением через API
- [ ] Переименование файла inline
- [ ] Responsive layout
