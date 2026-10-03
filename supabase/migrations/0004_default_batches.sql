-- Default BICA batches: one operational batch for each seeded course.
-- Safe to run more than once.
insert into batches (course_id,name,starts_on)
select id, code || ' Batch', current_date
from courses
where code in ('DCA','ADCA','CDC')
  and not exists (
    select 1 from batches b where b.course_id=courses.id and b.name=courses.code || ' Batch'
  );

create index if not exists idx_batches_course on batches(course_id);
