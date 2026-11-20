-- Fix ambiguous project/file name references; preserve the private bucket and all files.
begin;

alter policy "project_attachment_read" on storage.objects to authenticated
using (bucket_id = 'project-attachments'
  and (storage.foldername(storage.objects.name))[1] = (select auth.uid())::text
  and exists (select 1 from public.projects p where p.id::text = (storage.foldername(storage.objects.name))[2] and p.user_id = (select auth.uid())));

alter policy "project_attachment_upload" on storage.objects to authenticated
with check (bucket_id = 'project-attachments'
  and (storage.foldername(storage.objects.name))[1] = (select auth.uid())::text
  and array_length(storage.foldername(storage.objects.name), 1) = 2
  and exists (select 1 from public.projects p where p.id::text = (storage.foldername(storage.objects.name))[2] and p.user_id = (select auth.uid())));

alter policy "project_attachment_delete" on storage.objects to authenticated
using (bucket_id = 'project-attachments'
  and (storage.foldername(storage.objects.name))[1] = (select auth.uid())::text
  and exists (select 1 from public.projects p where p.id::text = (storage.foldername(storage.objects.name))[2] and p.user_id = (select auth.uid())));
commit;
