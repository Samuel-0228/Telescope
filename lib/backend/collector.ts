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

const stripHtml = (value: string): string =>
  decodeHtml(
    value
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+\n/g, '\n')
      .replace(/\n\s+/g, '\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim(),
  );

const parseTelegramCount = (value: string | null | undefined): number => {
  if (!value) {
    return 0;
  }

  const normalized = value.replace(/,/g, '').replace(/\s+/g, '').trim();
  const compactMatch = normalized.match(/^(\d+(?:\.\d+)?)([kmb])?$/i);

  if (!compactMatch) {
    const digits = normalized.replace(/[^\d]/g, '');
    return digits ? Number(digits) : 0;
  }

  const amount = Number(compactMatch[1]);
  const suffix = compactMatch[2]?.toLowerCase();
  const multiplier = suffix === 'k' ? 1_000 : suffix === 'm' ? 1_000_000 : suffix === 'b' ? 1_000_000_000 : 1;
  return Math.round(amount * multiplier);
};

const extractChannelName = (html: string, username: string): string => {
  const patterns = [
    /<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i,
    /class="tgme_channel_info_header_title"[^>]*>\s*<span[^>]*>([\s\S]*?)<\/span>/i,
    /class="tgme_widget_channel_title"[^>]*>([\s\S]*?)<\//i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const name = stripHtml(match[1]);
      if (name) {
        return name;
      }
    }
  }

  return username;
};

const extractMessageSegments = (html: string): string[] => {
  const postMatches = Array.from(html.matchAll(/data-post="([^"]+\/\d+)"/gi));
  if (postMatches.length) {
    return postMatches.map((match, index) => {
      const nearestDiv = html.lastIndexOf('<div', match.index ?? 0);
      const startIndex = nearestDiv >= 0 ? nearestDiv : match.index ?? 0;
      const endIndex = index < postMatches.length - 1 ? postMatches[index + 1].index ?? html.length : html.length;
      return html.slice(startIndex, endIndex);
    });
  }

  const wrapMatches = html.match(/<div class="tgme_widget_message_wrap[\s\S]*?<\/div>\s*<\/div>/gi);
  return wrapMatches || [];
};

const extractPostsFromHtml = (html: string, channel: ChannelRecord, cutoff: Date | null, fallback = false): PostRecord[] => {
  const segments = extractMessageSegments(html);
  const posts: PostRecord[] = [];

  for (const segment of segments) {
    const postPathMatch = segment.match(/data-post="([^"]+\/\d+)"/i) || segment.match(/href="https:\/\/t\.me\/([^"/]+\/\d+)"/i);
    const externalPostPath = postPathMatch?.[1];
    if (!externalPostPath) {
      continue;
    }

    const datetimeMatch = segment.match(/<time[^>]+datetime="([^"]+)"/i);
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

    const textMatch =
      segment.match(/class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
      segment.match(/class="tgme_widget_message_caption[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const content = textMatch ? stripHtml(textMatch[1]) : '(no text)';

    const viewMatch =
      segment.match(/data-view="([^"]+)"/i) ||
      segment.match(/tgme_widget_message_views[^>]*>([^<]+)/i);
    const views = parseTelegramCount(viewMatch?.[1]);

    let mediaType: PostRecord['mediaType'] = 'text';
    if (/tgme_widget_message_document/i.test(segment)) mediaType = 'document';
    if (/tgme_widget_message_voice_player|tgme_widget_message_audio/i.test(segment)) mediaType = 'audio';
    if (/tgme_widget_message_video_player|tgme_widget_message_video/i.test(segment)) mediaType = 'video';
    if (/tgme_widget_message_photo_wrap|tgme_widget_message_media_photo/i.test(segment)) mediaType = 'image';

    posts.push({
      id: `scrape_${channel.username}_${externalPostPath.replace('/', '_')}`,
      channelId: channel.id,
      externalPostId: externalPostPath.replace('/', '_'),
      content: content || '(no text)',
      mediaType,
      views,
      reactions: 0,
      comments: 0,
      timestamp: timestamp.toISOString(),
      raw: { source: 'scraper', fallback },
    });
  }

  return posts;
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
      throw new Error('Please enter a valid public Telegram channel username or URL.');
    }

    const url = `https://t.me/s/${encodeURIComponent(username)}`;

    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (SavvyScope)',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
        },
      });

      if (!res.ok) {
        throw new Error(`Telegram channel fetch failed with status ${res.status}. Ensure the channel is public.`);
      }

      const html = await res.text();
      const channel: ChannelRecord = {
        id: `scrape_${username}`,
        name: extractChannelName(html, username),
        username,
        category: null,
        createdAt: new Date().toISOString(),
      };

      const cutoff = getTimeRangeStart(timeRange);
      const posts = extractPostsFromHtml(html, channel, cutoff, false);

      if (!posts.length) {
        const fallbackPosts = extractPostsFromHtml(html, channel, null, true);
        if (fallbackPosts.length) {
          return {
            channel,
            posts: fallbackPosts,
            source: 'scraper',
          };
        }

        throw new Error('No public posts found for this channel. It may be private, empty, or Telegram changed the page structure.');
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
