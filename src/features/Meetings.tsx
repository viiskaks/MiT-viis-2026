import { newId } from '../lib/id';
import { useState } from 'react';
import { CalendarDays, Clock3, Plus, Pencil, Trash2, Video } from 'lucide-react';
import { useWorkspace } from '../hooks/workspace';
import { meetingSchema, errorMessage, statusLabels } from '../types/workspace';
import type { Meeting } from '../types/workspace';
import { chronological, formatMeeting, isUpcoming } from '../lib/time';
import { Confirm, ExternalLink, Field, Modal, PageHeading } from '../components/ui';

function MeetingEditor({ meeting, onClose }: { meeting: Meeting; onClose: () => void }) {
  const { update } = useWorkspace();
  const [form, setForm] = useState(meeting);
  const [unscheduled, setUnscheduled] = useState(!meeting.date);
  const [error, setError] = useState('');
  const change = (key: keyof Meeting, value: string | number) =>
    setForm((f) => ({ ...f, [key]: value }));
  return (
    <Modal title={meeting.title ? 'Редактировать встречу' : 'Новая встреча'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            const valid = meetingSchema.parse({
              ...form,
              date: unscheduled ? '' : form.date,
              time: unscheduled ? '' : form.time,
            });
            if (
              update((w) => ({
                ...w,
                meetings: w.meetings.some((m) => m.id === valid.id)
                  ? w.meetings.map((m) => (m.id === valid.id ? valid : m))
                  : [...w.meetings, valid],
              }))
            )
              onClose();
          } catch (e) {
            setError(errorMessage(e));
          }
        }}
      >
        <Field label="Название встречи">
          <input
            required
            maxLength={160}
            value={form.title}
            onChange={(e) => change('title', e.target.value)}
          />
        </Field>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={unscheduled}
            onChange={(e) => setUnscheduled(e.target.checked)}
          />{' '}
          Дату согласуем позже
        </label>
        {!unscheduled && (
          <div className="form-grid">
            <Field label="Дата">
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => change('date', e.target.value)}
              />
            </Field>
            <Field label="Начало">
              <input
                type="time"
                required
                value={form.time}
                onChange={(e) => change('time', e.target.value)}
              />
            </Field>
          </div>
        )}
        <div className="form-grid">
          <Field label="Длительность, минут">
            <input
              type="number"
              min={15}
              max={480}
              required
              value={form.duration}
              onChange={(e) => change('duration', Number(e.target.value))}
            />
          </Field>
          <Field label="Статус встречи">
            <select value={form.status} onChange={(e) => change('status', e.target.value)}>
              <option value="planned">Запланирована</option>
              <option value="completed">Проведена</option>
              <option value="canceled">Отменена</option>
            </select>
          </Field>
        </div>
        <Field
          label="Часовой пояс"
          hint="Время этой встречи сохраняется в указанном часовом поясе IANA."
        >
          <input
            required
            value={form.timezone}
            onChange={(e) => change('timezone', e.target.value)}
          />
        </Field>
        <Field label="Повестка">
          <textarea
            rows={5}
            value={form.agenda}
            onChange={(e) => change('agenda', e.target.value)}
          />
        </Field>
        <Field label="Zoom URL" hint="Необязательно. Вставьте готовую ссылку на встречу.">
          <input
            type="url"
            placeholder="https://…"
            value={form.zoomUrl}
            onChange={(e) => change('zoomUrl', e.target.value)}
          />
        </Field>
        <Field label="Заметки">
          <textarea rows={3} value={form.notes} onChange={(e) => change('notes', e.target.value)} />
        </Field>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="actions">
          <button type="button" className="btn" onClick={onClose}>
            Отмена
          </button>
          <button className="btn primary">Сохранить встречу</button>
        </div>
      </form>
    </Modal>
  );
}
export function Meetings() {
  const { data, update } = useWorkspace();
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState<Meeting | null>(null);
  const [deleting, setDeleting] = useState<Meeting | null>(null);
  const meetings = [...data.meetings]
    .sort(chronological)
    .filter(
      (m) =>
        filter === 'all' ||
        (filter === 'upcoming' && isUpcoming(m)) ||
        (filter === 'draft' && !m.date) ||
        (filter === 'past' && !!m.date && !isUpcoming(m)),
    );
  return (
    <>
      <PageHeading
        eyebrow="01 / ВСТРЕЧАЕМСЯ И ОБСУЖДАЕМ"
        title="Встречи"
        description="Небольшие шаги. Регулярные разговоры. Место для вопросов."
        action={
          <button
            className="btn primary"
            onClick={() =>
              setEditing({
                id: newId(),
                title: '',
                date: '',
                time: '',
                duration: 60,
                timezone: data.settings.timezone,
                status: 'planned',
                agenda: '',
                zoomUrl: '',
                notes: '',
              })
            }
          >
            <Plus size={17} />
            Новая встреча
          </button>
        }
      />
      <div className="toolbar">
        <div className="segmented" aria-label="Фильтр встреч">
          {[
            ['all', 'Все встречи'],
            ['upcoming', 'Предстоящие'],
            ['past', 'История'],
            ['draft', 'Без даты'],
          ].map(([key, label]) => (
            <button key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>
              {label}
            </button>
          ))}
        </div>
        <span className="meta">По умолчанию: {data.settings.timezone}</span>
      </div>
      <div className="meeting-list">
        {meetings.length === 0 && (
          <div className="empty panel">Здесь пока нет встреч. Можно начать с одного разговора.</div>
        )}
        {meetings.map((meeting) => (
          <article className="meeting-card panel" key={meeting.id}>
            <div className="meeting-date">
              <CalendarDays size={22} />
              <strong>{meeting.date ? meeting.date.slice(8) : '—'}</strong>
              <span>{meeting.date ? meeting.date.slice(0, 7) : 'БЕЗ ДАТЫ'}</span>
            </div>
            <div className="meeting-main">
              <div className="row spread">
                <span className={`badge ${meeting.status}`}>
                  {meeting.status === 'planned' ? 'Запланирована' : statusLabels[meeting.status]}
                </span>
                <div className="row">
                  <button
                    className="icon-btn"
                    aria-label={`Редактировать ${meeting.title}`}
                    onClick={() => setEditing(meeting)}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    className="icon-btn"
                    aria-label={`Удалить ${meeting.title}`}
                    onClick={() => setDeleting(meeting)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <h2>{meeting.title}</h2>
              <div className="meeting-meta">
                <span>
                  <Clock3 size={14} />
                  {formatMeeting(meeting)} · {meeting.duration} мин
                </span>
                <span>{meeting.timezone}</span>
              </div>
              <ul className="agenda">
                {meeting.agenda
                  .split('\n')
                  .filter(Boolean)
                  .map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
              </ul>
              {meeting.notes && (
                <div className="session-notes">
                  <span className="eyebrow">ЗАМЕТКИ</span>
                  <p>{meeting.notes}</p>
                </div>
              )}
              <div className="meeting-bottom">
                {meeting.zoomUrl ? (
                  <ExternalLink href={meeting.zoomUrl}>
                    <Video size={15} />
                    Открыть Zoom
                  </ExternalLink>
                ) : (
                  <span className="muted small">Zoom-ссылка появится после настройки встречи</span>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
      {editing && (
        <MeetingEditor key={editing.id} meeting={editing} onClose={() => setEditing(null)} />
      )}
      {deleting && (
        <Confirm
          title="Удалить встречу?"
          onClose={() => setDeleting(null)}
          onConfirm={() => {
            if (update((w) => ({ ...w, meetings: w.meetings.filter((m) => m.id !== deleting.id) })))
              setDeleting(null);
          }}
        >
          «{deleting.title}» и её заметки будут удалены. Это действие нельзя отменить без резервной
          копии.
        </Confirm>
      )}
    </>
  );
}
