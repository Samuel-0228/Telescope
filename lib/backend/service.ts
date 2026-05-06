import { analyzePatterns, calculateChannelMetrics, calculateGrowthScore } from './metrics';
import { checkRateLimit } from './rate-limit';
import { getRepository } from './repository';
import { getTelegramCollector } from './collector';
import { generateLeaderboardSeeds } from './mock-data';
import type { AnalyzedChannelResponse, ChannelMetrics, ComparisonRow, LeaderboardEntry, PostIdea, TimeRange, WeeklyPlanItem } from './types';
import { extractChannelLabel, normalizeTelegramUsername } from './utils';
import { generatePostIdeas, generateWeeklyPlan } from './ai';

export interface AnalyzeChannelInput {
  channelReference: string;
  timeRange: TimeRange;
}

export interface CompareChannelsInput {
  channelReferences: string[];
  timeRange: TimeRange;
}

export interface GeneratedAnalysis extends AnalyzedChannelResponse {
  viewsOverTime: Array<{ date: string; views: number }>;
  topPosts: ChannelMetrics['topPosts'];
}

const repository = getRepository();
const collector = getTelegramCollector();

const resolveChannelCacheKey = async (channelReference: string): Promise<string | null> => {
  const username = normalizeTelegramUsername(channelReference);
  if (!username) {
    // If it's not a username, we can't use a UUID cache key yet.
    return null;
  }

  const existingChannel = await repository.findChannelByUsername(username);
  // Only return a cache key when we have a persisted channel id (UUID).
  return existingChannel?.id || null;
};

const readCacheIfFresh = async (channelId: string | null, timeRange: TimeRange): Promise<AnalyzedChannelResponse | null> => {
  if (!channelId) return null;

  const cached = await repository.readMetricsCache(channelId, timeRange);
  if (!cached) {
    return null;
  }

  return cached.payload as AnalyzedChannelResponse;
};

export const analyzeChannel = async (input: AnalyzeChannelInput): Promise<GeneratedAnalysis> => {
  const cacheKey = await resolveChannelCacheKey(input.channelReference);
  const cached = await readCacheIfFresh(cacheKey, input.timeRange);
  if (cached) {
    return {
      ...cached,
      viewsOverTime: cached.metrics.viewsTrend,
      topPosts: cached.metrics.topPosts,
    };
  }

  const collection = await collector.collectChannel(input.channelReference, input.timeRange);
  const channel = await repository.upsertChannel(collection.channel);
  await repository.upsertPosts(channel.id, collection.posts);

  const metrics = calculateChannelMetrics(collection.posts, input.timeRange);
  const patterns = analyzePatterns(collection.posts, metrics);
  const growthScore = calculateGrowthScore(metrics, patterns);

  const response: AnalyzedChannelResponse = {
    channel,
    metrics,
    patterns,
    growthScore,
    strategies: patterns.insights,
  };

  await repository.writeMetricsCache(channel.id, input.timeRange, response);

  const scraperFallback = collection.posts.some((p) => (p.raw as any)?.fallback === true);

  return {
    ...response,
    viewsOverTime: metrics.viewsTrend,
    topPosts: metrics.topPosts,
    // optional flag to indicate scraper used fallback to all-time
    ...(scraperFallback ? { scraperFallback: true } : {}),
  } as GeneratedAnalysis & { scraperFallback?: boolean };
};

