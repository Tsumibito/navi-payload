-- Патч для заполнения links в Team из Sanity данных

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

-- Проверка
SELECT t.name, tl.service, tl.url 
FROM team t 
LEFT JOIN team_links tl ON t.id = tl._parent_id 
ORDER BY t.id, tl._order;
