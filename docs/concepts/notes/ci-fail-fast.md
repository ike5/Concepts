# Matrix fail-fast

_tooling · beginner_

GitHub Actions cancels the rest of a job matrix as soon as one job fails, unless fail-fast is false. That saves minutes but hides whether the other platforms would have passed.

## Where it showed up (1)

### 2026-11-06 · [Who expands a glob?](../commits/2026-11-06-7ca4c08-who-expands-a-glob/README.md) · `7ca4c08`

One Linux failure cancelled the macOS and Windows jobs; now each platform reports its own result.

Files: `.github/workflows/ci.yml`

## My notes

<!-- Your own notes below this line are kept when this file is regenerated. -->

