-- Add must_change_password flag so admin can force password change on next login
ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0;
