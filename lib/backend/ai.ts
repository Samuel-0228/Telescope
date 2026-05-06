import type { ChannelMetrics, PatternAnalysis, PostIdea, WeeklyPlanItem } from './types';

interface OpenAIResponse {
  output_text?: string;
}

const maybeOpenAiPlan = async (prompt: string): Promise<string | null> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      input: prompt,
      text: {
        format: {
          type: 'json_object',
        },
      },
    }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as OpenAIResponse;
  return payload.output_text || null;
};

const parseJsonOrNull = <T,>(value: string | null): T | null => {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

const buildDefaultWeeklyPlan = (metrics: ChannelMetrics, patterns: PatternAnalysis): WeeklyPlanItem[] => {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const focusPool = [
    'Educational breakdown',
    'Community question',
    'Case study spotlight',
    'Industry news recap',
    'Behind-the-scenes update',
    'Conversion-focused showcase',
    'Insight thread summary',
  ];

  return days.map((day, index) => ({
    day,
    time: index === 0 ? patterns.commonPostingTime : `${String((18 + index) % 24).padStart(2, '0')}:00 UTC`,
    contentType: patterns.commonContentType,
    focus: focusPool[index],
    rationale: index % 2 === 0
      ? `Use the ${patterns.commonPostingTime} window where top posts already perform well.`
      : `Keep posting cadence close to ${metrics.postingFrequency.toFixed(1)} posts/day for consistency.`,
  }));
};

const buildDefaultIdeas = (category: string | null, metrics: ChannelMetrics, patterns: PatternAnalysis): PostIdea[] => {
  const topic = category || 'your audience';
  return [
    {
      title: `A weekly ${topic.toLowerCase()} pulse`,
      angle: `Summarize the most relevant updates for ${topic.toLowerCase()}.`,
      format: 'Carousel + caption',
      hook: `What changed in ${topic.toLowerCase()} this week?`,
      rationale: `Your best content type is ${patterns.commonContentType}, and this topic fits the engagement profile.`,
    },
    {
      title: 'One-minute teardown',
      angle: 'Break down a useful workflow, product, or result.',
      format: 'Video or voice memo',
      hook: 'Here is the fastest way to do it better.',
      rationale: `Short, high-signal content performs well at your current average of ${Math.round(metrics.avgViewsPerPost)} views/post.`,
    },
    {
      title: 'Community benchmark post',
      angle: 'Show a comparison table, scorecard, or trend line.',
      format: 'Image + summary',
      hook: 'The numbers tell the story.',
      rationale: 'Comparison content tends to lift save and share behavior.',
    },
    {
      title: 'Actionable checklist',
      angle: 'Give subscribers a simple next-step framework.',
      format: 'Text + bullets',
      hook: 'Use this checklist before your next campaign.',
      rationale: 'Clear utility increases repeat engagement.',
    },
    {
      title: 'Behind-the-scenes build log',
      angle: 'Reveal process, decisions, and lessons learned.',
      format: 'Text + image',
      hook: 'What actually happened when we shipped this?',
      rationale: 'Narrative posts are strong for audience trust and retention.',
    },
  ];
};

export const generateWeeklyPlan = async (metrics: ChannelMetrics, patterns: PatternAnalysis, category: string | null): Promise<WeeklyPlanItem[]> => {
  const prompt = JSON.stringify({ metrics, patterns, category, task: 'Generate a 7-day Telegram posting plan as JSON with day, time, contentType, focus, rationale.' });
  const openAiPlan = parseJsonOrNull<{ schedule?: WeeklyPlanItem[] }>(await maybeOpenAiPlan(prompt));
  return openAiPlan?.schedule?.length ? openAiPlan.schedule : buildDefaultWeeklyPlan(metrics, patterns);
};

export const generatePostIdeas = async (metrics: ChannelMetrics, patterns: PatternAnalysis, category: string | null): Promise<PostIdea[]> => {
  const prompt = JSON.stringify({ metrics, patterns, category, task: 'Generate 5 Telegram post ideas as JSON with title, angle, format, hook, rationale.' });
  const openAiIdeas = parseJsonOrNull<{ ideas?: PostIdea[] }>(await maybeOpenAiPlan(prompt));
  return openAiIdeas?.ideas?.length ? openAiIdeas.ideas : buildDefaultIdeas(category, metrics, patterns);
};
