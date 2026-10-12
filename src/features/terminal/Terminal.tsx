import { useEffect, useRef, useState } from 'react';
import { TerminalSquare, ShieldCheck, CornerDownLeft } from 'lucide-react';
import { PageHeading } from '../../components/ui';
import { commands, executeCommand, pipelineSteps } from './commands';
import type { Line } from './commands';
const initial: Line[] = [
  { text: 'MiT playground shell · v0.1', tone: 'accent' },
  { text: 'Это симулятор. Команды не выполняются в операционной системе.', tone: 'muted' },
  { text: 'Введите help — или просто начните с coffee.', tone: 'normal' },
];
export function Terminal() {
  const [output, setOutput] = useState<Line[]>(initial);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [cursor, setCursor] = useState(0);
  const [draft, setDraft] = useState('');
  const [running, setRunning] = useState(false);
  const log = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const append = (lines: Line[]) => setOutput((o) => [...o, ...lines].slice(-250));
  useEffect(() => {
    if (!running) field.current?.focus();
  }, [running]);
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [output]);
  useEffect(() => {
    if (!running) return;
    let step = 0;
    const timer = setInterval(() => {
      append([{ text: pipelineSteps[step], tone: 'success' }]);
      step++;
      if (step === pipelineSteps.length) {
        clearInterval(timer);
        setRunning(false);
        field.current?.focus();
      }
    }, 650);
    return () => clearInterval(timer);
  }, [running]);
  function run(value: string) {
    if (running || !value.trim()) return;
    const command = value.trim();
    const result = executeCommand(command);
    setHistory((h) => [...h, command].slice(-100));
    setCursor(Math.min(history.length + 1, 100));
    setDraft('');
    setInput('');
    if (result.clear) setOutput([]);
    else
      append([{ text: `[sim] mentee@playground:~ $ ${command}`, tone: 'muted' }, ...result.lines]);
    if (result.pipeline) {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches)
        append(pipelineSteps.map((text) => ({ text, tone: 'success' })));
      else setRunning(true);
    }
    field.current?.focus();
  }
  return (
    <>
      <PageHeading
        eyebrow="03 / МОЖНО ПРОБОВАТЬ"
        title="Терминал-песочница"
        description="Любопытство — единственное, что здесь нужно установить."
      />
      <div className="terminal-layout">
        <section className="terminal-window">
          <div className="terminal-title">
            <span className="window-dots">
              <i />
              <i />
              <i />
            </span>
            <span>mentee@playground: ~</span>
            <span className="simulation-badge">SIMULATION</span>
          </div>
          <div
            className="terminal-output"
            ref={log}
            role="log"
            aria-live="polite"
            aria-label="Вывод терминала"
          >
            {output.map((line, i) => (
              <div className={`terminal-line ${line.tone}`} key={i}>
                {line.text}
              </div>
            ))}
            {running && <span className="running-line">Симуляция выполняется…</span>}
          </div>
          <form
            className="terminal-input"
            onSubmit={(e) => {
              e.preventDefault();
              run(input);
            }}
          >
            <label htmlFor="terminal-command">
              <span>~</span> $
            </label>
            <input
              id="terminal-command"
              ref={field}
              aria-label="Команда терминала"
              maxLength={2000}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder={
                running ? 'Дождитесь завершения или остановите симуляцию' : 'Введите команду…'
              }
              disabled={running}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  if (cursor === history.length) setDraft(input);
                  const next = Math.max(0, cursor - 1);
                  setCursor(next);
                  setInput(history[next] ?? '');
                }
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  const next = Math.min(history.length, cursor + 1);
                  setCursor(next);
                  setInput(next === history.length ? draft : history[next]);
                }
                if (e.key === 'Tab' && input) {
                  const matches = commands.filter((c) => c.name.startsWith(input));
                  if (matches.length === 1) {
                    e.preventDefault();
                    setInput(matches[0].name);
                  }
                }
              }}
            />
            <button type="submit" aria-label="Выполнить команду" disabled={running}>
              <CornerDownLeft size={18} />
            </button>
          </form>
          <div className="terminal-footer">
            <span>↑ ↓ история · Tab дополнение · help подсказки</span>
            {running && (
              <button
                onClick={() => {
                  setRunning(false);
                  append([
                    {
                      text: 'Симуляция остановлена. Никаких изменений вне страницы.',
                      tone: 'warning',
                    },
                  ]);
                }}
              >
                Остановить
              </button>
            )}
          </div>
        </section>
        <aside className="terminal-aside">
          <div className="panel">
            <ShieldCheck size={25} className="cyan" />
            <h3>Безопасно для экспериментов</h3>
            <p>
              Это учебная имитация shell. Она не читает файлы компьютера, не подключается к серверу
              и не запускает процессы.
            </p>
          </div>
          <div className="panel">
            <TerminalSquare size={24} className="violet" />
            <h3>С чего начать?</h3>
            <p>Нажмите команду, чтобы попробовать.</p>
            <div className="command-chips">
              {['help', 'whoami', 'coffee', 'git status', 'deploy --dry-run'].map((command) => (
                <button key={command} disabled={running} onClick={() => run(command)}>
                  {command}
                  <span>↵</span>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
