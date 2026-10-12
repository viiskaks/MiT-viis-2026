import { newId } from '../lib/id';
import { useState } from 'react';
import {
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Check,
  Circle,
  CircleDot,
  BookOpen,
} from 'lucide-react';
import { useWorkspace } from '../hooks/workspace';
import { flatten, progress, updateTopic, deleteTopic } from '../lib/roadmap';
import { statusLabels, topicStatuses } from '../types/workspace';
import type { Topic } from '../types/workspace';
import { Confirm, Field, Modal, PageHeading, Progress } from '../components/ui';
export function Roadmap() {
  const { data, update, canEdit, canInteract, setProgress } = useWorkspace();
  const [selectedId, setSelectedId] = useState(data.roadmap[0]?.id ?? '');
  const [open, setOpen] = useState<Set<string>>(new Set(data.roadmap.slice(0, 1).map((t) => t.id)));
  const [editor, setEditor] = useState<{
    topic: Topic;
    parent: string | null;
    existing: boolean;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const all = flatten(data.roadmap);
  const selected = all.find((t) => t.id === selectedId) ?? all[0];
  const stats = progress(data.roadmap);
  const add = (parent: string | null) =>
    setEditor({
      topic: {
        id: newId(),
        title: '',
        description: '',
        status: 'planned',
        children: [],
      },
      parent,
      existing: false,
    });
  const tree = (topics: Topic[], depth = 0) => (
    <ul className="topic-tree">
      {topics.map((topic, i) => (
        <li key={topic.id}>
          <div
            className={`topic-row ${selected?.id === topic.id ? 'active' : ''}`}
            style={{ paddingLeft: 12 + depth * 13 }}
          >
            {topic.children.length ? (
              <button
                className="tree-toggle"
                aria-label={`${open.has(topic.id) ? 'Свернуть' : 'Развернуть'} ${topic.title}`}
                aria-expanded={open.has(topic.id)}
                onClick={() =>
                  setOpen((prev) => {
                    const next = new Set(prev);
                    if (next.has(topic.id)) next.delete(topic.id);
                    else next.add(topic.id);
                    return next;
                  })
                }
              >
                <ChevronRight
                  size={15}
                  style={{ transform: open.has(topic.id) ? 'rotate(90deg)' : undefined }}
                />
              </button>
            ) : (
              <span className="tree-spacer" />
            )}
            <button
              className="topic-select"
              aria-current={selected?.id === topic.id ? 'true' : undefined}
              onClick={() => setSelectedId(topic.id)}
            >
              {depth === 0 && (
                <span className="topic-number">{String(i + 1).padStart(2, '0')}</span>
              )}
              <span>{topic.title}</span>
              {topic.status === 'completed' ? (
                <Check size={14} className="cyan" />
              ) : topic.status === 'in-progress' ? (
                <CircleDot size={13} className="violet" />
              ) : (
                <Circle size={12} className="muted" />
              )}
            </button>
          </div>
          {topic.children.length > 0 && open.has(topic.id) && tree(topic.children, depth + 1)}
        </li>
      ))}
    </ul>
  );
  return (
    <>
      <PageHeading
        eyebrow="02 / КАРТА ПУТЕШЕСТВИЯ"
        title="Программа обучения"
        description="Это ориентир, а не дедлайн. Маршрут можно менять вместе."
        action={
          canEdit && (
            <button className="btn primary" onClick={() => add(null)}>
              <Plus size={17} />
              Добавить раздел
            </button>
          )
        }
      />
      <div className="roadmap-progress panel">
        <div>
          <span className="eyebrow">ОБЩИЙ ПРОГРЕСС</span>
          <p>
            {stats.done} из {stats.total} тем завершено
          </p>
        </div>
        <Progress value={stats.percent} />
        <strong>{stats.percent}%</strong>
      </div>
      <div className="roadmap-layout">
        <section className="panel tree-panel" aria-label="Дерево программы">
          <div className="panel-label">
            <BookOpen size={16} />
            ВАШ МАРШРУТ<span>{data.roadmap.length} разделов</span>
          </div>
          {tree(data.roadmap)}
          {!all.length && <p className="empty">Добавьте первый раздел.</p>}
        </section>
        <section className="panel topic-detail" aria-label="Описание темы">
          {selected ? (
            <>
              <div className="row spread">
                <span className={`badge ${selected.status}`}>{statusLabels[selected.status]}</span>
                <div className="row" hidden={!canEdit}>
                  <button
                    className="icon-btn"
                    aria-label="Редактировать тему"
                    onClick={() => setEditor({ topic: selected, parent: null, existing: true })}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    className="icon-btn"
                    aria-label="Удалить тему"
                    onClick={() => setDeleting(true)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <span className="detail-icon">
                <BookOpen size={28} />
              </span>
              <h2>{selected.title}</h2>
              <p className="topic-description">
                {selected.description || 'Добавьте описание: что изучаем и зачем это пригодится.'}
              </p>
              <Field label="Статус темы">
                <select
                  value={selected.status}
                  disabled={!canInteract}
                  onChange={(e) => void setProgress(selected.id, e.target.value as Topic['status'])}
                >
                  {topicStatuses.map((status) => (
                    <option key={status} value={status}>
                      {statusLabels[status]}
                    </option>
                  ))}
                </select>
              </Field>
              <p className="muted small">
                Прогресс считается по конечным темам. Статус раздела не меняет статусы его подтем.
                Менти видит свой личный прогресс.
              </p>
              <button hidden={!canEdit} className="btn mt-6" onClick={() => add(selected.id)}>
                <Plus size={16} />
                Добавить подтему
              </button>
              <div className="note">
                <span>↳</span>Любой вопрос — хорошая точка входа. Отметьте тему, к которой хочется
                вернуться на встрече.
              </div>
            </>
          ) : (
            <p className="empty">Выберите тему или создайте новый раздел.</p>
          )}
        </section>
      </div>
      {canEdit && editor && (
        <Modal
          title={editor.existing ? 'Редактировать тему' : 'Новая тема'}
          onClose={() => setEditor(null)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const entry = { ...editor.topic, title: editor.topic.title.trim() };
              if (!entry.title) return;
              const success = await update((w) => ({
                ...w,
                roadmap: editor.existing
                  ? updateTopic(w.roadmap, entry.id, () => entry)
                  : editor.parent
                    ? updateTopic(w.roadmap, editor.parent, (t) => ({
                        ...t,
                        children: [...t.children, entry],
                      }))
                    : [...w.roadmap, entry],
              }));
              if (success) {
                setSelectedId(entry.id);
                if (editor.parent) setOpen((p) => new Set(p).add(editor.parent!));
                setEditor(null);
              }
            }}
          >
            <Field label="Название темы">
              <input
                required
                maxLength={160}
                value={editor.topic.title}
                onChange={(e) =>
                  setEditor({ ...editor, topic: { ...editor.topic, title: e.target.value } })
                }
              />
            </Field>
            <Field label="Описание темы">
              <textarea
                rows={7}
                maxLength={12000}
                value={editor.topic.description}
                onChange={(e) =>
                  setEditor({ ...editor, topic: { ...editor.topic, description: e.target.value } })
                }
              />
            </Field>
            <div className="actions">
              <button type="button" className="btn" onClick={() => setEditor(null)}>
                Отмена
              </button>
              <button className="btn primary">Сохранить тему</button>
            </div>
          </form>
        </Modal>
      )}
      {canEdit && deleting && selected && (
        <Confirm
          title="Удалить тему?"
          onClose={() => setDeleting(false)}
          onConfirm={async () => {
            if (await update((w) => ({ ...w, roadmap: deleteTopic(w.roadmap, selected.id) })))
              setDeleting(false);
          }}
        >
          «{selected.title}» и все её подтемы ({flatten(selected.children).length}) будут удалены.
        </Confirm>
      )}
    </>
  );
}
