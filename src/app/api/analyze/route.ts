import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { apiKey, prompt, systemInstruction } = await req.json();

    if (!apiKey) {
      return NextResponse.json({ error: 'API Key is required.' }, { status: 401 });
    }
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 });
    }

    const requestBody: Record<string, unknown> = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    };

    // Use native systemInstruction field for cleaner prompting
    if (systemInstruction) {
      requestBody.systemInstruction = {
        parts: [{ text: systemInstruction }],
      };
    }

    // Updated to gemini-2.5-flash — the old gemini-1.5-pro model has been shut down
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData.error?.message || 'Failed to fetch from Gemini API' },
        { status: response.status }
      );
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      const finishReason = data.candidates?.[0]?.finishReason;
      if (finishReason) {
        return NextResponse.json(
          { error: `Request blocked or failed. Reason: ${finishReason}` },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to generate a valid response from the API.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ text });
  } catch (error: unknown) {
    console.error('API Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
