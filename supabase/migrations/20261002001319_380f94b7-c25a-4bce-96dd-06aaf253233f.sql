create type public.app_role as enum ('owner','client');
create type public.project_status as enum ('DORMANT','INTENT','DISCOVERY','DEFINED','PLANNED','IN_PROGRESS','REVIEW','WAITING_FOR_HUMAN','BLOCKED','APPROVAL','EXECUTION','VALIDATION','COMPLETED','MONITORING','PAUSED','CANCELLED','SUPERSEDED','ARCHIVED');
create type public.task_status as enum ('PENDING','READY','RUNNING','WAITING','WAITING_FOR_HUMAN','BLOCKED','FAILED','COMPLETED','CANCELLED');
create type public.decision_status as enum ('PROPOSED','WAITING_FOR_HUMAN','ACCEPTED','REJECTED','DEFERRED','SUPERSEDED');
create type public.approval_status as enum ('REQUESTED','GRANTED','REJECTED','EXPIRED');
create type public.artifact_status as enum ('DRAFT','PROPOSED','APPROVED','REJECTED','SUPERSEDED','FINAL');
create type public.context_status as enum ('MISSING','REQUESTED','PARTIALLY_RECEIVED','RECEIVED','ASSUMED','VALIDATED','REJECTED','EXPIRED');

create table public.profiles (id uuid primary key, email text, display_name text, created_at timestamptz not null default now());
create table public.user_roles (id uuid primary key default gen_random_uuid(), user_id uuid not null, role public.app_role not null, unique(user_id, role));
grant select, insert, update on public.profiles to authenticated; grant all on public.profiles to service_role;
grant select on public.user_roles to authenticated; grant all on public.user_roles to service_role;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role) returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from public.user_roles where user_id=_user_id and role=_role) $$;

create table public.organizations (id uuid primary key default gen_random_uuid(), name text not null, mission text, created_at timestamptz not null default now());
create table public.projects (id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id) on delete set null, name text not null, description text, objective text, status public.project_status not null default 'INTENT', priority int not null default 50, domains text[] not null default '{}', created_at timestamptz not null default now(), started_at timestamptz, completed_at timestamptz);
create table public.project_clients (project_id uuid not null references public.projects(id) on delete cascade, user_id uuid not null, created_at timestamptz not null default now(), primary key (project_id, user_id));

create or replace function public.is_project_client(_project_id uuid) returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from public.project_clients where project_id=_project_id and user_id=auth.uid()) $$;
create or replace function public.is_owner() returns boolean language sql stable security definer set search_path = public as $$ select public.has_role(auth.uid(),'owner') $$;

create table public.tasks (id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade, title text not null, description text, domain text not null default 'general', status public.task_status not null default 'PENDING', risk int not null default 1, reversibility int not null default 3, approval_required boolean not null default false, created_at timestamptz not null default now(), started_at timestamptz, completed_at timestamptz);
create table public.decisions (id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade, question text not null, options jsonb not null default '[]', recommendation text, selected_option text, rationale text, confidence real, risk int, reversibility int, status public.decision_status not null default 'PROPOSED', created_at timestamptz not null default now(), resolved_at timestamptz);
create table public.evidence (id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade, approval_id uuid, source text not null, source_type text not null default 'document', claim text not null, confidence real not null default 0.7, created_at timestamptz not null default now());
create table public.approvals (id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade, target_type text not null default 'PROJECT', title text not null, reason text not null, risk int not null default 2, reversibility int not null default 3, consequences text, recommendation text, requires_client boolean not null default false, status public.approval_status not null default 'REQUESTED', constraints text, evidence_request text, resolution_note text, resolved_by uuid, created_at timestamptz not null default now(), resolved_at timestamptz);
create table public.artifacts (id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade, type text not null default 'deliverable', name text not null, description text, storage_path text, status public.artifact_status not null default 'DRAFT', client_visible boolean not null default false, created_at timestamptz not null default now());
create table public.context_requirements (id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade, name text not null, description text not null default '', category text not null default 'general', required boolean not null default true, status public.context_status not null default 'MISSING', reason text not null default '', assigned_to_client boolean not null default false, response text, response_file_path text, deadline timestamptz, created_at timestamptz not null default now(), resolved_at timestamptz);
create table public.outcomes (id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade, metric text not null, expected_value text not null, actual_value text not null, interpretation text, created_at timestamptz not null default now());
create table public.events (id uuid primary key default gen_random_uuid(), project_id uuid references public.projects(id) on delete cascade, type text not null, summary text not null, actor_id uuid, client_visible boolean not null default false, created_at timestamptz not null default now());
create table public.directives (id uuid primary key default gen_random_uuid(), project_id uuid references public.projects(id) on delete set null, organization_id uuid references public.organizations(id) on delete set null, client_id uuid, content text not null, created_by uuid not null, created_at timestamptz not null default now());
create table public.comments (id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade, target_type text not null default 'project', target_id uuid, author_id uuid not null, body text not null, created_at timestamptz not null default now());
create table public.owner_state (user_id uuid primary key, last_seen_at timestamptz not null default now(), previous_seen_at timestamptz);

