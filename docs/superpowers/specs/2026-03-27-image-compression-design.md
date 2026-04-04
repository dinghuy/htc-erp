# Image Upload Compression Design

## Scope
- Compress avatar uploads and product image uploads.
- Keep download/share URLs working by storing optimized files as normal assets under `/uploads`.
- Do not change document uploads or CSV/XLSX imports.

## Approach
- Frontend compresses images before upload to reduce transfer size.
- Backend normalizes uploaded images again so stored files are consistent across clients.
- PNG files with real transparency stay PNG.
- Non-transparent images are converted to lossy format for smaller size.

## Profiles
- Avatar: max 1024px, balanced compression.
- Product image: max 1600px, balanced compression.

## Constraints
- Transparent PNG assets must remain shareable PNG files.
- Stored files remain downloadable via the existing upload endpoints/URLs.
- On client-side compression failure, fallback to the original file.
