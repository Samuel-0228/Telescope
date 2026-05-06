import type { ChannelRecord, PostRecord, TimeRange } from './types';
import { generateSyntheticChannel, generateSyntheticPosts } from './mock-data';
import { normalizeTelegramUsername } from './utils';

export interface TelegramCollectionResult {
  channel: ChannelRecord;
  posts: PostRecord[];
  source: 'synthetic' | 'bot-api' | 'scraper';
}

export interface TelegramCollector {
  collectChannel(channelReference: string, timeRange: TimeRange): Promise<TelegramCollectionResult>;
}

const detectCollectionMode = (): 'synthetic' | 'bot-api' | 'scraper' => {
  const mode = (process.env.TELEGRAM_DATA_SOURCE || 'synthetic').toLowerCase();
  if (mode === 'bot-api' || mode === 'bot') {
    return 'bot-api';
  }

  if (mode === 'scraper' || mode === 'scrape') {
    return 'scraper';
  }

  return 'synthetic';
};

const buildChannelRecord = (reference: string): ChannelRecord => {
  const username = normalizeTelegramUsername(reference) || 'savvyscope-demo';
  return generateSyntheticChannel(username);
};

const getTimeRangeStart = (timeRange: TimeRange): Date | null => {
  if (timeRange === 'all') {
    return null;
  }

  const days = Number(timeRange);
  if (!Number.isFinite(days) || days <= 0) {
    return null;
  }

  const start = new Date();
  start.setUTCDate(start.getUTCDate() - days);
  return start;
};

const decodeHtml = (value: string): string =>
  value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');

class SyntheticTelegramCollector implements TelegramCollector {
  async collectChannel(channelReference: string, timeRange: TimeRange): Promise<TelegramCollectionResult> {
    const channel = buildChannelRecord(channelReference);
    const posts = generateSyntheticPosts(channel.username, timeRange);

    return {
      channel,
      posts,
      source: 'synthetic',
    };
  }
}

class BotApiTelegramCollector extends SyntheticTelegramCollector {
  async collectChannel(channelReference: string, timeRange: TimeRange): Promise<TelegramCollectionResult> {
    return super.collectChannel(channelReference, timeRange);
  }
}

class ScraperTelegramCollector extends SyntheticTelegramCollector {
  async collectChannel(channelReference: string, timeRange: TimeRange): Promise<TelegramCollectionResult> {
    const username = normalizeTelegramUsername(channelReference);
    if (!username) {
      throw new Error('Please enter a valid public Telegram channel username or URL.');
    }

    const url = `https://t.me/s/${encodeURIComponent(username)}`;

    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (SavvyScope)' } });
      if (!res.ok) {
        throw new Error(`Telegram channel fetch failed with status ${res.status}. Ensure the channel is public.`);
      }

      const html = await res.text();

      // Extract channel title and username
      const titleMatch = html.match(/class="tgme_widget_channel_title">([\s\S]*?)<\//i);
      const name = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : username;

      const channel: ChannelRecord = {
        id: `scrape_${username}`,
        name,
        username,
        category: null,
        createdAt: new Date().toISOString(),
      };

      const messageBlockRegex = /<div class="tgme_widget_message_wrap[\s\S]*?<\/article>\s*<\/div>/gi;
      const datetimeRegex = /<time[^>]+datetime="([^"]+)"/i;
      const postLinkRegex = /href="https:\/\/t\.me\/([^"/]+)\/(\d+)"/i;
      const textBlockRegex = /<div[^>]+class="tgme_widget_message_text"[^>]*>([\s\S]*?)<\/div>/i;
      const viewsRegex = /tgme_widget_message_views[^>]*>([0-9,\.\s]+)/i;
      const photoRegex = /tgme_widget_message_media_photo/i;
      const videoRegex = /tgme_widget_message_video_or_photo|tgme_widget_message_video/i;
      const cutoff = getTimeRangeStart(timeRange);

      const posts: PostRecord[] = [];

      let blockMatch: RegExpExecArray | null;
      while ((blockMatch = messageBlockRegex.exec(html)) !== null) {
        const block = blockMatch[0];

        const datetimeMatch = block.match(datetimeRegex);
        if (!datetimeMatch) {
          continue;
        }

        const timestamp = new Date(datetimeMatch[1]);
        if (Number.isNaN(timestamp.getTime())) {
          continue;
        }

        if (cutoff && timestamp < cutoff) {
          continue;
        }

        const linkMatch = block.match(postLinkRegex);
        const externalPostId = linkMatch ? `${linkMatch[1]}_${linkMatch[2]}` : `${username}_${timestamp.toISOString()}`;

        const textMatch = block.match(textBlockRegex);
        const content = textMatch
          ? decodeHtml(textMatch[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim())
          : '(no text)';

        const viewsMatch = block.match(viewsRegex);
        const views = viewsMatch ? Number(viewsMatch[1].replace(/[\D]/g, '')) : 0;

        let mediaType: PostRecord['mediaType'] = 'text';
        if (photoRegex.test(block)) mediaType = 'image';
        if (videoRegex.test(block)) mediaType = 'video';

        const post: PostRecord = {
          id: `scrape_${username}_${externalPostId}`,
          channelId: channel.id,
          externalPostId,
          content: content || '(no text)',
          mediaType,
          views,
          reactions: 0,
          comments: 0,
          timestamp: timestamp.toISOString(),
          raw: { source: 'scraper' },
        };

        posts.push(post);
      }

      if (!posts.length) {
        throw new Error('No public posts found for this channel in the selected time range.');
      }

      return {
        channel,
        posts,
        source: 'scraper',
      };
    } catch (err) {
      if (err instanceof Error) {
        throw err;
      }

      throw new Error('Failed to scrape Telegram channel.');
    }
  }
}

let collectorInstance: TelegramCollector | null = null;

export const getTelegramCollector = (): TelegramCollector => {
  if (collectorInstance) {
    return collectorInstance;
  }

  const mode = detectCollectionMode();
  if (mode === 'bot-api') {
    collectorInstance = new BotApiTelegramCollector();
  } else if (mode === 'scraper') {
    collectorInstance = new ScraperTelegramCollector();
  } else {
    collectorInstance = new SyntheticTelegramCollector();
  }

  return collectorInstance;
};
