# Paint Planogram

A phone friendly map of the Behr paint chip wall. Customers scan a QR code at the wall, search for a color by name or number, and the map flashes where that chip sits.

Live site: https://blakeiis.github.io/Paint-Planogram/

## What it does

1. Search by color name ("Swiss Coffee") or number ("PPU7-13"). Partial words and typos still find results.
2. A whole wall map shows the found chip with a flashing ring and crosshair lines.
3. A close up of that section highlights the chip and gives plain directions (family, rows, column, row).
4. Links can point straight to a color, for example `?c=T27-01`.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page layout and security settings |
| `style.css` | Styles |
| `fonts/` | Atkinson Hyperlegible font (SIL Open Font License, see `fonts/LICENSE`) |
| `app.js` | Search, wall map, and close up logic |
| `data.js` | Every chip's name, number, color, and wall position (generated) |
| `raw/colors.json` | Source data from the color locator tool |
| `scripts/build_data.py` | Rebuilds `data.js` from `raw/colors.json` |
| `qr/` | Printable QR code sign |

## Updating colors after a wall reset

1. Replace `raw/colors.json` with a fresh export.
2. Run `python3 scripts/build_data.py raw/colors.json data.js`.
3. Commit and push. GitHub Pages updates in a minute or two.

## Wall layout

Left to right as you face it: Reds, Oranges, Yellows, Greens, Blues, Purples (each with Pure, Muted, Shaded and Neutral rows, 8 columns), then the Whites, Neutrals and Grays panel, then One Coat Hide, then the Designer Collection.

## Security

1. The page loads nothing from other websites. Fonts, scripts and styles are all served from this repo.
2. A Content Security Policy in `index.html` blocks scripts and styles from any other source, so injected code cannot run.
3. `scripts/build_data.py` rejects any color with an unexpected name, number or hex value, and leaves `data.js` untouched if anything fails.
4. The app never inserts raw HTML built from data, and it collects no personal information, cookies or analytics.
5. Keep two factor authentication on for the GitHub account, since whoever controls this repo controls the live site.
6. Check the printed QR sign regularly so nobody covers it with a fake code.
