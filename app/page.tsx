'use client';

import { useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { TrendingUp, BarChart3, Users, Zap, Trophy, Calendar, Sparkles, Share2, ArrowRight, Gauge } from 'lucide-react';

// Mock data
const viewsOverTimeData = [
  { date: 'Mon', views: 2400 },
  { date: 'Tue', views: 1398 },
  { date: 'Wed', views: 9800 },
  { date: 'Thu', views: 3908 },
  { date: 'Fri', views: 4800 },
  { date: 'Sat', views: 3800 },
  { date: 'Sun', views: 4300 },
];

const topPosts = [
  { id: 1, title: 'Breaking: New Feature Release', views: 15420, engagement: 8.2, type: 'NEWS' },
  { id: 2, title: 'Tutorial: Getting Started Guide', views: 12890, engagement: 9.1, type: 'TUTORIAL' },
  { id: 3, title: 'Community Spotlight', views: 10450, engagement: 7.8, type: 'COMMUNITY' },
  { id: 4, title: 'Weekly Newsletter #42', views: 9320, engagement: 6.5, type: 'NEWSLETTER' },
  { id: 5, title: 'Behind the Scenes', views: 8950, engagement: 9.3, type: 'LIFESTYLE' },
];

const leaderboard = [
  { rank: 1, name: 'Tech Daily', engagement: 12.5, views: 285000, category: 'TECHNOLOGY' },
  { rank: 2, name: 'Growth Hacker', engagement: 11.8, views: 245000, category: 'BUSINESS' },
  { rank: 3, name: 'Dev Tips', engagement: 11.2, views: 215000, category: 'TECHNOLOGY' },
  { rank: 4, name: 'AI Insights', engagement: 10.5, views: 185000, category: 'AI' },
  { rank: 5, name: 'Startup Stories', engagement: 9.8, views: 155000, category: 'BUSINESS' },
];

export default function SavvyScope() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [timeFilter, setTimeFilter] = useState('30');
  const [channelLink, setChannelLink] = useState('');
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [theme, setTheme] = useState<'red' | 'grey'>('red');

  const growthScore = 78;

  const COLORS = theme === 'red' 
    ? ['#ff3333', '#ff6666', '#dd2222', '#00ff88', '#ffaa00']
    : ['#808080', '#a0a0a0', '#606060', '#00ff88', '#ffaa00'];

  const primaryColor = theme === 'red' ? '#ff3333' : '#808080';

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
              <h1 className="text-lg font-mono font-bold text-foreground">SavvyScope</h1>
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
              <h1 className="text-base font-mono font-bold text-foreground">SavvyScope</h1>
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
                      <span className="text-primary">⬜</span> ANALYZE CHANNEL
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Input
                        placeholder="Paste Telegram channel link..."
                        value={channelLink}
                        onChange={(e) => setChannelLink(e.target.value)}
                        className="flex-1 text-sm font-mono bg-background border-border text-foreground placeholder:text-muted-foreground"
                      />
                      <Button 
                        className="w-full sm:w-auto font-mono uppercase tracking-wide text-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
                        onClick={() => setChannelLink('')}
                      >
                        ANALYZE
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Time Filter and Key Metrics */}
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <h3 className="text-sm font-mono uppercase tracking-wider font-semibold">Key Metrics</h3>
                    <Select value={timeFilter} onValueChange={setTimeFilter}>
                      <SelectTrigger className="w-full sm:w-40 text-xs font-mono uppercase tracking-wide bg-card border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        <SelectItem value="30" className="font-mono text-xs">Last 30 days</SelectItem>
                        <SelectItem value="60" className="font-mono text-xs">Last 60 days</SelectItem>
                        <SelectItem value="90" className="font-mono text-xs">Last 90 days</SelectItem>
                        <SelectItem value="all" className="font-mono text-xs">Overall</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Metrics Grid - Interactive */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                      { label: 'TOTAL VIEWS', value: '142.5K', icon: TrendingUp, color: 'text-primary' },
                      { label: 'AVG VIEWS/POST', value: '8.2K', icon: BarChart3, color: 'text-primary' },
                      { label: 'POSTS', value: '47', icon: Calendar, color: 'text-primary' },
                      { label: 'ENGAGEMENT', value: '8.7%', icon: Zap, color: 'text-primary' },
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

                {/* Additional Insights Grid with corner brackets */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { label: 'BEST POSTING DAY', value: 'WEDNESDAY', desc: '↑ 34% more views' },
                    { label: 'PEAK TIME', value: '10:00 AM', desc: 'Engagement peak hour' },
                    { label: 'TOP CONTENT', value: 'TUTORIALS', desc: '42% of top posts' },
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
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card className="border border-border bg-card/50">
                    <CardHeader>
                      <CardTitle className="text-xs font-mono uppercase tracking-wide flex items-center gap-2">
                        <span className="text-primary">⬜</span> VIEWS OVER TIME
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
                        <span className="text-primary">⬜</span> CONTENT DISTRIBUTION
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex justify-center">
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie
                            data={[
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

                {/* Top Posts with Interactive Badges */}
                <Card className="border border-border bg-card/50">
                  <CardHeader>
                    <CardTitle className="text-xs font-mono uppercase tracking-wide flex items-center gap-2">
                      <span className="text-primary">⬜</span> TOP 5 PERFORMING POSTS
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
                          {topPosts.map((post) => (
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
                              <td className="text-right py-3 px-2 hidden sm:table-cell text-sm font-mono text-foreground">{post.views.toLocaleString()}</td>
                              <td className={`text-right py-3 px-2 font-mono font-bold text-sm transition-colors ${hoveredCard === `post-${post.id}` ? 'text-primary' : 'text-muted-foreground'}`}>
                                {post.engagement}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Compare Tab */}
            {activeTab === 'compare' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <h2 className="text-2xl sm:text-4xl font-mono font-bold text-foreground">
                    <span className="text-primary">COMPARE</span> CHANNELS
                  </h2>
                  <p className="text-sm text-muted-foreground font-mono">Compare up to 3 channels side-by-side</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {['TECH DAILY', 'GROWTH HACKER', 'DEV TIPS'].map((channel, idx) => (
                    <Card key={idx} className="border border-border bg-card/50 hover:border-primary/50 transition-colors">
                      <CardHeader>
                        <CardTitle className="text-sm font-mono uppercase tracking-wider text-foreground">{channel}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Total Views (30d)</p>
                          <p className="text-3xl font-mono font-bold text-foreground mt-1">285K</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Engagement Rate</p>
                          <p className="text-2xl font-mono font-bold text-primary mt-1">12.5%</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Posting Frequency</p>
                          <p className="text-lg font-mono font-semibold text-foreground mt-1">3.2 posts/day</p>
                        </div>
                        <Button 
                          variant="outline" 
                          className="w-full text-xs font-mono uppercase tracking-wider border-border text-foreground hover:border-primary hover:text-primary transition-colors"
                          size="sm"
                        >
                          VIEW DETAILS
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Card className="border border-border bg-card/50">
                  <CardHeader>
                    <CardTitle className="text-xs font-mono uppercase tracking-wide flex items-center gap-2">
                      <span className="text-primary">⬜</span> COMPARISON MATRIX
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={[
                          { metric: 'VIEWS', 'Tech Daily': 285, 'Growth Hacker': 245, 'Dev Tips': 215 },
                          { metric: 'ENGAGEMENT', 'Tech Daily': 12.5, 'Growth Hacker': 11.8, 'Dev Tips': 11.2 },
                          { metric: 'POSTS', 'Tech Daily': 95, 'Growth Hacker': 87, 'Dev Tips': 82 },
                        ]}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                        <XAxis dataKey="metric" tick={{ fontSize: 12, fill: '#808080' }} />
                        <YAxis tick={{ fontSize: 12, fill: '#808080' }} />
                        <Tooltip contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a' }} />
                        <Legend wrapperStyle={{ color: '#808080' }} />
                        <Bar dataKey="Tech Daily" fill={COLORS[0]} />
                        <Bar dataKey="Growth Hacker" fill={COLORS[1]} />
                        <Bar dataKey="Dev Tips" fill={COLORS[2]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Leaderboard Tab */}
            {activeTab === 'leaderboard' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <h2 className="text-2xl sm:text-4xl font-mono font-bold text-foreground">
                    <span className="text-primary">TOP 10</span> CHANNELS
                  </h2>
                  <p className="text-sm text-muted-foreground font-mono">Ranked by engagement rate (Last 30 days)</p>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {leaderboard.map((channel) => (
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
                                {channel.engagement}%
                              </p>
                            </div>
                            <div className="hidden sm:block">
                              <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Views</p>
                              <p className="font-mono font-bold text-sm mt-1">{(channel.views / 1000).toFixed(0)}K</p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Strategy Tab */}
            {activeTab === 'strategy' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <h2 className="text-2xl sm:text-4xl font-mono font-bold text-foreground">
                    <span className="text-primary">GROWTH</span> STRATEGY
                  </h2>
                  <p className="text-sm text-muted-foreground font-mono">AI-powered recommendations for channel growth</p>
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
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-5xl font-mono font-bold text-primary">{growthScore}</p>
                        <p className="text-xs text-muted-foreground font-mono mt-1">/ 100</p>
                      </div>
                      <div className="w-32 h-32 rounded-full border-4 border-primary/20 flex items-center justify-center relative">
                        <div 
                          className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary"
                          style={{
                            transform: `rotate(${(growthScore / 100) * 360}deg)`,
                            transition: 'transform 1s ease-out'
                          }}
                        ></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { title: 'OPTIMAL POST TIME', desc: 'Post between 10 AM - 2 PM for maximum engagement' },
                    { title: 'CONTENT MIX', desc: 'Increase tutorials from 25% to 35% of content' },
                    { title: 'POSTING FREQUENCY', desc: 'Increase to 4 posts/day for better reach' },
                    { title: 'ENGAGEMENT FOCUS', desc: 'Ask questions in 60% of posts to boost interaction' },
                  ].map((strategy, idx) => (
                    <Card 
                      key={idx} 
                      className="border border-border bg-card/50 hover:border-primary/50 transition-all cursor-pointer group relative overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 w-1 h-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                      <CardContent className="pt-4 pb-4 pl-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <div className="relative w-5 h-5 flex items-center justify-center">
                              <div className="absolute inset-0 border border-primary" style={{clipPath: 'polygon(0 20%, 0 0, 20% 0, 20% 20%, 0 20%)'}} />
                              <div className="absolute inset-0 border border-primary" style={{clipPath: 'polygon(80% 0, 100% 0, 100% 20%, 80% 20%, 80% 0)'}} />
                              <div className="absolute inset-0 border border-primary" style={{clipPath: 'polygon(0 80%, 0 100%, 20% 100%, 20% 80%, 0 80%)'}} />
                              <div className="absolute inset-0 border border-primary" style={{clipPath: 'polygon(100% 100%, 100% 80%, 80% 80%, 80% 100%, 100% 100%)'}} />
                              <div className="w-1 h-1 bg-primary rounded-full" />
                            </div>
                            <p className="font-mono font-bold text-sm text-foreground uppercase tracking-wider">{strategy.title}</p>
                          </div>
                          <p className="text-xs text-muted-foreground font-mono">{strategy.desc}</p>
                          <div className="flex items-center gap-1 mt-3 text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-xs font-mono uppercase tracking-wider">Learn more</span>
                            <ArrowRight className="w-3 h-3" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
