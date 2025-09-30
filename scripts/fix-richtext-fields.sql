-- Патч для исправления RichText полей (Slate/PortableText → Lexical)

-- 1. Исправляем Team bioSummary - заменяем PortableText на пустой Lexical
UPDATE team SET bio_summary = '{"root": {"type": "root", "format": "", "indent": 0, "version": 1, "children": [], "direction": "ltr"}}'::jsonb
WHERE bio_summary IS NOT NULL 
AND (bio_summary::text LIKE '%_type%' OR bio_summary::text LIKE '%_key%');

-- 2. Исправляем Certificates description - уже исправлено, но проверяем
UPDATE certificates SET description = '{"root": {"type": "root", "format": "", "indent": 0, "version": 1, "children": [], "direction": "ltr"}}'::jsonb
WHERE description IS NULL 
OR (description::jsonb->'root'->'children' IS NULL)
OR (jsonb_array_length(description::jsonb->'root'->'children') = 0 AND description::text NOT LIKE '%paragraph%');

-- 3. Исправляем Certificates translations description
UPDATE certificates_translations 
SET description = '{"root": {"type": "root", "format": "", "indent": 0, "version": 1, "children": [], "direction": "ltr"}}'::jsonb
WHERE description IS NULL 
OR (description::jsonb->'root'->'children' IS NULL)
OR (jsonb_array_length(description::jsonb->'root'->'children') = 0 AND description::text NOT LIKE '%paragraph%');

-- Проверка
SELECT 'Team bioSummary fixed:' as status, COUNT(*) as count FROM team 
WHERE bio_summary::text LIKE '%root%' AND bio_summary::text NOT LIKE '%_type%';

SELECT 'Certificates description fixed:' as status, COUNT(*) as count FROM certificates 
WHERE description::text LIKE '%root%';

SELECT 'Certificates translations fixed:' as status, COUNT(*) as count FROM certificates_translations 
WHERE description::text LIKE '%root%';
