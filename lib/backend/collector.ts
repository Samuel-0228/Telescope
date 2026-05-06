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
    return super.collectChannel(channelReference, timeRange);
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
