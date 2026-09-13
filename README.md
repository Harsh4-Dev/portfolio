# ML Portfolio — a 3D journey through the history of learning machines

A static portfolio / CV site for GitHub Pages. **All content lives in one Excel file**
(`content.xlsx`); the page, the printable CV and the 3D scene adapt to whatever you put in it.

The hero is a Three.js network drawn in a doodle style on cream paper. As you scroll through your
CV it morphs into real architectures from ML history — McCulloch–Pitts neuron (1943), Rosenblatt's
Mark I Perceptron (1958), a backprop MLP (1986), LeNet-5 (1998), AlexNet's two-GPU split (2012), the
Transformer (2017) — and finally into your own constellation. Each era carries a one-line historical
insight, editable in the workbook.

```
ml-portfolio/
├── content.xlsx            ← THE thing you edit (one sheet per section, one row per item)
├── studio.py               ← local preview + dashboard + "Publish to GitHub" button
├── tools/
│   ├── build_content.py    ← content.xlsx -> site/content.json (stdlib only, used by CI too)
│   └── make_seed.py        ← regenerates the starter workbook (needs openpyxl; you rarely need it)
├── site/                   ← what gets deployed
│   ├── index.html          ← the portfolio
│   ├── cv.html             ← printable CV from the same data
│   ├── content.json        ← generated
│   └── assets/{css,js,img} ← put your images in assets/img/
└── .github/workflows/deploy.yml   ← builds & deploys on every push
```

## 1. Run it locally

```bash
python studio.py
```

Opens the studio at <http://localhost:5173/studio> (preview at <http://localhost:5173/>). It watches
`content.xlsx`: save in Excel and the browser reloads. No dependencies beyond Python 3.10+.

Opening `site/index.html` directly from the file system does **not** work (browsers block `fetch`
on `file://`) — always go through `studio.py` or any static server.

## 2. Edit the content

Open `content.xlsx`. The `_README` sheet inside explains everything; the short version:

| Sheet | What it is |
|---|---|
| `Settings` | key / value pairs: name, headline, rotating roles, colours, fonts, links to CTAs, hero era… |
| `Sections` | one row per section: `id` (= sheet name), `title`, `eyebrow`, `intro`, `layout`, `order`, `era`, `doodle`, `columns`, `visible`, `cta_label`, `cta_link` |
| `Journey` | the eras of the 3D story: `id`, `year`, `title`, `insight`, `shape`, `color` |
| `Links` | social links: `label`, `url`, `icon`, `show_in` (all / nav / hero / footer / contact) |
| **any other sheet** | a section. Each row is an item, each column a field. |

**Adding a section** = add a sheet, add a row in `Sections` to choose its layout/order/era. A sheet
that is not listed in `Sections` still shows up (as cards, at the end).
**Adding an item** = add a row. **Adding a field** = add a column — unknown columns are rendered as
small "detail" chips so nothing is lost. **Hiding** = `hidden` = yes on the row, or `visible` = no on
the section. Sheets whose name starts with `_` are ignored.

### Layouts

| `layout` | Use for | Notable columns |
|---|---|---|
| `timeline` | experience, education | `title`, `org`, `location`, `start`, `end`, `description`, `tags`, `icon` |
| `cards` | projects (click opens a detail modal) | `title`, `subtitle`, `description`, `tags`, `link`, `link_label`, `links`, `image`, `images`, `featured`, `status`, `date`, `color`, `icon` |
| `tags` | skills | `title`, `group`, `level` (1–5), `icon`, `link` |
| `stats` | headline numbers | `value`, `label`, `icon` |
| `text` | about | `title`, `description`, `image` |
| `list` | achievements, certifications, talks | `title`, `subtitle`, `date`, `description`, `link`, `icon`, `group` |
| `gallery` | pictures | `image` / `images`, `caption` |
| `table` | anything tabular | every column becomes a table column |
| `contact` | contact block | `title`, `subtitle`, `link`, `icon` (+ the `Links` sheet) |

