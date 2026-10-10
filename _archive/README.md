# Archive (not deployed)

Files from the previous version of the site. Nothing in the live page references them,
and `netlify.toml` returns 404 for `/_archive/*`, so they are not served.

- `script.js` / `style.css` / `meta.html` — old multi-file implementation (language switcher, gallery, admin blog modal).
  **`script.js` contains a hard-coded admin password. It was publicly downloadable while deployed.
  If you use that password anywhere else, change it.** Client-side passwords are never real security.
- `data/*.json` — unused sample data (contains placeholder `*.demo.com` links).

Safe to delete once you no longer need them for reference.
