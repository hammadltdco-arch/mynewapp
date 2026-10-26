-- Loop v1: private one-to-one messaging. Apply through Supabase migrations.
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 username text unique check (username ~ '^[a-z0-9_]{3,24}$'),
 display_name text not null default 'New member' check (char_length(display_name) between 1 and 60),
 about text not null default '' check (char_length(about)<=160),
 created_at timestamptz not null default now()
);
create table public.conversations (
 id uuid primary key default gen_random_uuid(),
 direct_key text not null unique,
 created_at timestamptz not null default now()
);
create table public.conversation_members (
 conversation_id uuid not null references public.conversations(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 last_read_at timestamptz not null default now(),
 primary key(conversation_id,user_id)
);
create table public.blocks (
 blocker_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
 blocked_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(blocker_id,blocked_id), check(blocker_id<>blocked_id)
);
create table public.messages (
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references public.conversations(id) on delete cascade,
 sender_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
 body text not null default '' check(char_length(body)<=4000),
 attachment_path text,
 created_at timestamptz not null default now(),
 check (char_length(trim(body))>0 or attachment_path is not null)
);
create index messages_conversation_time on public.messages(conversation_id,created_at desc,id);
create index messages_sender_time on public.messages(sender_id,created_at desc);
create index members_user on public.conversation_members(user_id);
create table public.reports (
 id uuid primary key default gen_random_uuid(),
 reporter_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
 reported_id uuid references public.profiles(id) on delete set null,
 message_id uuid references public.messages(id) on delete set null,
 reason text not null check(reason in ('spam','harassment','sexual_content','child_safety','other')),
 details text not null default '' check(char_length(details)<=2000),
 status text not null default 'pending' check(status in ('pending','reviewing','resolved')),
 created_at timestamptz not null default now()
);
create table public.device_tokens (
 token text primary key check(char_length(token) between 20 and 4096),
 user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now()
);

create function public.is_member(cid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.conversation_members where conversation_id=cid and user_id=auth.uid());
$$;
create function public.is_blocked(other_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.blocks where (blocker_id=auth.uid() and blocked_id=other_id) or (blocker_id=other_id and blocked_id=auth.uid()));
$$;
create function public.can_send(cid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_member(cid) and not exists(
  select 1 from public.conversation_members m join public.blocks b
   on (b.blocker_id=auth.uid() and b.blocked_id=m.user_id) or (b.blocked_id=auth.uid() and b.blocker_id=m.user_id)
  where m.conversation_id=cid and m.user_id<>auth.uid()
 ) and (select count(*) from public.conversation_members where conversation_id=cid)=2;
$$;
create function public.shares_conversation(other_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.conversation_members a join public.conversation_members b using(conversation_id) where a.user_id=auth.uid() and b.user_id=other_id);
$$;
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
 begin
 insert into public.profiles(id,display_name) values(new.id,coalesce(nullif(left(trim(new.raw_user_meta_data->>'display_name'),60),''),'New member'));
 return new;
 end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
create function public.search_profiles(prefix text) returns table(id uuid,username text,display_name text,about text) language plpgsql stable security definer set search_path='' as $$
 begin
 if auth.uid() is null or char_length(prefix)<3 or char_length(prefix)>24 or prefix !~ '^[a-z0-9_]+$' then return; end if;
 return query select p.id,p.username,p.display_name,p.about from public.profiles p
 where p.id<>auth.uid() and starts_with(p.username,prefix) and not public.is_blocked(p.id)
 order by p.username limit 20;
 end;
$$;
create function public.start_direct_chat(other_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
 declare cid uuid; k text;
 begin
 if auth.uid() is null or other_id=auth.uid() or public.is_blocked(other_id) or not exists(select 1 from public.profiles where id=other_id and username is not null) or not exists(select 1 from public.profiles where id=auth.uid() and username is not null) then
 raise exception 'This conversation cannot be started'; end if;
 k:=least(auth.uid()::text,other_id::text)||':'||greatest(auth.uid()::text,other_id::text);
 insert into public.conversations(direct_key) values(k) on conflict(direct_key) do update set direct_key=excluded.direct_key returning id into cid;
 insert into public.conversation_members(conversation_id,user_id) values(cid,auth.uid()),(cid,other_id) on conflict do nothing;
 return cid;
 end;
$$;
create function public.mark_read(cid uuid) returns void language sql security definer set search_path='' as $$
 update public.conversation_members set last_read_at=now() where conversation_id=cid and user_id=auth.uid();
$$;
create function public.enforce_message_rate() returns trigger language plpgsql security definer set search_path='' as $$
 begin
 perform pg_advisory_xact_lock(hashtextextended(new.sender_id::text,0));
 if (select count(*) from public.messages where sender_id=new.sender_id and created_at>now()-interval '1 minute')>=60 then raise exception 'Too many messages. Please wait a minute.'; end if;
 return new;
 end;
$$;
create trigger message_rate before insert on public.messages for each row execute function public.enforce_message_rate();

alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.device_tokens enable row level security;
create policy profiles_read on public.profiles for select to authenticated using(id=auth.uid() or public.shares_conversation(id));
create policy profiles_update on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy conversations_read on public.conversations for select to authenticated using(public.is_member(id));
create policy members_read on public.conversation_members for select to authenticated using(public.is_member(conversation_id));
create policy messages_read on public.messages for select to authenticated using(public.is_member(conversation_id));
create policy messages_send on public.messages for insert to authenticated with check(sender_id=auth.uid() and public.can_send(conversation_id) and (attachment_path is null or (split_part(attachment_path,'/',1)=auth.uid()::text and split_part(attachment_path,'/',2)=conversation_id::text and exists(select 1 from storage.objects where bucket_id='chat-media' and name=attachment_path))));
create policy messages_delete on public.messages for delete to authenticated using(sender_id=auth.uid());
create policy blocks_read on public.blocks for select to authenticated using(blocker_id=auth.uid());
create policy blocks_insert on public.blocks for insert to authenticated with check(blocker_id=auth.uid());
create policy blocks_delete on public.blocks for delete to authenticated using(blocker_id=auth.uid());
create policy reports_insert on public.reports for insert to authenticated with check(reporter_id=auth.uid() and reported_id<>auth.uid() and public.shares_conversation(reported_id) and (message_id is null or exists(select 1 from public.messages m where m.id=message_id and m.sender_id=reported_id and public.is_member(m.conversation_id))));
create policy tokens_read on public.device_tokens for select to authenticated using(user_id=auth.uid());
create policy tokens_insert on public.device_tokens for insert to authenticated with check(user_id=auth.uid());
create policy tokens_delete on public.device_tokens for delete to authenticated using(user_id=auth.uid());

-- Explicit grants prevent ID/timestamp spoofing or report status escalation.
revoke all on public.profiles,public.conversations,public.conversation_members,public.messages,public.blocks,public.reports,public.device_tokens from anon,authenticated;
grant select on public.profiles,public.conversations,public.conversation_members,public.messages,public.blocks,public.device_tokens to authenticated;
grant update(username,display_name,about) on public.profiles to authenticated;
grant insert(conversation_id,body,attachment_path),delete on public.messages to authenticated;
grant insert(blocked_id),delete on public.blocks to authenticated;
grant insert(reported_id,message_id,reason,details) on public.reports to authenticated;
grant insert(token),delete on public.device_tokens to authenticated;
revoke all on function public.is_member(uuid),public.is_blocked(uuid),public.can_send(uuid),public.shares_conversation(uuid),public.search_profiles(text),public.start_direct_chat(uuid),public.mark_read(uuid),public.handle_new_user(),public.enforce_message_rate() from public,anon;
grant execute on function public.is_member(uuid),public.is_blocked(uuid),public.can_send(uuid),public.shares_conversation(uuid),public.search_profiles(text),public.start_direct_chat(uuid),public.mark_read(uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('chat-media','chat-media',false,5242880,array['image/jpeg','image/png','image/webp']);
create policy media_read on storage.objects for select to authenticated using(bucket_id='chat-media' and public.is_member((storage.foldername(name))[2]::uuid));
create policy media_insert on storage.objects for insert to authenticated with check(bucket_id='chat-media' and (storage.foldername(name))[1]=auth.uid()::text and public.can_send((storage.foldername(name))[2]::uuid));
create policy media_delete on storage.objects for delete to authenticated using(bucket_id='chat-media' and (storage.foldername(name))[1]=auth.uid()::text);

-- No DELETE event payload is relied on: clients refresh on focus/reconnect too.
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
 alter publication supabase_realtime add table public.messages,public.conversation_members,public.blocks;
 end if;
end $$;
