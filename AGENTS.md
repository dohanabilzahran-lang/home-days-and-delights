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

- Browser reads/writes app data via the Supabase client with per-user RLS (`src/lib/data.ts` hooks); keeps CRUD simple for a single-user app.
- All UI strings go through `src/lib/i18n.tsx` (EN/AR, sets `dir`); use logical spacing (ps/pe, text-start) so RTL works.
