DROP POLICY "open access" ON public.indicators;
DROP POLICY "open access" ON public.periods;
DROP POLICY "open access" ON public.cells;
REVOKE ALL ON public.indicators, public.periods, public.cells FROM anon;
CREATE POLICY "signed in access" ON public.indicators FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "signed in access" ON public.periods FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "signed in access" ON public.cells FOR ALL TO authenticated USING (true) WITH CHECK (true);