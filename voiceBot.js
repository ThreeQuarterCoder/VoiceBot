// voiceBot.js
import { bufferAudioChunk, getBufferedAudio, resetProcessingFlag } from './audioBuffer.js';
import { transcribeAudio } from './speechToText.js';
import { getAIResponse } from './openAi.js';
import { encodeWAV } from './wavEncoder.js';

let resamplePCM = null;

// Dynamically import or install pcm-audio-resampler
async function ensureResampler() {
  if (resamplePCM) return;

  try {
    resamplePCM = (await import('pcm-audio-resampler')).default;
  } catch (e) {
    console.log('📦 pcm-audio-resampler not found, installing...');
    const { execSync } = await import('child_process');
    execSync('npm install pcm-audio-resampler', { stdio: 'inherit' });

    resamplePCM = (await import('pcm-audio-resampler')).default;
  }
}

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

    await ensureResampler();

    const ttsAudioBuffer = await synthesizeSpeech(aiReply); // returns 24kHz, mono, 16-bit PCM

    // STEP 5: Downsample to 16kHz PCM
    const pcm16kHzBuffer = resamplePCM({
      input: ttsAudioBuffer,
      inputSampleRate: 24000,
      outputSampleRate: 16000,
      channels: 1,
      bytesPerSample: 2, // 16-bit = 2 bytes
    });

    // STEP 6: Wrap in WAV format
    const wavBuffer = encodeWAV(pcm16kHzBuffer, {
      sampleRate: 16000,
      channels: 1,
      bitDepth: 16,
    });

    callback(wavBuffer); // ✅ Send text response back to server.js
  } catch (error) {
    console.error('❌ Voice Bot error:', error);
    callback(`Error: ${error.message}`);
  } finally {
    resetProcessingFlag();
  }
}
