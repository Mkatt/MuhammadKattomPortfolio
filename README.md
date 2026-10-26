# Muhammad Kattom's portfolio

Static website hosted with GitHub Pages from the root of the `master` branch.

- `index.html`: introduction and project cards.
- `styles.css`: page styling.
- `projects.js`: project descriptions, results, PDF page metadata, and grammar examples.
- `app.js`: project dialogs, inline document reader, and Dyck path explorer.
- `assets/`: original PDFs and images. `assets/documents/` holds page images used by the inline reader.

Keep the folder structure intact when uploading or publishing. Asset URLs are relative so the site works under its GitHub Pages repository path. PDFs still open in the inline reader, with an option to open the original PDF in a new tab.

Run `node check.cjs` to check project and reader behavior without browser dependencies. This is a mocked DOM check, not a visual browser test.

To update the published website, commit changes and push `master` to GitHub. Check the repository's Actions tab for the Pages deployment result.
