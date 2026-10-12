export type Tone = 'normal' | 'muted' | 'success' | 'warning' | 'accent';
export interface Line {
  text: string;
  tone: Tone;
}
export interface CommandResult {
  lines: Line[];
  clear?: boolean;
  pipeline?: boolean;
}
interface Command {
  name: string;
  description: string;
  match: (input: string) => boolean;
  run: (input: string) => CommandResult;
}
const line = (text: string, tone: Tone = 'normal'): CommandResult => ({ lines: [{ text, tone }] });
const exact = (name: string) => (input: string) => input === name;
export const pipelineSteps = [
  '[dry-run] Проверка fictional-workspace… OK',
  '[dry-run] Учебные тесты… 12 / 12 OK (пример)',
  '[dry-run] Сборка воображаемого приложения… OK',
  '[dry-run] План доставки на demo-vps… OK',
  '[dry-run] Проверка здоровья… OK',
  'Готово. Это была симуляция: ни один сервер не изменён.',
];
const fortunes = [
  'Сначала прочитай ошибку. Иногда она уже знает ответ.',
  'Работает на моей машине — начало истории, а не конец.',
  'Лучший деплой — тот, который можно откатить.',
  'Не знать команду нормально. Знать, где посмотреть help, полезнее.',
  'У резервной копии есть любимое свидание: тест восстановления.',
];
export const commands: Command[] = [
  {
    name: 'help',
    description: 'Список команд',
    match: exact('help'),
    run: () => ({
      lines: [
        { text: 'Учебный терминал · команды выполняются только в этой странице', tone: 'accent' },
        ...commands.map((c) => ({
          text: `${c.name.padEnd(26)} ${c.description}`,
          tone: 'normal' as Tone,
        })),
      ],
    }),
  },
  {
    name: 'whoami',
    description: 'Кто мы и зачем здесь',
    match: exact('whoami'),
    run: () =>
      line('curious-human · здесь можно спрашивать, ошибаться и пробовать снова.', 'success'),
  },
  {
    name: 'pwd',
    description: 'Учебный рабочий каталог',
    match: exact('pwd'),
    run: () => line('/home/mentee/playground  [вымышленный путь]', 'accent'),
  },
  {
    name: 'ls',
    description: 'Воображаемые файлы',
    match: exact('ls'),
    run: () => line('welcome.txt   roadmap.txt   ideas/   pet-project/', 'accent'),
  },
  {
    name: 'cat welcome.txt',
    description: 'Приветствие',
    match: exact('cat welcome.txt'),
    run: () =>
      line(
        'Добро пожаловать в MiT-viis-2026!\nСегодня знакомимся, обсуждаем ожидания и пробуем команды.\nЗдесь нет доступа к вашей машине — можно исследовать спокойно.',
      ),
  },
  {
    name: 'cat roadmap.txt',
    description: 'Короткий маршрут',
    match: exact('cat roadmap.txt'),
    run: () =>
      line(
        'Architecture → Linux → Git → VPS → Deployment → Observability → Pet Project\nРедактируемая программа находится в разделе «Программа».',
      ),
  },
  {
    name: 'echo <text>',
    description: 'Повторить текст',
    match: (s) => s === 'echo' || s.startsWith('echo '),
    run: (s) => line(s.slice(5)),
  },
  {
    name: 'date',
    description: 'Локальные дата и время браузера',
    match: exact('date'),
    run: () =>
      line(
        `${new Date().toLocaleString('ru-RU')} · ${Intl.DateTimeFormat().resolvedOptions().timeZone}\nВремя браузера; часовой пояс встреч настраивается отдельно.`,
      ),
  },
  {
    name: 'clear',
    description: 'Очистить экран',
    match: exact('clear'),
    run: () => ({ lines: [], clear: true }),
  },
  {
    name: 'coffee',
    description: 'Перерыв на кофе',
    match: exact('coffee'),
    run: () =>
      line(
        "  ( (\n   ) )\n  |~~|]\n  `--'\nКофе готов. Мысли можно компилировать заново. ☕",
        'success',
      ),
  },
  {
    name: 'fortune',
    description: 'Маленькая DevOps-мудрость',
    match: exact('fortune'),
    run: () => line(fortunes[Math.floor(Math.random() * fortunes.length)], 'accent'),
  },
  {
    name: 'git status',
    description: 'Пример состояния репозитория',
    match: exact('git status'),
    run: () =>
      line(
        '[Симуляция] On branch learning\nYour branch is up to date with curiosity/main.\nUntracked files: first-question.md\nНикакой реальный Git-репозиторий не читался.',
        'success',
      ),
  },
  {
    name: 'sudo make-me-a-sandwich',
    description: 'Очень важный запрос',
    match: exact('sudo make-me-a-sandwich'),
    run: () =>
      line(
        'Okay. 🥪\nПрава администратора не требуются. Хорошие манеры — приветствуются.',
        'success',
      ),
  },
  {
    name: 'deploy --dry-run',
    description: 'Учебный pipeline',
    match: exact('deploy --dry-run'),
    run: () => ({
      lines: [
        {
          text: 'Начинаем учебную симуляцию. Сеть и процессы ОС не используются.',
          tone: 'warning',
        },
      ],
      pipeline: true,
    }),
  },
  {
    name: 'ping curiosity',
    description: 'Проверить связь с любопытством',
    match: exact('ping curiosity'),
    run: () =>
      line(
        'reply from curiosity: question=1 fear=0\nСвязь есть. Сформулируйте вопрос для следующей встречи.',
        'success',
      ),
  },
];
export function executeCommand(input: string): CommandResult {
  const command = input.trim();
  return (
    commands.find((c) => c.match(command))?.run(command) ??
    line(`Команда «${command}» не найдена в симуляторе. Попробуйте help.`, 'warning')
  );
}
