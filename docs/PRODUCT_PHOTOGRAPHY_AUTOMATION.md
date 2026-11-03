# MES STORE product photography automation

The repository includes an on-demand GitHub Actions workflow that creates **two separate 2:3 photographs per catalogue product**:

- `studio.jpg`: product-only, ghost-mannequin studio photograph on a neutral background.
- `model.jpg`: adult male model wearing the garment in a restrained studio fashion shot.

## One-time repository configuration

Add an Actions secret named `OPENAI_API_KEY`:

1. Open the repository's **Settings → Secrets and variables → Actions**.
2. Select **New repository secret**.
3. Set the name to `OPENAI_API_KEY` and paste an OpenAI API key with image-generation API access.

The secret is never stored in the repository or printed in workflow logs.

## Run

Open **Actions → Generate MES STORE product photography → Run workflow**.

- Leave Product IDs empty and Limit at 0 to process all 22 catalogue products (44 images).
- Use a comma-separated ID list such as `mes1,mes2` for a smaller run.
- Enable Force only when replacing already-generated photographs.

The workflow commits image files under `assets/products/{product-id}/`, updates `data/products.json`, and pushes to `main`. The existing Pages deployment workflow then publishes the updated catalogue.

## Accuracy and commercial review

These are AI-generated catalogue photographs created from the current product title, category, and colour metadata. The repository does not currently contain verified real-stock photography or detailed garment reference photos for every SKU. Therefore generated images can represent the intended category and colour but **cannot certify exact fabric, stitching, fit, print artwork, hardware, or stock condition**. The script marks each generated product with `media.photography.reviewRequired: true`. A store operator must compare the result with the physical item and approve it before treating it as an exact product photograph or accepting orders based on fine visual details.

Image generation is a paid API operation. Processing all 22 products makes 44 image-generation requests; review the OpenAI API billing and usage limits before running the full catalogue.
