import 'dotenv/config';
import payload from 'payload';

async function run() {
  try {
    console.log('🚀 Запуск миграции Payload через Local API');

    const configModule = await import('../src/payload.config');
    const config = configModule.default;

    const payloadInstance = await payload.init({
      config,
      onInit: async () => {
        console.log('✅ Payload инициализирован');
      },
    });

    console.log('📦 Запуск payload.db.migrate()...');
    await payloadInstance.db.migrate();

    console.log('✨ Миграция завершена успешно');
    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка миграции:', error);
    process.exit(1);
  }
}

run();
