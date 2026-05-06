import { load } from 'cheerio';
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
  const $ = load(html);
  const titleCandidates = [
    $('meta[property="og:title"]').attr('content'),
    $('.tgme_channel_info_header_title span').first().text(),
    $('.tgme_widget_channel_title').first().text(),
  ];

  for (const candidate of titleCandidates) {
    const name = normalizeText(candidate || '');
    if (name) {
      return name;
    }
  }

  return username;
};

const normalizeText = (value: string): string =>
  decodeHtml(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const extractExternalPostPath = ($: any, $wrap: any, username: string): string | null => {
  const dataPost = $wrap.attr('data-post') || $wrap.find('[data-post]').first().attr('data-post');
  if (dataPost && /\/.+\/\d+/.test(dataPost)) {
    return dataPost;
  }

  const linkHref = $wrap
    .find('a[href^="https://t.me/"]')
    .toArray()
    .map((element) => $(element).attr('href') || '')
    .find((href) => href.includes(`https://t.me/${username}/`) && /\/\d+(?:\?|#|$)/.test(href));

  const hrefMatch = linkHref?.match(/https:\/\/t\.me\/([^/?#]+\/\d+)/i);
  return hrefMatch?.[1] || null;
};

const extractCountFromText = (value: string | null | undefined): number => {
  if (!value) {
    return 0;
  }

  const directMatch = value.replace(/\u00a0/g, ' ').match(/([\d,.]+(?:\.?\d+)?\s*[kmb]?)/i);
  return parseTelegramCount(directMatch?.[1] || value);
};

const extractMessageText = ($wrap: any): string => {
  const contentNode = $wrap.find('.tgme_widget_message_text, .tgme_widget_message_caption').first().clone();
  if (!contentNode.length) {
    return '';
  }

  contentNode.find('.tgme_widget_message_replies, .tgme_widget_message_views, .tgme_widget_message_reaction, .tgme_widget_message_meta').remove();
  contentNode.find('br').replaceWith('\n');
  return normalizeText(stripHtml(contentNode.html() || contentNode.text()));
};

const extractPostsFromHtml = (html: string, channel: ChannelRecord, cutoff: Date | null, fallback = false): PostRecord[] => {
  const $ = load(html);
  const segments = $('div.tgme_widget_message_wrap').toArray();
  const posts: PostRecord[] = [];

  for (const segment of segments) {
    const $segment = $(segment);
    const externalPostPath = extractExternalPostPath($, $segment, channel.username);
    if (!externalPostPath) {
      continue;
    }

    const datetimeValue = $segment.find('time[datetime]').first().attr('datetime');
    if (!datetimeValue) {
      continue;
    }

    const timestamp = new Date(datetimeValue);
    if (Number.isNaN(timestamp.getTime())) {
      continue;
    }

    if (cutoff && timestamp < cutoff) {
      continue;
    }

    const content = extractMessageText($segment) || '(media post)';

    const viewText = $segment.find('.tgme_widget_message_views').first().text() || $segment.find('[data-view]').first().attr('data-view');
    const views = extractCountFromText(viewText);

    const commentsText =
      $segment.find('.tgme_widget_message_comments').first().text() ||
      $segment.find('[class*="comments"]').first().text() ||
      '';
    const comments = extractCountFromText(commentsText);

    const reactionsText = $segment.find('.tgme_widget_message_reactions').first().text() || '';
    const reactions = extractCountFromText(reactionsText);

    let mediaType: PostRecord['mediaType'] = 'text';
    if ($segment.find('.tgme_widget_message_document, .tgme_widget_message_file').length) mediaType = 'document';
    if ($segment.find('.tgme_widget_message_voice_player, .tgme_widget_message_audio').length) mediaType = 'audio';
    if ($segment.find('.tgme_widget_message_video_player, .tgme_widget_message_video').length) mediaType = 'video';
    if ($segment.find('.tgme_widget_message_photo_wrap, .tgme_widget_message_media_photo').length) mediaType = 'image';

    posts.push({
      id: `scrape_${channel.username}_${externalPostPath.replace('/', '_')}`,
      channelId: channel.id,
      externalPostId: externalPostPath.replace('/', '_'),
      content: content || '(no text)',
      mediaType,
      views,
      reactions,
      comments,
      timestamp: timestamp.toISOString(),
      raw: {
        source: 'scraper',
        fallback,
        extracted: {
          hasViews: views > 0,
          hasComments: comments > 0,
          hasReactions: reactions > 0,
        },
      },
    });
  }

  const deduped = new Map<string, PostRecord>();
  posts.forEach((post) => {
    if (!deduped.has(post.externalPostId)) {
      deduped.set(post.externalPostId, post);
    }
  });

  return Array.from(deduped.values()).sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());
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
