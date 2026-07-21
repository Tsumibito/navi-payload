# Navi.training content localization workflow

## Editorial contract

Saving and publishing are separate operations. An AI job may create or update localized fields, but it never changes a post to `published`. The editor chooses the source language, enables automation, reviews every locale and the proposed link plan, then marks the post ready/published.

States: `draft` → `localizing` → `review` → `ready` → `published`. Failures retain the editorial data and are visible in the Payload Jobs log.

## Pipeline

1. A save compares `name`, `content`, `summary`, and `image` with the previous source revision.
2. Only changed/missing fields are queued in `content-localization`; duplicate pending jobs for the same post supersede older jobs.
3. The source locale receives missing SEO fields, summary, featured-image alt and a link plan.
4. Missing/outdated target fields are translated in small text-node batches. Lexical structure, uploads, formatting and existing URLs are preserved.
5. SEO is generated independently for every locale: title, description and focus keyphrase.
6. A locale-specific internal-link plan selects 2–6 related articles sharing topic tags. Every proposal contains an exact natural anchor, target, reason and section hint. It is intentionally reviewable instead of silently inserting low-quality links.
7. The post moves to `review`; the editor checks terminology, links and snippets and explicitly publishes.

## Topic-cluster linking rules

- Prefer articles sharing one or more tags; later add explicit pillar/cluster relationships to Tags.
- Links must answer the reader's likely next question at that point in the article.
- Spread links through relevant sections; do not collect them in the conclusion.
- Use 2–6 contextual links depending on article length, no repeated target, no forced exact-match SEO anchors.
- Preserve every existing indexed route. Localized editorial slugs are rewritten to the frozen public route during Astro SSG.
- Link proposals are locale-specific because useful anchors and search intent differ by language.

## Adding a language

Add one entry to `src/config/contentLocales.ts` and redeploy/migrate Payload. The locale automatically becomes available in the editor, job input and target list. Existing posts can then be re-saved with the new target selected to backfill that language. Astro route generation for the new locale is a separate deploy step and must be completed before publishing it.

## Runtime

Payload's durable Jobs Queue runs one localization job at a time every minute. Each job retries twice, and concurrency is keyed by post ID. This avoids blocking the admin save request and prevents simultaneous translations from overwriting one another.

Production must provide `OPENROUTER_TOKEN`. Optional `OPENROUTER_LOCALIZATION_MODEL` defaults to `openai/gpt-4.1-mini`.
