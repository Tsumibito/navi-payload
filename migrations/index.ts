import * as migration_20260716_081148_sprint3a_schema from './20260716_081148_sprint3a_schema';
import * as migration_20260718_173613_sprint3c_schema_alignment from './20260718_173613_sprint3c_schema_alignment';
import * as migration_20260718_174443 from './20260718_174443';

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
    up: migration_20260718_174443.up,
    down: migration_20260718_174443.down,
    name: '20260718_174443'
  },
];
