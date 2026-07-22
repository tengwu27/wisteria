# Repository Scripts

- `assets/`: geometry and asset-package validation.
- `content/`: generated content and data exports.
- `media/`: cinematic masks, animation, and video-rendering utilities.

Scripts resolve paths from the repository root and should keep generated
delivery media under `public/media`, never beside editable source artwork.

Python asset and media scripts require the packages in
`requirements-assets.txt`. Install them in a project virtual environment before
running the tools:

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements-assets.txt
```
