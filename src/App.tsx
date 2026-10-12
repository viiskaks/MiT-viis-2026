import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  Map,
  TerminalSquare,
  UserRound,
  Settings2,
  ChevronRight,
  HardDrive,
  PanelLeftClose,
  PanelLeftOpen,
  ArrowUpRight,
} from 'lucide-react';
import { useWorkspace } from './hooks/workspace';
import { Dashboard } from './features/Dashboard';
import { Meetings } from './features/Meetings';
import { Roadmap } from './features/Roadmap';
import { Terminal } from './features/terminal/Terminal';
import { MentorProfile } from './features/Profile';
import { Settings } from './features/Settings';
const routes = [
  { id: 'home', name: 'Главная', sub: 'Mission Control', icon: LayoutDashboard },
  { id: 'meetings', name: 'Встречи', sub: 'Sessions', icon: CalendarDays },
  { id: 'roadmap', name: 'Программа', sub: 'Learning Roadmap', icon: Map },
  { id: 'terminal', name: 'Терминал', sub: 'Playground', icon: TerminalSquare },
  { id: 'about', name: 'О менторе', sub: 'People & Projects', icon: UserRound },
  { id: 'settings', name: 'Настройки', sub: 'Workspace', icon: Settings2 },
];
const routeFromHash = () => location.hash.replace(/^#\/?/, '') || 'home';
export function App() {
  const { data, error, saved } = useWorkspace();
  const [route, setRoute] = useState(routeFromHash);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const handler = () => {
      setRoute(routeFromHash());
      window.scrollTo(0, 0);
    };
    addEventListener('hashchange', handler);
    return () => removeEventListener('hashchange', handler);
  }, []);
  const active = routes.find((r) => r.id === route);
  const Current = (
    {
      home: Dashboard,
      meetings: Meetings,
      roadmap: Roadmap,
      terminal: Terminal,
      about: MentorProfile,
      settings: Settings,
    } as Record<string, typeof Dashboard>
  )[route];
  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.querySelector<HTMLElement>('#main')?.focus();
        }}
      >
        К содержимому
      </a>
      <aside className="sidebar">
        <a href="#/home" className="brand">
          <span className="brand-icon">
            m<span>_</span>
          </span>
          <div>
            <strong>
              MiT<span> / </span>viis
            </strong>
            <small>MENTORSHIP · 2026</small>
          </div>
        </a>
        <div className="workspace-label">
          ЛИЧНОЕ ПРОСТРАНСТВО<span>v0.1</span>
        </div>
        <nav aria-label="Основная навигация">
          {routes.map((item) => (
            <a
              key={item.id}
              href={`#/${item.id}`}
              aria-current={route === item.id ? 'page' : undefined}
              title={item.name}
            >
              <item.icon size={19} />
              <span>{item.name}</span>
              {route === item.id && <i />}
            </a>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="status-dot" />
          <p>
            Учимся разбираться,
            <br />а не знать всё сразу.
          </p>
          <span className="sidebar-code">$ start with curiosity</span>
        </div>
        <a className="local-storage" href="#/settings">
          <HardDrive size={16} />
          <div>
            <strong>Локальное пространство</strong>
            <small>{saved ? 'Данные в этом браузере' : 'Есть несохранённые изменения'}</small>
          </div>
        </a>
        <button
          className="collapse-button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
        >
          {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          <span>Свернуть меню</span>
        </button>
      </aside>
      <div className="app-body">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>MiT-viis-2026</span>
            <ChevronRight size={14} />
            <span>{active?.sub ?? 'Страница не найдена'}</span>
          </div>
          <div className="topbar-right">
            <span className="zone-label">{data.settings.timezone}</span>
            <span className="local-badge">
              <span className="status-dot" />
              Локальный режим
            </span>
          </div>
        </header>
        <main id="main" tabIndex={-1} className="main-content">
          {error && (
            <div role="alert" className="notice error storage-error">
              {error}
              <a href="#/settings">
                Настройки и резервная копия
                <ArrowUpRight size={15} />
              </a>
            </div>
          )}
          {Current ? (
            <Current key={route} />
          ) : (
            <div className="empty panel">
              <h1>Такой страницы пока нет</h1>
              <a href="#/home" className="btn mt-6">
                Вернуться на главную
              </a>
            </div>
          )}
        </main>
        <footer className="app-footer">
          <span>
            MiT-viis-2026 <span className="footer-dot">·</span> DevOps Mentorship Playground
          </span>
          <span>built for questions, not exams.</span>
        </footer>
      </div>
    </div>
  );
}
