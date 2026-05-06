import { load } from 'cheerio';
import type { ChannelRecord, PostRecord } from './types';
import { generateSyntheticChannel, generateSyntheticPosts } from './mock-data';
import { normalizeTelegramUsername } from './utils';

export interface TelegramCollectionResult {
  channel: ChannelRecord;
  posts: PostRecord[];
  expectedPostCount: number | null;
  fetchComplete: boolean;
  source: 'synthetic' | 'bot-api' | 'scraper' | 'mtproto';
}

export interface TelegramCollector {
  collectChannel(channelReference: string): Promise<TelegramCollectionResult>;
}

const detectCollectionMode = (): 'synthetic' | 'bot-api' | 'scraper' | 'mtproto' => {
  const mode = (process.env.TELEGRAM_DATA_SOURCE || 'mtproto').toLowerCase();
  if (mode === 'bot-api' || mode === 'bot') {
    return 'bot-api';
  }

  if (mode === 'scraper' || mode === 'scrape') {
    return 'scraper';
  }

  if (mode === 'mtproto') {
    return 'mtproto';
  }

  return 'synthetic';
};

const buildChannelRecord = (reference: string): ChannelRecord => {
  const username = normalizeTelegramUsername(reference) || 'savvyscope-demo';
  return generateSyntheticChannel(username);
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
    if (!digits || digits.length > 9) {
      return 0;
    }

    return Number(digits);
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

  const normalized = value.replace(/\u00a0/g, ' ').trim();
  const tokenMatch = normalized.match(/^([\d,.]+(?:\.\d+)?\s*[kmb]?)\s*(?:views?|view|replies?|comments?|reactions?)?$/i);

  if (tokenMatch?.[1]) {
    return parseTelegramCount(tokenMatch[1]);
  }

  return 0;
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

const extractPostsFromHtml = (html: string, channel: ChannelRecord): PostRecord[] => {
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
  async collectChannel(channelReference: string): Promise<TelegramCollectionResult> {
    const channel = buildChannelRecord(channelReference);
    const posts = generateSyntheticPosts(channel.username);

    return {
      channel,
      posts,
      expectedPostCount: posts.length,
      fetchComplete: true,
      source: 'synthetic',
    };
  }
}

class BotApiTelegramCollector extends SyntheticTelegramCollector {
  async collectChannel(channelReference: string): Promise<TelegramCollectionResult> {
    return super.collectChannel(channelReference);
  }
}

interface MTProtoClientConfig {
  apiId?: number;
  apiHash?: string;
  botToken?: string;
}

interface FetchResult {
  messages: PostRecord[];
  totalCount: number | null;
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
}

// MTProto-based collector using public API
class MTProtoTelegramCollector extends SyntheticTelegramCollector {
  private readonly apiEndpoint = 'https://t.me/s';
  private readonly maxRetries = 3;
  private readonly retryDelayMs = 1000;

  private normalizeChannelInput(input: string): string {
    if (!input) return '';
    let cleaned = input.trim().toLowerCase();
    cleaned = cleaned.replace(/^https?:\/\/(www\.)?t\.me\//i, '');
    cleaned = cleaned.replace(/^t\.me\//i, '');
    cleaned = cleaned.replace(/^@/, '');
    cleaned = cleaned.replace(/[^a-z0-9_]/g, '');
    return cleaned;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async tryResolveChannel(channelInput: string): Promise<{ username: string; exists: boolean; error?: string }> {
    const normalized = this.normalizeChannelInput(channelInput);
    if (!normalized) {
      return { username: '', exists: false, error: 'Failed to normalize channel input' };
    }

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const testUrl = `${this.apiEndpoint}/${normalized}`;
        const response = await fetch(testUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (SavvyScope)',
            Accept: 'text/html,application/xhtml+xml',
          },
        });

        if (response.ok) {
          const html = await response.text();
          if (html && html.length > 100) {
            return { username: normalized, exists: true };
          }
        }
      } catch (err) {
        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelayMs * attempt);
        }
      }
    }

    return { username: normalized, exists: false, error: 'Channel resolution failed after retries' };
  }

  private async fetchChannelMessages(
    username: string,
    maxMessages = 5000,
    batchSize = 100,
  ): Promise<FetchResult> {
    const messages: PostRecord[] = [];
    let oldestMessageId: number | null = null;
    let attempt = 0;
    const maxAttempts = Math.ceil(maxMessages / batchSize) + 5;
    const seenIds = new Set<string>();

    const channel: ChannelRecord = {
      id: `mtproto_${username}`,
      name: username.replace(/[-_]+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()),
      username,
      category: null,
      createdAt: new Date().toISOString(),
    };

    while (attempt < maxAttempts && messages.length < maxMessages) {
      attempt += 1;

      try {
        const pageUrl = oldestMessageId
          ? `${this.apiEndpoint}/${username}?before=${oldestMessageId}`
          : `${this.apiEndpoint}/${username}`;

        const response = await fetch(pageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (SavvyScope)',
            Accept: 'text/html,application/xhtml+xml',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
          },
        });

        if (!response.ok) {
          return {
            messages: [],
            totalCount: null,
            success: false,
            errorCode: `HTTP_${response.status}`,
            errorMessage: `Fetch failed with status ${response.status}`,
          };
        }

        const html = await response.text();
        if (!html || html.length < 100) {
          if (attempt === 1) {
            return {
              messages: [],
              totalCount: null,
              success: false,
              errorCode: 'EMPTY_RESPONSE',
              errorMessage: 'Server returned empty response for channel',
            };
          }
          break;
        }

        const pagePosts = extractPostsFromHtml(html, channel);
        if (!pagePosts.length) {
          if (attempt === 1 && messages.length === 0) {
            return {
              messages: [],
              totalCount: null,
              success: true,
              errorMessage: 'Channel appears to be empty (no posts extracted)',
            };
          }
          break;
        }

        let newCount = 0;
        pagePosts.forEach((post) => {
          if (!seenIds.has(post.externalPostId)) {
            messages.push(post);
            seenIds.add(post.externalPostId);
            newCount += 1;
          }
        });

        if (newCount === 0) {
          break;
        }

        const ids = pagePosts
          .map((post) => {
            const idPart = post.externalPostId.split('_').at(-1);
            return Number(idPart);
          })
          .filter((value) => Number.isFinite(value) && value > 0);

        if (!ids.length) {
          break;
        }

        const minId = Math.min(...ids);
        if (minId <= 1) {
          break;
        }

        if (oldestMessageId === minId) {
          break;
        }

        oldestMessageId = minId;

        if (messages.length >= maxMessages) {
          break;
        }

        await this.delay(Math.random() * 500 + 500);
      } catch (err) {
        if (attempt === maxAttempts) {
          return {
            messages: [],
            totalCount: null,
            success: false,
            errorCode: 'FETCH_EXCEPTION',
            errorMessage: err instanceof Error ? err.message : 'Unknown fetch error',
          };
        }
        await this.delay(this.retryDelayMs * attempt);
      }
    }

    if (messages.length === 0) {
      return {
        messages: [],
        totalCount: null,
        success: true,
        errorMessage: 'No messages found after exhausting pagination',
      };
    }

    messages.sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());

    return {
      messages,
      totalCount: messages.length,
      success: true,
    };
  }

  async collectChannel(channelReference: string): Promise<TelegramCollectionResult> {
    const resolution = await this.tryResolveChannel(channelReference);

    if (!resolution.exists) {
      const errorMsg = `Channel resolution failed for "${channelReference}": ${resolution.error || 'unknown error'}`;
      // eslint-disable-next-line no-console
      console.warn(`MTProto collector: ${errorMsg}`);
      throw new Error(`Please enter a valid public Telegram channel username or URL.`);
    }

    const fetchResult = await this.fetchChannelMessages(resolution.username);

    // eslint-disable-next-line no-console
    console.log(`MTProto collector: channel=${resolution.username} messages=${fetchResult.messages.length} success=${fetchResult.success} error=${fetchResult.errorCode || 'none'}`);

    if (!fetchResult.success || (fetchResult.messages.length === 0 && !fetchResult.errorMessage?.includes('empty'))) {
      const errorMsg = `MTProto fetch failed: ${fetchResult.errorCode} - ${fetchResult.errorMessage}`;
      // eslint-disable-next-line no-console
      console.error(errorMsg);
      throw new Error(
        `Failed to fetch channel data: ${fetchResult.errorMessage || 'Unknown error'}. Ensure the channel is public and not restricted.`,
      );
    }

    if (fetchResult.messages.length === 0) {
      throw new Error('No public posts found for this channel. It may be private, empty, or Telegram changed the page structure.');
    }

    const channel: ChannelRecord = {
      id: `mtproto_${resolution.username}`,
      name: resolution.username.replace(/[-_]+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()),
      username: resolution.username,
      category: null,
      createdAt: new Date().toISOString(),
    };

    return {
      channel,
      posts: fetchResult.messages,
      expectedPostCount: fetchResult.totalCount,
      fetchComplete: true,
      source: 'mtproto',
    };
  }
}

