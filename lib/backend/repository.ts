import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ChannelRecord, LeaderboardEntry, PostRecord, TimeRange } from './types';

interface MetricsCacheRecord {
  channelId: string;
  timeRange: TimeRange;
  payload: unknown;
  refreshedAt: string;
}

interface RepositoryShape {
  upsertChannel(channel: ChannelRecord): Promise<ChannelRecord>;
  findChannelByUsername(username: string): Promise<ChannelRecord | null>;
  upsertPosts(channelId: string, posts: PostRecord[]): Promise<void>;
  readMetricsCache(channelId: string, timeRange: TimeRange): Promise<MetricsCacheRecord | null>;
  writeMetricsCache(channelId: string, timeRange: TimeRange, payload: unknown): Promise<void>;
  readLeaderboard(): Promise<LeaderboardEntry[] | null>;
  writeLeaderboard(entries: LeaderboardEntry[]): Promise<void>;
}

class MemoryRepository implements RepositoryShape {
  private readonly channels = new Map<string, ChannelRecord>();

  private readonly posts = new Map<string, PostRecord[]>();

  private readonly metricsCache = new Map<string, MetricsCacheRecord>();

  private leaderboard: LeaderboardEntry[] = [];

  async upsertChannel(channel: ChannelRecord): Promise<ChannelRecord> {
    this.channels.set(channel.username, channel);
    return channel;
  }

  async findChannelByUsername(username: string): Promise<ChannelRecord | null> {
    return this.channels.get(username) || null;
  }

  async upsertPosts(channelId: string, posts: PostRecord[]): Promise<void> {
    this.posts.set(channelId, posts);
  }

  async readMetricsCache(channelId: string, timeRange: TimeRange): Promise<MetricsCacheRecord | null> {
    const key = `${channelId}:${timeRange}`;
    const cached = this.metricsCache.get(key);
    if (!cached) {
      return null;
    }

    const ageMs = Date.now() - new Date(cached.refreshedAt).getTime();
    if (ageMs > this.getTtlMs()) {
      this.metricsCache.delete(key);
      return null;
    }

    return cached;
  }

  async writeMetricsCache(channelId: string, timeRange: TimeRange, payload: unknown): Promise<void> {
    this.metricsCache.set(`${channelId}:${timeRange}`, {
      channelId,
      timeRange,
      payload,
      refreshedAt: new Date().toISOString(),
    });
  }

  async readLeaderboard(): Promise<LeaderboardEntry[] | null> {
    return this.leaderboard.length ? this.leaderboard : null;
  }

  async writeLeaderboard(entries: LeaderboardEntry[]): Promise<void> {
    this.leaderboard = entries;
  }

  private getTtlMs(): number {
    return Number(process.env.METRICS_CACHE_TTL_MS || 6 * 60 * 60 * 1000);
  }
}

class SupabaseRepository implements RepositoryShape {
  constructor(private readonly client: SupabaseClient) {}

  async upsertChannel(channel: ChannelRecord): Promise<ChannelRecord> {
    const { data, error } = await this.client
      .from('channels')
      .upsert(
        {
          name: channel.name,
          username: channel.username,
          category: channel.category,
          created_at: channel.createdAt,
        },
        { onConflict: 'username' },
      )
      .select('id, name, username, category, created_at')
      .single();

    if (error) {
      throw new Error(`Failed to upsert channel: ${error.message}`);
    }

    return {
      id: data.id,
      name: data.name,
      username: data.username,
      category: data.category,
      createdAt: data.created_at,
    };
  }

  async findChannelByUsername(username: string): Promise<ChannelRecord | null> {
    const { data, error } = await this.client
      .from('channels')
      .select('id, name, username, category, created_at')
      .eq('username', username)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find channel: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      username: data.username,
      category: data.category,
      createdAt: data.created_at,
    };
  }

  async upsertPosts(channelId: string, posts: PostRecord[]): Promise<void> {
    if (!posts.length) {
      return;
    }

    const payload = posts.map((post) => ({
      channel_id: channelId,
      external_post_id: post.externalPostId,
      content: post.content,
      media_type: post.mediaType,
      views: post.views,
      reactions: post.reactions,
      comments: post.comments,
      post_timestamp: post.timestamp,
      raw_payload: post.raw,
    }));

    const { error } = await this.client.from('posts').upsert(payload, { onConflict: 'channel_id,external_post_id' });
    if (error) {
      throw new Error(`Failed to upsert posts: ${error.message}`);
    }
  }

  async readMetricsCache(channelId: string, timeRange: TimeRange): Promise<MetricsCacheRecord | null> {
    const { data, error } = await this.client
      .from('metrics_cache')
      .select('channel_id, time_range, payload, refreshed_at')
      .eq('channel_id', channelId)
      .eq('time_range', timeRange)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to read metrics cache: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return {
      channelId: data.channel_id,
      timeRange: data.time_range as TimeRange,
      payload: data.payload,
      refreshedAt: data.refreshed_at,
    };
  }

  async writeMetricsCache(channelId: string, timeRange: TimeRange, payload: unknown): Promise<void> {
    const { error } = await this.client.from('metrics_cache').upsert(
      {
        channel_id: channelId,
        time_range: timeRange,
        payload,
        refreshed_at: new Date().toISOString(),
      },
      { onConflict: 'channel_id,time_range' },
    );

    if (error) {
      throw new Error(`Failed to write metrics cache: ${error.message}`);
    }
  }

  async readLeaderboard(): Promise<LeaderboardEntry[] | null> {
    const { data, error } = await this.client
      .from('leaderboard')
      .select('id, rank, channel_id, engagement_rate, total_views_30d, channels(name, username, category)')
      .order('rank', { ascending: true })
      .limit(10);

    if (error) {
      throw new Error(`Failed to read leaderboard: ${error.message}`);
    }

    if (!data?.length) {
      return null;
    }

    return data.map((row) => {
      const channel = Array.isArray(row.channels) ? row.channels[0] : row.channels;
      return {
        id: row.id,
        rank: row.rank,
        name: channel?.name || 'Unknown',
        username: channel?.username || 'unknown',
        category: channel?.category || null,
        engagement_rate: row.engagement_rate,
        total_views_30d: row.total_views_30d,
      };
    });
  }

  async writeLeaderboard(entries: LeaderboardEntry[]): Promise<void> {
    if (!entries.length) {
      return;
    }

    const channels = entries.map((entry) => ({
      id: entry.id,
      name: entry.name,
      username: entry.username,
      category: entry.category,
    }));

    const { error: channelError } = await this.client.from('channels').upsert(channels, { onConflict: 'id' });
    if (channelError) {
      throw new Error(`Failed to upsert leaderboard channels: ${channelError.message}`);
    }

    const leaderboardRows = entries.map((entry) => ({
      channel_id: entry.id,
      engagement_rate: entry.engagement_rate,
      total_views_30d: entry.total_views_30d,
      rank: entry.rank,
      refreshed_at: new Date().toISOString(),
    }));

    const { error } = await this.client.from('leaderboard').upsert(leaderboardRows, { onConflict: 'rank' });
    if (error) {
      throw new Error(`Failed to write leaderboard: ${error.message}`);
    }
  }
}

let cachedRepository: RepositoryShape | null = null;

export const getRepository = (): RepositoryShape => {
  if (cachedRepository) {
    return cachedRepository;
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseServiceRoleKey) {
    cachedRepository = new SupabaseRepository(createClient(supabaseUrl, supabaseServiceRoleKey));
    return cachedRepository;
  }

  cachedRepository = new MemoryRepository();
  return cachedRepository;
};
