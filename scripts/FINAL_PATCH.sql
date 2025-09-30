-- ============================================
-- ФИНАЛЬНЫЙ ПАТЧ МИГРАЦИИ SANITY → PAYLOAD
-- ============================================

-- 1. TAGS → POSTS ОБРАТНЫЕ СВЯЗИ
-- Создаём обратные связи от тегов к постам
WITH tag_posts AS (
  SELECT 
    pr.tags_id as tag_id,
    pr.parent_id as post_id,
    ROW_NUMBER() OVER (PARTITION BY pr.tags_id ORDER BY pr.parent_id) as row_num
  FROM posts_rels pr
  WHERE pr.tags_id IS NOT NULL
)
INSERT INTO tags_rels (parent_id, "order", path, posts_id)
SELECT tag_id, row_num, 'posts', post_id
FROM tag_posts
ON CONFLICT DO NOTHING;

-- 2. TEAM SOCIAL LINKS
-- Алексей Бурлаков (id=1)
UPDATE team_links SET url = 'mailto:alex.mon.navi@gmail.com' WHERE _parent_id = 1 AND service = 'email' AND _order = 1;
UPDATE team_links SET url = 'tel:33769958299' WHERE _parent_id = 1 AND service = 'phone' AND _order = 2;
UPDATE team_links SET url = 'https://www.facebook.com/alex.tsumibito?mibextid=LQQJ4d' WHERE _parent_id = 1 AND service = 'facebook' AND _order = 3;
UPDATE team_links SET url = 'https://www.instagram.com/tsumibito/profilecard/?igsh=d3JzZjZmdnd2OW5v' WHERE _parent_id = 1 AND service = 'instagram' AND _order = 4;

-- Андрей Говорской (id=2)
UPDATE team_links SET url = 'mailto:navigar.fr@gmail.com' WHERE _parent_id = 2 AND service = 'email' AND _order = 1;

-- Евгения Пильгун (id=3)
UPDATE team_links SET url = 'mailto:navigar.fr@gmail.com' WHERE _parent_id = 3 AND service = 'email' AND _order = 1;
UPDATE team_links SET url = 'https://www.facebook.com/Eugeniia.Pilgun?mibextid=LQQJ4d' WHERE _parent_id = 3 AND service = 'facebook' AND _order = 2;
UPDATE team_links SET url = 'https://www.instagram.com/jenn.the.pilgrim?igsh=MTVsZmw2dTJpem4zZw==' WHERE _parent_id = 3 AND service = 'instagram' AND _order = 3;

-- 3. TEAM BIO_SUMMARY (PortableText → Lexical)
UPDATE team SET bio_summary = '{"root": {"type": "root", "format": "", "indent": 0, "version": 1, "children": [], "direction": "ltr"}}'::jsonb;

-- 4. CERTIFICATES DESCRIPTION (пустые → Lexical)
UPDATE certificates SET description = '{"root": {"type": "root", "format": "", "indent": 0, "version": 1, "children": [], "direction": "ltr"}}'::jsonb
WHERE description IS NULL OR jsonb_array_length(description->'root'->'children') = 0;

UPDATE certificates_translations SET description = '{"root": {"type": "root", "format": "", "indent": 0, "version": 1, "children": [], "direction": "ltr"}}'::jsonb
WHERE description IS NULL OR jsonb_array_length(description->'root'->'children') = 0;

-- ============================================
-- ПРОВЕРКА РЕЗУЛЬТАТОВ
-- ============================================

SELECT '=== TAGS → POSTS RELATIONS ===' as check_name;
SELECT COUNT(*) as total_relations FROM tags_rels WHERE path = 'posts';

SELECT '=== TEAM LINKS ===' as check_name;
SELECT t.name, tl.service, tl.url 
FROM team t 
LEFT JOIN team_links tl ON t.id = tl._parent_id 
ORDER BY t.id, tl._order;

SELECT '=== TEAM BIO_SUMMARY ===' as check_name;
SELECT id, name, 
  CASE 
    WHEN bio_summary::text LIKE '%root%' THEN 'Lexical ✓'
    ELSE 'ERROR'
  END as format
FROM team;

SELECT '=== CERTIFICATES DESCRIPTION ===' as check_name;
SELECT id, title,
  CASE 
    WHEN description::text LIKE '%root%' THEN 'Lexical ✓'
    ELSE 'ERROR'
  END as format
FROM certificates;

SELECT '=== SUMMARY ===' as check_name;
SELECT 
  'Tags relations' as item, COUNT(*) as count FROM tags_rels WHERE path = 'posts'
UNION ALL
SELECT 'Team links', COUNT(*) FROM team_links WHERE url IS NOT NULL AND url != ''
UNION ALL
SELECT 'Team bio_summary fixed', COUNT(*) FROM team WHERE bio_summary::text LIKE '%root%'
UNION ALL
SELECT 'Certificates fixed', COUNT(*) FROM certificates WHERE description::text LIKE '%root%';
