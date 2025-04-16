// voiceBot.js
import { bufferAudioChunk, getBufferedAudio, resetProcessingFlag } from './audioBuffer.js';
import { transcribeAudio } from './speechToText.js';
import { getAIResponse } from './openAi.js';
import { synthesizeSpeech } from './textToSpeech.js';
import { encodeWAV } from './wavEncoder.js';


export async function sendToVoiceBot(chunk, callback) {
  console.log('🧩 Voice Bot: Buffering incoming audio chunk...');
  bufferAudioChunk(chunk);

  const completeAudio = getBufferedAudio();
  if (!completeAudio) {
    console.log('🧩 Voice Bot: Not enough audio yet, waiting for more...');
    return;
  }

  try {
    console.log('🎙️ Voice Bot: Processing complete audio buffer...');

    const text = await transcribeAudio(completeAudio);
    console.log('📝 Voice Bot: Transcribed text:', text);

    const aiReply = await getAIResponse(text);
    console.log('🤖 Voice Bot: AI response:', aiReply);

    const ttsAudioBuffer = await synthesizeSpeech(aiReply); 

    const wavBuffer = encodeWAV(ttsAudioBuffer, {
      sampleRate: 16000,
      channels: 1,
      bitDepth: 16,
    });

    callback(wavBuffer); 
  } catch (error) {
    console.error('❌ Voice Bot error:', error);
    callback(`Error: ${error.message}`);
  } finally {
    resetProcessingFlag();
  }
}
