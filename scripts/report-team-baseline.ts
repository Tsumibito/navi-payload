#!/usr/bin/env tsx

import 'dotenv/config';

import fetch from 'node-fetch';
import { getPayload } from 'payload';

import payloadConfig from '../src/payload.config';
import type { DataFromCollectionSlug } from '../src/payload-types';

type TeamDoc = DataFromCollectionSlug<'team-new'>;
type PostDoc = DataFromCollectionSlug<'posts-new'>;

const BASEROW_TABLE_ID = 356533;
const BASEROW_ENDPOINT = `https://api.baserow.io/api/database/rows/table/${BASEROW_TABLE_ID}/?user_field_names=true&size=200`;

async function main() {
  const BASEROW_API_KEY = process.env.BASEROW_API_KEY;
  if (!BASEROW_API_KEY) {
    throw new Error('BASEROW_API_KEY is not defined');
  }

  const payload = await getPayload({ config: payloadConfig });

  const baserowResponse = await fetch(BASEROW_ENDPOINT, {
    headers: {
      Authorization: `Token ${BASEROW_API_KEY}`,
    },
  });

  if (!baserowResponse.ok) {
    throw new Error(`Failed to fetch Baserow Team table: HTTP ${baserowResponse.status}`);
  }

  const baserowJson = (await baserowResponse.json()) as {
    count: number;
    results: Array<Record<string, unknown>>;
  };

  const baserowSample = baserowJson.results.slice(0, 5).map((row) => {
    const {
      id,
      Slug,
      Name_RU,
      Name_UA,
      Name_EN,
      Bio_RU,
      Bio_UA,
      Bio_EN,
      'Bio Summary_RU': bioSummaryRu,
      'Bio Summary_UA': bioSummaryUa,
      'Bio Summary_EN': bioSummaryEn,
      'Job Title_RU': jobTitleRu,
      'Job Title_UA': jobTitleUa,
      'Job Title_EN': jobTitleEn,
      Instagram: instagram,
      Facebook: facebook,
      Twitter: twitter,
      Phone: phone,
      Email: email,
      Linkedin: linkedin,
    } = row as Record<string, unknown>;

    return {
      id,
      slug: Slug,
      name: {
        ru: Name_RU,
        ua: Name_UA,
        en: Name_EN,
      },
      jobTitle: {
        ru: jobTitleRu,
        ua: jobTitleUa,
        en: jobTitleEn,
      },
      bioSummary: {
        ru: bioSummaryRu,
        ua: bioSummaryUa,
        en: bioSummaryEn,
      },
      bio: {
        ru: Bio_RU,
        ua: Bio_UA,
        en: Bio_EN,
      },
      contacts: {
        email,
        phone,
        instagram,
        facebook,
        twitter,
        linkedin,
      },
    };
  });

  const payloadTeam = await payload.find<TeamDoc>({
    collection: 'team-new',
    limit: 200,
    locale: 'all',
  });

  const payloadSample = payloadTeam.docs.slice(0, 5).map((doc) => ({
    id: doc.id,
    slug: doc.slug,
    hasPhoto: Boolean(doc.photo),
    name: doc.name,
    position: doc.position,
    bioSummaryLocales: Object.keys(doc.bio_summary ?? {}),
    bioLocales: Object.keys(doc.bio ?? {}),
    links: doc.links,
    posts: doc.posts,
  }));

  const payloadPostIds = new Set<string>();
  for (const doc of payloadTeam.docs) {
    if (Array.isArray(doc.posts)) {
      for (const rel of doc.posts) {
        if (rel && typeof rel === 'object' && 'value' in rel && typeof rel.value === 'string') {
          payloadPostIds.add(rel.value);
        }
      }
    }
  }

  let postsLookup: Record<string, string> | undefined;
  if (payloadPostIds.size > 0) {
    const postsResult = await payload.find<PostDoc>({
      collection: 'posts-new',
      limit: payloadPostIds.size,
      where: {
        id: {
          in: Array.from(payloadPostIds),
        },
      },
    });

    postsLookup = postsResult.docs.reduce<Record<string, string>>((acc, post) => {
      acc[post.id] = post.slug;
      return acc;
    }, {});
  }

  const summary = {
    baserow: {
      count: baserowJson.count,
      sample: baserowSample,
      fields: baserowJson.results.length > 0 ? Object.keys(baserowJson.results[0]) : [],
    },
    payload: {
      totalDocs: payloadTeam.totalDocs,
      sample: payloadSample,
      fields: payloadTeam.docs.length > 0 ? Object.keys(payloadTeam.docs[0]) : [],
      postsLookup,
      postsLinkedCount: Array.from(payloadPostIds).length,
      teamWithoutPosts: payloadTeam.docs
        .filter((doc) => !Array.isArray(doc.posts) || doc.posts.length === 0)
        .map((doc) => ({ id: doc.id, slug: doc.slug })),
    },
  };

  console.log(JSON.stringify(summary, null, 2));

  await payload.close?.();
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