class ScraperTelegramCollector extends SyntheticTelegramCollector {
  async collectChannel(channelReference: string): Promise<TelegramCollectionResult> {
    const username = normalizeTelegramUsername(channelReference);
    if (!username) {
      throw new Error('Please enter a valid public Telegram channel username or URL.');
    }

    const baseUrl = `https://t.me/s/${encodeURIComponent(username)}`;

    try {
      const fetchPage = async (before?: number): Promise<string> => {
        const pageUrl = before ? `${baseUrl}?before=${before}` : baseUrl;
        const pageRes = await fetch(pageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (SavvyScope)',
            Accept: 'text/html,application/xhtml+xml',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
          },
        });

        if (!pageRes.ok) {
          throw new Error(`Telegram channel fetch failed with status ${pageRes.status}. Ensure the channel is public.`);
        }

        return pageRes.text();
      };

      const html = await fetchPage();

      const channel: ChannelRecord = {
        id: `scrape_${username}`,
        name: extractChannelName(html, username),
        username,
        category: null,
        createdAt: new Date().toISOString(),
      };

      const deduped = new Map<string, PostRecord>();
      const seenPageFingerprints = new Set<string>();
      let oldestMessageId: number | null = null;
      let expectedPostCount: number | null = null;
      let fetchComplete = false;
      let pageIndex = 0;

