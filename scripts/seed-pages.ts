#!/usr/bin/env tsx
/**
 * Sprint 3B-1: Seed 8 base Pages / 19 locale variants as drafts via Payload Local API.
 *
 * Safety:
 * - No implicit dotenv loading. Requires explicit --env-file.
 * - Refuses production endpoint by comparing against root .env.
 * - --allow-production overrides the guard (requires interactive confirmation).
 *
 * Idempotent:
 * - Finds existing Page by pageKey; creates only if missing.
 * - Updates locale data only when it differs from current draft.
 * - Errors on duplicate pageKey (should never happen with unique constraint).
 *
 * Locale codes: ru, uk, en (NOT ua — `ua` is a URL contract only).
 * SEO data (title, description, h1) sourced from audit/diffs/static-page-migration.csv.
 * Content and OG images left NULL for editorial fill.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { URL } from 'url';

type Locale = 'ru' | 'uk' | 'en';

interface LocaleData {
  h1: string;
  seoTitle: string;
  seoDescription: string;
}

interface PageSeed {
  pageKey: string;
  pageType: 'root' | 'listing' | 'static';
  locales: Partial<Record<Locale, LocaleData>>;
}

// ponytail: data inlined from static-page-migration.csv + fixup corrections
const SEEDS: PageSeed[] = [
  {
    pageKey: 'home',
    pageType: 'root',
    locales: {
      ru: {
        h1: 'Центр РАЗВИТИЯ ЯХТИНГА Navi.training',
        seoTitle: 'Яхтенная компания Navi.training - центр развития яхтинга',
        seoDescription: 'Navi.training - поможет вам осуществить мечту о море, научим вас управлять практически любой яхтой, организуем незабываемый отдых под парусом, доставим вашу яхту в любую точку мира и поможем сделать правильный выбор при покупке судна. ☎️ +33769958299',
      },
      en: {
        h1: 'YACHTING DEVELOPMENT CENTRE Navi.training',
        seoTitle: 'Yacht company Navi.training - sailing development centre',
        seoDescription: 'Navi.training - will help you realise your dream of the sea, teach you how to manage almost any yacht, organise an unforgettable holiday under sail, deliver your yacht anywhere in the world and help you make the right choice when buying a vessel. ☎️ +33769958299.',
      },
      uk: {
        h1: 'Центр РАЗВИТИЯ ЯХТИНГА Navi.training',
        seoTitle: 'Яхтова компанія Navi.training - центр розвитку яхтингу',
        seoDescription: 'Navi.training - допоможе вам здійснити мрію про море, навчимо вас керувати практично будь-якою яхтою, організуємо незабутній відпочинок під вітрилом, доставимо вашу яхту в будь-яку точку світу і допоможемо зробити правильний вибір під час купівлі судна. ☎️ +33769958299',
      },
    },
  },
  {
    pageKey: 'blog',
    pageType: 'listing',
    locales: {
      ru: {
        h1: 'Блог  Navi.training',
        seoTitle: 'Блог яхтенной школы navi.training',
        seoDescription: 'Статьи о яхтинге, учебные материалы для начинающих яхтенных капитанов, интервью известных яхтсменов. Блог яхтенной школы navi.training',
      },
      en: {
        h1: 'Navi.training  blog',
        seoTitle: 'Blog of the sailing school navi.training',
        seoDescription: 'Articles about yachting, training materials for yacht captains, interviews with famous yachtsmen. Blog of the yachting school navi.training',
      },
      uk: {
        h1: 'Блог  Navi.training',
        seoTitle: 'Блог яхтової школи navi.training',
        seoDescription: "Статті про яхтинг, навчальні матеріали для яхтових капітанів-початківців, інтерв'ю відомих яхтсменів. Блог яхтової школи navi.training",
      },
    },
  },
  {
    pageKey: 'tags',
    pageType: 'listing',
    locales: {
      ru: {
        h1: 'Разделы Блога Navi.training',
        seoTitle: 'Облако тегов блога | Navi.training',
        seoDescription: 'Коллекция тегов и категорий нашего блога | яхтенная школа Navi.training',
      },
      en: {
        h1: 'Sections of the Navi.training Blog',
        seoTitle: 'Blog Tag Cloud | Navi.training',
        seoDescription: 'Collection of tags and categories of our blog | sailing school Navi.training',
      },
      uk: {
        h1: 'Розділи Блогу Navi.training',
        seoTitle: 'Хмаринка тегів блогу | Navi.training',
        seoDescription: 'Колекція тегів і категорій нашого блогу | яхтова школа Navi.training',
      },
    },
  },
  {
    pageKey: 'charter',
    pageType: 'static',
    locales: {
      ru: {
        h1: 'чартер с капитанами  Navi.Training',
        seoTitle: 'Яхтенный чартер с капитанами Navi.Training',
        seoDescription: 'Яхтенные путешествия любой вкус и бюджет в самых красивых уголках мира.Ваш сейлинг будет незабываемым!',
      },
      en: {
        h1: 'GO charter with OUR skippers',
        seoTitle: 'Yacht charter with Navi.Training skippers',
        seoDescription: 'Yachting trips for every taste and budget in the most beautiful parts of the world.Your sailing will be unforgettable!',
      },
      uk: {
        h1: 'чартер із капітанами Navi.Training',
        seoTitle: 'Яхтовий чартер із капітанами Navi.Training',
        seoDescription: 'Яхтові подорожі на будь-який смак і бюджет у найкрасивіших куточках світу.Ваш сейлінг буде незабутнім!',
      },
    },
  },
  {
    pageKey: 'sailing-school',
    pageType: 'static',
    locales: {
      ru: {
        h1: 'Яхтенная школа Navi.training',
        seoTitle: 'Яхтенная школа Navi.training - международные права на яхту',
        seoDescription: 'Яхтенная школа  - научись управлять парусной или моторной яхтой в яхтенной школе Navi.training и получи яхтенные права ISSA. Обучение шкиперов парусных и моторных яхт.  ☎️ +33769958299',
      },
      en: {
        h1: 'Navi.training',
        seoTitle: 'Sailing school Navi.training - get your international yacht license',
        seoDescription: 'School for real sailors. Learn to sail or drive a sailing or motor yacht at Navi.training yachting school and get your ISSA boating license. Training for skippers of sailing and motor yachts. ☎️ +33769958299',
      },
      uk: {
        h1: 'Navi.training',
        seoTitle: 'Яхтова школа Navi.training - міжнародні права на яхту',
        seoDescription: 'Яхтова школа - навчися керувати вітрильною або моторною яхтою в яхтовій школі Navi.training і отримай яхтові права ISSA. Навчання шкіперів вітрильних і моторних яхт. ☎️ +33769958299',
      },
    },
  },
  {
    pageKey: 'charter-for-dummies',
    pageType: 'static',
    locales: {
      ru: {
        h1: 'Online марафон «ЯХТИНГ ДЛЯ ВСЕХ» Спланируйте ВАШЕ  ЯХТЕННОЕ ПУТЕШЕСТВИЕ за 7 дней',
        seoTitle: 'Яхтинг для всех: пошаговая инструкция по организации путешествий  от Navi.training',
        seoDescription: 'Курс для начинающих яхтсменов "Яхтинг для всех". Мечтаете отправиться в яхтенное путешествие, но не знаете с чего начать? Этот курс поможет вам разобраться в основах яхтинга и спланировать ваше первое яхтенное путешествие.',
      },
      uk: {
        h1: '«ЯХТИНГ ДЛЯ ВСІХ: ВАША ПЕРША ЯХТОВА ПОДОРОЖ - ВІД МРІЇ ДО РЕАЛЬНОСТІ»',
        seoTitle: 'Яхтинг для всіх: покрокова інструкція з організації подорожей від Navi.training',
        seoDescription: 'Курс для яхтсменів-початківців "Яхтинг для всіх". Мрієте вирушити в яхтову подорож із сім\'єю та друзями, але не знаєте з чого почати? Цей курс допоможе вам розібратися в основах яхтингу і спланувати вашу першу яхтову подорож.',
      },
    },
  },
  {
    pageKey: 'yahting-dlya-vseh',
    pageType: 'static',
    locales: {
      ru: {
        h1: 'За 7 дней откройте для себя мир яхтенных путешествий',
        seoTitle: 'Яхтинг для всех: подробная по организации путешествий от Navi.training',
        seoDescription: 'Курс для начинающих яхтсменов "Яхтинг для всех". Мечтаете отправиться в яхтенное путешествие, но не знаете с чего начать? Этот курс поможет вам разобраться в основах яхтинга и спланировать ваше первое яхтенное путешествие.',
      },
    },
  },
  {
    pageKey: 'payment-issue',
    pageType: 'static',
    locales: {
      uk: {
        h1: 'Помилка при обробці платежу!',
        seoTitle: 'Помилка під час обробки вашого платежу',
        seoDescription: 'payment-issue',
      },
    },
  },
];

// --- Safety helpers ---

function readEnvFile(filePath: string): Record<string, string> {
  const abs = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(abs)) {
    throw new Error(`Env file not found: ${abs}`);
  }
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(abs, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const idx = trimmed.indexOf('=');
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (key) env[key] = value;
  }
  return env;
}

function endpointFingerprint(uri: string): string {
  const parsed = new URL(uri);
  return `${parsed.hostname.toLowerCase()}:${parsed.port || 5432}:${parsed.pathname.slice(1)}`;
}

function assertNotProduction(env: Record<string, string>, allowProduction: boolean): void {
  const targetUri = env.DATABASE_URI;
  if (!targetUri) throw new Error('DATABASE_URI not found in env file');

  // Find root .env for comparison
  const rootEnvPath = path.resolve(process.cwd(), '..', '.env');
  if (!fs.existsSync(rootEnvPath)) return; // no root .env = can't compare

  const rootEnv = readEnvFile(rootEnvPath);
  const prodUri = rootEnv.DATABASE_URI;
  if (!prodUri) return;

  if (endpointFingerprint(targetUri) === endpointFingerprint(prodUri)) {
    if (!allowProduction) {
      throw new Error(
        'REFUSED: target endpoint matches production .env.\n' +
        'Pass --allow-production and confirm interactively to override.'
      );
    }
    // Interactive confirmation for production
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = rl.question('WARNING: You are about to write to PRODUCTION. Type "yes" to proceed: ', (ans) => {
      rl.close();
      if (ans.trim().toLowerCase() !== 'yes') {
        console.error('Aborted.');
        process.exit(1);
      }
    });
  }
}

// --- Idempotent seed logic ---

function localeDataMatches(current: any, expected: LocaleData): boolean {
  if ((current.h1 || '') !== expected.h1) return false;
  if ((current.seo?.title || '') !== expected.seoTitle) return false;
  if ((current.seo?.meta_description || '') !== expected.seoDescription) return false;
  return true;
}

async function main() {
  const args = process.argv.slice(2);
  const envFileIdx = args.indexOf('--env-file');
  const allowProdIdx = args.indexOf('--allow-production');

  if (envFileIdx === -1 || !args[envFileIdx + 1]) {
    console.error('Usage: tsx scripts/seed-pages.ts --env-file <path> [--allow-production]');
    console.error('Error: --env-file is required. Implicit .env loading is disabled for safety.');
    process.exit(1);
  }

  const envFile = args[envFileIdx + 1];
  const allowProduction = allowProdIdx !== -1;

  const env = readEnvFile(envFile);
  assertNotProduction(env, allowProduction);

  // Set env vars for Payload init (no dotenv auto-load)
  process.env.DATABASE_URI = env.DATABASE_URI;
  process.env.PAYLOAD_SECRET = env.PAYLOAD_SECRET || process.env.PAYLOAD_SECRET || '';
  if (env.PAYLOAD_PUBLIC_SERVER_URL) process.env.PAYLOAD_PUBLIC_SERVER_URL = env.PAYLOAD_PUBLIC_SERVER_URL;

  // Dynamic import after env is set so payload config picks up the right values
  const { default: payload } = await import('payload');
  const { default: payloadConfig } = await import('../src/payload.config');

  await payload.init({ config: payloadConfig });

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const seed of SEEDS) {
    // Find existing page by pageKey
    const { docs: existing } = await payload.find({
      collection: 'pages',
      where: { pageKey: { equals: seed.pageKey } },
      limit: 1,
      overrideAccess: true,
      draft: true,
    });

    let pageId: number;

    if (existing.length > 1) {
      throw new Error(`Duplicate pageKey found: ${seed.pageKey} (${existing.length} records)`);
    }

    if (existing.length === 1) {
      pageId = existing[0].id;
      skipped += 1;
      console.log(`  exists: ${seed.pageKey} (id=${pageId})`);
    } else {
      // Create with default locale (ru) + draft
      const ruData = seed.locales.ru;
      const baseData: Record<string, unknown> = {
        pageKey: seed.pageKey,
        pageType: seed.pageType,
        _status: 'draft',
      };
      if (ruData) {
        baseData.h1 = ruData.h1;
        baseData.seo = {
          title: ruData.seoTitle,
          meta_description: ruData.seoDescription,
        };
      }

      const doc = await payload.create({
        collection: 'pages',
        data: baseData,
        draft: true,
        overrideAccess: true,
      });
      pageId = doc.id;
      created += 1;
      console.log(`  created: ${seed.pageKey} (id=${pageId}, draft)`);
    }

    // Sync each locale (update only if data differs)
    for (const locale of ['ru', 'en', 'uk'] as Locale[]) {
      const locData = seed.locales[locale];
      if (!locData) continue;

      // Skip ru if we just created (ru data was set on create)
      if (locale === 'ru' && existing.length === 0) {
        console.log(`    ${locale}: already set on create`);
        continue;
      }

      const current = await payload.findByID({
        collection: 'pages',
        id: pageId,
        locale,
        fallbackLocale: false as any,
        overrideAccess: true,
        draft: true,
      });

      if (localeDataMatches(current, locData)) {
        console.log(`    ${locale}: unchanged`);
        continue;
      }

      await payload.update({
        collection: 'pages',
        id: pageId,
        locale,
        data: {
          h1: locData.h1,
          seo: {
            title: locData.seoTitle,
            meta_description: locData.seoDescription,
          },
        },
        draft: true,
        overrideAccess: true,
      });
      updated += 1;
      console.log(`    ${locale}: updated h1="${locData.h1.slice(0, 40)}..."`);
    }
  }

  console.log(`\nSeed complete: ${created} created, ${updated} updated, ${skipped} skipped`);

  // Verify
  const { docs: pages } = await payload.find({
    collection: 'pages',
    limit: 0,
    pagination: false,
    overrideAccess: true,
    draft: true,
  });
  console.log(`Verify: ${pages.length} pages found`);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
