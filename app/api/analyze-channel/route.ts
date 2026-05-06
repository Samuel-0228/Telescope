import { NextRequest } from 'next/server';
import { analyzeChannelSchema, parseTimeRange } from '@/lib/backend/validation';
import { analyzeChannel, getRateLimitStatus } from '@/lib/backend/service';
import { errorResponse, getIpAddress, json } from '@/lib/backend/http';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const ip = getIpAddress(request);
    const rateLimit = getRateLimitStatus(`analyze:${ip}`);
    if (!rateLimit.allowed) {
      return errorResponse('Rate limit exceeded', 429);
    }

    const body = await request.json().catch(() => null);
    const parsed = analyzeChannelSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Invalid request body', 400);
    }

    const result = await analyzeChannel({
      channelReference: parsed.data.channel_url,
      timeRange: parseTimeRange(parsed.data.time_range),
    });

    return json({
      channel: result.channel,
      metrics: {
        total_views: result.metrics.totalViews,
        avg_views_per_post: result.metrics.avgViewsPerPost,
        number_of_posts: result.metrics.numberOfPosts,
        posting_frequency: result.metrics.postingFrequency,
        engagement_rate: result.metrics.engagementRate,
        best_posting_day: result.metrics.bestPostingDay,
        best_posting_hour: result.metrics.bestPostingHour,
        top_content_type: result.metrics.topContentType,
      },
      views_over_time: result.viewsOverTime,
      top_posts: result.topPosts.map((post) => ({
        id: post.id,
        title: post.title,
        type: post.type,
        views: post.views,
        engagement: post.engagement,
        timestamp: post.timestamp,
      })),
      content_type_performance: result.metrics.contentTypePerformance,
      strategies: result.strategies,
      growth_score: result.growthScore,
      patterns: result.patterns,
      scraper_fallback: (result as any).scraperFallback || false,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Failed to analyze channel', 500);
  }
}
