-- Community foundation, phase 1.
-- Additive only: this does not remove the current one-community/global policies yet.

create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  logo_url text,
  status text not null default 'active'
    check (status in ('active', 'archived', 'suspended')),
  created_by uuid references public.members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_memberships (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  role text not null default 'member'
    check (role in ('owner', 'admin', 'committee', 'member')),
  status text not null default 'active'
    check (status in ('invited', 'pending', 'active', 'suspended', 'left')),
  is_public_to_other_communities boolean not null default false,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (community_id, member_id)
);

create table if not exists public.community_sport_permissions (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  sport_id uuid not null references public.sports(id) on delete cascade,
  permission text not null default 'manage'
    check (permission in ('manage')),
  created_at timestamptz not null default now(),
  unique (community_id, member_id, sport_id, permission)
);

create table if not exists public.community_invitations (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  email text,
  invited_member_id uuid references public.members(id) on delete cascade,
  invited_by uuid references public.members(id),
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  role text not null default 'member'
    check (role in ('admin', 'committee', 'member')),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'expired', 'revoked')),
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now()
);

alter table if exists public.matches
  add column if not exists community_id uuid references public.communities(id);

alter table if exists public.leagues
  add column if not exists community_id uuid references public.communities(id);

alter table if exists public.venues
  add column if not exists community_id uuid references public.communities(id);

alter table if exists public.member_activities
  add column if not exists community_id uuid references public.communities(id);

alter table public.communities enable row level security;
alter table public.community_memberships enable row level security;
alter table public.community_sport_permissions enable row level security;
alter table public.community_invitations enable row level security;

create index if not exists communities_created_by_idx
  on public.communities (created_by);

create index if not exists community_memberships_member_idx
  on public.community_memberships (member_id, status);

create index if not exists community_memberships_community_idx
  on public.community_memberships (community_id, status);

create index if not exists community_sport_permissions_member_idx
  on public.community_sport_permissions (member_id, sport_id);

create index if not exists community_invitations_token_idx
  on public.community_invitations (token);

create or replace function public.current_member_has_community_role(
  target_community_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.community_memberships cm
    join public.members m on m.id = cm.member_id
    where m.auth_user_id = auth.uid()
      and m.approval_status = 'approved'
      and cm.community_id = target_community_id
      and cm.status = 'active'
      and cm.role = any(allowed_roles)
  );
$$;

create or replace function public.current_member_in_community(target_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_member_has_community_role(
    target_community_id,
    array['owner', 'admin', 'committee', 'member']
  );
$$;

drop policy if exists "active community members can read communities" on public.communities;
create policy "active community members can read communities"
  on public.communities
  for select
  to authenticated
  using (public.current_member_in_community(id));

drop policy if exists "community owners can manage communities" on public.communities;
create policy "community owners can manage communities"
  on public.communities
  for all
  to authenticated
  using (public.current_member_has_community_role(id, array['owner']))
  with check (public.current_member_has_community_role(id, array['owner']));

drop policy if exists "active members can read community memberships" on public.community_memberships;
create policy "active members can read community memberships"
  on public.community_memberships
  for select
  to authenticated
  using (public.current_member_in_community(community_id));

drop policy if exists "community admins can manage memberships" on public.community_memberships;
create policy "community admins can manage memberships"
  on public.community_memberships
  for all
  to authenticated
  using (public.current_member_has_community_role(community_id, array['owner', 'admin']))
  with check (public.current_member_has_community_role(community_id, array['owner', 'admin']));

drop policy if exists "active members can read community sport permissions" on public.community_sport_permissions;
create policy "active members can read community sport permissions"
  on public.community_sport_permissions
  for select
  to authenticated
  using (public.current_member_in_community(community_id));

drop policy if exists "community admins can manage sport permissions" on public.community_sport_permissions;
create policy "community admins can manage sport permissions"
  on public.community_sport_permissions
  for all
  to authenticated
  using (public.current_member_has_community_role(community_id, array['owner', 'admin']))
  with check (public.current_member_has_community_role(community_id, array['owner', 'admin']));

drop policy if exists "community admins can manage invitations" on public.community_invitations;
create policy "community admins can manage invitations"
  on public.community_invitations
  for all
  to authenticated
  using (public.current_member_has_community_role(community_id, array['owner', 'admin']))
  with check (public.current_member_has_community_role(community_id, array['owner', 'admin']));
