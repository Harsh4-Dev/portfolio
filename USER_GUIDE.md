# User guide

Everything you need to run, customise and publish this portfolio, in one place.
`README.md` is the technical reference; `SETUP.md` is the short install walkthrough. This guide is
the long version, written for the person who will actually maintain the site.

---

## 0. The one-minute mental model

```
content.xlsx  ──(python studio.py, or GitHub Actions)──▶  site/content.json  ──▶  the pages read it in the browser
```

- **`content.xlsx` is the whole site.** Text, sections, projects, colours, fonts, which pages exist,
  which parts are on or off, and every label the site prints. You never edit HTML.
- **`studio.py`** is a small local app: it previews the site, watches the workbook, rebuilds on
  save, and has a **Publish** button that commits and pushes to GitHub.
- **GitHub Pages** hosts the result. A workflow in the repo rebuilds `content.json` from the
  workbook on every push and deploys the `site/` folder. Nothing runs on the server afterwards:
  the site is plain static files.

**Does everything work on GitHub Pages?** Yes. The published site is static HTML/CSS/JS and needs
nothing from the studio. Both themes, the CV page, the history page, the animations, the terminal
prompt and the theme switch all run in the visitor's browser. Two things are local-only *by
design*: the studio dashboard (Publish button, live reload) and the `--prune` step that removes
pages you switched off, which runs on GitHub's build runner, not in the browser. The only external
resources the live site fetches are Google Fonts and the Three.js library from jsDelivr (paper
theme only); if either is blocked, the page still renders with fallback fonts and without the 3D
scene.

---

## 1. Install

| Need | Check | Notes |
|---|---|---|
| Python 3.10+ | `python --version` | python.org or Microsoft Store. WSL works too. |
| Git | `git --version` | Git for Windows includes the credential manager that signs you in to GitHub. |
| Excel / LibreOffice / Google Sheets | — | Google Sheets: File → Download → .xlsx, save as `content.xlsx`. |
| A GitHub account | — | free |

No `pip install` is needed to run the studio or build the site. `openpyxl` is needed only for two
optional tools: `tools/make_seed.py` (reset the workbook to the starter) and
`tools/upgrade_workbook.py` (add newly supported rows/sheets to your workbook).

---

## 2. Run the studio

```bash
cd ml-portfolio
python studio.py
```

- Dashboard: <http://localhost:5173/studio>
- Preview: <http://localhost:5173/> (add `?theme=terminal` or `?theme=paper` to force a theme)
- CV page: <http://localhost:5173/cv.html> · History page: <http://localhost:5173/history.html>

Keep the preview tab open. Every time you save the workbook, the studio rebuilds `content.json`
(the studio log shows `built content.json: 9 sections, 44 items`) and the browser reloads itself.

Options: `--port 8080`, `--no-open`. Commands: `python studio.py build | validate | init --remote URL | publish -m "msg"`.

**Dashboard cards**

- **Content** — workbook path, last build time, warnings (unknown layout, missing image, empty
  section), and **Will publish**: the theme, the pages and the sections per theme that your current
  settings produce. Check this before publishing.
- **GitHub** — remote, branch, uncommitted changes, last commit, live URL, links to Actions and
  Pages settings. **Connect GitHub** sets the remote.
- **Publish** — builds, commits everything, pushes. GitHub Actions deploys.

---

## 3. The workbook, sheet by sheet

Open `content.xlsx`. Sheets whose name starts with `_` are ignored (the `_README` sheet inside
the workbook is a short version of this section).

### `Settings` — key / value

Identity and hero: `site_title`, `name`, `first_name`, `initials`, `tagline`, `headline`, `roles`
(rotating words, `;`-separated), `roles_prefix`, `availability`, `location`, `email`, `phone`,
`avatar` (file in `site/assets/img/`), `resume_url`, `primary_cta_label/link`,
`secondary_cta_label/link`, `hero_note`, `hero_note_terminal`, `footer_note`, `seo_description`.

Look: `color_paper`, `color_paper_2`, `color_ink`, `color_accent`, `color_accent_2..4`,
`font_display`, `font_hand`, `font_body` (Google Font names), `scene_density`,
`scene_opacity_sections`, `show_grain`, `hero_era`, `journey_title`, `cv_title`.

Themes: `theme` (paper / terminal — what GitHub Pages opens with), `theme_toggle`,
`terminal_user`, `terminal_bg`, `terminal_fg`, `terminal_dim`, `terminal_accent`, `terminal_font`,
`terminal_scanlines`, `terminal_boot`, `terminal_banner` (ascii / text / none), `terminal_field`,
`terminal_wireframe`, `terminal_typing`.

Switches (yes / no) — see §5.

### `Sections` — one row per section

