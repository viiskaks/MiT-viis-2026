import { newId } from '../lib/id';
import { useState } from 'react';
import { Pencil, Plus, Trash2, FolderGit2, Sparkles } from 'lucide-react';
import { useWorkspace } from '../hooks/workspace';
import { profileSchema, projectSchema, errorMessage } from '../types/workspace';
import type { Project } from '../types/workspace';
import { Confirm, ExternalLink, Field, Modal, PageHeading } from '../components/ui';
export function MentorProfile() {
  const { data, update } = useWorkspace();
  const profile = data.profile;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(profile);
  const [project, setProject] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [error, setError] = useState('');
  return (
    <>
      <PageHeading
        eyebrow="04 / ПОЗНАКОМИМСЯ ПОБЛИЖЕ"
        title="Ментор и проекты"
        description="Опыт, любимые инструменты и вещи, которые хочется показать."
        action={
          <button
            className="btn"
            onClick={() => {
              setForm(profile);
              setError('');
              setEditing(true);
            }}
          >
            <Pencil size={16} />
            Редактировать профиль
          </button>
        }
      />
      <div className="profile-grid">
        <section className="panel profile-intro">
          <div className="avatar-mark">&gt;_</div>
          <span className="eyebrow">НЕСКОЛЬКО СЛОВ О СЕБЕ</span>
          <h2>{profile.headline}</h2>
          <p className="prose">{profile.introduction}</p>
          <div className="welcome-note">
            <Sparkles size={19} />
            <p>{profile.welcome}</p>
          </div>
        </section>
        <section className="panel profile-skills">
          <h3>Опыт и направления</h3>
          <ul className="check-list">
            {profile.experience.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
          <h3>Рабочий набор</h3>
          <div className="tags">
            {profile.stack.map((tag, i) => (
              <span key={i}>{tag}</span>
            ))}
          </div>
          {profile.links.length > 0 && (
            <>
              <h3>Полезные ссылки</h3>
              <div className="link-list">
                {profile.links.map((link) => (
                  <ExternalLink key={link.id} href={link.url}>
                    {link.title}
                  </ExternalLink>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
      <div className="section-heading">
        <div>
          <p className="eyebrow">СДЕЛАНО ИЗ ЛЮБОПЫТСТВА</p>
          <h2>Проекты для разговора</h2>
        </div>
        <button
          className="btn"
          onClick={() => {
            setError('');
            setProject({
              id: newId(),
              title: '',
              description: '',
              tags: [],
              repoUrl: '',
              demoUrl: '',
            });
          }}
        >
          <Plus size={16} />
          Добавить проект
        </button>
      </div>
      <div className="project-grid">
        {profile.projects.map((item) => (
          <article className="panel project-card" key={item.id}>
            <div className="row spread">
              <FolderGit2 className="cyan" size={25} />
              <div className="row">
                <button
                  className="icon-btn"
                  aria-label={`Редактировать проект ${item.title}`}
                  onClick={() => {
                    setError('');
                    setProject(item);
                  }}
                >
                  <Pencil size={15} />
                </button>
                <button
                  className="icon-btn"
                  aria-label={`Удалить проект ${item.title}`}
                  onClick={() => setDeleting(item)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
            <h3>{item.title}</h3>
            <p className="prose">{item.description}</p>
            <div className="tags">
              {item.tags.map((tag, i) => (
                <span key={i}>{tag}</span>
              ))}
            </div>
            <div className="row mt-6">
              {item.repoUrl && <ExternalLink href={item.repoUrl}>Репозиторий</ExternalLink>}
              {item.demoUrl && <ExternalLink href={item.demoUrl}>Демо</ExternalLink>}
            </div>
          </article>
        ))}
        {!profile.projects.length && (
          <p className="empty panel">Первый проект может быть совсем небольшим.</p>
        )}
      </div>
      {editing && (
        <Modal title="Редактировать профиль" onClose={() => setEditing(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              try {
                const valid = profileSchema.parse({
                  ...form,
                  experience: form.experience.map((s) => s.trim()).filter(Boolean),
                  stack: form.stack.map((s) => s.trim()).filter(Boolean),
                });
                if (update((w) => ({ ...w, profile: valid }))) setEditing(false);
              } catch (e) {
                setError(errorMessage(e));
              }
            }}
          >
            <Field label="Заголовок знакомства">
              <input
                required
                maxLength={160}
                value={form.headline}
                onChange={(e) => setForm({ ...form, headline: e.target.value })}
              />
            </Field>
            <Field label="О себе">
              <textarea
                rows={4}
                value={form.introduction}
                onChange={(e) => setForm({ ...form, introduction: e.target.value })}
              />
            </Field>
            <Field label="Приветствие менти">
              <textarea
                rows={3}
                value={form.welcome}
                onChange={(e) => setForm({ ...form, welcome: e.target.value })}
              />
            </Field>
            <Field label="Области опыта" hint="Каждая область — с новой строки.">
              <textarea
                value={form.experience.join('\n')}
                onChange={(e) => setForm({ ...form, experience: e.target.value.split('\n') })}
              />
            </Field>
            <Field label="Технологии" hint="Каждая технология — с новой строки.">
              <textarea
                value={form.stack.join('\n')}
                onChange={(e) => setForm({ ...form, stack: e.target.value.split('\n') })}
              />
            </Field>
            <h3 className="mb-4">Полезные ссылки</h3>
            {form.links.map((link, i) => (
              <div className="link-editor" key={link.id}>
                <Field label={`Название ссылки ${i + 1}`}>
                  <input
                    required
                    value={link.title}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        links: form.links.map((l) =>
                          l.id === link.id ? { ...l, title: e.target.value } : l,
                        ),
                      })
                    }
                  />
                </Field>
                <Field label={`URL ссылки ${i + 1}`}>
                  <input
                    type="url"
                    required
                    value={link.url}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        links: form.links.map((l) =>
                          l.id === link.id ? { ...l, url: e.target.value } : l,
                        ),
                      })
                    }
                  />
                </Field>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Убрать ссылку ${i + 1}`}
                  onClick={() =>
                    setForm({ ...form, links: form.links.filter((l) => l.id !== link.id) })
                  }
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn"
              onClick={() =>
                setForm({
                  ...form,
                  links: [...form.links, { id: newId(), title: '', url: '' }],
                })
              }
            >
              <Plus size={15} />
              Добавить ссылку
            </button>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <div className="actions">
              <button type="button" className="btn" onClick={() => setEditing(false)}>
                Отмена
              </button>
              <button className="btn primary">Сохранить профиль</button>
            </div>
          </form>
        </Modal>
      )}
      {project && (
        <Modal title="Редактировать проект" onClose={() => setProject(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              try {
                const valid = projectSchema.parse({
                  ...project,
                  tags: project.tags.map((t) => t.trim()).filter(Boolean),
                });
                if (
                  update((w) => ({
                    ...w,
                    profile: {
                      ...w.profile,
                      projects: w.profile.projects.some((p) => p.id === valid.id)
                        ? w.profile.projects.map((p) => (p.id === valid.id ? valid : p))
                        : [...w.profile.projects, valid],
                    },
                  }))
                )
                  setProject(null);
              } catch (e) {
                setError(errorMessage(e));
              }
            }}
          >
            <Field label="Название проекта">
              <input
                required
                value={project.title}
                onChange={(e) => setProject({ ...project, title: e.target.value })}
              />
            </Field>
            <Field label="Описание проекта">
              <textarea
                rows={4}
                value={project.description}
                onChange={(e) => setProject({ ...project, description: e.target.value })}
              />
            </Field>
            <Field label="Теги проекта" hint="Через запятую: Linux, Docker, TypeScript">
              <input
                value={project.tags.join(',')}
                onChange={(e) => setProject({ ...project, tags: e.target.value.split(',') })}
              />
            </Field>
            <Field label="URL репозитория">
              <input
                type="url"
                value={project.repoUrl}
                onChange={(e) => setProject({ ...project, repoUrl: e.target.value })}
              />
            </Field>
            <Field label="URL демо">
              <input
                type="url"
                value={project.demoUrl}
                onChange={(e) => setProject({ ...project, demoUrl: e.target.value })}
              />
            </Field>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <div className="actions">
              <button type="button" className="btn" onClick={() => setProject(null)}>
                Отмена
              </button>
              <button className="btn primary">Сохранить проект</button>
            </div>
          </form>
        </Modal>
      )}
      {deleting && (
        <Confirm
          title="Удалить проект?"
          onClose={() => setDeleting(null)}
          onConfirm={() => {
            if (
              update((w) => ({
                ...w,
                profile: {
                  ...w.profile,
                  projects: w.profile.projects.filter((p) => p.id !== deleting.id),
                },
              }))
            )
              setDeleting(null);
          }}
        >
          Карточка «{deleting.title}» будет удалена.
        </Confirm>
      )}
    </>
  );
}
