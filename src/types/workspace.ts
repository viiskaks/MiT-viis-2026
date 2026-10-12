import { z } from 'zod';
import { DateTime, IANAZone } from 'luxon';

export const topicStatuses = ['planned', 'in-progress', 'completed'] as const;
export const statusLabels = {
  planned: 'В планах',
  'in-progress': 'В процессе',
  completed: 'Завершено',
  canceled: 'Отменено',
};
export const safeUrl = z
  .string()
  .max(2048)
  .refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
    } catch {
      return false;
    }
  }, 'Используйте полный URL с https:// или http:// без логина и пароля');
export const timezoneSchema = z
  .string()
  .max(100)
  .refine((value) => IANAZone.isValidZone(value), 'Неизвестный часовой пояс IANA');
const title = z.string().trim().min(1, 'Введите название').max(160);
const text = z.string().max(12000);
const id = z.string().min(1).max(100);
export const meetingSchema = z
  .object({
    id,
    title,
    date: z.string(),
    time: z.string(),
    duration: z.number().int().min(15).max(480),
    timezone: timezoneSchema,
    agenda: text,
    zoomUrl: safeUrl,
    status: z.enum(['planned', 'completed', 'canceled']),
    notes: text,
  })
  .strict()
  .superRefine((meeting, ctx) => {
    if (!meeting.date && !meeting.time) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(meeting.date) || !/^\d{2}:\d{2}$/.test(meeting.time)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Укажите корректные дату и время вместе',
        path: ['date'],
      });
      return;
    }
    const local = `${meeting.date}T${meeting.time}`;
    const value = DateTime.fromISO(local, { zone: meeting.timezone });
    if (
      !value.isValid ||
      value.toFormat("yyyy-MM-dd'T'HH:mm") !== local ||
      value.getPossibleOffsets().length > 1
    ) {
      ctx.addIssue({
        code: 'custom',
        message:
          'Это время не существует или неоднозначно в выбранном часовом поясе. Выберите другое время.',
        path: ['time'],
      });
    }
  });
export type Meeting = z.infer<typeof meetingSchema>;
export interface Topic {
  id: string;
  title: string;
  description: string;
  status: (typeof topicStatuses)[number];
  children: Topic[];
}
export const topicSchema: z.ZodType<Topic> = z.lazy(() =>
  z
    .object({
      id,
      title,
      description: text,
      status: z.enum(topicStatuses),
      children: z.array(topicSchema).max(100),
    })
    .strict(),
);
export const projectSchema = z
  .object({
    id,
    title,
    description: text,
    tags: z.array(z.string().trim().min(1).max(60)).max(30),
    repoUrl: safeUrl,
    demoUrl: safeUrl,
  })
  .strict();
export const profileSchema = z
  .object({
    headline: title,
    introduction: text,
    welcome: text,
    experience: z.array(z.string().max(300)).max(30),
    stack: z.array(z.string().max(60)).max(30),
    links: z
      .array(z.object({ id, title, url: safeUrl.refine((v) => !!v, 'Укажите URL') }).strict())
      .max(30),
    projects: z.array(projectSchema).max(50),
  })
  .strict();
export type Profile = z.infer<typeof profileSchema>;
export type Project = z.infer<typeof projectSchema>;
export const workspaceSchema = z
  .object({
    version: z.literal(1),
    meetings: z.array(meetingSchema).max(300),
    roadmap: z.array(topicSchema).max(100),
    profile: profileSchema,
    settings: z.object({ timezone: timezoneSchema }).strict(),
  })
  .strict();
export type Workspace = z.infer<typeof workspaceSchema>;

// Bound nesting before the recursive schema runs, including adversarial imports.
export function parseWorkspace(input: unknown): Workspace {
  if (!input || typeof input !== 'object' || !('roadmap' in input) || !Array.isArray(input.roadmap))
    throw new Error('Некорректная структура workspace');
  const seen = new Set<string>();
  let count = 0;
  function walk(items: unknown[], depth: number) {
    if (items.length && depth > 10) throw new Error('Не больше 10 уровней вложенности');
    for (const item of items) {
      if (++count > 500) throw new Error('Не больше 500 тем');
      if (
        !item ||
        typeof item !== 'object' ||
        !('id' in item) ||
        typeof item.id !== 'string' ||
        !('children' in item) ||
        !Array.isArray(item.children)
      )
        throw new Error('Некорректная тема');
      if (seen.has(item.id)) throw new Error('Повторяющийся идентификатор темы');
      seen.add(item.id);
      walk(item.children, depth + 1);
    }
  }
  walk(input.roadmap, 1);
  const data = workspaceSchema.parse(input);
  for (const items of [data.meetings, data.profile.projects, data.profile.links]) {
    if (new Set(items.map((item) => item.id)).size !== items.length)
      throw new Error('Повторяющийся идентификатор');
  }
  return data;
}
export function parseBackup(raw: string) {
  if (raw.length > 2_000_000) throw new Error('Файл слишком большой: максимум 2 МБ');
  return parseWorkspace(JSON.parse(raw));
}
export function errorMessage(error: unknown) {
  return error instanceof z.ZodError
    ? (error.issues[0]?.message ?? 'Проверьте данные')
    : error instanceof Error
      ? error.message
      : 'Не удалось обработать данные';
}
