# Патлатюк Глеб (DarkDreamerd) — OAuth-регистрация: VK, Google, Apple, Yandex

## Контекст
- **Раздел:** `/auth` — публичная зона  
- **Роли:** Гость / Заявитель / Нотариус / Админ  
- **Связан с:** Игорь Васильев (форма входа) — компонент вставляется внутрь его страницы

---

## Задача
Добавить OAuth-кнопки на страницу входа и реализовать форму подтверждения контакта после OAuth-авторизации.

---

## Маршруты

| Маршрут | Компонент | Описание |
|---|---|---|
| `/auth` | `OAuthButtonsComponent` | Вставляется в существующую форму входа блоком кнопок |
| `/auth/confirm` | `ConfirmContactComponent` | Подтверждение email/телефона после OAuth |

---

## Генерация компонентов

```bash
pnpm nx g @nx/angular:component libs/web/guest/src/lib/features/auth/oauth-buttons/oauth-buttons --standalone
pnpm nx g @nx/angular:component libs/web/guest/src/lib/features/auth/confirm-contact/confirm-contact --standalone
```

---

## API-контракты
OAuth-методы в proto **не реализованы**. Компоненты работают на mock-заглушках.

| Метод (заглушка) | Описание |
|---|---|
| `mockOAuthLogin(provider: 'vk' \| 'google' \| 'apple' \| 'yandex')` | Имитация: 1.5 сек → переход на `/auth/confirm` |

---

## Ключевые функции

### `OAuthButtonsComponent`
- Блок из 4 кнопок: **ВКонтакте**, **Google**, **Apple**, **Яндекс**
- Каждая кнопка: иконка провайдера + название
- При клике → mock-загрузка → навигация на `/auth/confirm?provider=vk` (и т.д.)
- Разделитель «или» между формой email/пароля и блоком OAuth

### `ConfirmContactComponent` (`/auth/confirm`)
- Показывает: «Подтвердите контакт для [provider]»
- Поле ввода кода (6 цифр)
- Кнопка «Подтвердить» (mock: любой 6-значный код → success)
- Кнопка «Отправить повторно» с таймером обратного отсчёта **60 сек**
  - Реализовать через `signal` + `interval` из RxJS
  - Кнопка disabled пока таймер не истёк
- После успешного подтверждения → mock: `authService` вызывает `tokenStore.setTokens(...)` с заглушкой → редирект на `/applicant`

---

## Интеграция с формой входа
Добавить в `login.html` (файл Игоря Васильева):
```html
<div class="login__divider">или</div>
<lib-oauth-buttons />
```

---

## Обновить маршруты
Добавить в `libs/web/guest/src/lib/guest.routes.ts`:
```typescript
{ path: 'auth/confirm', component: ConfirmContactComponent },
```

---

## Технические требования
- Таймер: `signal<number>` + `setInterval` / `takeUntilDestroyed` из Angular
- `OAuthButtonsComponent` экспортировать из `libs/web/guest/src/index.ts`
- Mock-данные не хардкодить в шаблоне — вынести в константу/сервис
- TODO-комментарии в местах, где будет реальная OAuth-интеграция

---

## Критерии готовности
- [ ] 4 кнопки OAuth отображаются на странице входа
- [ ] Клик → mock-загрузка → переход на `/auth/confirm`
- [ ] Форма подтверждения принимает 6-значный код
- [ ] Таймер повторной отправки работает (60 сек)
- [ ] После подтверждения — редирект
- [ ] Responsive layout
