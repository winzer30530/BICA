create extension if not exists pgcrypto;
create type app_role as enum ('owner','teacher');
create type student_status as enum ('active','completed','paused','left');
create type fee_status as enum ('paid','pending');
create type att_status as enum ('present','absent','late','excused');

create table profiles (id uuid primary key references auth.users on delete cascade, full_name text not null, role app_role not null default 'teacher', created_at timestamptz default now());
create table courses (id uuid primary key default gen_random_uuid(), code text unique not null, name text not null, duration_months int, total_fee numeric(10,2), modules text[] default '{}', active boolean default true);
create table batches (id uuid primary key default gen_random_uuid(), course_id uuid not null references courses, name text not null, starts_on date, timing text);
create table students (id uuid primary key default gen_random_uuid(), full_name text not null, phone text, guardian_phone text, course_id uuid references courses, batch_id uuid references batches, admitted_on date default current_date, status student_status default 'active', created_at timestamptz default now());
create table fee_payments (id uuid primary key default gen_random_uuid(), student_id uuid not null references students on delete cascade, month date not null check (extract(day from month)=1), amount numeric(10,2) not null default 0, status fee_status not null default 'pending', paid_on date, recorded_by uuid references profiles, unique (student_id, month));
create table attendance (id uuid primary key default gen_random_uuid(), student_id uuid not null references students on delete cascade, day date not null, status att_status not null, unique (student_id, day));
create table exams (id uuid primary key default gen_random_uuid(), course_id uuid references courses, title text not null, kind text check (kind in ('mcq','practical','written')), total_marks int, held_on date);
create table exam_questions (id uuid primary key default gen_random_uuid(), exam_id uuid not null references exams on delete cascade, body text not null, options jsonb, answer text, marks int default 1);
create table exam_results (id uuid primary key default gen_random_uuid(), exam_id uuid not null references exams, student_id uuid not null references students, marks numeric(6,2), unique (exam_id, student_id));
create table certificates (id uuid primary key default gen_random_uuid(), student_id uuid not null references students, number text unique not null, issued_on date default current_date, file_path text);
create table lab_devices (id uuid primary key default gen_random_uuid(), label text unique not null, status text not null default 'working', hardware jsonb default '{}', notes text);
create table maintenance_records (id uuid primary key default gen_random_uuid(), device_id uuid not null references lab_devices, issue text, action text, done_on date default current_date);
create table documents (id uuid primary key default gen_random_uuid(), name text not null, path text, kind text, created_by uuid references profiles, created_at timestamptz default now());
create table agent_runs (id uuid primary key default gen_random_uuid(), user_id uuid references profiles, prompt text not null, status text not null default 'running', result text, created_at timestamptz default now());
create table agent_actions (id uuid primary key default gen_random_uuid(), run_id uuid references agent_runs on delete cascade, tool text not null, args jsonb, ok boolean, detail text, created_at timestamptz default now());
create table audit_logs (id bigserial primary key, user_id uuid, action text not null, entity text, entity_id uuid, before jsonb, after jsonb, created_at timestamptz default now());
create table settings (key text primary key, value jsonb not null);

create function is_staff() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from profiles where id = auth.uid()) $$;
create function is_owner() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from profiles where id = auth.uid() and role='owner') $$;

do $$ declare t text; begin
  foreach t in array array['courses','batches','students','fee_payments','attendance','exams','exam_questions','exam_results','certificates','lab_devices','maintenance_records','documents','agent_runs','agent_actions'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy staff_all on %I for all to authenticated using (is_staff()) with check (is_staff())', t);
  end loop;
end $$;
alter table profiles enable row level security;
create policy profiles_read on profiles for select to authenticated using (is_staff());
create policy profiles_owner_write on profiles for all to authenticated using (is_owner()) with check (is_owner());
alter table audit_logs enable row level security;
create policy audit_read on audit_logs for select to authenticated using (is_owner());
create policy audit_insert on audit_logs for insert to authenticated with check (is_staff());
alter table settings enable row level security;
create policy settings_read on settings for select to authenticated using (is_staff());
create policy settings_owner on settings for all to authenticated using (is_owner()) with check (is_owner());
-- No anon access anywhere. Service-role key is never shipped in the app.
