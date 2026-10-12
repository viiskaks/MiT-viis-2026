import { useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  Map,
  TerminalSquare,
  UserRound,
  Globe2,
  Server,
  AppWindow,
  Database,
  Network,
  Sparkles,
  Video,
} from 'lucide-react';
import { useWorkspace } from '../hooks/workspace';
import { progress } from '../lib/roadmap';
import { chronological, formatMeeting, isUpcoming } from '../lib/time';
import { ExternalLink, Progress } from '../components/ui';
const architecture = [
  {
    title: 'Браузер',
    icon: Globe2,
    text: 'Здесь начинается запрос. Браузер показывает интерфейс и обращается к приложению по HTTP или HTTPS.',
  },
  {
    title: 'DNS',
    icon: Network,
    text: 'Перед соединением браузер узнаёт IP-адрес домена у DNS (или из кэша). Сам HTTP-запрос не проходит через DNS: после поиска адреса браузер соединяется с сервером.',
  },
  {
    title: 'VPS',
    icon: Server,
    text: 'Виртуальный сервер предоставляет вычислительные ресурсы. Здесь может работать reverse proxy и ваше приложение.',
  },
  {
    title: 'Приложение',
    icon: AppWindow,
    text: 'Код обрабатывает запрос: проверяет данные, применяет правила и при необходимости обращается к базе данных.',
  },
  {
    title: 'База данных',
    icon: Database,
    text: 'Хранит данные между запросами. Ответ возвращается через приложение в браузер; база обычно не открыта напрямую посетителям.',
  },
];
export function Dashboard() {
  const { data } = useWorkspace();
  const stats = progress(data.roadmap);
  const next =
    [...data.meetings].filter(isUpcoming).sort(chronological)[0] ??
    data.meetings.find((m) => m.status === 'planned' && !m.date);
  const [node, setNode] = useState(0);
  return (
    <>
      <div className="dashboard-greeting">
        <p className="eyebrow">
          <span className="status-dot" /> WORKSPACE / НАЧАЛО ПУТИ
        </p>
        <h1>
          Большие системы.
          <br />
          <span>Маленькие шаги.</span>
        </h1>
        <p>
          От первых архитектурных схем
          <br className="hero-break" /> до собственного приложения на VPS.
        </p>
        <div className="row wrap mt-6">
          <a className="btn primary" href="#/meetings">
            Готовимся к знакомству
            <ArrowRight size={16} />
          </a>
          <a className="text-link" href="#/about">
            О менторе и проектах
            <ArrowRight size={15} />
          </a>
        </div>
        <div className="hero-decoration" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="hero-core">
            <TerminalSquare size={50} />
            <span>hello, devops.</span>
          </div>
          <span className="orbit-tag tag-top">curiosity: true</span>
          <span className="orbit-tag tag-bottom">one step at a time_</span>
        </div>
      </div>
      <div className="dashboard-main">
        <section className="panel next-session">
          <div className="panel-label">
            <CalendarDays size={16} />
            СЛЕДУЮЩАЯ ВСТРЕЧА
            <span className="badge planned">
              {next?.date ? 'Запланирована' : 'Согласуем вместе'}
            </span>
          </div>
          <h2>{next?.title ?? 'Начнём с разговора'}</h2>
          <p className="muted">
            {next
              ? 'Без спешки. Познакомимся, обсудим ожидания и выберем направление.'
              : 'Добавьте встречу, когда будете готовы.'}
          </p>
          <div className="session-schedule">
            <span>
              <CalendarDays size={16} />
              {next ? formatMeeting(next) : 'Дата не выбрана'}
            </span>
            <span>
              <Clock3 size={16} />
              {next?.duration ?? 60} мин
            </span>
            <span className="meta">{next?.timezone ?? data.settings.timezone}</span>
          </div>
          <div className="session-agenda-preview">
            {(next?.agenda.split('\n').filter(Boolean) ?? ['Познакомиться и обсудить ожидания.'])
              .slice(0, 3)
              .map((line, i) => (
                <p key={i}>
                  <span>{String(i + 1).padStart(2, '0')}</span>
                  {line}
                </p>
              ))}
          </div>
          <div className="row spread wrap">
            <a className="text-link" href="#/meetings">
              Открыть план встречи
              <ArrowRight size={15} />
            </a>
            {next?.zoomUrl ? (
              <ExternalLink href={next.zoomUrl}>
                <Video size={14} />
                Zoom
              </ExternalLink>
            ) : (
              <span className="meta">Zoom ещё не настроен</span>
            )}
          </div>
        </section>
        <section className="panel progress-card">
          <div className="panel-label">
            <Map size={16} />
            ВАШ МАРШРУТ
          </div>
          <div className="progress-number">
            {stats.percent}
            <span>%</span>
            <span className="progress-spark">
              <Sparkles size={24} />
            </span>
          </div>
          <h3>{stats.done ? 'Уже есть первые шаги.' : 'Всё начинается с интереса.'}</h3>
          <p className="muted">
            {stats.done} из {stats.total} тем завершено.
            <br />
            Темп выбираем вместе.
          </p>
          <Progress value={stats.percent} />
          <div className="roadmap-dots">
            {data.roadmap.map((topic, i) => (
              <span
                key={topic.id}
                title={topic.title}
                className={progress([topic]).percent === 100 ? 'done' : ''}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
            ))}
          </div>
          <a className="text-link" href="#/roadmap">
            Посмотреть программу
            <ArrowRight size={15} />
          </a>
        </section>
      </div>
      <div className="quick-grid">
        {[
          {
            url: 'meetings',
            icon: CalendarDays,
            title: 'Встречи',
            text: 'Планы, разговоры и заметки',
            code: '01',
          },
          {
            url: 'roadmap',
            icon: Map,
            title: 'Программа',
            text: 'От основ к своему проекту',
            code: '02',
          },
          {
            url: 'terminal',
            icon: TerminalSquare,
            title: 'Терминал',
            text: 'Место, где можно пробовать',
            code: '03',
          },
          {
            url: 'about',
            icon: UserRound,
            title: 'О менторе',
            text: 'Опыт, инструменты и проекты',
            code: '04',
          },
        ].map((item) => (
          <a className="quick-card" href={`#/${item.url}`} key={item.url}>
            <div className="row spread">
              <item.icon size={21} />
              <span>{item.code}</span>
            </div>
            <h3>
              {item.title}
              <ArrowRight size={16} />
            </h3>
            <p>{item.text}</p>
          </a>
        ))}
      </div>
      <section className="panel architecture-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">ОДИН ЗАПРОС — НЕСКОЛЬКО ОСТАНОВОК</p>
            <h2>Как всё связано?</h2>
          </div>
          <span className="meta">Нажмите на любой элемент</span>
        </div>
        <div className="architecture-flow">
          {architecture.map((part, i) => (
            <div className="architecture-stop" key={part.title}>
              <button aria-pressed={node === i} onClick={() => setNode(i)}>
                <part.icon size={22} />
                <span>{part.title}</span>
              </button>
              {i < architecture.length - 1 && <ArrowRight size={16} />}
            </div>
          ))}
        </div>
        <div className="architecture-explanation" aria-live="polite">
          <span>{String(node + 1).padStart(2, '0')}</span>
          <p>{architecture[node].text}</p>
        </div>
        <p className="meta mt-4">
          Упрощённый порядок знакомства с компонентами. DNS — поиск адреса, а не прокси для трафика.
        </p>
      </section>
      <div className="closing-note">
        <span>~/mentorship</span>
        <p>Здесь нет глупых вопросов. Есть следующая хорошая попытка.</p>
        <span>▍</span>
      </div>
    </>
  );
}
