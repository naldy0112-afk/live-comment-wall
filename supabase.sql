-- SupabaseのSQL Editorで実行します。
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  body text not null check (char_length(trim(body)) between 1 and 200),
  created_at timestamptz not null default now()
);

alter table public.comments enable row level security;

-- 誰でもコメントを読める（表示画面に必要）
drop policy if exists "Public can read comments" on public.comments;
create policy "Public can read comments"
on public.comments for select
to anon, authenticated
using (true);

-- 誰でもコメントを投稿できる（ログイン不要）
drop policy if exists "Public can insert comments" on public.comments;
create policy "Public can insert comments"
on public.comments for insert
to anon, authenticated
with check (char_length(trim(body)) between 1 and 200);

grant select, insert on public.comments to anon, authenticated;

-- Realtime publicationへ追加。すでに登録済みならエラーになる場合があるので、
-- その場合はSupabase Dashboard > Database > Publications > supabase_realtimeで
-- commentsテーブルが含まれているか確認してください。
alter publication supabase_realtime add table public.comments;
