import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    console.log('Screenshot requested for URL:', url);

    // TODO: Реализовать скриншоты через отдельный сервис
    // Puppeteer слишком тяжелый для Turbopack и вызывает крэши
    // Рекомендуется использовать внешний сервис (например, Screenshotone API)
    
    return NextResponse.json(
      { 
        error: 'Screenshot functionality temporarily disabled',
        message: 'Puppeteer causes Turbopack crashes. Use external screenshot service or "Use Image" button instead.',
        requestedUrl: url,
        suggestion: 'Consider using https://screenshotone.com or similar API service'
      },
      { status: 501 }
    );

  } catch (error) {
    console.error('Screenshot API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process request',
        message: (error as Error).message 
      },
      { status: 500 }
    );
  }
}
