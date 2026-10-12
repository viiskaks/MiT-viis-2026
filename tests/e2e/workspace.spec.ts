import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { createSeed } from '../../src/data/seed';
import { readFile } from 'node:fs/promises';
const key = 'mit-viis-2026.workspace.v1';
const go = async (page: Page, section: string) => {
  await page.getByRole('navigation').getByRole('link', { name: section, exact: true }).click();
};
test.beforeEach(async ({ page }) => {
  const login = await page.request.post('/api/login', {
    headers: { Origin: 'http://localhost:5174' },
    data: { username: 'test-owner', password: 'browser-test-password-12345' },
  });
  expect(login.ok()).toBeTruthy();
  const snapshot = await (await page.request.get('/api/workspace')).json();
  const reset = await page.request.put('/api/workspace', {
    headers: { Origin: 'http://localhost:5174' },
    data: { revision: snapshot.revision, data: createSeed() },
  });
  expect(reset.ok()).toBeTruthy();
  await page.goto('/');
  await expect(page.getByRole('navigation')).toBeVisible();
});
test('introductory dashboard, architecture and navigation', async ({ page }) => {
  await expect(
    page.getByRole('heading', { name: 'Большие системы. Маленькие шаги.' }),
  ).toBeVisible();
  await expect(page.getByText('Session 01 — Знакомство')).toBeVisible();
  await expect(page.getByText('Zoom ещё не настроен')).toBeVisible();
  await page.getByRole('button', { name: 'DNS', exact: true }).click();
  await expect(page.locator('.architecture-explanation')).toContainText(
    'Сам HTTP-запрос не проходит через DNS',
  );
  for (const [nav, title] of [
    ['Встречи', 'Встречи'],
    ['Программа', 'Программа обучения'],
    ['Терминал', 'Терминал-песочница'],
    ['О менторе', 'Ментор и проекты'],
    ['Настройки', 'Настройки и данные'],
  ]) {
    await go(page, nav);
    await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
  }
});
test('meeting create, edit, Zoom target, persistence, filters and confirmed deletion', async ({
  page,
}) => {
  await go(page, 'Встречи');
  await page.getByRole('button', { name: 'Новая встреча', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Название встречи').fill('Проверка встречи');
  await dialog.getByLabel('Дату согласуем позже').uncheck();
  await dialog.getByLabel('Дата', { exact: true }).fill('2030-02-10');
  await dialog.getByLabel('Начало', { exact: true }).fill('19:00');
  await dialog.getByLabel('Zoom URL').fill('https://example.com/zoom-demo');
  await dialog.getByLabel('Повестка').fill('Обсудить идею\nПопробовать команды');
  await dialog.getByRole('button', { name: 'Сохранить встречу' }).click();
  await expect(dialog).not.toBeVisible();
  const card = page
    .locator('article')
    .filter({ has: page.getByRole('heading', { name: 'Проверка встречи', exact: true }) });
  await expect(card).toContainText('Asia/Tbilisi');
  await expect(card.getByRole('link', { name: 'Открыть Zoom' })).toHaveAttribute(
    'target',
    '_blank',
  );
  await page.route('https://example.com/zoom-demo', (route) =>
    route.fulfill({ body: 'Demo meeting' }),
  );
  const popup = page.waitForEvent('popup');
  await card.getByRole('link', { name: 'Открыть Zoom' }).click();
  await (await popup).close();
  await page.getByRole('button', { name: 'Редактировать Проверка встречи', exact: true }).click();
  await dialog.getByLabel('Заметки').fill('Запомнить вопрос');
  await dialog.getByLabel('Статус встречи').selectOption('completed');
  await dialog.getByRole('button', { name: 'Сохранить встречу' }).click();
  await page.reload();
  await expect(card).toContainText('Запомнить вопрос');
  await page.getByRole('button', { name: 'История', exact: true }).click();
  await expect(card).toBeVisible();
  await page.getByRole('button', { name: 'Предстоящие', exact: true }).click();
  await expect(card).toHaveCount(0);
  await page.getByRole('button', { name: 'Все встречи' }).click();
  await page.getByRole('button', { name: 'Удалить Проверка встречи', exact: true }).click();
  await dialog.getByRole('button', { name: 'Отмена' }).click();
  await expect(card).toBeVisible();
  await page.getByRole('button', { name: 'Удалить Проверка встречи', exact: true }).click();
  await dialog.getByRole('button', { name: 'Подтвердить' }).click();
  await expect(card).toHaveCount(0);
  await page.reload();
  await expect(card).toHaveCount(0);
});
test('meeting validation and modal escape/focus', async ({ page }) => {
  await go(page, 'Встречи');
  const trigger = page.getByRole('button', {
    name: 'Редактировать Session 01 — Знакомство',
    exact: true,
  });
  await trigger.click();
  const d = page.getByRole('dialog');
  await d.getByLabel('Часовой пояс', { exact: true }).fill('Mars/Olympus');
  await d.getByRole('button', { name: 'Сохранить встречу' }).click();
  await expect(d.getByRole('alert')).toContainText('часовой пояс');
  await page.keyboard.press('Escape');
  await expect(d).not.toBeVisible();
  await expect(trigger).toBeFocused();
});
test('roadmap tree edits, nested additions, progress persistence and subtree deletion', async ({
  page,
}) => {
  await go(page, 'Программа');
  await page.getByRole('button', { name: 'Как работает Интернет', exact: true }).click();
  const progressSaved = page.waitForResponse(
    (r) => r.url().endsWith('/api/workspace') && r.request().method() === 'PUT',
  );
  await page.getByLabel('Статус темы').selectOption('completed');
  await progressSaved;
  await page.reload();
  await page.getByRole('button', { name: 'Как работает Интернет', exact: true }).click();
  await expect(page.getByLabel('Статус темы')).toHaveValue('completed');
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '3');
  await page.getByRole('button', { name: 'Добавить раздел' }).click();
  let d = page.getByRole('dialog');
  await d.getByLabel('Название темы').fill('Новый маршрут');
  await d.getByLabel('Описание темы').fill('Наши вопросы');
  await d.getByRole('button', { name: 'Сохранить тему' }).click();
  await page.getByRole('button', { name: 'Добавить подтему' }).click();
  await d.getByLabel('Название темы').fill('Первый вопрос');
  await d.getByRole('button', { name: 'Сохранить тему' }).click();
  await page.getByRole('button', { name: 'Редактировать тему', exact: true }).click();
  await d.getByLabel('Название темы').fill('Уточнённый вопрос');
  await d.getByRole('button', { name: 'Сохранить тему' }).click();
  await page.getByRole('button', { name: 'Свернуть Новый маршрут', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Уточнённый вопрос', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Развернуть Новый маршрут', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Уточнённый вопрос', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^08 Новый маршрут$/ }).click();
  await page.getByRole('button', { name: 'Удалить тему', exact: true }).click();
  await d.getByRole('button', { name: 'Подтвердить' }).click();
  await expect(page.getByRole('button', { name: 'Уточнённый вопрос', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('Новый маршрут')).toHaveCount(0);
});
test('mentor profile, links and projects can be edited and saved', async ({ page }) => {
  await go(page, 'О менторе');
  await page.getByRole('button', { name: 'Редактировать профиль' }).click();
  const d = page.getByRole('dialog');
  await d.getByLabel('Заголовок знакомства').fill('Добро пожаловать в нашу мастерскую');
  await d.getByLabel('О себе', { exact: true }).fill('Тестовый текст для знакомства');
  await d.getByLabel('Области опыта').fill('Linux\nОбучение');
  await d.getByRole('button', { name: 'Добавить ссылку' }).click();
  await d.getByLabel('Название ссылки 1').fill('Материалы');
  await d.getByLabel('URL ссылки 1').fill('https://example.com');
  await d.getByRole('button', { name: 'Сохранить профиль' }).click();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Добро пожаловать в нашу мастерскую' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Материалы' })).toHaveAttribute(
    'href',
    'https://example.com',
  );
  await page.getByRole('button', { name: 'Добавить проект' }).click();
  await d.getByLabel('Название проекта').fill('Demo lab');
  await d.getByLabel('Описание проекта').fill('Простой учебный проект');
  await d.getByLabel('Теги проекта').fill('Linux, Docker');
  await d.getByLabel('URL репозитория').fill('https://example.com/repo');
  await d.getByRole('button', { name: 'Сохранить проект' }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Demo lab' })).toBeVisible();
  await page.getByRole('button', { name: 'Редактировать проект Demo lab' }).click();
  await d.getByLabel('Название проекта').fill('Demo lab 2');
  await d.getByRole('button', { name: 'Сохранить проект' }).click();
  await page.getByRole('button', { name: 'Удалить проект Demo lab 2' }).click();
  await d.getByRole('button', { name: 'Подтвердить' }).click();
  await expect(page.getByRole('heading', { name: 'Demo lab 2' })).toHaveCount(0);
});
test('terminal commands, plain text, history, clear and simulated deployment', async ({ page }) => {
  await go(page, 'Терминал');
  const input = page.getByRole('textbox', { name: 'Команда терминала' });
  const log = page.getByRole('log');
  const run = async (s: string) => {
    await input.fill(s);
    await input.press('Enter');
  };
  await run('help');
  await expect(log).toContainText('sudo make-me-a-sandwich');
  await run('coffee');
  await expect(log).toContainText('Кофе готов');
  await input.fill('draft');
  await input.press('ArrowUp');
  await expect(input).toHaveValue('coffee');
  await input.press('ArrowDown');
  await expect(input).toHaveValue('draft');
  await run('echo <script>alert(1)</script>');
  await expect(log).toContainText('<script>alert(1)</script>');
  await run('ls && pwd');
  await expect(log).toContainText('не найдена');
  await run('clear');
  await expect(log).toBeEmpty();
  await run('deploy --dry-run');
  await expect(log).toContainText('ни один сервер не изменён', { timeout: 10000 });
  await expect(input).toBeEnabled();
  await run('deploy --dry-run');
  await page.getByRole('button', { name: 'Остановить', exact: true }).click();
  await expect(log).toContainText('Симуляция остановлена');
  await run('pwd');
  await expect(log).toContainText('вымышленный путь');
});
test('backup download, import validation, confirmation, restore and reset', async ({ page }) => {
  await go(page, 'Настройки');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Экспорт JSON' }).click();
  const file = await downloadPromise;
  const exported = JSON.parse(await readFile((await file.path())!, 'utf8'));
  expect(exported.version).toBe(1);
  exported.profile.headline = 'Импортированный профиль';
  const upload = page.getByLabel('Импорт JSON', { exact: true });
  const set = async (value: unknown) =>
    upload.setInputFiles({
      name: 'backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(value)),
    });
  await set(exported);
  let d = page.getByRole('dialog');
  await expect(d).toContainText('Текущие данные будут заменены');
  await d.getByRole('button', { name: 'Отмена' }).click();
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBeNull();
  await set(exported);
  await d.getByRole('button', { name: 'Подтвердить' }).click();
  await page.reload();
  await go(page, 'О менторе');
  await expect(page.getByRole('heading', { name: 'Импортированный профиль' })).toBeVisible();
  await go(page, 'Настройки');
  const stored = await page.evaluate((key) => localStorage.getItem(key), key);
  await set({ ...exported, version: 99 });
  await expect(page.getByRole('alert')).toContainText('Импорт отклонён');
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(stored);
  await page.getByRole('button', { name: 'Сбросить workspace' }).click();
  await d.getByRole('button', { name: 'Подтвердить' }).click();
  await go(page, 'О менторе');
  await expect(page.getByRole('heading', { name: 'Давайте познакомимся.' })).toBeVisible();
});
test('localStorage cannot override the shared workspace or grant access', async ({ page }) => {
  await page.evaluate((key) => localStorage.setItem(key, '{broken'), key);
  await page.reload();
  await expect(page.getByText('Session 01 — Знакомство')).toBeVisible();
  await page.getByRole('button', { name: 'Выйти', exact: true }).click();
  await page.evaluate(() => localStorage.setItem('role', 'owner'));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Место для своих.' })).toBeVisible();
  expect((await page.request.get('/api/workspace')).status()).toBe(401);
});
for (const width of [1366, 800, 390])
  test(`responsive ${width}px: all sections, no horizontal overflow or runtime errors`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.setViewportSize({ width, height: 900 });
    await page.reload();
    for (const section of [
      'Главная',
      'Встречи',
      'Программа',
      'Терминал',
      'О менторе',
      'Настройки',
    ]) {
      await go(page, section);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
      if (section === 'Главная')
        await page.screenshot({ path: `test-results/dashboard-${width}.png`, fullPage: true });
    }
    expect(errors).toEqual([]);
  });

test('phone editor, keyboard focus loop and LAN-compatible ID creation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() =>
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true }),
  );
  await go(page, 'Встречи');
  await page.getByRole('button', { name: 'Новая встреча', exact: true }).click();
  const d = page.getByRole('dialog');
  await d.getByLabel('Название встречи').fill('Мобильная встреча');
  const save = d.getByRole('button', { name: 'Сохранить встречу' });
  await save.focus();
  await page.keyboard.press('Tab');
  await expect(d.getByRole('button', { name: 'Закрыть окно' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(save).toBeFocused();
  await save.click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Мобильная встреча' })).toBeVisible();
  await page.getByRole('button', { name: 'Редактировать Мобильная встреча' }).click();
  await page.screenshot({ path: 'test-results/meeting-editor-phone.png' });
  expect(await d.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
});
test('reduced-motion pipeline and collapsed desktop navigation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Свернуть меню', exact: true }).click();
  await go(page, 'Терминал');
  await page.getByRole('button', { name: /^deploy --dry-run/ }).click();
  await expect(page.getByRole('log')).toContainText('ни один сервер не изменён');
  await expect(page.getByRole('button', { name: 'Остановить', exact: true })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Команда терминала' })).toBeEnabled();
  await page.screenshot({ path: 'test-results/terminal-desktop.png', fullPage: true });
});
test('API write failure keeps the previous server state and reports failure', async ({ page }) => {
  await go(page, 'Настройки');
  await page.route('**/api/workspace', async (route) => {
    if (route.request().method() === 'PUT')
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Сервер временно недоступен' }),
      });
    else await route.continue();
  });
  await page.getByLabel('Часовой пояс по умолчанию').fill('UTC');
  await page.getByRole('button', { name: 'Сохранить настройки' }).click();
  await expect(page.getByRole('alert')).toContainText('Сервер временно недоступен');
  const data = await (await page.request.get('/api/workspace')).json();
  expect(data.data.settings.timezone).toBe('Asia/Tbilisi');
});

