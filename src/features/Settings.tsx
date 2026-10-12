import { useState } from 'react';
import { Download, Upload, RotateCcw, HardDrive, Globe2 } from 'lucide-react';
import { useWorkspace } from '../hooks/workspace';
import { downloadJson } from '../lib/storage';
import { parseBackup, timezoneSchema, errorMessage } from '../types/workspace';
import type { Workspace } from '../types/workspace';
import { Accounts } from './Accounts';
import { STORAGE_KEY } from '../lib/storage';
import { createSeed } from '../data/seed';
import { flatten } from '../lib/roadmap';
import { Confirm, Field, PageHeading } from '../components/ui';
export function Settings() {
  const { data, update, replace, canEdit } = useWorkspace();
  const [timezone, setTimezone] = useState(data.settings.timezone);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [imported, setImported] = useState<Workspace | null>(null);
  const [reset, setReset] = useState(false);
  return (
    <>
      <PageHeading
        eyebrow="05 / ВАШЕ ПРОСТРАНСТВО"
        title="Настройки и данные"
        description="Управление доступом и резервные копии общего пространства."
      />
      <Accounts />
      {canEdit && (
        <>
          <div className="settings-grid">
            <section className="panel settings-card">
              <Globe2 className="cyan" size={24} />
              <h2>Часовой пояс</h2>
              <p className="muted">
                Значение для новых встреч. Существующие встречи сохраняют свой часовой пояс.
              </p>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setMessage('');
                  setError('');
                  try {
                    const zone = timezoneSchema.parse(timezone.trim());
                    if (await update((w) => ({ ...w, settings: { timezone: zone } })))
                      setMessage('Часовой пояс сохранён.');
                  } catch (e) {
                    setError(errorMessage(e));
                  }
                }}
              >
                <Field label="Часовой пояс по умолчанию">
                  <input
                    list="timezones"
                    required
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                  />
                  <datalist id="timezones">
                    {[
                      'Asia/Tbilisi',
                      'Europe/Moscow',
                      'Europe/Berlin',
                      'America/New_York',
                      'UTC',
                    ].map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                </Field>
                <button className="btn primary">Сохранить настройки</button>
              </form>
            </section>
            <section className="panel settings-card">
              <HardDrive className="violet" size={24} />
              <h2>Общее пространство на сервере</h2>
              <p className="muted">
                Встречи, программа и профиль хранятся на сервере. Изменять их может только ментор.
                Менти сохраняет свой прогресс, если вы разрешили это в настройках доступа.
              </p>
              <p className="muted">
                Обновите страницу или нажмите «Обновить», чтобы получить последние изменения. JSON
                содержит общие материалы; учётные записи и личный прогресс входят в отдельную
                серверную резервную копию.
              </p>
              <div className="storage-stats">
                <span>
                  <b>{data.meetings.length}</b> встреч
                </span>
                <span>
                  <b>{flatten(data.roadmap).length}</b> тем и разделов
                </span>
                <span>
                  <b>{data.profile.projects.length}</b> проектов
                </span>
              </div>
            </section>
          </div>
          <section className="panel backup-panel">
            <div>
              <p className="eyebrow">РЕЗЕРВНАЯ КОПИЯ</p>
              <h2>Ваш прогресс — с собой.</h2>
              <p className="muted">
                JSON содержит заметки и ссылки встреч. Передавайте его только нужному человеку.
              </p>
            </div>
            <div className="row wrap">
              <button
                className="btn primary"
                onClick={() => {
                  downloadJson(data);
                  setMessage('JSON подготовлен к скачиванию.');
                  setError('');
                }}
              >
                <Download size={17} />
                Экспорт JSON
              </button>
              <label className="btn import-button">
                <Upload size={17} />
                Импорт JSON
                <input
                  aria-label="Импорт JSON"
                  type="file"
                  accept=".json,application/json"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    setMessage('');
                    setError('');
                    try {
                      if (file.size > 2_000_000)
                        throw new Error('Файл слишком большой: максимум 2 МБ');
                      setImported(parseBackup(await file.text()));
                    } catch (e) {
                      setError(`Импорт отклонён: ${errorMessage(e)}`);
                    }
                  }}
                />
              </label>
            </div>
          </section>
          <section className="panel settings-card">
            <h3>Перенос старой локальной копии</h3>
            <p className="muted">
              Если вы работали в прежней версии на этом устройстве, сначала скачайте её JSON. Затем
              импортируйте его в общее пространство. Старая копия не удаляется автоматически.
            </p>
            <button
              className="btn"
              onClick={() => {
                try {
                  const raw = localStorage.getItem(STORAGE_KEY);
                  if (!raw) throw new Error('В этом браузере нет старой копии');
                  downloadJson(parseBackup(raw));
                  setMessage('Старая копия скачана.');
                } catch (e) {
                  setError(errorMessage(e));
                }
              }}
            >
              Скачать старую локальную копию
            </button>
          </section>
          <section className="panel reset-panel">
            <div>
              <h3>Начать с демонстрационных данных</h3>
              <p className="muted small">
                Все ваши изменения будут заменены примерами. Сначала сохраните резервную копию.
              </p>
            </div>
            <button className="btn danger" onClick={() => setReset(true)}>
              <RotateCcw size={16} />
              Сбросить workspace
            </button>
          </section>
        </>
      )}
      {message && (
        <p role="status" className="notice success">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {canEdit && imported && (
        <Confirm
          title="Заменить workspace?"
          onClose={() => setImported(null)}
          onConfirm={async () => {
            if (await replace(imported)) {
              setTimezone(imported.settings.timezone);
              setImported(null);
              setMessage('Данные импортированы.');
            }
          }}
        >
          Будут загружены {imported.meetings.length} встреч, {flatten(imported.roadmap).length} тем
          и {imported.profile.projects.length} проектов. Текущие данные будут заменены целиком.
          Экспортируйте их заранее, если нужно сохранить.
        </Confirm>
      )}
      {canEdit && reset && (
        <Confirm
          title="Сбросить все данные?"
          onClose={() => setReset(false)}
          onConfirm={async () => {
            if (await replace(createSeed())) {
              setTimezone('Asia/Tbilisi');
              setReset(false);
              setMessage('Демонстрационные данные восстановлены.');
            }
          }}
        >
          Ваш профиль, встречи и прогресс будут заменены исходными примерами. Без резервной копии
          отменить это нельзя.
        </Confirm>
      )}
    </>
  );
}
