import { DateTime } from 'luxon';
import type { Meeting } from '../types/workspace';
export function meetingTime(meeting: Meeting) {
  return meeting.date
    ? DateTime.fromISO(`${meeting.date}T${meeting.time}`, { zone: meeting.timezone })
    : null;
}
export function chronological(a: Meeting, b: Meeting) {
  return (
    (meetingTime(a)?.toMillis() ?? Infinity) - (meetingTime(b)?.toMillis() ?? Infinity) ||
    a.title.localeCompare(b.title)
  );
}
export function isUpcoming(meeting: Meeting) {
  const time = meetingTime(meeting);
  return (
    meeting.status === 'planned' &&
    !!time &&
    time.plus({ minutes: meeting.duration }).toMillis() >= Date.now()
  );
}
export function formatMeeting(meeting: Meeting) {
  return (
    meetingTime(meeting)?.setLocale('ru').toFormat('d MMMM yyyy · HH:mm') ??
    'Дата ещё не согласована'
  );
}
