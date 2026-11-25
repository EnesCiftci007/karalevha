-- SALT OKUNUR: NoReservationOverlap migration'ından önce canlı veritabanında çalıştırın.
-- Hiçbir kaydı değiştirmez. Çakışan çift ya da ters aralık çıkarsa migration hata verir;
-- o kayıtlar elle çözülmelidir (otomatik silinmez).
BEGIN TRANSACTION READ ONLY;

-- Aynı ekipmanda zaman aralığı kesişen rezervasyon çiftleri (bitiş = başlangıç çakışma sayılmaz)
SELECT a."Id" AS rezervasyon_1, b."Id" AS rezervasyon_2, a."EquipmentId" AS ekipman,
       a."StartsAt" AS bas_1, a."EndsAt" AS bit_1, b."StartsAt" AS bas_2, b."EndsAt" AS bit_2
FROM "Reservations" a
JOIN "Reservations" b
  ON a."EquipmentId" = b."EquipmentId" AND a."Id" < b."Id"
 AND a."StartsAt" < b."EndsAt" AND b."StartsAt" < a."EndsAt"
ORDER BY a."EquipmentId", a."StartsAt";

-- Bitişi başlangıçtan önce ya da ona eşit kayıtlar
SELECT "Id", "EquipmentId", "StartsAt", "EndsAt" FROM "Reservations" WHERE "EndsAt" <= "StartsAt";

-- btree_gist bu sunucuda kurulabilir mi (1 = evet)
SELECT count(*) AS btree_gist_mevcut FROM pg_available_extensions WHERE name = 'btree_gist';

COMMIT;