do $$ declare t text; begin
  foreach t in array array['organizations','projects','project_clients','tasks','decisions','evidence','approvals','artifacts','context_requirements','outcomes','events','directives','comments','owner_state'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "Owner full access" on public.%I for all to authenticated using (public.is_owner()) with check (public.is_owner())', t);
  end loop;
end $$;

create policy "Own profile" on public.profiles for select to authenticated using (id = auth.uid() or public.is_owner());
create policy "Update own profile" on public.profiles for update to authenticated using (id = auth.uid());
create policy "Own roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.is_owner());

create policy "Client sees own links" on public.project_clients for select to authenticated using (user_id = auth.uid());
create policy "Client sees linked projects" on public.projects for select to authenticated using (public.is_project_client(id));
create policy "Client sees shared events" on public.events for select to authenticated using (client_visible and public.is_project_client(project_id));
create policy "Client sees shared deliverables" on public.artifacts for select to authenticated using (client_visible and public.is_project_client(project_id));
create policy "Client sees their approvals" on public.approvals for select to authenticated using (requires_client and public.is_project_client(project_id));
create policy "Client sees their requirements" on public.context_requirements for select to authenticated using (assigned_to_client and public.is_project_client(project_id));
create policy "Client reads comments" on public.comments for select to authenticated using (public.is_project_client(project_id));
create policy "Client writes comments" on public.comments for insert to authenticated with check (author_id = auth.uid() and public.is_project_client(project_id));

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, email, display_name) values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1))) on conflict do nothing;
  if not exists (select 1 from public.user_roles where role='owner') then
    insert into public.user_roles(user_id, role) values (new.id, 'owner');
  else
    insert into public.user_roles(user_id, role) values (new.id, 'client') on conflict do nothing;
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.client_resolve_approval(_approval_id uuid, _approved boolean, _note text) returns void language plpgsql security definer set search_path = public as $$
declare a public.approvals;
begin
  select * into a from public.approvals where id=_approval_id;
  if a.id is null or not a.requires_client or not public.is_project_client(a.project_id) then raise exception 'Not allowed'; end if;
  if a.status <> 'REQUESTED' then raise exception 'Already resolved'; end if;
  update public.approvals set status = case when _approved then 'GRANTED'::approval_status else 'REJECTED'::approval_status end, resolution_note=left(_note,2000), resolved_by=auth.uid(), resolved_at=now() where id=_approval_id;
  insert into public.events(project_id,type,summary,actor_id,client_visible) values (a.project_id, case when _approved then 'APPROVAL_GRANTED' else 'APPROVAL_REJECTED' end, 'Client ' || case when _approved then 'approved' else 'rejected' end || ': ' || a.title, auth.uid(), true);
end $$;

create or replace function public.client_respond_requirement(_req_id uuid, _response text, _file_path text) returns void language plpgsql security definer set search_path = public as $$
declare r public.context_requirements;
begin
  select * into r from public.context_requirements where id=_req_id;
  if r.id is null or not r.assigned_to_client or not public.is_project_client(r.project_id) then raise exception 'Not allowed'; end if;
  update public.context_requirements set response=left(_response,10000), response_file_path=coalesce(_file_path, response_file_path), status='RECEIVED', resolved_at=now() where id=_req_id;
  insert into public.events(project_id,type,summary,actor_id,client_visible) values (r.project_id,'CONTEXT_RECEIVED','Client provided: ' || r.name, auth.uid(), true);
end $$;

create or replace function public.touch_owner_seen() returns timestamptz language plpgsql security definer set search_path = public as $$
declare prev timestamptz;
begin
  if not public.is_owner() then return null; end if;
  select last_seen_at into prev from public.owner_state where user_id=auth.uid();
  insert into public.owner_state(user_id,last_seen_at,previous_seen_at) values (auth.uid(), now(), prev)
    on conflict (user_id) do update set previous_seen_at = case when owner_state.last_seen_at < now() - interval '30 minutes' then owner_state.last_seen_at else owner_state.previous_seen_at end, last_seen_at = now();
  select previous_seen_at into prev from public.owner_state where user_id=auth.uid();
  return prev;
end $$;

revoke execute on function public.client_resolve_approval(uuid,boolean,text) from public, anon;
revoke execute on function public.client_respond_requirement(uuid,text,text) from public, anon;
revoke execute on function public.touch_owner_seen() from public, anon;
grant execute on function public.client_resolve_approval(uuid,boolean,text), public.client_respond_requirement(uuid,text,text), public.touch_owner_seen() to authenticated;

create policy "Owner files" on storage.objects for all to authenticated using (bucket_id='project-files' and public.is_owner()) with check (bucket_id='project-files' and public.is_owner());
create policy "Client reads project files" on storage.objects for select to authenticated using (bucket_id='project-files' and public.is_project_client(((storage.foldername(name))[1])::uuid));
create policy "Client uploads to project" on storage.objects for insert to authenticated with check (bucket_id='project-files' and (storage.foldername(name))[2] = 'client-uploads' and public.is_project_client(((storage.foldername(name))[1])::uuid));