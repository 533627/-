const CHINA_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function previousChinaDayRange(now: Date) {
  const chinaNow = new Date(now.getTime() + CHINA_OFFSET_MS);
  const currentChinaDay = Date.UTC(
    chinaNow.getUTCFullYear(),
    chinaNow.getUTCMonth(),
    chinaNow.getUTCDate(),
  );

  return {
    start: new Date(currentChinaDay - DAY_MS - CHINA_OFFSET_MS),
    end: new Date(currentChinaDay - CHINA_OFFSET_MS),
  };
}

export function nextReusableDueAt(originalDueAt: Date, now: Date) {
  const nextDay = new Date(originalDueAt.getTime() + DAY_MS);
  return nextDay > now ? nextDay : new Date(now.getTime() + DAY_MS);
}

export function formatChinaDateTimeLocal(date: Date) {
  const chinaDate = new Date(date.getTime() + CHINA_OFFSET_MS);
  const year = chinaDate.getUTCFullYear();
  const month = String(chinaDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(chinaDate.getUTCDate()).padStart(2, "0");
  const hour = String(chinaDate.getUTCHours()).padStart(2, "0");
  const minute = String(chinaDate.getUTCMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}
