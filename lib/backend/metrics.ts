import { DAY_NAMES, clamp, differenceInDaysUtc, formatDateKey, roundTo, toPercent } from './utils';
import type { ChannelMetrics, MediaType, PatternAnalysis, PatternInsight, PostRecord, TimeRange } from './types';

const EMPTY_MEDIA_ROWS: Array<{ name: MediaType; count: number; totalViews: number; totalEngagement: number }> = [
  { name: 'text', count: 0, totalViews: 0, totalEngagement: 0 },
  { name: 'image', count: 0, totalViews: 0, totalEngagement: 0 },
  { name: 'video', count: 0, totalViews: 0, totalEngagement: 0 },
  { name: 'audio', count: 0, totalViews: 0, totalEngagement: 0 },
  { name: 'document', count: 0, totalViews: 0, totalEngagement: 0 },
  { name: 'unknown', count: 0, totalViews: 0, totalEngagement: 0 },
];

const getEngagementRate = (post: PostRecord): number => {
  if (!post.views) {
    return 0;
  }

  return ((post.reactions + post.comments) / post.views) * 100;
};

const hasDirectEngagementSignals = (posts: PostRecord[]): boolean =>
  posts.some((post) => post.reactions > 0 || post.comments > 0);

const getPostPerformanceScore = (post: PostRecord, preferViews: boolean): number => {
  if (preferViews) {
    return post.views;
  }

  return getEngagementRate(post);
};

const getTopContentType = (rows: Array<{ name: MediaType; totalEngagement: number }>): MediaType | 'mixed' => {
  const sorted = rows
    .filter((row) => row.totalEngagement > 0)
    .sort((left, right) => right.totalEngagement - left.totalEngagement);

  if (sorted.length === 0) {
    return 'mixed';
  }

  return sorted[0].name;
};

const calculateViewsTrend = (posts: PostRecord[]): Array<{ date: string; views: number }> => {
  const byDate = new Map<string, number>();

  posts.forEach((post) => {
    const key = formatDateKey(new Date(post.timestamp));
    byDate.set(key, (byDate.get(key) || 0) + post.views);
  });

  return Array.from(byDate.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, views]) => ({ date, views }));
};

const calculateTopPosts = (posts: PostRecord[], preferViews: boolean): ChannelMetrics['topPosts'] =>
  posts
    .map((post) => ({
      id: post.id,
      title: post.content.length > 70 ? `${post.content.slice(0, 67)}...` : post.content,
      type: post.mediaType,
      views: post.views,
      engagement: getPostPerformanceScore(post, preferViews),
      timestamp: post.timestamp,
    }))
    .sort((left, right) => right.engagement - left.engagement || right.views - left.views)
    .slice(0, 5);

const calculateContentTypePerformance = (
  rows: Array<{ name: MediaType; count: number; totalEngagement: number }>,
  totalPosts: number,
): Array<{ name: string; value: number }> => {
  if (!totalPosts) {
    return [];
  }

  return rows
    .filter((row) => row.count > 0)
    .map((row) => ({
      name: row.name.toUpperCase(),
      value: toPercent(row.count / totalPosts),
    }))
    .sort((left, right) => right.value - left.value);
};

const calculateBestDayAndHour = (posts: PostRecord[], preferViews: boolean): { bestPostingDay: string; bestPostingHour: string } => {
  const dayBuckets = new Map<number, { totalEngagement: number; count: number }>();
  const hourBuckets = new Map<number, { totalEngagement: number; count: number }>();

  posts.forEach((post) => {
    const date = new Date(post.timestamp);
    const dayKey = date.getUTCDay();
    const hourKey = date.getUTCHours();
    const engagement = getPostPerformanceScore(post, preferViews);

    const dayBucket = dayBuckets.get(dayKey) || { totalEngagement: 0, count: 0 };
    dayBucket.totalEngagement += engagement;
    dayBucket.count += 1;
    dayBuckets.set(dayKey, dayBucket);

    const hourBucket = hourBuckets.get(hourKey) || { totalEngagement: 0, count: 0 };
    hourBucket.totalEngagement += engagement;
    hourBucket.count += 1;
    hourBuckets.set(hourKey, hourBucket);
  });

  const bestPostingDay = Array.from(dayBuckets.entries())
    .map(([day, bucket]) => ({ day, avg: bucket.totalEngagement / bucket.count }))
    .sort((left, right) => right.avg - left.avg)[0];

  const bestPostingHour = Array.from(hourBuckets.entries())
    .map(([hour, bucket]) => ({ hour, avg: bucket.totalEngagement / bucket.count }))
    .sort((left, right) => right.avg - left.avg)[0];

  return {
    bestPostingDay: bestPostingDay ? DAY_NAMES[bestPostingDay.day] : 'N/A',
    bestPostingHour: bestPostingHour ? `${String(bestPostingHour.hour).padStart(2, '0')}:00 UTC` : 'N/A',
  };
};

