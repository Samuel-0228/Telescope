import { CATEGORY_POOL, DEFAULT_HISTORY_DAYS, DAY_NAMES, MEDIA_TYPES, hashSeed, seededRandom } from './utils';
import type { ChannelRecord, MediaType, PostRecord, TimeRange } from './types';

interface SyntheticProfile {
  id: string;
  name: string;
  username: string;
  category: string;
  baseAudience: number;
  dailyCadence: number;
  preferredHour: number;
  preferredDay: number;
  contentMix: Record<MediaType, number>;
}

const MEDIA_BASE_REACH: Record<MediaType, number> = {
  text: 0.82,
  image: 1.08,
  video: 1.16,
  audio: 0.7,
  document: 0.58,
  unknown: 0.72,
};

const MEDIA_CONTENT_TEMPLATES: Record<MediaType, string[]> = {
  text: ['Quick update from the team', 'What we learned this week', 'A short insight worth bookmarking', 'Behind the scenes on this release'],
  image: ['Visual breakdown of the latest trend', 'Screenshot recap with key takeaways', 'Infographic summary for the week', 'A before-and-after comparison worth sharing'],
  video: ['A fast walkthrough of the workflow', 'Demo clip with the main use case', 'Short form product update in motion', 'Explainer video covering the core idea'],
  audio: ['Voice memo with commentary', 'Podcast clip recap', 'Founders note for the community', 'Audio update with context'],
  document: ['Deep dive playbook', 'Checklist for the team', 'PDF guide for subscribers', 'Reference pack with resources'],
  unknown: ['General channel update', 'Community note', 'Roundup post', 'Fresh announcement'],
};

const buildProfile = (username: string): SyntheticProfile => {
  const seed = hashSeed(username || 'savvyscope');
  const name = username ? username.replace(/[-_]+/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase()) : 'SavvyScope Demo';
  const category = CATEGORY_POOL[seed % CATEGORY_POOL.length];
  const baseAudience = 8_000 + (seed % 140_000);
  const dailyCadence = 0.6 + seededRandom(seed, 1) * 4.2;
  const preferredHour = 7 + Math.floor(seededRandom(seed, 2) * 15);
  const preferredDay = Math.floor(seededRandom(seed, 3) * 7);
  const contentMix: Record<MediaType, number> = {
    text: 0.32 + seededRandom(seed, 4) * 0.2,
    image: 0.24 + seededRandom(seed, 5) * 0.25,
    video: 0.18 + seededRandom(seed, 6) * 0.2,
    audio: 0.04 + seededRandom(seed, 7) * 0.08,
    document: 0.04 + seededRandom(seed, 8) * 0.08,
    unknown: 0.06 + seededRandom(seed, 9) * 0.08,
  };

  const contentWeightTotal = Object.values(contentMix).reduce((sum, value) => sum + value, 0);
  (Object.keys(contentMix) as MediaType[]).forEach((key) => {
    contentMix[key] /= contentWeightTotal;
  });

  return {
    id: `channel_${seed}`,
    name,
    username,
    category,
    baseAudience,
    dailyCadence,
    preferredHour,
    preferredDay,
    contentMix,
  };
};

const pickFromMix = (mix: Record<MediaType, number>, seed: number, offset: number): MediaType => {
  const roll = seededRandom(seed, offset);
  let cumulative = 0;

  for (const type of MEDIA_TYPES) {
    cumulative += mix[type] ?? 0;
    if (roll <= cumulative) {
      return type;
    }
  }

  return 'text';
};

const buildContent = (mediaType: MediaType, seed: number, index: number, day: number): string => {
  const templates = MEDIA_CONTENT_TEMPLATES[mediaType];
  const template = templates[(seed + index + day) % templates.length];
  const suffix = mediaType === 'text' ? ' Keep it concise.' : mediaType === 'video' ? ' Watch the full clip.' : '';
  return `${template}.${suffix}`.replace(/\s+/g, ' ').trim();
};

const estimateViews = (profile: SyntheticProfile, mediaType: MediaType, dayIndex: number, hour: number, seed: number): number => {
  const timeFactor = hour >= 18 || hour <= 8 ? 1.12 : 0.94;
  const dayFactor = dayIndex % 7 === profile.preferredDay ? 1.14 : 0.98;
  const freshnessFactor = Math.max(0.58, 1.12 - dayIndex / 260);
  const mediaFactor = MEDIA_BASE_REACH[mediaType];
  const randomFactor = 0.82 + seededRandom(seed, dayIndex) * 0.5;
  return Math.max(120, Math.round(profile.baseAudience * timeFactor * dayFactor * freshnessFactor * mediaFactor * randomFactor * 0.12));
};

