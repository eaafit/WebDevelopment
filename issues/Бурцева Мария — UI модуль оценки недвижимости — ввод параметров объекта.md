# Бурцева Мария — Модуль оценки: форма ввода параметров объекта (создание)

## Контекст
- **Разделы:** `/applicant/assessment`  
- **Роли:** Заявитель  
- **Связан с:** Дятлова Анна (таблица/список запросов — RUD часть), Емельянов (загрузка фото), Салихов (запрос оценки)  
- **Связанные файлы:** `libs/web/applicant/src/lib/`

---

## Задача
Реализовать форму создания запроса на оценку (CR_D — Create, часть Read): ввод адреса с подсказками, параметры объекта, характеристики, валидации, автозаполнение.

---

## Маршрут

| Маршрут | Компонент | Описание |
|---|---|---|
| `/applicant/assessment` | `AssessmentWizardComponent` | Визард оценки — содержит все шаги |
| — шаг «Параметры» | `AssessmentParamsFormComponent` | Этот компонент (шаг 1 или 2) |

---

## Генерация компонентов

```bash
pnpm nx g @nx/angular:component libs/web/applicant/src/lib/features/assessment/wizard/assessment-wizard --standalone
pnpm nx g @nx/angular:component libs/web/applicant/src/lib/features/assessment/wizard/steps/params-form/params-form --standalone
```

---

## API-контракты (`@notary-portal/api-contracts`)

| Метод | Запрос | Ответ | Где |
|---|---|---|---|
| `AssessmentService.createAssessment` | `CreateAssessmentRequest { applicantId, propertyType, address, description, ... }` | `CreateAssessmentResponse { assessment }` | Сохранение нового запроса |
| `FormsService.saveAssessmentForm` | `{ assessmentId, formData }` | `SaveAssessmentFormResponse` | Сохранение расширенных параметров |

---

## Ключевые функции

### `AssessmentParamsFormComponent` — форма параметров объекта

**Блок «Адрес»:**
- Поле «Адрес объекта» — text с **подсказками автодополнения**
  - Реализовать через Nominatim API: `https://nominatim.openstreetmap.org/search?format=json&q={query}&limit=5`
  - Debounce 400 мс, min 3 символа для запроса
  - Выпадающий список с результатами
  - При выборе → заполнить поля ниже (если API вернул компоненты адреса)
- Поле «Кадастровый номер» — text (необязательно)

**Блок «Основные характеристики»:**
- **Тип объекта** — select (required):
  - «Квартира», «Жилой дом», «Земельный участок», «Гараж», «Коммерческое помещение», «Иное»
- **Площадь** — number (кв. м, required, > 0)
- **Кадастровая стоимость** — number (руб., необязательно)

**Блок «Дополнительные характеристики»** (разворачивается):
- **Этажность** (для квартир): «Этаж» — number, «Этажей в доме» — number
- **Год постройки** — number (1800–текущий год)
- **Состояние** — select: «Отличное», «Хорошее», «Удовлетворительное», «Плохое»
- **Материал стен** — select: «Кирпич», «Панель», «Монолит», «Дерево», «Иное»
- **Наличие ремонта** — checkbox

**Блок «Описание»:**
- Textarea (необязательно), placeholder «Дополнительная информация об объекте»

**Кнопки:**
- «Сохранить черновик» → `createAssessment` + `saveAssessmentForm`, без перехода
- «Далее →» → `createAssessment` + `saveAssessmentForm` + переход к шагу загрузки документов (Емельянов)

---

## `AssessmentWizardComponent` — родительский визард

Координирует все шаги:
```typescript
enum AssessmentStep { Params = 1, Upload = 2, Request = 3 }
```
- Прогресс-бар или шаг-индикатор
- Шаг 1: `AssessmentParamsFormComponent` (Бурцева)
- Шаг 2: `AssessmentUploadStepComponent` (Емельянов)
- Шаг 3: `AssessmentRequestFormComponent` (Салихов)

---

## Технические требования
- `ReactiveFormsModule` с `FormGroup`, `Validators.required`, `Validators.min`
- Autocomplete: `Subject<string>` + `switchMap(query => fetch(nominatim))` + `debounceTime(400)`
- `applicantId` из `inject(TokenStore).user()?.id`
- После создания `Assessment` — сохранить `assessmentId` в сервисе визарда для следующих шагов
- Создать `libs/web/applicant/src/lib/features/assessment/assessment-wizard.service.ts` — хранит `assessmentId` и currentStep

---

## Критерии готовности
- [ ] Форма с валидацией — нельзя «Далее» без обязательных полей
- [ ] Автодополнение адреса через Nominatim с debounce
- [ ] Дополнительные характеристики разворачиваются
- [ ] «Сохранить черновик» создаёт Assessment через API
- [ ] Переход к шагу загрузки с сохранённым `assessmentId`
- [ ] Responsive layout
