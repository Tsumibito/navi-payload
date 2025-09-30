/**
 * Утилиты для генерации slug с поддержкой кириллицы
 */

const transliterationMap: Record<string, string> = {
  // Русский
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  А: 'A', Б: 'B', В: 'V', Г: 'G', Д: 'D', Е: 'E', Ё: 'Yo', Ж: 'Zh', З: 'Z',
  И: 'I', Й: 'Y', К: 'K', Л: 'L', М: 'M', Н: 'N', О: 'O', П: 'P', Р: 'R',
  С: 'S', Т: 'T', У: 'U', Ф: 'F', Х: 'H', Ц: 'Ts', Ч: 'Ch', Ш: 'Sh', Щ: 'Sch',
  Ъ: '', Ы: 'Y', Ь: '', Э: 'E', Ю: 'Yu', Я: 'Ya',
  // Украинский
  ґ: 'g', є: 'ye', і: 'i', ї: 'yi',
  Ґ: 'G', Є: 'Ye', І: 'I', Ї: 'Yi',
};

/**
 * Транслитерация кириллицы в латиницу
 */
export function transliterate(text: string): string {
  return text
    .split('')
    .map((char) => transliterationMap[char] || char)
    .join('');
}

/**
 * Генерация slug из текста
 */
export function generateSlug(text: string): string {
  return transliterate(text)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Удаляем спецсимволы
    .replace(/[\s_]+/g, '-') // Пробелы и подчеркивания в дефисы
    .replace(/-+/g, '-') // Множественные дефисы в один
    .replace(/^-+|-+$/g, '') // Удаляем дефисы в начале и конце
    .substring(0, 100); // Ограничиваем длину
}
