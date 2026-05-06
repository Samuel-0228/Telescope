export type MediaType = 'text' | 'image' | 'video' | 'audio' | 'document' | 'unknown';

export interface ChannelRecord {
  id: string;
  name: string;
  username: string;
  category: string | null;
  createdAt: string;
}

export interface PostRecord {
  id: string;
  channelId: string;
  externalPostId: string;
  content: string;
  mediaType: MediaType;
  views: number;
  reactions: number;
  comments: number;
  timestamp: string;
  raw: Record<string, unknown>;
}

export interface ChannelMetrics {
  totalViews: number;
  avgViewsPerPost: number;
  numberOfPosts: number;
  postingFrequency: number;
  engagementRate: number;
  bestPostingDay: string;
  bestPostingHour: string;
  topContentType: MediaType | 'mixed';
  contentTypePerformance: Array<{ name: string; value: number }>;
  viewsTrend: Array<{ date: string; views: number }>;
  topPosts: Array<{
    id: string;
    title: string;
    type: MediaType;
    views: number;
    engagement: number;
    timestamp: string;
  }>;
}

export interface PatternInsight {
  title: string;
  description: string;
  confidence: number;
  signal: string;
}

export interface PatternAnalysis {
  topPerformingPercent: number;
  averageLength: number;
  commonPostingTime: string;
  commonContentType: MediaType | 'mixed';
  insights: PatternInsight[];
}

export interface WeeklyPlanItem {
  day: string;
  time: string;
  contentType: MediaType | 'mixed';
  focus: string;
  rationale: string;
}

export interface PostIdea {
  title: string;
  angle: string;
  format: string;
  hook: string;
  rationale: string;
}

export interface ComparisonRow {
  channelId: string;
  channelName: string;
  username: string;
  category: string | null;
  totalViews: number;
  engagementRate: number;
  postingFrequency: number;
  contentDistribution: Array<{ name: string; value: number }>;
  topContentType: MediaType | 'mixed';
  bestPostingDay: string;
  bestPostingHour: string;
}

export interface LeaderboardEntry {
  id: string;
  rank: number;
  name: string;
  username: string;
  category: string | null;
  engagement_rate: number;
  total_views_30d: number;
}

export interface AnalyzedChannelResponse {
  channel: ChannelRecord;
  metrics: ChannelMetrics;
  patterns: PatternAnalysis;
  growthScore: number;
  strategies: PatternInsight[];
}
