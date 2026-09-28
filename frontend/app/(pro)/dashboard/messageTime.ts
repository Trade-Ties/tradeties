import { differenceInMinutes, format, isSameYear, isToday, isYesterday } from "date-fns";

/**
 * When a message came in, as a conversation list shows it: how long ago while it is still today,
 * "Yesterday" for yesterday, and the date from then on — "3 days ago" says less than the date
 * does, and stops being true the day after it is read.
 */
export function listTime(sentAt: Date, now = new Date()): string {
  if (isToday(sentAt)) {
    const minutes = Math.max(differenceInMinutes(now, sentAt), 0);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m`;
    return `${Math.floor(minutes / 60)}h`;
  }
  if (isYesterday(sentAt)) return "Yesterday";

  return format(sentAt, isSameYear(sentAt, now) ? "MMM d" : "MMM d, yyyy");
}

/**
 * When a message was sent, as the conversation itself shows it: always the time, and the day in
 * words people use for the last two days.
 */
export function messageTime(sentAt: Date, now = new Date()): string {
  const time = format(sentAt, "h:mm a");

  if (isToday(sentAt)) return `Today, ${time}`;
  if (isYesterday(sentAt)) return `Yesterday, ${time}`;

  return `${format(sentAt, isSameYear(sentAt, now) ? "EEE, MMM d" : "EEE, MMM d, yyyy")}, ${time}`;
}
