-- Actions can belong to a goal: the steps agreed to fix what's not good about it.
-- Deleting a goal keeps its actions and just unlinks them.

ALTER TABLE public.client_actions
  ADD COLUMN goal_id uuid REFERENCES client_goals(id) ON DELETE SET NULL;

CREATE INDEX idx_client_actions_goal_id ON client_actions(goal_id) WHERE goal_id IS NOT NULL;
