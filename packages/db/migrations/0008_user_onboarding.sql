ALTER TABLE user ADD COLUMN onboarding_completed_at TEXT;

UPDATE user
SET onboarding_completed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE onboarding_completed_at IS NULL;
