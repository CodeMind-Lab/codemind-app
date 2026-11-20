-- Private file storage. Apply once in the Supabase SQL Editor.
begin;
insert into storage.buckets (id, name, public, file_size_limit)
values ('project-attachments', 'project-attachments', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = 10485760;

create policy "project_attachment_read" on storage.objects for select to authenticated
using (bucket_id = 'project-attachments'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.projects p where p.id::text = (storage.foldername(name))[2] and p.user_id = (select auth.uid())));

create policy "project_attachment_upload" on storage.objects for insert to authenticated
with check (bucket_id = 'project-attachments'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and array_length(storage.foldername(name), 1) = 2
  and exists (select 1 from public.projects p where p.id::text = (storage.foldername(name))[2] and p.user_id = (select auth.uid())));

create policy "project_attachment_delete" on storage.objects for delete to authenticated
using (bucket_id = 'project-attachments'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.projects p where p.id::text = (storage.foldername(name))[2] and p.user_id = (select auth.uid())));
commit;
