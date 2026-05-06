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
      return super.collectChannel(channelReference, timeRange);
    }

    const url = `https://t.me/s/${encodeURIComponent(username)}`;

    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (SavvyScope)' } });
      if (!res.ok) {
        return super.collectChannel(channelReference, timeRange);
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

      // Find message date anchors to iterate posts
      const dateAnchorRegex = /<a[^>]+class="tgme_widget_message_date"[^>]*>\s*<time[^>]+datetime="([^"]+)"/gi;
      const textBlockRegex = /<div[^>]+class="tgme_widget_message_text"[^>]*>([\s\S]*?)<\/div>/i;
      const viewsRegex = /tgme_widget_message_views[^>]*>([0-9,\.\s]+)/i;
      const photoRegex = /tgme_widget_message_media_photo/i;
      const videoRegex = /tgme_widget_message_video_or_photo|tgme_widget_message_video/i;

      const posts: PostRecord[] = [];

      // iterate through date anchors and for each find surrounding content
      let match: RegExpExecArray | null;
      while ((match = dateAnchorRegex.exec(html)) !== null) {
        const datetime = match[1];
        const idx = match.index;

        // search backward for the nearest text block before this anchor
        const before = html.slice(0, idx);
        const lastTextMatch = before.match(/<div[^>]+class="tgme_widget_message_text"[^>]*>[\s\S]*?<\/div>(?![\s\S]*<div[^>]+class="tgme_widget_message_text")/i);
        let content = '';
        if (lastTextMatch) {
          content = lastTextMatch[0].replace(/<[^>]+>/g, '').trim();
        } else {
          // fallback: try to find any text block after anchor
          const after = html.slice(idx);
          const afterMatch = after.match(textBlockRegex);
          content = afterMatch ? afterMatch[1].replace(/<[^>]+>/g, '').trim() : '';
        }

        // find views near this index (after)
        const afterSlice = html.slice(idx, idx + 800);
        const viewsMatch = afterSlice.match(viewsRegex);
        const views = viewsMatch ? Number(viewsMatch[1].replace(/[\D]/g, '')) : 0;

        // detect media type around the anchor
        const windowSlice = html.slice(Math.max(0, idx - 600), idx + 600);
        let mediaType: PostRecord['mediaType'] = 'text';
        if (photoRegex.test(windowSlice)) mediaType = 'image';
        if (videoRegex.test(windowSlice)) mediaType = 'video';

        const post: PostRecord = {
          id: `scrape_${username}_${datetime}`,
          channelId: channel.id,
          externalPostId: `${username}_${datetime}`,
          content: content || '(no text)',
          mediaType,
          views,
          reactions: 0,
          comments: 0,
          timestamp: new Date(datetime).toISOString(),
          raw: { source: 'scraper' },
        };

        posts.push(post);
      }

      if (!posts.length) {
        return super.collectChannel(channelReference, timeRange);
      }

      return {
        channel,
        posts,
        source: 'scraper',
      };
    } catch (err) {
      return super.collectChannel(channelReference, timeRange);
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
