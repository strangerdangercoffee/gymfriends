-- Direct message conversations between exactly two users
create table if not exists dm_conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references users(id) on delete cascade,
  user_b uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Always store with user_a < user_b (lexicographic on UUID text) so pair is unique
  unique (user_a, user_b),
  -- Prevent self-conversations
  check (user_a <> user_b)
);

create index if not exists dm_conversations_user_a_idx on dm_conversations (user_a);
create index if not exists dm_conversations_user_b_idx on dm_conversations (user_b);

-- Messages within a DM conversation
create table if not exists dm_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references dm_conversations(id) on delete cascade,
  sender_user_id uuid not null references users(id) on delete cascade,
  message_text text,
  message_type text not null default 'text',  -- 'text' | 'image' | 'system'
  metadata jsonb,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  read_by uuid[] default '{}'::uuid[]
);

create index if not exists dm_messages_conversation_created_idx
  on dm_messages (conversation_id, created_at);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

alter table dm_conversations enable row level security;
alter table dm_messages enable row level security;

-- Conversations: only participants can see/create
create policy "dm_conversations_participant_select"
  on dm_conversations for select
  using (auth.uid() = user_a or auth.uid() = user_b);

create policy "dm_conversations_participant_insert"
  on dm_conversations for insert
  with check (auth.uid() = user_a or auth.uid() = user_b);

-- Messages: only conversation participants can read/write
create policy "dm_messages_participant_select"
  on dm_messages for select
  using (
    exists (
      select 1 from dm_conversations c
      where c.id = dm_messages.conversation_id
        and (c.user_a = auth.uid() or c.user_b = auth.uid())
    )
  );

create policy "dm_messages_sender_insert"
  on dm_messages for insert
  with check (
    sender_user_id = auth.uid()
    and exists (
      select 1 from dm_conversations c
      where c.id = dm_messages.conversation_id
        and (c.user_a = auth.uid() or c.user_b = auth.uid())
    )
  );

create policy "dm_messages_sender_update"
  on dm_messages for update
  using (sender_user_id = auth.uid());
