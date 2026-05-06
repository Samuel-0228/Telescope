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
create table if not exists public.metrics_cache (
    id uuid primary key default gen_random_uuid(),
    channel_id uuid not null references public.channels(id) on delete cascade,
    time_range text not null check (time_range in ('30', '60', '90', 'all')),
    total_views bigint not null default 0,
    avg_views numeric(12, 2) not null default 0,
    engagement_rate numeric(6, 2) not null default 0,
    posting_frequency numeric(12, 2) not null default 0,
    payload jsonb not null default '{}'::jsonb,
    refreshed_at timestamptz not null default now(),
    unique (channel_id, time_range)
);
create table if not exists public.leaderboard (
    id uuid primary key default gen_random_uuid(),
    channel_id uuid not null references public.channels(id) on delete cascade,
    engagement_rate numeric(6, 2) not null,
    total_views_30d bigint not null,
    rank integer not null unique,
    refreshed_at timestamptz not null default now(),
    unique (channel_id)
);
create index if not exists channels_username_idx on public.channels (username);
create index if not exists channels_updated_idx on public.channels (updated_at desc);
create index if not exists posts_channel_timestamp_idx on public.posts (channel_id, post_timestamp desc);
create index if not exists posts_timestamp_idx on public.posts (post_timestamp desc);
create index if not exists metrics_cache_refreshed_at_idx on public.metrics_cache (refreshed_at desc);
create index if not exists leaderboard_rank_idx on public.leaderboard (rank asc);
create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now();
return new;
end;
$$;
drop trigger if exists channels_set_updated_at on public.channels;
create trigger channels_set_updated_at before
update on public.channels for each row execute function public.set_updated_at();
create or replace function public.refresh_leaderboard_from_posts(top_n integer default 10) returns void language plpgsql security definer
set search_path = public as $$ begin if top_n is null
    or top_n < 1 then top_n := 10;
end if;
delete from public.leaderboard;
with ranked as (
    select c.id as channel_id,
        coalesce(sum(p.views), 0)::bigint as total_views_30d,
        case
            when coalesce(sum(p.views), 0) = 0 then 0::numeric
            else round(
                (
                    sum(p.reactions + p.comments)::numeric / sum(p.views)::numeric
                ) * 100,
                2
            )
        end as engagement_rate,
        row_number() over (
            order by case
                    when coalesce(sum(p.views), 0) = 0 then 0::numeric
                    else (
                        sum(p.reactions + p.comments)::numeric / sum(p.views)::numeric
                    ) * 100
                end desc,
                coalesce(sum(p.views), 0) desc
        ) as rank
    from public.channels c
        left join public.posts p on p.channel_id = c.id
        and coalesce(p.raw_payload->>'source', '') <> 'synthetic'
    group by c.id
),
picked as (
    select *
    from ranked
    where total_views_30d > 0
    order by rank
    limit top_n
)
insert into public.leaderboard (
        channel_id,
        engagement_rate,
        total_views_30d,
        rank,
        refreshed_at
    )
select channel_id,
    engagement_rate,
    total_views_30d,
    rank,
    now()
from picked;
end;
$$;
grant execute on function public.refresh_leaderboard_from_posts(integer) to anon,
    authenticated,
    service_role;