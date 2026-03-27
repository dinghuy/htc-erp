import type { Express, Request, Response } from 'express';

type AsyncRouteFactory = (handler: (req: Request, res: Response) => Promise<unknown>) => any;

type RegisterPlatformTranslationRoutesDeps = {
  ah: AsyncRouteFactory;
};

export function registerPlatformTranslationRoutes(app: Express, deps: RegisterPlatformTranslationRoutesDeps) {
  const { ah } = deps;

  app.post('/api/translate', ah(async (req: Request, res: Response) => {
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (!text) return res.status(400).json({ error: 'Text is required' });

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.0-flash-001',
          messages: [
            {
              role: 'user',
              content: `Translate the following Vietnamese text to professional business English for a commercial quotation. Only return the translated English text, no explanations, no quotes.\n\n${text}`,
            },
          ],
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'OpenRouter error');

      const translation = data.choices[0].message.content.trim();
      res.json({ translation });
    } catch (err: any) {
      console.error('Translation error:', err);
      res.status(500).json({ error: err.message || 'Failed to translate' });
    }
  }));
}