| Column | Meaning |
|---|---|
| `id` | the sheet name that holds the rows |
| `title`, `eyebrow`, `intro` | heading, small line above it, paragraph under it |
| `layout` | `timeline`, `cards`, `tags`, `stats`, `text`, `list`, `gallery`, `table`, `contact` |
| `order` | number, lower first |
| `era` | which `Journey` row this section belongs to (paper theme: the 3D diagram + rail) |
| `doodle` | icon next to the eyebrow (paper theme) |
| `columns` | grid columns for cards / stats / list / gallery |
| `visible` | yes / no — hide the whole section everywhere |
| `themes` | `all`, `paper` or `terminal` — show the section in one theme only |
| `show_in_nav` | yes / no — list it in the menu / tabs |
| `show_in_cv` | yes / no — include it on cv.html |
| `nav_label` | text for the menu (defaults to the title / sheet name) |
| `command` | terminal theme: the command that "types" itself, e.g. `cat work.log` |
| `cta_label`, `cta_link` | optional button under the section |

Any sheet not listed here still shows up (as cards, at the end).

### Content sheets (`About`, `Experience`, `Projects`, …)

One row per item; every column is a field. Recognised columns: `title`, `subtitle`, `org`,
`role`, `location`, `start`, `end`, `date`, `description` (markdown-lite), `tags`, `tools`,
`link`, `link_label`, `links` (`Label|url ; Label|url`), `image`, `images`, `icon`, `color`,
`group`, `level` (1–5), `value`, `label`, `featured`, `status`, `order`, `hidden`. Any other column
is shown as a small "key: value" chip, so you can add anything.

`description` formatting: blank line = paragraph, `- ` = bullet, `**bold**`, `*italic*`,
`` `code` ``, `[text](https://url)`.

### `Journey` — the eras of ML history

`id`, `year`, `title`, `insight`, `shape` (`neuron`, `perceptron`, `mlp`, `cnn`, `deep`,
`transformer`, `constellation`), `color`, `order`, `visible`. Used by the paper theme (rail +
3D diagrams) and by `history.html` in the terminal theme.

### `Links` — social links

`label`, `url`, `icon` (github, linkedin, mail, twitter, globe, …), `show_in`
(all / nav / hero / footer / contact / none), `order`.

### `Text` — every word that is not content

Buttons, hints, the terminal's commands, help text, boot lines, error lines, footer text, CV page
labels, history page labels. Change the `value`; delete a row to get the built-in default back.
`{placeholders}` such as `{name}`, `{year}`, `{source}`, `{id}`, `{n}` are filled in by the site.
Examples: `paper_theme_toggle` (the "Terminal" button), `term_boot_lines` (boot sequence, lines
separated by `|`), `term_keys` (status bar legend), `term_help` (what `help` prints),
`term_cmd_cards` (the command shown for a cards section, default `ls -la {id}/`).

---

## 4. Common tasks

**Add a project** → `Projects` sheet, new row. `featured` = yes makes it bigger (paper). `status`
shows as a chip. `image` = file name in `site/assets/img/`.

**Add a section** → new sheet (e.g. `Talks`) with a header row and rows → add a row to `Sections`
with `id` = `Talks`, a layout (`list`), an order. Optional: an `era`, a `command`.

**Hide something temporarily** → `hidden` = yes on the row, or `visible` = no on the section, or
`themes` = paper to keep it out of the terminal theme only.

**Reorder** → `order` numbers in `Sections` (sections) or in any sheet (rows).

**Change the menu text** → `nav_label` in `Sections`.

**Change what the terminal types** → `command` in `Sections`, or the `term_cmd_*` rows in `Text`.

**Add a photo** → put `me.jpg` in `site/assets/img/`, set `Settings.avatar` = `me.jpg`. Paper
theme shows it in the About section; terminal theme renders it as an ASCII portrait.

**Offer a resume PDF** → put the file in `site/assets/`, set `resume_url` = `assets/resume.pdf`.
Everything under `site/` is published, so keep private documents out of it (the project's `private/`
folder is gitignored for exactly that).

**Switch theme for the public site** → `Settings.theme` = `terminal` or `paper`.

**Drop a page** → `show_cv_page` = no or `show_history_page` = no. Links disappear and the
workflow deletes the file from the deployed site.

**Change colours / fonts** → `color_*`, `font_*`, `terminal_*` in `Settings`. Fonts are Google
Font names.

**Reset to the starter** → `pip install openpyxl` then `python tools/make_seed.py` (overwrites
`content.xlsx`).

---

## 5. Switches — what to show and what not

All in `Settings`, all yes / no unless noted. Blank = default (yes).

