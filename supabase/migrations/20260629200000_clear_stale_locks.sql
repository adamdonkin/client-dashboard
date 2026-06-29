-- Clear all stale session locks
UPDATE session_notes SET locked_by = NULL, locked_at = NULL WHERE locked_by IS NOT NULL;
