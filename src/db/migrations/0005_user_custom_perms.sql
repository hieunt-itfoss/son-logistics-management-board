-- Per-user permission overrides (JSON), merged over role defaults at login
ALTER TABLE users ADD COLUMN custom_perms TEXT NOT NULL DEFAULT '{}';
