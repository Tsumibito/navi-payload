import * as migration_20260716_081148_sprint3a_schema from './20260716_081148_sprint3a_schema';
import * as migration_20260718_173613_sprint3c_schema_alignment from './20260718_173613_sprint3c_schema_alignment';
import * as migration_20260721_134147_training_certificates_ssg from './20260721_134147_training_certificates_ssg';
import * as migration_20260721_163943_post_localization_workflow from './20260721_163943_post_localization_workflow';
import * as migration_20260721_165400_trainings_seo_alignment from './20260721_165400_trainings_seo_alignment';
import * as migration_20260721_172549_glossary_intelligence from './20260721_172549_glossary_intelligence';
import * as migration_20260721_175821_glossary_encyclopedia_mvp from './20260721_175821_glossary_encyclopedia_mvp';
import * as migration_20260721_190000_post_editorial_workflow from './20260721_190000_post_editorial_workflow';

export const migrations = [
  {
    up: migration_20260716_081148_sprint3a_schema.up,
    down: migration_20260716_081148_sprint3a_schema.down,
    name: '20260716_081148_sprint3a_schema',
  },
  {
    up: migration_20260718_173613_sprint3c_schema_alignment.up,
    down: migration_20260718_173613_sprint3c_schema_alignment.down,
    name: '20260718_173613_sprint3c_schema_alignment',
  },
  {
    up: migration_20260721_134147_training_certificates_ssg.up,
    down: migration_20260721_134147_training_certificates_ssg.down,
    name: '20260721_134147_training_certificates_ssg',
  },
  {
    up: migration_20260721_163943_post_localization_workflow.up,
    down: migration_20260721_163943_post_localization_workflow.down,
    name: '20260721_163943_post_localization_workflow',
  },
  {
    up: migration_20260721_165400_trainings_seo_alignment.up,
    down: migration_20260721_165400_trainings_seo_alignment.down,
    name: '20260721_165400_trainings_seo_alignment',
  },
  {
    up: migration_20260721_172549_glossary_intelligence.up,
    down: migration_20260721_172549_glossary_intelligence.down,
    name: '20260721_172549_glossary_intelligence',
  },
  {
    up: migration_20260721_175821_glossary_encyclopedia_mvp.up,
    down: migration_20260721_175821_glossary_encyclopedia_mvp.down,
    name: '20260721_175821_glossary_encyclopedia_mvp'
  },
  {
    up: migration_20260721_190000_post_editorial_workflow.up,
    down: migration_20260721_190000_post_editorial_workflow.down,
    name: '20260721_190000_post_editorial_workflow'
  },
];
