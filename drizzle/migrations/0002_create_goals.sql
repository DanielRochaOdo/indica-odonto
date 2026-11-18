CREATE TABLE public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator_id uuid NOT NULL REFERENCES public.indicators(id) ON DELETE CASCADE,
  period text NOT NULL DEFAULT '',
  company text NOT NULL DEFAULT '',
  target double precision NOT NULL,
  direction text NOT NULL DEFAULT 'up',
  tolerance double precision NOT NULL DEFAULT 0.05,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (indicator_id, period, company)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "signed in access" ON public.goals FOR ALL TO authenticated USING (true) WITH CHECK (true);