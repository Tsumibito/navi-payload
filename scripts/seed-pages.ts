#!/usr/bin/env tsx
/**
 * Sprint 3B-1: Seed 8 base Pages / 19 locale variants as drafts via Payload Local API.
 *
 * Uses `draft: true` on create so Payload populates `_pages_v` version records.
 * Locale codes: ru, uk, en (NOT ua — `ua` is a URL contract only).
 * SEO data (title, description, h1) sourced from audit/diffs/static-page-migration.csv.
 * Content and OG images left NULL for editorial fill.
 */
import 'dotenv/config';
import payload from 'payload';
import payloadConfig from '../src/payload.config';

type Locale = 'ru' | 'uk' | 'en';

interface PageSeed {
  pageKey: string;
  pageType: 'root' | 'listing' | 'static';
  locales: Record<Locale, { h1: string; seoTitle: string; seoDescription: string } | null>;
}

// ponytail: data inlined from static-page-migration.csv + 06 fixup corrections
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
      en: null,
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
      en: null,
      uk: null,
    },
  },
  {
    pageKey: 'payment-issue',
    pageType: 'static',
    locales: {
      ru: null,
      en: null,
      uk: {
        h1: 'Помилка при обробці платежу!',
        seoTitle: 'Помилка під час обробки вашого платежу',
        seoDescription: 'payment-issue',
      },
    },
  },
];

async function main() {
  await payload.init({ config: payloadConfig });

  let created = 0;
  let localeRecords = 0;

  for (const seed of SEEDS) {
    // Create with default locale (ru) + draft: true to generate version record
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
    created += 1;
    if (ruData) localeRecords += 1;
    console.log(`  created: ${seed.pageKey} (id=${doc.id}, draft)`);

    // Update other locales
    for (const locale of ['en', 'uk'] as Locale[]) {
      const locData = seed.locales[locale];
      if (!locData) continue;

      await payload.update({
        collection: 'pages',
        id: doc.id,
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
      localeRecords += 1;
      console.log(`    ${locale}: h1="${locData.h1.slice(0, 40)}..."`);
    }
  }

  console.log(`\nSeed complete: ${created} base pages, ${localeRecords} locale records`);

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
