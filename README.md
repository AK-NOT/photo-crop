# Figure Cropper
photo-crop.vercel.app

A tiny local web app for cropping extra whitespace from figures, graphs, and screenshots.

## Features

- Drag and drop or upload PNG, JPG, JPEG, and WEBP images
- Auto-trim white margins
- Drag crop handles or type exact crop dimensions
- Download the cropped image locally
- No server or upload required; the image stays in your browser

## Run

Open `index.html` in a browser.

For a local server:

```powershell
python -m http.server 8087 --bind 127.0.0.1
```

Then visit `http://127.0.0.1:8087`.
