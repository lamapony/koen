# Codex second pass

Added Python pipeline and Vitest coverage for missing values, real zeros, rank ties, bounds, weighting, 98 unique municipalities, uncertainty bands, source metadata and the Aarhusbolig 2017 date. Added an optional offline Playwright smoke test (`npm --prefix site run test:smoke`); browser startup was blocked by the sandbox's macOS Mach port permission, so it has not been verified here.

Fixed percentile ranks for a single municipality and all-missing indicator columns, and suppressed non-finite values in number formatting. Made the disabled Ventelistevalg manifest entry explicitly state that its licence is unresolved and the period was not fetched. The missing KK source entry now retains known licence and period metadata.

Validation: `npm test`, `npm run build`, and `UV_CACHE_DIR=/tmp/koen-uv-cache make check` passed. These tests use the existing local output data; a fresh offline pipeline rebuild was not verified. The pre-existing first-pass implementation was untracked when this pass began and remains outside this commit except for files changed by this pass.