const generateEngagement = (views: number, mediaType: MediaType, hour: number, dayIndex: number, seed: number): { reactions: number; comments: number } => {
  const baseRate = mediaType === 'video' ? 0.125 : mediaType === 'image' ? 0.105 : mediaType === 'text' ? 0.088 : 0.066;
  const timeBonus = hour >= 18 ? 0.02 : hour >= 12 ? 0.01 : -0.006;
  const dayBonus = dayIndex % 7 === 5 || dayIndex % 7 === 6 ? 0.012 : 0;
  const randomBonus = seededRandom(seed, dayIndex + 500) * 0.03;
  const rate = baseRate + timeBonus + dayBonus + randomBonus;
  const totalInteractions = Math.max(1, Math.round(views * rate));
  const reactions = Math.max(1, Math.round(totalInteractions * (0.72 + seededRandom(seed, dayIndex + 900) * 0.12)));
  const comments = Math.max(0, totalInteractions - reactions);
  return { reactions, comments };
};

const buildPostTimestamp = (daysBack: number, hour: number, salt: number): Date => {
  const base = new Date();
  base.setUTCHours(hour, Math.floor(seededRandom(salt, hour) * 60), 0, 0);
  base.setUTCDate(base.getUTCDate() - daysBack);
  return base;
};

export const generateSyntheticChannel = (usernameInput: string): ChannelRecord => {
  const username = usernameInput || 'savvyscope-demo';
  const profile = buildProfile(username);

  return {
    id: profile.id,
    name: profile.name,
    username: profile.username,
    category: profile.category,
    createdAt: new Date(Date.UTC(2023, 0, 1)).toISOString(),
  };
};

export const generateSyntheticPosts = (usernameInput: string, timeRange: TimeRange): PostRecord[] => {
  const username = usernameInput || 'savvyscope-demo';
  const profile = buildProfile(username);
  const seed = hashSeed(username);
  const historyDays = timeRange === 'all' ? DEFAULT_HISTORY_DAYS : Number(timeRange);
  const targetPosts = Math.max(24, Math.round(historyDays * profile.dailyCadence));
  const posts: PostRecord[] = [];

  for (let index = 0; index < targetPosts; index += 1) {
    const spacing = Math.max(1, Math.round(1 / profile.dailyCadence));
    const daysBack = Math.min(historyDays - 1, Math.floor(index * spacing));
    const hour = (profile.preferredHour + Math.floor(seededRandom(seed, index + 11) * 7) - 3 + 24) % 24;
    const mediaType = pickFromMix(profile.contentMix, seed, index + 20);
    const timestamp = buildPostTimestamp(daysBack, hour, seed + index * 17);
    const views = estimateViews(profile, mediaType, daysBack, hour, seed + index * 13);
    const { reactions, comments } = generateEngagement(views, mediaType, hour, daysBack, seed + index * 19);
    const content = buildContent(mediaType, seed, index, daysBack);

    posts.push({
      id: `${profile.id}_post_${index + 1}`,
      channelId: profile.id,
      externalPostId: `${profile.username}_${index + 1}`,
      content,
      mediaType,
      views,
      reactions,
      comments,
      timestamp: timestamp.toISOString(),
      raw: {
        username: profile.username,
        dayName: DAY_NAMES[timestamp.getUTCDay()],
        source: 'synthetic',
      },
    });
  }

  return posts.sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());
};

export const generateLeaderboardSeeds = (): Array<{ username: string; category: string }> => {
  const channels = [
    'ai_insights_daily',
    'growth_hackers_hub',
    'product_launch_digest',
    'startup_bulletin',
    'crypto_briefing',
    'design_systems_today',
    'creator_ops',
    'devops_signal',
    'community_builders',
    'mobile_metrics',
    'founder_notes',
    'marketing_stack',
  ];

  return channels.map((username) => {
    const seed = hashSeed(username);
    return {
      username,
      category: CATEGORY_POOL[seed % CATEGORY_POOL.length],
    };
  });
};
