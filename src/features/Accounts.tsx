import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Account } from '../types/access';
import { useWorkspace } from '../hooks/workspace';
import { Field } from '../components/ui';
import { errorMessage } from '../types/workspace';
export function Accounts() {
  const { canEdit } = useWorkspace();
  const [users, setUsers] = useState<Account[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [resetId, setResetId] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  async function load() {
    const result = await api<{ users: Account[] }>('/users');
    setUsers(result.users);
  }
  useEffect(() => {
    if (canEdit)
      void api<{ users: Account[] }>('/users')
        .then((r) => setUsers(r.users))
        .catch((e) => setError(errorMessage(e)));
  }, [canEdit]);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function change(user: Account, fields: Partial<Account> & { password?: string }) {
    await run(async () => {
      await api(`/users/${user.id}`, 'PATCH', {
        enabled: user.enabled,
        canInteract: user.canInteract,
        ...fields,
      });
      await load();
      setMessage('Доступ обновлён. Менти нужно войти снова.');
    });
  }
  return (
    <section className="panel settings-card access-management">
      <h2>Учётная запись и доступ</h2>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await run(async () => {
            await api('/password', 'POST', { current, password: next });

            window.location.reload();
          });
          setCurrent('');
          setNext('');
        }}
      >
        <h3>Сменить свой пароль</h3>
        <Field label="Текущий пароль">
          <input
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </Field>
        <Field label="Новый пароль">
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={14}
            maxLength={128}
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </Field>
        <button className="btn" disabled={busy}>
          Сменить пароль и выйти
        </button>
      </form>
      {canEdit && (
        <>
          <h3>Менти</h3>
          <p className="muted">
            Только вы создаёте учётные записи. Передайте логин и начальный пароль лично. Менти
            сможет сменить пароль после входа.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await run(async () => {
                await api('/users', 'POST', { username, name, password });
                setUsername('');
                setName('');
                setPassword('');
                await load();
                setMessage('Менти добавлен. Сохранение прогресса пока выключено.');
              });
            }}
          >
            <Field label="Логин менти">
              <input
                required
                pattern="[a-z0-9][a-z0-9_.\-]{2,63}"
                maxLength={64}
                autoComplete="off"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </Field>
            <Field label="Имя для отображения">
              <input
                required
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field
              label="Начальный пароль"
              hint="14–128 символов. Используйте уникальный пароль из менеджера паролей."
            >
              <input
                required
                type="password"
                autoComplete="new-password"
                minLength={14}
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <button className="btn primary" disabled={busy}>
              Добавить менти
            </button>
          </form>
          <div className="account-list">
            {users
              .filter((u) => u.role === 'mentee')
              .map((u) => (
                <article key={u.id} className="account-row">
                  <h3>
                    {u.name} <small className="muted">{u.username}</small>
                  </h3>
                  <label>
                    <input
                      type="checkbox"
                      disabled={busy}
                      checked={u.enabled}
                      onChange={(e) => void change(u, { enabled: e.target.checked })}
                    />{' '}
                    Доступ в пространство
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      disabled={busy}
                      checked={u.canInteract}
                      onChange={(e) => void change(u, { canInteract: e.target.checked })}
                    />{' '}
                    Разрешить личный прогресс
                  </label>
                  <button
                    className="btn"
                    onClick={() => {
                      setResetId(u.id);
                      setResetPassword('');
                    }}
                  >
                    Задать новый пароль
                  </button>
                  {resetId === u.id && (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        await change(u, { password: resetPassword });
                        setResetId('');
                        setResetPassword('');
                      }}
                    >
                      <Field label={`Новый пароль для ${u.name}`}>
                        <input
                          required
                          type="password"
                          autoComplete="new-password"
                          minLength={14}
                          maxLength={128}
                          value={resetPassword}
                          onChange={(e) => setResetPassword(e.target.value)}
                        />
                      </Field>
                      <button className="btn" disabled={busy}>
                        Сохранить новый пароль
                      </button>
                    </form>
                  )}
                </article>
              ))}
          </div>
        </>
      )}
      {message && (
        <p className="notice success" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