export const calculateChannelMetrics = (posts: PostRecord[], _timeRange: TimeRange): ChannelMetrics => {
  const orderedPosts = [...posts].sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());
  const totalViews = orderedPosts.reduce((sum, post) => sum + post.views, 0);
  const totalEngagement = orderedPosts.reduce((sum, post) => sum + post.reactions + post.comments, 0);
  const preferViews = !hasDirectEngagementSignals(orderedPosts);
  const numberOfPosts = orderedPosts.length;
  const avgViewsPerPost = numberOfPosts ? totalViews / numberOfPosts : 0;
  const firstPostDate = orderedPosts[numberOfPosts - 1] ? new Date(orderedPosts[numberOfPosts - 1].timestamp) : new Date();
  const lastPostDate = orderedPosts[0] ? new Date(orderedPosts[0].timestamp) : new Date();
  const daysWindow = Math.max(1, differenceInDaysUtc(lastPostDate, firstPostDate) + 1);
  const postingFrequency = numberOfPosts / daysWindow;

  const mediaRows = structuredClone(EMPTY_MEDIA_ROWS);
  orderedPosts.forEach((post) => {
    const bucket = mediaRows.find((row) => row.name === post.mediaType) || mediaRows[0];
    bucket.count += 1;
    bucket.totalViews += post.views;
    bucket.totalEngagement += preferViews ? post.views : post.reactions + post.comments;
  });

  const peakViews = orderedPosts[0]?.views || 0;
  const engagementRate = preferViews ? (peakViews ? toPercent(avgViewsPerPost / peakViews) : 0) : totalViews ? toPercent(totalEngagement / totalViews) : 0;
  const { bestPostingDay, bestPostingHour } = calculateBestDayAndHour(orderedPosts, preferViews);
  const contentTypePerformance = calculateContentTypePerformance(mediaRows, numberOfPosts);
  const topContentType = getTopContentType(mediaRows);

  return {
    totalViews,
    avgViewsPerPost: roundTo(avgViewsPerPost, 2),
    numberOfPosts,
    postingFrequency: roundTo(postingFrequency, 2),
    engagementRate: roundTo(engagementRate, 2),
    bestPostingDay,
    bestPostingHour,
    topContentType,
    contentTypePerformance,
    viewsTrend: calculateViewsTrend(orderedPosts),
    topPosts: calculateTopPosts(orderedPosts, preferViews),
  };
};

const calculateLengthBucket = (posts: PostRecord[]): number => {
  if (!posts.length) {
    return 0;
  }

  const totalCharacters = posts.reduce((sum, post) => sum + post.content.length, 0);
  return Math.round(totalCharacters / posts.length);
};

export const analyzePatterns = (posts: PostRecord[], metrics: ChannelMetrics): PatternAnalysis => {
  if (!posts.length) {
    return {
      topPerformingPercent: 20,
      averageLength: 0,
      commonPostingTime: 'N/A',
      commonContentType: 'mixed',
      insights: [],
    };
  }

  const preferViews = !hasDirectEngagementSignals(posts);
  const sortedByEngagement = [...posts]
    .map((post) => ({ post, engagement: getPostPerformanceScore(post, preferViews) }))
    .sort((left, right) => right.engagement - left.engagement || new Date(right.post.timestamp).getTime() - new Date(left.post.timestamp).getTime());

  const cutoffIndex = Math.max(1, Math.ceil(sortedByEngagement.length * 0.2));
  const topPosts = sortedByEngagement.slice(0, cutoffIndex).map(({ post }) => post);
  const averageLength = calculateLengthBucket(topPosts);

  const timeBuckets = new Map<number, number>();
  const contentBuckets = new Map<string, number>();

  topPosts.forEach((post) => {
    const date = new Date(post.timestamp);
    timeBuckets.set(date.getUTCHours(), (timeBuckets.get(date.getUTCHours()) || 0) + 1);
    contentBuckets.set(post.mediaType, (contentBuckets.get(post.mediaType) || 0) + 1);
  });

  const commonHour = Array.from(timeBuckets.entries()).sort((left, right) => right[1] - left[1])[0]?.[0];
  const commonContentType = Array.from(contentBuckets.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] as MediaType | undefined;

  const commonPostingTime = typeof commonHour === 'number' ? `${String(commonHour).padStart(2, '0')}:00 UTC` : 'N/A';
  const normalizedContentType: MediaType | 'mixed' = commonContentType || metrics.topContentType || 'mixed';

  const insights: PatternInsight[] = [
    {
      title: 'Double down on winning windows',
      description: `Your top 20% posts cluster around ${commonPostingTime}. Schedule high-value posts in that window.`,
      confidence: 0.86,
      signal: `peak-time:${commonPostingTime}`,
    },
    {
      title: 'Lean into the best format',
      description: `${normalizedContentType === 'mixed' ? 'A mixed format' : normalizedContentType} content drives the strongest engagement.`,
      confidence: 0.8,
      signal: `content-type:${normalizedContentType}`,
    },
    {
      title: 'Optimize post length',
      description: `Top performers average about ${averageLength} characters, which is a strong benchmark for future posts.`,
      confidence: 0.74,
      signal: `avg-length:${averageLength}`,
    },
  ];

  return {
    topPerformingPercent: 20,
    averageLength,
    commonPostingTime,
    commonContentType: normalizedContentType,
    insights,
  };
};

export const calculateGrowthScore = (metrics: ChannelMetrics, patternAnalysis: PatternAnalysis): number => {
  const engagementScore = clamp(metrics.engagementRate * 2.2, 0, 40);
  const frequencyScore = clamp(metrics.postingFrequency * 6, 0, 20);
  const viewsScore = clamp(metrics.avgViewsPerPost / 4_000, 0, 20);
  const contentScore = patternAnalysis.commonContentType === 'mixed' ? 8 : 12;
  const consistencyScore = patternAnalysis.insights.length ? 10 : 4;
  return Math.round(clamp(engagementScore + frequencyScore + viewsScore + contentScore + consistencyScore, 0, 100));
};
