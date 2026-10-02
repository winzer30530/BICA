insert into courses (code,name,duration_months,total_fee,modules) values
('DCA','Diploma in Computer Applications',6,0,'{"Computer Fundamentals","Windows","MS Word","MS Excel","MS PowerPoint","Internet"}'),
('ADCA','Advanced Diploma in Computer Applications',12,0,'{"Computer Fundamentals","Office Suite","Internet","Graphics","Programming","Database"}'),
('CDC','Certificate in Digital Computing',3,0,'{"Computer Basics","Internet","Office Basics","Digital Skills"}')
on conflict (code) do nothing;
create index if not exists idx_students_course on students(course_id);
create index if not exists idx_students_batch on students(batch_id);
create index if not exists idx_fees_month_status on fee_payments(month,status);
create index if not exists idx_attendance_day on attendance(day);
create index if not exists idx_agent_runs_created on agent_runs(created_at desc);
create index if not exists idx_audit_created on audit_logs(created_at desc);
insert into storage.buckets (id,name,public) values ('bica-documents','bica-documents',false),('bica-certificates','bica-certificates',false),('bica-designs','bica-designs',false) on conflict (id) do nothing;
