import * as migration_20260716_081148_sprint3a_schema from './20260716_081148_sprint3a_schema';

export const migrations = [
  {
    up: migration_20260716_081148_sprint3a_schema.up,
    down: migration_20260716_081148_sprint3a_schema.down,
    name: '20260716_081148_sprint3a_schema',
  },
];
