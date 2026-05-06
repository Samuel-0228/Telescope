import type { MediaType, TimeRange } from './types';

export const TIME_RANGE_TO_DAYS: Record<Exclude<TimeRange, 'all'>, number> = {
  '30': 30,
  '60': 60,
  '90': 90,
};

export const DEFAULT_HISTORY_DAYS = 180;

export const MEDIA_TYPES: MediaType[] = ['text', 'image', 'video', 'audio', 'document', 'unknown'];

export const CATEGORY_POOL = [
  'Technology',
  'Crypto',
  'Marketing',
  'News',
  'Education',
  'Finance',
  'Design',
  'Developer Tools',
  'Community',
  'Media',
] as const;

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export const roundTo = (value: number, digits = 2): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

export const formatDateKey = (date: Date): string => date.toISOString().slice(0, 10);

export const startOfDayUtc = (date: Date): Date => {
  const normalized = new Date(date);
  normalized.setUTCHours(0, 0, 0, 0);
  return normalized;
};

export const differenceInDaysUtc = (later: Date, earlier: Date): number => {
  const diff = startOfDayUtc(later).getTime() - startOfDayUtc(earlier).getTime();
  return Math.max(0, Math.floor(diff / 86_400_000));
};

export const hashSeed = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
};

export const seededRandom = (seed: number, salt = 0): number => {
  const value = Math.sin(seed + salt * 101.3) * 10_000;
  return value - Math.floor(value);
};

export const normalizeTelegramUsername = (value: string): string => {
  const input = value.trim();
  if (!input) {
    return '';
  }

  const cleaned = input
    .replace(/^https?:\/\/(?:t\.me|telegram\.me)\//i, '')
    .replace(/^@/, '')
    .replace(/\?.*$/, '')
    .replace(/\/.*$/, '')
    .trim();

  return cleaned.toLowerCase();
};

export const extractChannelLabel = (value: string): string => {
  const username = normalizeTelegramUsername(value);
  if (!username) {
    return 'unknown-channel';
  }

  return username.replace(/[-_]+/g, ' ');
};

export const toPercent = (value: number): number => roundTo(value * 100, 2);
