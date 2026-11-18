<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Indicator data lives in tables indicators/periods/cells; cells keep the original Excel formula text and src/lib/formula.ts recomputes it in the browser (refs map via indicators.sheet_row + periods.sheet_col), so totals stay faithful to the spreadsheet.
- Row order/hierarchy comes from indicators.position and kind (sector/group/indicator); never reorder by name since names repeat across groups.
- Whole app is behind login (src/routes/_authenticated); public signup is disabled and data tables allow only signed-in users, because the dashboard holds internal company data.
