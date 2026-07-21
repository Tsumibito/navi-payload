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
