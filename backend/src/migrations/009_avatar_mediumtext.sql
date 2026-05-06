-- Migration 009: Increase avatar_url to MEDIUMTEXT to support base64 images
ALTER TABLE users MODIFY COLUMN avatar_url MEDIUMTEXT DEFAULT NULL;
