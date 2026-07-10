-- Remove all Granola-synced actions from client_actions
-- Granola actions are now surfaced in pre-reads only, not tracked as actions
DELETE FROM client_actions WHERE source = 'granola';
