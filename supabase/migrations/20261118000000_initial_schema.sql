CREATE TABLE public.indicators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position double precision NOT NULL DEFAULT 0,
  sheet_row int,
  kind text NOT NULL DEFAULT 'indicator',
  name text NOT NULL,
  sector text NOT NULL DEFAULT '',
  grp text,
  bold boolean NOT NULL DEFAULT false,
  indent int NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'numero',
  decimals int NOT NULL DEFAULT 0,
  companies text[] NOT NULL DEFAULT '{}',
  rmr boolean NOT NULL DEFAULT false,
  rid boolean NOT NULL DEFAULT false,
  rgr boolean NOT NULL DEFAULT false,
  total_formula text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.periods (
  month date PRIMARY KEY,
  sheet_col text
);

CREATE TABLE public.cells (
  indicator_id uuid NOT NULL REFERENCES public.indicators(id) ON DELETE CASCADE,
  month date NOT NULL REFERENCES public.periods(month) ON DELETE CASCADE,
  num_value double precision,
  text_value text,
  formula text,
  PRIMARY KEY (indicator_id, month)
);

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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.indicators, public.periods, public.cells, public.goals TO authenticated;
GRANT ALL ON public.indicators, public.periods, public.cells, public.goals TO service_role;

ALTER TABLE public.indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cells ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "signed in access" ON public.indicators FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "signed in access" ON public.periods FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "signed in access" ON public.cells FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "signed in access" ON public.goals FOR ALL TO authenticated USING (true) WITH CHECK (true);
