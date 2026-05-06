import { analyzePatterns, calculateChannelMetrics, calculateGrowthScore } from './metrics';
import { checkRateLimit } from './rate-limit';
import { getRepository } from './repository';
import { getTelegramCollector } from './collector';
import type { AnalyzedChannelResponse, ChannelMetrics, ComparisonRow, LeaderboardEntry, PostIdea, WeeklyPlanItem } from './types';
import { normalizeTelegramUsername } from './utils';
import { generateGeminiStrategyAnswer, generatePostIdeas, generateWeeklyPlan } from './ai';

export interface AnalyzeChannelInput {
  channelReference: string;
}

export interface CompareChannelsInput {
  channelReferences: string[];
}

export interface StrategyChatInput {
  channelReference: string;
  userQuestion: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
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

const readCacheIfFresh = async (channelId: string | null): Promise<AnalyzedChannelResponse | null> => {
  if (!channelId) return null;

  const cached = await repository.readMetricsCache(channelId);
  if (!cached) {
    return null;
  }

  return cached.payload as AnalyzedChannelResponse;
};

export const analyzeChannel = async (input: AnalyzeChannelInput): Promise<GeneratedAnalysis> => {
  const cacheKey = await resolveChannelCacheKey(input.channelReference);
  const cached = await readCacheIfFresh(cacheKey);
  if (cached) {
    return {
      ...cached,
      viewsOverTime: cached.metrics.viewsTrend,
      topPosts: cached.metrics.topPosts,
    };
  }

  const collection = await collector.collectChannel(input.channelReference);
  const channel = await repository.upsertChannel(collection.channel);
  await repository.upsertPosts(channel.id, collection.posts);

  const storedPosts = await repository.getPostsByChannelId(channel.id);
  const metrics = calculateChannelMetrics(storedPosts);
  const patterns = analyzePatterns(storedPosts, metrics);
  const growthScore = calculateGrowthScore(metrics, patterns);

  const response: AnalyzedChannelResponse = {
    channel,
    metrics,
    patterns,
    growthScore,
    strategies: patterns.insights,
  };

  await repository.writeMetricsCache(channel.id, response);

  if (!collection.fetchComplete) {
    // eslint-disable-next-line no-console
    console.warn(`Partial fetch detected for @${channel.username}: pagination did not reach a terminal page.`);
  }
  if (collection.expectedPostCount && storedPosts.length < Math.max(1, Math.floor(collection.expectedPostCount * 0.9))) {
    // eslint-disable-next-line no-console
    console.warn(
      `Potential partial fetch for @${channel.username}: stored ${storedPosts.length} posts vs expected approx ${collection.expectedPostCount}.`,
    );
  }

  return {
    ...response,
    viewsOverTime: metrics.viewsTrend,
    topPosts: metrics.topPosts,
  };
};

export const compareChannels = async (input: CompareChannelsInput): Promise<{ comparisons: ComparisonRow[]; topPerformers: Record<string, string> }> => {
  const references = input.channelReferences.slice(0, 3);
  const analyses = await Promise.all(references.map((reference) => analyzeChannel({ channelReference: reference })));

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
    total_views: comparisons.slice().sort((left, right) => right.totalViews - left.totalViews || right.engagementRate - left.engagementRate)[0]?.channelName || 'N/A',
    engagement_rate: comparisons.slice().sort((left, right) => right.engagementRate - left.engagementRate || right.totalViews - left.totalViews)[0]?.channelName || 'N/A',
    posting_frequency: comparisons.slice().sort((left, right) => right.postingFrequency - left.postingFrequency || right.totalViews - left.totalViews)[0]?.channelName || 'N/A',
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
    .sort((left, right) => right.engagement_rate - left.engagement_rate || right.total_views_30d - left.total_views_30d)
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
  if (!trackedChannels.length) {
    return [];
  }

  const analyses = await Promise.all(trackedChannels.map((channel) => analyzeChannel({ channelReference: channel.username })));
  const leaderboard = buildLeaderboardFromAnalyses(analyses);
  await repository.writeLeaderboard(leaderboard);
  return leaderboard;
};

export const getLeaderboard = async (): Promise<LeaderboardEntry[]> => refreshLeaderboard();

export const generateIdeas = async (channelReference: string): Promise<{ channel: string; ideas: PostIdea[] }> => {
  const analysis = await analyzeChannel({ channelReference });
  const ideas = await generatePostIdeas(analysis.metrics, analysis.patterns, analysis.channel.category);
  return {
    channel: analysis.channel.username,
    ideas,
  };
};

export const generatePlan = async (channelReference: string): Promise<{ channel: string; schedule: WeeklyPlanItem[] }> => {
  const analysis = await analyzeChannel({ channelReference });
  const schedule = await generateWeeklyPlan(analysis.metrics, analysis.patterns, analysis.channel.category);
  return {
    channel: analysis.channel.username,
    schedule,
  };
};

export const chatStrategy = async (input: StrategyChatInput): Promise<{ answer: string; suggestions?: string[] }> => {
  const normalizedQuestion = input.userQuestion.trim().replace(/\s+/g, ' ').slice(0, 500);
  if (!normalizedQuestion) {
    return {
      answer: 'Please enter a question so I can generate a strategy.',
    };
  }

  const analysis = await analyzeChannel({ channelReference: input.channelReference });
  if (!analysis.metrics.numberOfPosts) {
    return {
      answer: 'Analyze your channel first to get personalized strategy insights.',
    };
  }

  const context = {
    total_views: analysis.metrics.totalViews,
    avg_views_per_post: Math.round(analysis.metrics.avgViewsPerPost),
    engagement_rate: Number(analysis.metrics.engagementRate.toFixed(2)),
    posting_frequency: Number(analysis.metrics.postingFrequency.toFixed(2)),
    best_posting_day: analysis.metrics.bestPostingDay,
    best_posting_hour: analysis.metrics.bestPostingHour,
    content_type_performance: analysis.metrics.contentTypePerformance,
    top_posts_summary: analysis.metrics.topPosts.slice(0, 5).map((post) => ({
      title: post.title,
      type: post.type,
      views: post.views,
      engagement: Number(post.engagement.toFixed(2)),
    })),
    detected_patterns: {
      common_posting_time: analysis.patterns.commonPostingTime,
      common_content_type: analysis.patterns.commonContentType,
      top_performing_percent: analysis.patterns.topPerformingPercent,
      average_post_length: analysis.patterns.averageLength,
    },
    growth_score: analysis.growthScore,
  };

  const recentHistory = (input.history || []).slice(-5).map((message) => ({
    role: message.role,
    content: message.content.trim().replace(/\s+/g, ' ').slice(0, 500),
  }));

  const prompt = `You are a Telegram growth expert.

Here is the channel data:
${JSON.stringify(context, null, 2)}

Recent chat history:
${JSON.stringify(recentHistory, null, 2)}

Answer the user's question using ONLY this data.
Give actionable, specific advice.
Avoid generic answers.
Be concise but insightful.

User question:
${normalizedQuestion}

Return strict JSON:
{
  "answer": "string",
  "suggestions": ["optional suggestion 1", "optional suggestion 2", "optional suggestion 3"]
}`;

  const rawAnswer = await generateGeminiStrategyAnswer(prompt);
  if (!rawAnswer) {
    return {
      answer: 'Analyze your channel first to get personalized strategy insights.',
    };
  }

  try {
    const parsed = JSON.parse(rawAnswer) as { answer?: string; suggestions?: string[] };
    return {
      answer: parsed.answer || 'I could not generate a focused answer. Please try rephrasing your question.',
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 3) : [],
    };
  } catch {
    return {
      answer: rawAnswer,
      suggestions: [],
    };
  }
};

export const runMaintenanceJobs = async (): Promise<{ leaderboard: LeaderboardEntry[]; refreshedAt: string }> => {
  const leaderboard = await refreshLeaderboard();
  return {
    leaderboard,
    refreshedAt: new Date().toISOString(),
  };
};

export const getRateLimitStatus = (key: string): { allowed: boolean; remaining: number; resetAt: number } => checkRateLimit(key);
