# Архитектура

```text
Browser React → same-origin /api → Node API → SQLite (private persistent volume)
             ↘ static assets from reverse proxy
```

- `src/features/`: встречи, программа, профиль, настройки/аккаунты, локальный терминал.
- `src/hooks/workspace.tsx`: сессия, загрузка, подтверждённые сервером изменения;
  асинхронный commit, отсутствие fallback на LocalStorage.
- `src/lib/api.ts`: JSON fetch, same-origin credentials, нормализованные ошибки.
- `src/types/`: общие схемы данных; роль не входит в редактируемый workspace.
- `server/api.ts`: маршрутизация, проверка сессии/роли на каждом запросе, Origin,
  лимиты запросов, валидация общих и персональных изменений.
- `server/store.ts`: SQLite таблицы, salted scrypt, маппинг публичных полей аккаунта.
- `server/index.ts`: запуск API и административные команды владельца через stdin.

`users` хранит единственного owner и созданных им mentee; `sessions` — хеш токена
и абсолютный срок действия; `workspace` — валидированный JSON и revision;
`progress` — отдельные значения по user_id/topic_id; `attempts` — ограничители входа.

Обновление workspace — один условный SQL UPDATE по revision. Две параллельные
правки одной версии не перезаписывают друг друга. Progress не принимает user_id
от клиента. Чтение общих материалов требует вход; личный прогресс возвращается
только владельцу соответствующей сессии.

Сервер использует параметризованные запросы, HttpOnly cookie и fail-closed доступ.
Отключение mentee удаляет его сессии. Отсутствие API показывает экран входа/ошибку;
код не создаёт локального администратора. Подробнее: [ACCESS_CONTROL](ACCESS_CONTROL.md).

## Деплой

Клиент и API собираются из одного reviewed commit. CI публичного приложения не
имеет deploy Secrets. Приватный workflow публикует только `dist/`; API отдельно
собирается из `Dockerfile.api` администратором инфраструктуры. Данные никогда не
лежат в каталоге статических релизов. В production один API-процесс, приватная
Docker-сеть, HTTPS reverse proxy; порт API не публикуется на хосте.
