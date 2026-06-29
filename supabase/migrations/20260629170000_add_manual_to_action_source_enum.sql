-- Add 'manual' to the action_source enum for hand-entered actions
alter type action_source add value if not exists 'manual';
