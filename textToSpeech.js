import 'dotenv/config';
import fetch from 'node-fetch';

export async function synthesizeSpeech(text) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'tts-1', // OpenAI TTS model
      input: text,
      voice: 'nova', // or 'echo', 'onyx' — try others!
      response_format: 'pcm',

      speed: 1.0
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI TTS API error:', errorText);
    throw new Error('Failed to synthesize speech');
  }

  const audioBuffer = await response.arrayBuffer();
  return Buffer.from(audioBuffer); // ✅ Return audio buffer
}