test('owner creates a mentee, grants progress, and revokes access', async ({ page, browser }) => {
  await go(page, 'Настройки');
  await page.getByLabel('Логин менти', { exact: true }).fill('browser-mentee');
  await page.getByLabel('Имя для отображения').fill('Учебный аккаунт');
  await page.getByLabel('Начальный пароль', { exact: true }).fill('mentee-browser-password-12345');
  await page.getByRole('button', { name: 'Добавить менти', exact: true }).click();
  const account = page.locator('.account-row').filter({ hasText: 'browser-mentee' });
  await expect(account).toBeVisible();
  const context = await browser.newContext();
  const student = await context.newPage();
  await student.goto('http://localhost:5174');
  await student.getByLabel('Логин', { exact: true }).fill('browser-mentee');
  await student.getByLabel('Пароль', { exact: true }).fill('mentee-browser-password-12345');
  await student.getByRole('button', { name: 'Войти', exact: true }).click();
  await go(student, 'Встречи');
  await expect(student.getByRole('button', { name: 'Новая встреча' })).toHaveCount(0);
  await go(student, 'Программа');
  await expect(student.getByLabel('Статус темы')).toBeDisabled();
  await account.getByLabel('Разрешить личный прогресс').click();
  await expect(account.getByLabel('Разрешить личный прогресс')).toBeChecked();
  await expect(page.getByRole('status')).toContainText('Доступ обновлён');
  await student.reload();
  await expect(student.getByRole('heading', { name: 'Место для своих.' })).toBeVisible();
  await student.getByLabel('Логин', { exact: true }).fill('browser-mentee');
  await student.getByLabel('Пароль', { exact: true }).fill('mentee-browser-password-12345');
  await student.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(student.getByLabel('Статус темы')).toBeEnabled();
  const saved = student.waitForResponse((r) => r.url().endsWith('/api/progress'));
  await student.getByLabel('Статус темы').selectOption('completed');
  await saved;
  await student.reload();
  await expect(student.getByLabel('Статус темы')).toHaveValue('completed');
  await account.getByLabel('Доступ в пространство').click();
  await expect(account.getByLabel('Доступ в пространство')).not.toBeChecked();
  await student.reload();
  await expect(student.getByRole('heading', { name: 'Место для своих.' })).toBeVisible();
  await context.close();
});
