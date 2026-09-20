# Setup

Step-by-step, from a fresh machine to a live GitHub Pages site. `README.md` is the reference for
what every sheet, column and setting does; this file is the walkthrough.

## 1. Requirements

| Need | Why | Check |
|---|---|---|
| Python 3.10 or newer | runs the studio and the Excel→JSON builder (standard library only) | `python --version` |
| Git | publishing | `git --version` |
| Excel, LibreOffice Calc or Google Sheets (export as .xlsx) | editing `content.xlsx` | — |
| A GitHub account | hosting on GitHub Pages (free) | — |

Optional: `pip install openpyxl` only if you ever want to regenerate the starter workbook with
`python tools/make_seed.py`. Normal use never needs it.

Windows: use the normal `python` from python.org or the Microsoft Store. WSL works too, and the
studio's "Open content.xlsx" button opens Excel on the Windows side.

## 2. Start the studio

```bash
cd ml-portfolio
python studio.py
```

Your browser opens the dashboard at <http://localhost:5173/studio>. The site preview is at
<http://localhost:5173/> (keep this tab open — it reloads itself every time you save the workbook).

If the port is taken: `python studio.py --port 8080`. To skip opening the browser: `--no-open`.

## 3. Make it yours

1. Click **Open content.xlsx** in the dashboard (or open the file yourself).
2. Start with the `Settings` sheet: `name`, `tagline`, `headline`, `roles`, `email`, `location`,
   `availability`, the CTA labels and links. Save — the preview updates.
3. Go through the content sheets (`About`, `Experience`, `Projects`, …). Edit rows, delete rows,
   add rows. Put `yes` in a `hidden` column to keep a row without showing it.
4. Reorder or rename sections in `Sections` (`order`, `title`, `eyebrow`). Change a section's
   look with `layout`. Attach a moment of ML history with `era`.
5. Add a section: create a new sheet, give it a header row, add a row to `Sections` for it.
6. Images: copy files into `site/assets/img/` and write the file name in an `image` column or in
   `Settings.avatar`. The dashboard's status card warns about names that do not exist.
7. To offer a resume PDF, drop it in `site/assets/` and point `Settings.resume_url` at it
   (e.g. `assets/resume.pdf`). Leave `resume_url` blank for no resume link. Remember that anything
   under `site/` is published publicly.

The dashboard's **Status** shows warnings from the builder (unknown layout, missing image, empty
section). "all good" means the workbook is clean.

### Every word and every part is yours to change

- **Words**: the `Text` sheet holds every label the site prints (button text, hints, the terminal's
  commands and help lines, footer). Edit the value column. Delete a row to fall back to the default.
- **Parts**: rows starting with `show_`, `terminal_` and `paper_` in `Settings` switch parts on or
  off (yes/no). Pages: `show_cv_page`, `show_history_page`.
- **Sections**: `themes` decides in which theme a section appears, `show_in_nav` / `show_in_cv`
  where it is listed, `nav_label` what the menu says, `command` what the terminal "types".

The dashboard's **Will publish** line reflects your choices immediately.

## 4. Pick a theme

`Settings.theme` decides which theme the site opens with — this is what GitHub Pages serves:

| `theme` | Look |
|---|---|
| `paper` | cream paper, ink doodles, 3D diagrams that dissolve into dust |
| `terminal` | black & white CLI with one yellow: boot sequence, typed commands, ASCII banner / portrait, animated character field, shortcuts, a working prompt. ML history on its own page (`history.html`) |

Visitors can switch with the toggle in the header (disable with `theme_toggle` = no). While
previewing you can also force one with `?theme=terminal` or `?theme=paper` in the URL. Terminal
colours and the monospace font are the `terminal_*` settings.

## 5. Publish to GitHub Pages

One-time:

1. Tell git who you are (once per machine):
   ```bash
   git config --global user.name "Your Name"
   git config --global user.email "you@example.com"
   ```
2. On GitHub create a **new empty repository** (no README, no .gitignore). Name it anything, e.g.
   `portfolio`. Name it `<username>.github.io` if you want the site at the root of your domain.
3. In the dashboard's **GitHub** card, paste the repository URL
   (`https://github.com/<you>/<repo>.git`) and click **Connect GitHub**.
4. Click **Publish to GitHub**. The first push may ask you to sign in to GitHub — sign in in the
   window that appears (Git Credential Manager handles this on Windows/macOS).
5. Watch the **Actions** tab: the "Build & deploy portfolio" workflow runs for about a minute and
   switches Pages on by itself. The site is then live at `https://<you>.github.io/<repo>/`
   (the dashboard shows the link).
6. Open the repository → **Settings → Pages → Build and deployment** and confirm **Source** is
   **GitHub Actions**. If it says *Deploy from a branch*, change it: otherwise GitHub also runs its
   own Jekyll build on the repo root, the two deployments race, and the site alternates between
   your portfolio and a rendered README.

Every time after that: edit the workbook → save → **Publish**. Nothing else. The workflow
regenerates `content.json` from `content.xlsx` on GitHub's side, so committing the workbook alone
is enough even if you push from somewhere without Python.

Command-line equivalents:

```bash
python studio.py init --remote https://github.com/<you>/<repo>.git
python studio.py publish -m "update projects"
```

## 6. Custom domain (optional)

Add a file `site/CNAME` containing your domain (e.g. `harsh.dev`), point the domain's DNS at GitHub
Pages as described in GitHub's docs, then set the domain under Settings → Pages. Publish again.

## 7. Updating the site code

Everything under `site/` is plain HTML/CSS/JS with no build step. Edit, save, the preview reloads
on the next refresh. Keep `site/content.json` out of your hands — it is regenerated from the
workbook on every save and on every deploy.

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| "Could not load content.json" | Open the site through `python studio.py`, not by double-clicking `index.html`. |
| Preview does not reload after saving | Check the studio window for "BUILD FAILED" — a malformed workbook (e.g. two sheets with the same name) stops the build. |
| "content.xlsx is locked" in the log | Excel was mid-save. The watcher retries by itself. |
| Publish: "Please tell me who you are" | Run the two `git config --global` commands from step 5.1. |
| Publish: authentication failed | Sign in when Git asks, or create a personal access token on GitHub and use it as the password. |
| Pushed, but the site is not updating | Settings → Pages → Source must be **GitHub Actions**. Then check the Actions tab for a red run. |
| No 3D / ASCII scene | Needs WebGL and access to `cdn.jsdelivr.net`. The rest of the page works without it. |
| Fonts look different offline | Google Fonts are fetched at view time; offline the system fallbacks are used. |
| Windows says `python` is not recognised | Install Python from python.org and tick "Add python.exe to PATH", or use `py studio.py`. |