      while (true) {
        const pageHtml = pageIndex === 0 ? html : await fetchPage(oldestMessageId || undefined);
        pageIndex += 1;

        const pagePosts = extractPostsFromHtml(pageHtml, channel);
        if (!pagePosts.length) {
          fetchComplete = true;
          break;
        }

        const pageFingerprint = pagePosts.map((post) => post.externalPostId).join('|');
        if (seenPageFingerprints.has(pageFingerprint)) {
          break;
        }
        seenPageFingerprints.add(pageFingerprint);

        pagePosts.forEach((post) => {
          deduped.set(post.externalPostId, post);
        });

        const ids = pagePosts
          .map((post) => {
            const idPart = post.externalPostId.split('_').at(-1);
            return Number(idPart);
          })
          .filter((value) => Number.isFinite(value));

        const maxId = ids.length ? Math.max(...ids) : null;
        const minId = ids.length ? Math.min(...ids) : null;
        if (maxId && (!expectedPostCount || maxId > expectedPostCount)) {
          expectedPostCount = maxId;
        }

        if (!minId || minId <= 1) {
          fetchComplete = true;
          break;
        }

        if (oldestMessageId !== null && minId >= oldestMessageId) {
          break;
        }

        oldestMessageId = minId;
      }

      const posts = Array.from(deduped.values()).sort(
        (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
      );

      if (!posts.length) {
        throw new Error('No public posts found for this channel. It may be private, empty, or Telegram changed the page structure.');
      }

      if (expectedPostCount && posts.length < expectedPostCount) {
        fetchComplete = false;
      }

      return {
        channel,
        posts,
        expectedPostCount,
        fetchComplete,
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
  if (mode === 'mtproto') {
    collectorInstance = new MTProtoTelegramCollector();
  } else if (mode === 'bot-api') {
    collectorInstance = new BotApiTelegramCollector();
  } else if (mode === 'scraper') {
    collectorInstance = new ScraperTelegramCollector();
  } else {
    collectorInstance = new SyntheticTelegramCollector();
  }

  return collectorInstance;
};