| Both themes | Paper only | Terminal only |
|---|---|---|
| `show_nav` | `show_era_note` | `show_section_numbers` |
| `show_footer` | `show_journey_rail` | `show_status_bar`, `show_clock` |
| `show_scroll_cue` | `show_grain` | `show_prompt`, `show_shortcuts` |
| `show_roles`, `show_socials` | `paper_modal` (card click opens details) | `terminal_field` (background characters) |
| `show_location`, `show_availability` | `show_scene` (3D diagrams) | `terminal_wireframe` (rotating ASCII shape / portrait) |
| `show_hero_note`, `show_generated_line` | | `terminal_banner` (ascii / text / none) |
| `show_cv_page`, `show_history_page` | | `terminal_typing`, `terminal_boot`, `terminal_scanlines` |
| `theme_toggle` | | |

The **Will publish** line in the studio reflects these immediately.

---

## 6. Publish to GitHub Pages

One-time setup:

1. Git identity (once per machine):
   ```bash
   git config --global user.name "Your Name"
   git config --global user.email "you@example.com"
   ```
2. On GitHub: **New repository**, empty (no README). Name: anything (`portfolio`) → site at
   `https://<you>.github.io/portfolio/`; or `<you>.github.io` → site at `https://<you>.github.io/`.
3. Studio → GitHub card → paste `https://github.com/<you>/<repo>.git` → **Connect GitHub**.
4. Studio → **Publish to GitHub**. First time, Git opens a sign-in window; sign in.
5. Repo → **Actions** tab: "Build & deploy portfolio" runs (~1 minute) and switches Pages on by
   itself. The studio then shows the live URL.
6. Only if that run fails at "configure-pages": **Settings → Pages → Build and deployment →
   Source: GitHub Actions**, then re-run the workflow from the Actions tab.

Every later change: save the workbook → check the preview → **Publish**. That is the whole loop.
Committing only `content.xlsx` is enough: the workflow rebuilds `content.json` on the runner and
removes pages you switched off.

Without the studio: `git add -A && git commit -m "update" && git push`.

Custom domain: create `site/CNAME` with your domain, set DNS per GitHub's docs, set the domain in
Settings → Pages, publish.

---

## 7. Where things are (if you want to go further)

```
content.xlsx                 your content
studio.py                    local preview + dashboard + publish
tools/build_content.py       xlsx → site/content.json (stdlib only; --prune removes disabled pages)
tools/upgrade_workbook.py    add new settings/text rows to your workbook (openpyxl)
tools/make_seed.py           regenerate the starter workbook (openpyxl)
site/index.html              both themes boot from here
site/cv.html                 printable CV
site/history.html            ML history (terminal theme)
site/assets/css/style.css    paper theme
site/assets/css/terminal.css terminal theme
site/assets/js/app.js        paper renderer (RENDERERS = one function per layout)
site/assets/js/terminal.js   terminal renderer
site/assets/js/content.js    shared helpers (markdown-lite, dates, Text lookup, switches)
site/assets/js/scene.js      3D diagrams (Three.js); layouts.js holds the architectures
site/assets/js/ascii*.js     ASCII banner/portrait, character field, wireframes, ASCII diagrams
.github/workflows/deploy.yml build + deploy on push
```

Adding a layout = one function in `app.js` (and one in `terminal.js` for the terminal look).
Adding an architecture = one function in `layouts.js`.

---

## 8. Troubleshooting

| Symptom | What to do |
|---|---|
| "Could not load content.json" | Use `python studio.py`; opening `index.html` from the file system does not work. |
| Preview doesn't update after saving | Look at the studio window: `BUILD FAILED …` names the problem (e.g. two sheets with the same name). |
| Studio says the workbook is locked | Excel was saving. It retries by itself. |
| A new setting has no effect | Spelling: keys are lowercase with underscores. Value must be `yes` / `no`. |
| A Text row has no effect | The key must match exactly (see the `note` column); an empty value means "use default". |
| Publish: "Please tell me who you are" | Run the two `git config --global` commands from §6. |
| Publish: authentication failed | Sign in when Git asks, or use a GitHub personal access token as the password. |
| Site not updating after a push | Check the Actions tab for a red run. If "configure-pages" failed, set Settings → Pages → Source to **GitHub Actions** and re-run. |
| The site flips between the portfolio and the rendered README | The repository's Pages source is still **Deploy from a branch**, so GitHub's own "pages build and deployment" (Jekyll) publishes the repo root while this workflow publishes `site/`. They race and the last one wins. Set Settings → Pages → Build and deployment → Source to **GitHub Actions**; the Jekyll build then stops and only the workflow deploys. |
| Visitors still see the other theme | With `theme_toggle` = no the Settings theme always wins, including for people who switched on an earlier visit. With it set to yes, their saved choice is remembered. |
| A page you disabled is still online | Wait for the next Actions run to finish; hard-refresh (Ctrl+F5). |
| No 3D scene / no fonts | The browser blocked `cdn.jsdelivr.net` or Google Fonts; everything else still works. |
| Terminal theme shows nothing after the boot lines | Press any key — the boot is skippable; if it still hangs, set `terminal_boot` = no. |
