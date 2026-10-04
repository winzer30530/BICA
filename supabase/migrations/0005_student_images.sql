-- Student profile images
alter table public.students add column if not exists image_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bica-student-images',
  'bica-student-images',
  false,
  5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update
set public=false,
    file_size_limit=5242880,
    allowed_mime_types=array['image/jpeg','image/png','image/webp'];

drop policy if exists bica_student_images_select on storage.objects;
drop policy if exists bica_student_images_insert on storage.objects;
drop policy if exists bica_student_images_update on storage.objects;
drop policy if exists bica_student_images_delete on storage.objects;

create policy bica_student_images_select
on storage.objects for select
to authenticated
using (bucket_id='bica-student-images' and (select private.is_staff()));

create policy bica_student_images_insert
on storage.objects for insert
to authenticated
with check (bucket_id='bica-student-images' and (select private.is_staff()));

create policy bica_student_images_update
on storage.objects for update
to authenticated
using (bucket_id='bica-student-images' and (select private.is_staff()))
with check (bucket_id='bica-student-images' and (select private.is_staff()));

create policy bica_student_images_delete
on storage.objects for delete
to authenticated
using (bucket_id='bica-student-images' and (select private.is_staff()));
