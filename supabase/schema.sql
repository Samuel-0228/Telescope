create extension if not exists pgcrypto;
create table if not exists public.channels (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    username text not null unique,
    category text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create table if not exists public.posts (
    id uuid primary key default gen_random_uuid(),
    channel_id uuid not null references public.channels(id) on delete cascade,
    external_post_id text not null,
    content text not null,
    media_type text not null check (
        media_type in (
            'text',
            'image',
            'video',
            'audio',
            'document',
            'unknown'
        )
    ),
    views bigint not null default 0,
    reactions bigint not null default 0,
    comments bigint not null default 0,
    post_timestamp timestamptz not null,
    raw_payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    unique (channel_id, external_post_id)
);
create index if not exists posts_channel_timestamp_idx on public.posts (channel_id, post_timestamp desc);
create table if not exists public.metrics_cache (
    id uuid primary key default gen_random_uuid(),
    channel_id uuid not null references public.channels(id) on delete cascade,
    time_range text not null check (time_range in ('30', '60', '90', 'all')),
    total_views bigint not null,
    avg_views numeric(12, 2) not null,
    engagement_rate numeric(6, 2) not null,
    posting_frequency numeric(12, 2) not null,
    payload jsonb not null default '{}'::jsonb,
    refreshed_at timestamptz not null default now(),
    unique (channel_id, time_range)
);
create index if not exists metrics_cache_refreshed_at_idx on public.metrics_cache (refreshed_at desc);
create table if not exists public.leaderboard (
    id uuid primary key default gen_random_uuid(),
    channel_id uuid not null references public.channels(id) on delete cascade,
    engagement_rate numeric(6, 2) not null,
    total_views_30d bigint not null,
    rank integer not null unique,
    refreshed_at timestamptz not null default now()
);
create index if not exists leaderboard_rank_idx on public.leaderboard (rank asc);