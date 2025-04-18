import 'dotenv/config';
import fetch from 'node-fetch';
import FormData from 'form-data';

export async function transcribeAudio(buffer) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set in environment variables');
  }
  
  const file = Buffer.from(buffer);
  const formData = new FormData();
  formData.append('file', file, { filename: 'audio.wav', contentType: 'audio/wav' });
  formData.append('model', 'whisper-1');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: formData,
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.text;
}
