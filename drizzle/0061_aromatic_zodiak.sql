ALTER TABLE `platformAdminUsers` MODIFY COLUMN `platformRole` enum('super_admin','operator','operations','support','billing') NOT NULL DEFAULT 'operator';
