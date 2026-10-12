import { useState } from 'react';
import { LockKeyhole } from 'lucide-react';
import { Field } from '../components/ui';
export function Access({
  login,
  error,
  loading,
}: {
  login: (username: string, password: string) => Promise<void>;
  error: string;
  loading: boolean;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <main className="access-screen">
      <section className="panel access-card">
        <LockKeyhole className="cyan" size={32} />
        <p className="eyebrow">MiT-viis-2026 · PRIVATE WORKSPACE</p>
        <h1>Место для своих.</h1>
        <p className="muted">
          Войдите в пространство менторства. Доступ выдаёт ментор — открытой регистрации нет.
        </p>
        {loading ? (
          <p role="status">Проверяем сессию…</p>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await login(username, password);
              } finally {
                setBusy(false);
                setPassword('');
              }
            }}
          >
            <Field label="Логин">
              <input
                required
                autoComplete="username"
                value={username}
                maxLength={64}
                onChange={(e) => setUsername(e.target.value)}
              />
            </Field>
            <Field label="Пароль">
              <input
                required
                type="password"
                autoComplete="current-password"
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <button className="btn primary" disabled={busy}>
              {busy ? 'Входим…' : 'Войти'}
            </button>
          </form>
        )}
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <p className="muted small">Забыли пароль? Обратитесь к ментору.</p>
      </section>
    </main>
  );
}
