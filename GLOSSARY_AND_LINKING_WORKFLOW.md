# Navi.training glossary and bidirectional linking

## Glossary data model

`glossary-terms` stores one language-neutral sailing concept per document. Translations are rows with a free-form BCP-47 locale code, so adding French (`fr`), Spanish (`es`), German (`de`), Polish (`pl`) or another language does not change the database schema.

Each translation has a preferred term, aliases, definition, usage notes, forbidden variants, provenance, confidence and its own review status. Only concepts and translations marked `approved` are injected into article localization prompts. Agent-discovered and imported entries remain `proposed` until an editor or review agent approves them.

When article localization runs, the agent extracts specialist concepts and proposes variants in `ru`, `uk`, `en`, `fr`, `es`, `de` and `pl`, attaching the source article as evidence. It never overwrites an approved translation. For the actual article translation, only approved source/target pairs that occur in that article are loaded, keeping prompts focused and affordable.

The source importer accepts the supplied Russian-English TXT and English-Russian PDF. It merges aliases by canonical English concept and is idempotent. A dry run parsed 3,444 entries into 3,013 concepts. Imported values are proposals because both historic sources contain ambiguous or outdated variants.

## Bidirectional internal linking

Every localized article receives:

1. Two to six outgoing links to relevant published articles sharing its topic tags.
2. Two to five incoming-link opportunities from existing published articles to the target article.

Anchors must occur verbatim in the source article. Duplicate URLs and unpublished targets are rejected. Outgoing links are inserted during editorial generation. Incoming links are stored as a reviewable plan while the target is a draft; when the target is explicitly published, the workflow reruns and inserts the approved-shape links into the selected older articles for each language. Existing frozen SEO routes are preferred, while new content may use its localized slug. Astro performs the final route-alias rewrite during SSG.

AI never publishes an article. New and regenerated content stops at editorial review, and glossary suggestions stop at `proposed`.

### Passage RAG and the existing-link graph

The linking workflow indexes localized Lexical blocks rather than sending whole articles to an LLM. `link_passages` stores the exact Lexical path, a content hash, heading, tags, links already present in the block and a 1024-dimensional multilingual BGE-M3 embedding. Only changed blocks are embedded again.

`internal_links` is the relational map of the site graph. Existing links are reconstructed from the article content on every index update; proposed, applied and rejected edges are also retained. Retrieval uses that graph to exclude already-linked page pairs and rejected placements, avoid blocks that already contain a link, cap links from overloaded source pages and favour page diversity.

For a new page, hybrid retrieval combines vector similarity, tag overlap and lexical overlap. At most 8–12 exact passages reach the editorial model. The model may only choose an anchor already present verbatim in one supplied passage. Applying a suggestion requires both the Lexical node path and its original content hash to match, so an editor's later change prevents a stale automated insertion.

Embeddings use OpenRouter and `baai/bge-m3` through the existing `OPENROUTER_TOKEN`; `OPENROUTER_EMBEDDING_MODEL` can override the model without changing code. No separate Workers AI credential is required. The authenticated `/api/internal-link-index` endpoint backfills published posts in bounded batches and reports graph/index totals.

Publishing a post, changing indexed content on a published post, or taking it out of publication automatically queues a per-post incremental index job. The job refreshes every available language, embeds only blocks whose content hash or embedding model changed, rebuilds the affected graph edges, and removes inactive passages on unpublish. Jobs are started by the editor action itself rather than by a permanent polling process, preserving Neon scale-to-zero while retaining durable queued work and bounded retries.

## Encyclopedia MVP

The first public release is deliberately limited to 100–150 editorially selected concepts. The existing imported corpus remains in `backlog`; candidates move through `mvp` and only an approved concept in the `published` release is exposed to the Astro SSG build. One concept can have any number of BCP-47 language rows, and each language row owns its route slug, short definition, encyclopedia text, SEO copy and image alt text.

Glossary concepts reuse the existing `tags-new` taxonomy instead of creating a parallel category system. A concept can belong to several existing blog tags/categories. Tag pages may render a **Yachting encyclopedia** block containing published concepts from that tag, while encyclopedia pages link back to relevant tag hubs, posts and courses.

Source material is merged at the concept/sense level, never by concatenating strings. DeepSeek or another configured OpenRouter model may classify, deduplicate, translate and rewrite source records, but every result retains a field-level source ledger: source URL or record ID, retrieval date, license and reuse policy. `reference-only` material may inform validation but must not be reproduced. AI output is a derived proposal, not a substitute for provenance or license review.

Recommended MVP languages are the currently supported site languages (`ru`, `uk`, `en`). The schema already supports later `fr`, `es`, `de`, `pl` and other locales without migrations. A language version is published only when its translation, definition, slug, SEO copy and terminology have passed review; missing languages must not silently fall back to Russian on public encyclopedia routes.

## Deferred: community submissions

After the MVP dictionary is stable, add a separate `glossary-submissions` moderation queue. Visitors will be able to propose a term, translation, correction or source. Deterministic validation and an LLM will detect duplicates, assess evidence and prepare a merge diff; only an editor can approve the change. The public form will require rate limiting, Turnstile, an audit trail and a contributor license declaration. This collection and public form are intentionally not part of the MVP.

## Source import

After the glossary migration is deployed:

```sh
npm run glossary:import -- --txt='/path/словарь яхтенных терминов.txt' --pdf='/path/4. GLOSSARY of YACHTING A5.pdf'
```

Add `--dry-run` to parse and count without writing to the database.

Generate reviewable Ukrainian, French, Spanish, German and Polish proposals in batches:

```sh
npm run glossary:translate -- --locales=uk,fr,es,de,pl --limit=200
```

Omit `--limit` for a complete backfill. Existing language rows, especially approved/manual ones, are never overwritten.