export const compareChannels = async (input: CompareChannelsInput): Promise<{ comparisons: ComparisonRow[]; topPerformers: Record<string, string> }> => {
  const references = input.channelReferences.slice(0, 3);
  const analyses = await Promise.all(references.map((reference) => analyzeChannel({ channelReference: reference, timeRange: input.timeRange })));

  const comparisons: ComparisonRow[] = analyses.map((analysis) => ({
    channelId: analysis.channel.id,
    channelName: analysis.channel.name,
    username: analysis.channel.username,
    category: analysis.channel.category,
    totalViews: analysis.metrics.totalViews,
    engagementRate: analysis.metrics.engagementRate,
    postingFrequency: analysis.metrics.postingFrequency,
    contentDistribution: analysis.metrics.contentTypePerformance,
    topContentType: analysis.metrics.topContentType,
    bestPostingDay: analysis.metrics.bestPostingDay,
    bestPostingHour: analysis.metrics.bestPostingHour,
  }));

  const topPerformers = {
    total_views: comparisons.slice().sort((left, right) => right.totalViews - left.totalViews)[0]?.channelName || 'N/A',
    engagement_rate: comparisons.slice().sort((left, right) => right.engagementRate - left.engagementRate)[0]?.channelName || 'N/A',
    posting_frequency: comparisons.slice().sort((left, right) => right.postingFrequency - left.postingFrequency)[0]?.channelName || 'N/A',
  };

  return { comparisons, topPerformers };
};

const buildLeaderboardFromAnalyses = (analyses: AnalyzedChannelResponse[]): LeaderboardEntry[] => {
  return analyses
    .map((analysis) => ({
      id: analysis.channel.id,
      rank: 0,
      name: analysis.channel.name,
      username: analysis.channel.username,
      category: analysis.channel.category,
      engagement_rate: analysis.metrics.engagementRate,
      total_views_30d: analysis.metrics.totalViews,
    }))
    .sort((left, right) => right.engagement_rate - left.engagement_rate)
    .slice(0, 10)
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
};

export const refreshLeaderboard = async (): Promise<LeaderboardEntry[]> => {
  const topN = 10;

  const refreshedFromPosts = await repository.refreshLeaderboardFromPosts(topN);
  if (refreshedFromPosts) {
    const fromPosts = await repository.readLeaderboard();
    if (fromPosts?.length) {
      return fromPosts;
    }
  }

  const trackedChannels = await repository.listTrackedChannels(topN);
  if (trackedChannels.length) {
    const analyses = await Promise.all(
      trackedChannels.map((channel) => analyzeChannel({ channelReference: channel.username, timeRange: '30' })),
    );

    const leaderboard = buildLeaderboardFromAnalyses(analyses);
    await repository.writeLeaderboard(leaderboard);
    return leaderboard;
  }

  const seedChannels = generateLeaderboardSeeds();
  const analyses = await Promise.all(
    seedChannels.map((seed) => analyzeChannel({ channelReference: seed.username, timeRange: '30' })),
  );

  const leaderboard = buildLeaderboardFromAnalyses(analyses);
  await repository.writeLeaderboard(leaderboard);
  return leaderboard;
};

export const getLeaderboard = async (): Promise<LeaderboardEntry[]> => refreshLeaderboard();

export const generateIdeas = async (channelReference: string): Promise<{ channel: string; ideas: PostIdea[] }> => {
  const analysis = await analyzeChannel({ channelReference, timeRange: '30' });
  const ideas = await generatePostIdeas(analysis.metrics, analysis.patterns, analysis.channel.category);
  return {
    channel: analysis.channel.username,
    ideas,
  };
};

export const generatePlan = async (channelReference: string): Promise<{ channel: string; schedule: WeeklyPlanItem[] }> => {
  const analysis = await analyzeChannel({ channelReference, timeRange: '30' });
  const schedule = await generateWeeklyPlan(analysis.metrics, analysis.patterns, analysis.channel.category);
  return {
    channel: analysis.channel.username,
    schedule,
  };
};

export const runMaintenanceJobs = async (): Promise<{ leaderboard: LeaderboardEntry[]; refreshedAt: string }> => {
  const leaderboard = await refreshLeaderboard();
  return {
    leaderboard,
    refreshedAt: new Date().toISOString(),
  };
};

export const getRateLimitStatus = (key: string): { allowed: boolean; remaining: number; resetAt: number } => checkRateLimit(key);