`description` understands a little markdown: blank line = paragraph, `- ` = bullet, `**bold**`,
`*italic*`, `` `code` ``, `[text](https://url)`. `tags` / `tools` are comma- or semicolon-separated.
`links` holds several links: `GitHub|https://… ; Paper|https://…`. Dates can be `2026-06`, `Jun 2026`,
`2026`, `Present`, or real Excel dates. `icon` is an emoji or one of the doodle names:
`brain chip network graph lightbulb rocket book trophy medal mail pin coffee code heart flask globe
star sparkle wave squiggle neuron github linkedin twitter link download`.

### The 3D journey

`Journey` rows are the eras. `shape` picks the architecture the network morphs into:
`neuron`, `perceptron`, `mlp`, `cnn`, `deep`, `transformer`, `constellation`. Assign an era to each
section with the `era` column in `Sections`; several sections may share one. `Settings.hero_era`
chooses the shape the scene assembles into on load. The side rail (desktop) lists the eras in the
order they appear and shows the active era's insight. Rewrite the insights, reorder, add or remove
eras freely — the scene follows.

Other knobs in `Settings`: `color_*` (cream / ink / four accents), `font_display`, `font_hand`,
`font_body` (any Google Font), `scene_density` (low / medium / high), `scene_opacity_sections`,
`show_grain`, `show_journey_rail`, `roles` (rotating words), `availability` pill, CTAs, `resume_url`.

### Images

Drop files in `site/assets/img/` and refer to them by file name (`me.jpg`) in `image`, `images`
or `Settings.avatar`. Full URLs work too. The studio warns about missing files.

## 3. Publish to GitHub Pages

1. Create an **empty** repository on GitHub (e.g. `portfolio`, or `<you>.github.io` for a root site).
2. In the studio's **GitHub** card paste the repository URL and click **Connect GitHub**
   (or: `python studio.py init --remote https://github.com/<you>/<repo>.git`).
3. Click **Publish to GitHub** (or `python studio.py publish -m "first version"`).
   This builds `content.json`, commits everything and pushes `main`.
4. **Once**, on GitHub: repository → *Settings* → *Pages* → *Build and deployment* → Source:
   **GitHub Actions**. The included workflow runs on every push, rebuilds `content.json` from the
   workbook on the runner and deploys `site/`. The site appears at `https://<you>.github.io/<repo>/`
   in about a minute (the studio shows the link and the Actions page).

After that the loop is: edit Excel → save → check the preview → Publish. Editing `content.xlsx`
alone is enough; the workflow regenerates the JSON.

## Customising further

- Layout renderers are small functions in `site/assets/js/app.js` (`RENDERERS`). Add one, and the
  new `layout` value is available in the `Sections` sheet.
- Architectures for the scene are in `site/assets/js/scene.js` (`LAYOUTS`): each returns node
  positions and directed edges; the morphing, pulses and doodle rendering are shared.
- Doodle icons are hand-drawn SVG paths in `site/assets/js/doodles.js`.
- Colours, fonts and spacing tokens are at the top of `site/assets/css/style.css`; the Settings sheet
  overrides colours/fonts at runtime.

## Troubleshooting

- **Preview shows "Could not load content.json"** — run `python studio.py` (it builds the file) and
  open the page through the server, not from the file system.
- **Excel says the file is locked / build says "locked"** — Excel holds the file while saving; the
  watcher retries automatically.
- **Publish fails with "Please tell me who you are"** — run once:
  `git config --global user.name "Your Name"` and `git config --global user.email you@example.com`.
- **Pushed but nothing deployed** — enable Pages with Source = GitHub Actions (step 4) and check the
  Actions tab for the run log.
- **No 3D scene** — it needs WebGL and access to `cdn.jsdelivr.net` (Three.js). The page still
  renders everything else without it.
