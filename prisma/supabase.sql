-- Supabase helper SQL for HRMS
-- Run Prisma migrations first. This file contains optional operational helpers.

create extension if not exists pgcrypto;

-- Storage bucket for HRMS uploads when using Supabase Storage.
insert into storage.buckets (id, name, public)
values ('hrms-uploads', 'hrms-uploads', false)
on conflict (id) do nothing;

-- Service role manages private files. App-level RBAC is enforced by Next.js/Auth.js.
