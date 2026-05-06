'use client';

import { useState, useEffect, useRef } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { TrendingUp, BarChart3, Users, Zap, Trophy, Calendar, Sparkles, Share2, ArrowRight, Gauge, Bot, User, Loader2 } from 'lucide-react';

export default function ThreeFortyEight() {
  const [channelInfo, setChannelInfo] = useState<{ id: string; username: string } | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [channelLink, setChannelLink] = useState('');
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [theme, setTheme] = useState<'red' | 'grey'>('red');
  
  // API data states
  const [channelMetrics, setChannelMetrics] = useState<any>(null);
  const [viewsOverTimeData, setViewsOverTimeData] = useState<any[]>([]);
  const [topPosts, setTopPosts] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [contentTypePerformance, setContentTypePerformance] = useState<any[]>([]);
  const [strategies, setStrategies] = useState<any[]>([]);
  const [growthScore, setGrowthScore] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [compareChannelInputs, setCompareChannelInputs] = useState(['', '', '']);
  const [compareResult, setCompareResult] = useState<any>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [strategyQuestion, setStrategyQuestion] = useState('');
  const [strategyChatLoading, setStrategyChatLoading] = useState(false);
  const [strategyChatError, setStrategyChatError] = useState<string | null>(null);
  const [strategySuggestions, setStrategySuggestions] = useState<string[]>([]);
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const strategyChatScrollRef = useRef<HTMLDivElement | null>(null);

  const openStrategyDetail = (strategy: any) => {
    setSelectedStrategy(strategy);
  };

  const COLORS = theme === 'red' 
    ? ['#ff3333', '#ff6666', '#dd2222', '#00ff88', '#ffaa00']
    : ['#808080', '#a0a0a0', '#606060', '#00ff88', '#ffaa00'];

  const primaryColor = theme === 'red' ? '#ff3333' : '#808080';

  // Fetch channel metrics from backend
  const fetchChannelAnalysis = async () => {
    if (!channelLink.trim()) {
      setError('Please enter a channel URL or username');
      return;
    }
    
    setLoading(true);
    setError(null);
    setNotice(null);
    
    try {
      const response = await fetch('/api/analyze-channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_url: channelLink,
        }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(errorPayload?.error || 'Failed to fetch channel analysis');
      }
      
      const data = await response.json();

      setChannelInfo(data.channel ? { id: data.channel.id, username: data.channel.username } : null);
      setChannelMetrics(data.metrics);
      setViewsOverTimeData(data.views_over_time || []);
      setTopPosts(data.top_posts || []);
      setContentTypePerformance(data.content_type_performance || []);
      setStrategies(data.strategies || []);
      setGrowthScore(data.growth_score || 0);
      setChatMessages([]);
      setStrategySuggestions([]);
      setStrategyQuestion('');
      setStrategyChatError(null);
      setActiveTab('dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchCompareChannels = async () => {
    const channels = compareChannelInputs.map((value) => value.trim()).filter(Boolean);
    if (!channels.length) {
      setCompareError('Enter at least one channel to compare');
      return;
    }

    setCompareLoading(true);
    setCompareError(null);

    try {
      const response = await fetch('/api/compare-channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channels }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(errorPayload?.error || 'Failed to compare channels');
      }

      const data = await response.json();
      setCompareResult(data);
      setActiveTab('compare');
    } catch (err) {
      setCompareError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setCompareLoading(false);
    }
  };

  // Fetch leaderboard
  const fetchLeaderboard = async () => {
    setLeaderboardLoading(true);
    try {
      const response = await fetch('/api/leaderboard');
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(errorPayload?.error || 'Failed to fetch leaderboard');
      }
      const data = await response.json();
      setLeaderboard(data.leaderboard || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLeaderboardLoading(false);
    }
  };

  // Fetch leaderboard on mount
  useEffect(() => {
    fetchLeaderboard();
  }, []);

  useEffect(() => {
    if (strategyChatScrollRef.current) {
      strategyChatScrollRef.current.scrollTop = strategyChatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, strategyChatLoading]);

  const sendStrategyQuestion = async (questionOverride?: string) => {
    const question = (questionOverride || strategyQuestion).trim();
    if (!question) {
      setStrategyChatError('Please enter a question first');
      return;
    }
    if (!channelMetrics || !channelInfo) {
      setStrategyChatError('Analyze your channel first to get personalized strategy insights.');
      return;
    }

    setStrategyChatLoading(true);
    setStrategyChatError(null);
    const nextUserMessage = { role: 'user' as const, content: question };
    const nextMessages = [...chatMessages, nextUserMessage];
    setChatMessages(nextMessages);
    setStrategyQuestion('');

    try {
      const history = nextMessages.slice(-5).map((message) => ({
        role: message.role,
        content: message.content.slice(0, 500),
      }));

      const response = await fetch('/api/chat-strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_id: channelInfo.id,
          channel_url: channelInfo.username,
          user_question: question,
          history,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Failed to generate strategy answer');
      }

      const data = await response.json();
      setChatMessages((prev) => [...prev, { role: 'assistant', content: data.answer || 'No answer returned' }]);
      setStrategySuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
    } catch (err) {
      setStrategyChatError(err instanceof Error ? err.message : 'An error occurred');
      setChatMessages((prev) => [...prev, { role: 'assistant', content: 'Analyze your channel first to get personalized strategy insights.' }]);
    } finally {
      setStrategyChatLoading(false);
    }
  };

  return (
    <SidebarProvider>
      <div className="flex w-full min-h-screen bg-background overflow-hidden" data-theme={theme}>
        {/* Sidebar */}
        <Sidebar className="border-r border-border hidden lg:block">
          <SidebarHeader className="border-b border-border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded border-2 border-primary flex items-center justify-center text-primary font-mono font-bold text-sm">
                S
              </div>
              <h1 className="text-lg font-mono font-bold text-foreground">3:48</h1>
            </div>
            <p className="text-xs text-muted-foreground font-mono">TELEGRAM ANALYTICS</p>
            <button
              onClick={() => setTheme(theme === 'red' ? 'grey' : 'red')}
              className="w-full px-3 py-2 text-xs font-mono uppercase tracking-wide border border-primary bg-background hover:bg-primary/10 text-primary transition-colors rounded"
            >
              Theme: {theme === 'red' ? 'Red' : 'Grey'}
            </button>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              {[
                { id: 'dashboard', label: 'DASHBOARD', icon: BarChart3 },
                { id: 'compare', label: 'COMPARE', icon: TrendingUp },
                { id: 'leaderboard', label: 'LEADERBOARD', icon: Trophy },
                { id: 'strategy', label: 'STRATEGY', icon: Sparkles },
              ].map(({ id, label, icon: Icon }) => (
                <SidebarMenuItem key={id}>
                  <SidebarMenuButton
                    onClick={() => setActiveTab(id)}
                    isActive={activeTab === id}
                    className="cursor-pointer font-mono text-xs uppercase tracking-wider"
                  >
                    <Icon className="w-4 h-4" />
                    <span>{label}</span>
                  </SidebarMenuButton>
                  {id === 'strategy' && (
                    <a
                      href="https://t.me/savvy_society"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 ml-9 block text-[10px] font-mono uppercase tracking-wider text-primary/80 hover:text-primary transition-colors"
                    >
                      built by savvy
                    </a>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>
        </Sidebar>

        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          {/* Mobile Header */}
          <div className="lg:hidden border-b border-border bg-background sticky top-0 z-10 p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded border-2 border-primary flex items-center justify-center text-primary font-mono font-bold text-xs">
                S
              </div>
              <h1 className="text-base font-mono font-bold text-foreground">3:48</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTheme(theme === 'red' ? 'grey' : 'red')}
                className="px-3 py-1 text-xs font-mono uppercase tracking-wide border border-primary bg-background hover:bg-primary/10 text-primary transition-colors rounded"
              >
                {theme === 'red' ? 'Grey' : 'Red'}
              </button>
              <SidebarTrigger />
            </div>
          </div>

          <div className="p-4 sm:p-6 max-w-7xl mx-auto w-full">
            {/* Dashboard Tab */}
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                {/* Header with corner brackets */}
                <div className="space-y-4 relative">
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary opacity-50"></div>
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary opacity-50"></div>
                  <div className="space-y-2">
                    <h2 className="text-2xl sm:text-4xl font-mono font-bold text-foreground">
                      <span className="text-primary">CHANNEL</span> ANALYSIS
                    </h2>
                    <p className="text-sm text-muted-foreground font-mono">Get actionable insights about your Telegram channel performance</p>
                  </div>
                </div>

                {/* Input Section with interactive state */}
                <Card className="border border-border bg-card/50 hover:bg-card/80 transition-colors">
                  <CardHeader>
                    <CardTitle className="text-sm font-mono uppercase tracking-wide flex items-center gap-2">
                      <span className="text-primary">[]</span> ANALYZE CHANNEL
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {error && (
                      <div className="p-3 bg-destructive/10 border border-destructive/50 rounded text-sm text-destructive font-mono">
                        {error}
                      </div>
                    )}
                    {notice && (
                      <div className="p-3 bg-primary/10 border border-primary/40 rounded text-sm text-primary font-mono">
                        {notice}
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="flex-1">
                        <Input
                          placeholder="Paste a Telegram link or enter @username..."
                          value={channelLink}
                          onChange={(e) => setChannelLink(e.target.value)}
                          className="w-full text-sm font-mono bg-background border-border text-foreground placeholder:text-muted-foreground"
                          disabled={loading}
                        />
                        <p className="mt-2 sm:mt-3 text-xs text-muted-foreground font-mono uppercase tracking-wide">
                          Full channel history analysis
                        </p>
                      </div>
                      <Button 
                        className="w-full sm:w-auto font-mono uppercase tracking-wide text-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50"
                        onClick={fetchChannelAnalysis}
                        disabled={loading}
                      >
                        {loading ? 'ANALYZING...' : 'ANALYZE'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Time Filter and Key Metrics */}
                {channelMetrics ? (
                <div className="space-y-4">
                  <h3 className="text-sm font-mono uppercase tracking-wider font-semibold">Key Metrics (Lifetime)</h3>

                  {/* Metrics Grid - Interactive */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                      { label: 'TOTAL VIEWS', value: channelMetrics.total_views?.toLocaleString() || '0', icon: TrendingUp, color: 'text-primary' },
                      { label: 'AVG VIEWS/POST', value: Math.round(channelMetrics.avg_views_per_post || 0).toLocaleString(), icon: BarChart3, color: 'text-primary' },
                      { label: 'POSTS', value: channelMetrics.number_of_posts || '0', icon: Calendar, color: 'text-primary' },
                      { label: 'ENGAGEMENT', value: (channelMetrics.engagement_rate || 0).toFixed(1) + '%', icon: Zap, color: 'text-primary' },
                    ].map((metric, idx) => {
                      const Icon = metric.icon;
                      return (
                        <Card 
                          key={idx}
                          className="border border-border bg-card/50 hover:bg-card hover:border-primary/50 cursor-pointer transition-all"
                          onMouseEnter={() => setHoveredCard(`metric-${idx}`)}
                          onMouseLeave={() => setHoveredCard(null)}
                        >
                          <CardContent className="pt-4 pb-4">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">{metric.label}</p>
                                <p className="text-2xl font-mono font-bold text-foreground">{metric.value}</p>
                              </div>
                              <Icon className={`w-5 h-5 ${metric.color} opacity-60 transition-all ${hoveredCard === `metric-${idx}` ? 'opacity-100 scale-110' : ''}`} />
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
                ) : (
                <div className="text-center py-12 space-y-3">
                  <p className="text-muted-foreground font-mono text-sm">No channel data loaded</p>
                  <p className="text-xs text-muted-foreground font-mono">Analyze a channel above to view metrics and insights</p>
                </div>
                )}

                {channelMetrics && (
                <>
                {/* Additional Insights Grid with corner brackets */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { label: 'BEST POSTING DAY', value: channelMetrics.best_posting_day || 'N/A', desc: 'Higher engagement window' },
                    { label: 'PEAK TIME', value: channelMetrics.best_posting_hour || 'N/A', desc: 'Engagement peak hour' },
                    { label: 'TOP CONTENT', value: channelMetrics.top_content_type || 'N/A', desc: 'Most performing type' },
                  ].map((item, idx) => (
                    <Card key={idx} className="border border-border bg-card/50 hover:bg-card/80 transition-colors relative overflow-hidden group">
                      <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-primary opacity-0 group-hover:opacity-100 transition-all"></div>
                      <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-primary opacity-0 group-hover:opacity-100 transition-all"></div>
                      <CardContent className="pt-4 pb-4">
                        <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">{item.label}</p>
                        <p className="text-xl font-mono font-bold text-foreground mt-2">{item.value}</p>
                        <p className="text-xs text-primary font-mono mt-1">{item.desc}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Charts Section */}
                {viewsOverTimeData.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card className="border border-border bg-card/50">
                    <CardHeader>
                      <CardTitle className="text-xs font-mono uppercase tracking-wide flex items-center gap-2">
                        <span className="text-primary">[]</span> VIEWS OVER TIME
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={viewsOverTimeData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                          <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#808080' }} />
                          <YAxis tick={{ fontSize: 12, fill: '#808080' }} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a' }}
                            labelStyle={{ color: '#ffffff' }}
                          />
                          <Line type="monotone" dataKey="views" stroke={primaryColor} strokeWidth={2} dot={{ fill: primaryColor }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card className="border border-border bg-card/50">
                    <CardHeader>
                      <CardTitle className="text-xs font-mono uppercase tracking-wide flex items-center gap-2">
                        <span className="text-primary">[]</span> CONTENT DISTRIBUTION
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex justify-center">
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie
                            data={contentTypePerformance.length > 0 ? contentTypePerformance : [
                              { name: 'NEWS', value: 35 },
                              { name: 'TUTORIAL', value: 25 },
                              { name: 'COMMUNITY', value: 20 },
                              { name: 'NEWSLETTER', value: 15 },
                              { name: 'LIFESTYLE', value: 5 },
                            ]}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, value }) => `${name} ${value}%`}
                            outerRadius={80}
                            fill={primaryColor}
                            dataKey="value"
                          >
                            {COLORS.map((color, index) => (
                              <Cell key={`cell-${index}`} fill={color} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>

                )}
                
                {/* Top Posts with Interactive Badges */}
                {topPosts.length > 0 && (
                <Card className="border border-border bg-card/50">
                  <CardHeader>
                    <CardTitle className="text-xs font-mono uppercase tracking-wide flex items-center gap-2">
                      <span className="text-primary">[]</span> TOP 5 PERFORMING POSTS
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-3 px-2 font-mono font-bold text-xs text-muted-foreground uppercase tracking-wider">Title</th>
                            <th className="text-right py-3 px-2 font-mono font-bold text-xs text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Views</th>
                            <th className="text-right py-3 px-2 font-mono font-bold text-xs text-muted-foreground uppercase tracking-wider">Engagement</th>
                          </tr>
                        </thead>
                        <tbody>
                          {topPosts.map((post: any) => (
                            <tr 
                              key={post.id} 
                              className="border-b border-border hover:bg-card/30 transition-colors cursor-pointer"
                              onMouseEnter={() => setHoveredCard(`post-${post.id}`)}
                              onMouseLeave={() => setHoveredCard(null)}
                            >
                              <td className="py-3 px-2">
                                <div>
                                  <p className="font-mono text-sm text-foreground">{post.title}</p>
                                  <Badge 
                                    variant="outline" 
                                    className="text-xs mt-1 font-mono uppercase tracking-wider border-border text-muted-foreground"
                                  >
                                    {post.type}
                                  </Badge>
                                </div>
                              </td>
                              <td className="text-right py-3 px-2 hidden sm:table-cell text-sm font-mono text-foreground">{post.views?.toLocaleString() || '0'}</td>
                              <td className={`text-right py-3 px-2 font-mono font-bold text-sm transition-colors ${hoveredCard === `post-${post.id}` ? 'text-primary' : 'text-muted-foreground'}`}>
                                {(post.engagement || 0).toFixed(1)}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
                )}
                </>
                )}

                {/* Features / About Section */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    {
                      icon: BarChart3,
                      title: 'DEEP ANALYTICS',
                      desc: 'Unpack every metric that matters — views, reach, engagement rate, posting frequency, and content-type performance — all in one unified dashboard.',
                      tag: 'CORE',
                    },
                    {
                      icon: Sparkles,
                      title: 'AI GROWTH STRATEGIES',
                      desc: 'After each analysis, 3:48 generates tailored, actionable strategies based on your channel\'s actual data — not generic advice.',
                      tag: 'INTELLIGENCE',
                    },
                    {
                      icon: Trophy,
                      title: 'LIVE LEADERBOARD',
                      desc: 'See how the top 10 Telegram channels are performing right now. Benchmark your channel against the best in the ecosystem.',
                      tag: 'RANKINGS',
                    },
                    {
                      icon: TrendingUp,
                      title: 'CHANNEL COMPARISON',
                      desc: 'Place multiple channels side by side and visually compare views, engagement, and posting cadence across full history.',
                      tag: 'COMPARE',
                    },
                    {
                      icon: Zap,
                      title: 'PEAK TIMING INSIGHTS',
                      desc: 'Know exactly which day and hour your audience is most active, so every post lands at maximum impact.',
                      tag: 'TIMING',
                    },
                    {
                      icon: Calendar,
                      title: 'WHY 3:48?',
                      desc: 'Built for Telegram creators who take their craft seriously. 3:48 cuts through noise — giving you the signal you need to grow with precision and speed.',
                      tag: 'MISSION',
                    },
                  ].map(({ icon: Icon, title, desc, tag }, idx) => (
                    <div
                      key={idx}
                      className="group relative border border-border bg-card/40 hover:bg-card/80 hover:border-primary/40 rounded-lg p-4 transition-all duration-200 overflow-hidden cursor-default"
                    >
                      {/* corner accents */}
                      <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="flex items-start gap-3 mb-3">
                        <div className="mt-0.5 p-1.5 border border-border group-hover:border-primary/50 rounded transition-colors">
                          <Icon className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-mono font-bold text-xs text-foreground uppercase tracking-wider">{title}</p>
                          <span className="inline-block mt-1 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider border border-primary/30 text-primary/70 rounded">{tag}</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono leading-relaxed">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Compare Tab */}
            {activeTab === 'compare' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <h2 className="text-2xl sm:text-4xl font-mono font-bold text-foreground">
                    <span className="text-primary">COMPARE</span> CHANNELS
                  </h2>
                  <p className="text-sm text-muted-foreground font-mono">Compare up to 3 channels using stored lifetime metrics</p>
                </div>

                <Card className="border border-border bg-card/50">
                  <CardHeader>
                    <CardTitle className="text-xs font-mono uppercase tracking-wide flex items-center gap-2">
                      <span className="text-primary">[]</span> COMPARE CHANNELS
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      {compareChannelInputs.map((value, index) => (
                        <Input
                          key={index}
                          value={value}
                          onChange={(event) => {
                            const nextInputs = [...compareChannelInputs];
                            nextInputs[index] = event.target.value;
                            setCompareChannelInputs(nextInputs);
                          }}
                          placeholder={`Channel ${index + 1} URL or @username`}
                          className="w-full text-sm font-mono bg-background border-border text-foreground placeholder:text-muted-foreground"
                        />
                      ))}
                    </div>
                    {compareError && (
                      <div className="p-3 bg-destructive/10 border border-destructive/50 rounded text-sm text-destructive font-mono">
                        {compareError}
                      </div>
                    )}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-muted-foreground font-mono uppercase tracking-wide">
                        Full history is collected automatically when a channel is not yet stored.
                      </p>
                      <Button
                        className="w-full sm:w-auto font-mono uppercase tracking-wide text-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50"
                        onClick={fetchCompareChannels}
                        disabled={compareLoading}
                      >
                        {compareLoading ? 'COMPARING...' : 'COMPARE'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {compareResult?.comparisons?.length ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                      {compareResult.comparisons.map((comparison: any) => (
                        <Card key={comparison.channelId} className="border border-border bg-card/50 hover:border-primary/50 transition-colors">
                          <CardHeader>
                            <CardTitle className="text-sm font-mono uppercase tracking-wider text-foreground">{comparison.channelName}</CardTitle>
                            <CardDescription className="font-mono text-xs text-muted-foreground">@{comparison.username}</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div>
                              <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Total Views (Lifetime)</p>
                              <p className="text-3xl font-mono font-bold text-foreground mt-1">{comparison.totalViews.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Engagement Rate</p>
                              <p className="text-2xl font-mono font-bold text-primary mt-1">{comparison.engagementRate.toFixed(1)}%</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Posting Frequency</p>
                              <p className="text-lg font-mono font-semibold text-foreground mt-1">{comparison.postingFrequency.toFixed(2)} posts/day</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Top Content</p>
                              <p className="text-sm font-mono font-semibold text-foreground mt-1 uppercase">{comparison.topContentType}</p>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    <Card className="border border-border bg-card/50">
                      <CardHeader>
                        <CardTitle className="text-xs font-mono uppercase tracking-wide flex items-center gap-2">
                          <span className="text-primary">[]</span> COMPARISON MATRIX
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="px-2 py-3 text-left font-mono text-xs uppercase tracking-wider text-muted-foreground">Metric</th>
                              {compareResult.comparisons.map((comparison: any) => (
                                <th key={comparison.channelId} className="px-2 py-3 text-right font-mono text-xs uppercase tracking-wider text-muted-foreground">{comparison.channelName}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {[
                              { label: 'TOTAL VIEWS', getter: (comparison: any) => comparison.totalViews.toLocaleString() },
                              { label: 'ENGAGEMENT', getter: (comparison: any) => `${comparison.engagementRate.toFixed(1)}%` },
                              { label: 'FREQUENCY', getter: (comparison: any) => `${comparison.postingFrequency.toFixed(2)} / day` },
                              { label: 'TOP CONTENT', getter: (comparison: any) => String(comparison.topContentType).toUpperCase() },
                            ].map((row) => (
                              <tr key={row.label} className="border-b border-border/60 last:border-0">
                                <td className="px-2 py-3 font-mono text-xs uppercase tracking-wider text-foreground">{row.label}</td>
                                {compareResult.comparisons.map((comparison: any) => (
                                  <td key={`${row.label}-${comparison.channelId}`} className="px-2 py-3 text-right font-mono text-sm text-foreground">
                                    {row.getter(comparison)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Badge variant="outline" className="font-mono uppercase tracking-wider border-border text-foreground">
                            Highest views: {compareResult.topPerformers?.total_views || 'N/A'}
                          </Badge>
                          <Badge variant="outline" className="font-mono uppercase tracking-wider border-border text-foreground">
                            Highest engagement: {compareResult.topPerformers?.engagement_rate || 'N/A'}
                          </Badge>
                          <Badge variant="outline" className="font-mono uppercase tracking-wider border-border text-foreground">
                            Highest frequency: {compareResult.topPerformers?.posting_frequency || 'N/A'}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <Card className="border border-border bg-card/50">
                    <CardContent className="py-12 text-center space-y-3">
                      <p className="text-muted-foreground font-mono text-sm">No comparison data loaded</p>
                      <p className="text-xs text-muted-foreground font-mono">Enter channels above to generate a real comparison from stored analytics</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Leaderboard Tab */}
            {activeTab === 'leaderboard' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <h2 className="text-2xl sm:text-4xl font-mono font-bold text-foreground">
                    <span className="text-primary">TOP 10</span> CHANNELS
                  </h2>
                  <p className="text-sm text-muted-foreground font-mono">Ranked by lifetime engagement rate, then lifetime views</p>
                </div>

                {leaderboardLoading ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground font-mono text-sm">Loading leaderboard...</p>
                  </div>
                ) : leaderboard.length > 0 ? (
                <div className="grid grid-cols-1 gap-3">
                  {leaderboard.map((channel: any) => (
                    <Card 
                      key={channel.rank} 
                      className="border border-border bg-card/50 hover:bg-card/80 transition-all cursor-pointer"
                      onMouseEnter={() => setHoveredCard(`rank-${channel.rank}`)}
                      onMouseLeave={() => setHoveredCard(null)}
                    >
                      <CardContent className="pt-4 pb-4">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          <div className="flex items-start gap-4 w-full sm:flex-1">
                            <div className="flex-shrink-0">
                              {channel.rank <= 3 ? (
                                <Badge 
                                  className={`text-black font-mono uppercase tracking-wider text-xs ${
                                    channel.rank === 1 ? 'bg-yellow-400' :
                                    channel.rank === 2 ? 'bg-gray-300' :
                                    'bg-orange-400'
                                  }`}
                                >
                                  #{channel.rank}
                                </Badge>
                              ) : (
                                <Badge 
                                  variant="outline" 
                                  className="font-mono uppercase tracking-wider text-xs border-border text-foreground"
                                >
                                  #{channel.rank}
                                </Badge>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-mono font-bold text-sm text-foreground">{channel.name}</p>
                              <Badge 
                                variant="secondary" 
                                className="text-xs mt-1 font-mono uppercase tracking-wider border-border bg-card text-muted-foreground"
                              >
                                {channel.category}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex gap-6 sm:gap-8 text-right">
                            <div>
                              <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Engagement</p>
                              <p className={`font-mono font-bold text-sm mt-1 transition-colors ${hoveredCard === `rank-${channel.rank}` ? 'text-primary' : 'text-foreground'}`}>
                                {(channel.engagement_rate || 0).toFixed(1)}%
                              </p>
                            </div>
                            <div className="hidden sm:block">
                              <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Views</p>
                              <p className="font-mono font-bold text-sm mt-1">{(channel.total_views_30d || 0).toLocaleString()}</p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground font-mono text-sm">No leaderboard data available</p>
                </div>
                )}
              </div>
            )}

            {/* Strategy Tab */}
            {activeTab === 'strategy' && (
              <div className="space-y-6">
                {channelMetrics ? (
                <>
                <div className="border-b border-border pb-4">
                  <div className="flex items-center gap-3">
                    <div className="relative w-4 h-4 flex-shrink-0 border border-primary border-r-0 border-b-0" />
                    <h2 className="text-sm font-mono font-bold text-foreground uppercase tracking-widest">
                      STRATEGY
                    </h2>
                    <div className="flex-1 h-px bg-border"></div>
                  </div>
                </div>

                <Card className="border border-border bg-card/50 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-primary opacity-30"></div>
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-primary opacity-30"></div>
                  <CardHeader>
                    <CardTitle className="text-sm font-mono uppercase tracking-wide flex items-center gap-2">
                      <Gauge className="w-4 h-4 text-primary" />
                      GROWTH SCORE
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between gap-6">
                      <div>
                        <p className="text-5xl font-mono font-bold text-primary">{growthScore}</p>
                        <p className="text-xs text-muted-foreground font-mono mt-1">/ 100</p>
                      </div>
                      <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-primary/20 flex items-center justify-center relative flex-shrink-0">
                        <div className="absolute inset-2 rounded-full border border-primary/60 opacity-60" />
                        <div className="absolute inset-6 rounded-full border border-primary/30 opacity-40" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-border bg-card/50">
                  <CardHeader>
                    <CardTitle className="text-xs font-mono uppercase tracking-wide flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      STRATEGY CHATBOT
                    </CardTitle>
                    <CardDescription className="font-mono text-xs">
                      Ask data-driven growth questions powered by your channel analytics.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {strategyChatError && (
                      <div className="p-3 bg-destructive/10 border border-destructive/50 rounded text-sm text-destructive font-mono">
                        {strategyChatError}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {['Best posting time?', 'Improve engagement', 'Content ideas'].map((prompt) => (
                        <Button
                          key={prompt}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="font-mono text-[11px] uppercase tracking-wider"
                          onClick={() => sendStrategyQuestion(prompt)}
                          disabled={strategyChatLoading}
                        >
                          {prompt}
                        </Button>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="font-mono text-[11px] uppercase tracking-wider border-primary/50 text-primary"
                        onClick={() => sendStrategyQuestion('Generate a weekly posting plan for the next 7 days')}
                        disabled={strategyChatLoading}
                      >
                        Generate Weekly Plan
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      {[
                        { label: 'TOTAL VIEWS', value: channelMetrics.total_views?.toLocaleString() || '0', question: 'Explain what my total views trend means and what I should do next.' },
                        { label: 'AVG VIEWS/POST', value: Math.round(channelMetrics.avg_views_per_post || 0).toLocaleString(), question: 'Explain my average views per post and how to improve it.' },
                        { label: 'ENGAGEMENT', value: `${(channelMetrics.engagement_rate || 0).toFixed(1)}%`, question: 'Explain my engagement rate and how to increase it.' },
                        { label: 'POSTING FREQUENCY', value: `${(channelMetrics.posting_frequency || 0).toFixed(2)}/day`, question: 'Explain my posting frequency and whether I should adjust it.' },
                      ].map((metric) => (
                        <button
                          key={metric.label}
                          type="button"
                          onClick={() => sendStrategyQuestion(metric.question)}
                          disabled={strategyChatLoading}
                          className="text-left rounded border border-border bg-background/50 p-3 hover:border-primary/50 transition-colors disabled:opacity-60"
                        >
                          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{metric.label}</p>
                          <p className="text-sm font-mono font-bold text-foreground mt-1">{metric.value}</p>
                          <p className="text-[10px] font-mono text-primary mt-2">Explain this insight</p>
                        </button>
                      ))}
                    </div>

                    <div ref={strategyChatScrollRef} className="max-h-72 overflow-y-auto border border-border rounded bg-background/60 p-3 space-y-3">
                      {chatMessages.length === 0 && (
                        <p className="text-xs font-mono text-muted-foreground">
                          Ask a question to get personalized strategy advice from your analytics.
                        </p>
                      )}
                      {chatMessages.map((message, index) => (
                        <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] rounded px-3 py-2 border ${message.role === 'user' ? 'bg-primary/20 border-primary/40' : 'bg-card border-border'}`}>
                            <div className="flex items-center gap-2 mb-1">
                              {message.role === 'user' ? <User className="w-3 h-3 text-primary" /> : <Bot className="w-3 h-3 text-primary" />}
                              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{message.role === 'user' ? 'You' : 'AI Strategist'}</span>
                            </div>
                            <p className="text-xs sm:text-sm font-mono text-foreground whitespace-pre-wrap">{message.content}</p>
                          </div>
                        </div>
                      ))}
                      {strategyChatLoading && (
                        <div className="flex justify-start">
                          <div className="rounded px-3 py-2 border border-border bg-card">
                            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Thinking with your analytics...
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {strategySuggestions.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Follow-up suggestions</p>
                        <div className="flex flex-wrap gap-2">
                          {strategySuggestions.map((suggestion, index) => (
                            <Button
                              key={`${suggestion}-${index}`}
                              type="button"
                              variant="outline"
                              size="sm"
                              className="font-mono text-[10px] uppercase tracking-wider"
                              onClick={() => sendStrategyQuestion(suggestion)}
                              disabled={strategyChatLoading}
                            >
                              {suggestion}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Input
                        value={strategyQuestion}
                        onChange={(event) => setStrategyQuestion(event.target.value)}
                        placeholder="Ask about growth strategy using your data..."
                        className="font-mono text-sm"
                        maxLength={500}
                        disabled={strategyChatLoading}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            sendStrategyQuestion();
                          }
                        }}
                      />
                      <Button
                        type="button"
                        className="font-mono uppercase tracking-wider text-xs"
                        onClick={() => sendStrategyQuestion()}
                        disabled={strategyChatLoading || !strategyQuestion.trim()}
                      >
                        Ask
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {strategies.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {strategies.map((strategy: any, idx: number) => (
                    <Card 
                      key={idx} 
                      className="border border-border bg-card/50 hover:border-primary/50 transition-all cursor-pointer group relative overflow-hidden focus-within:border-primary/50"
                      role="button"
                      tabIndex={0}
                      onClick={() => openStrategyDetail(strategy)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          openStrategyDetail(strategy);
                        }
                      }}
                    >
                      <div className="absolute top-0 left-0 w-1 h-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                      <CardContent className="pt-4 pb-4 pl-4">
                        <div className="flex h-full flex-col justify-between gap-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <div className="relative w-5 h-5 flex items-center justify-center rounded-sm border border-primary/60">
                                <div className="w-1 h-1 bg-primary rounded-full" />
                              </div>
                              <div className="space-y-1">
                                <p className="font-mono font-bold text-sm text-foreground uppercase tracking-wider">{strategy.title}</p>
                                <p className="text-[10px] font-mono uppercase tracking-wider text-primary/80">Confidence {(strategy.confidence * 100).toFixed(0)}%</p>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground font-mono leading-relaxed">{strategy.description}</p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="w-full justify-between px-0 text-primary hover:text-primary hover:bg-transparent opacity-100 transition-opacity"
                            onClick={(event) => {
                              event.stopPropagation();
                              openStrategyDetail(strategy);
                            }}
                          >
                            <span className="text-xs font-mono uppercase tracking-wider">Learn more</span>
                            <ArrowRight className="ml-1 w-3 h-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground font-mono text-sm">No strategies generated yet</p>
                </div>
                )}
                </>
                ) : (
                <div className="text-center py-12 space-y-3">
                  <p className="text-muted-foreground font-mono text-sm">No strategy data available</p>
                  <p className="text-xs text-muted-foreground font-mono">Analyze a channel to generate personalized growth strategies</p>
                </div>
                )}
              </div>
            )}

            <Dialog open={Boolean(selectedStrategy)} onOpenChange={(open) => {
              if (!open) {
                setSelectedStrategy(null);
              }
            }}>
              <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle className="font-mono uppercase tracking-wide text-foreground">
                    {selectedStrategy?.title || 'Strategy detail'}
                  </DialogTitle>
                  <DialogDescription className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                    Full history analysis from stored channel posts
                  </DialogDescription>
                </DialogHeader>
                {selectedStrategy && (
                  <div className="space-y-4 pt-2">
                    <p className="text-sm font-mono text-foreground leading-relaxed">
                      {selectedStrategy.description}
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <Card className="border border-border bg-card/60">
                        <CardContent className="pt-4">
                          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Confidence</p>
                          <p className="text-lg font-mono font-bold text-primary mt-1">{(selectedStrategy.confidence * 100).toFixed(0)}%</p>
                        </CardContent>
                      </Card>
                      <Card className="border border-border bg-card/60">
                        <CardContent className="pt-4">
                          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Signal</p>
                          <p className="text-xs font-mono font-bold text-foreground mt-1 break-all">{selectedStrategy.signal}</p>
                        </CardContent>
                      </Card>
                      <Card className="border border-border bg-card/60">
                        <CardContent className="pt-4">
                          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Action</p>
                          <p className="text-xs font-mono font-bold text-foreground mt-1">Apply this across the full channel history.</p>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
