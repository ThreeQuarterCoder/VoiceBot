
import { Resampler } from '@audiojs/resampler';

export function encodeWAV(buffer, options) {
    const { sampleRate = 24000, channels = 1, bitDepth = 16 } = options;
    const byteRate = (sampleRate * channels * bitDepth) / 8;
    const blockAlign = (channels * bitDepth) / 8;
    const bufferLength = buffer.length;
  
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + bufferLength, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20); // PCM format
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitDepth, 34);
    header.write('data', 36);
    header.writeUInt32LE(bufferLength, 40);
  
    return Buffer.concat([header, buffer]);
  }

export function resamplePCMBuffer(pcmBuffer) {
  const int16 = new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.byteLength / 2);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768;
  }

  const inputSampleRate = 24000;
  const outputSampleRate = 16000;

  const resampler = new Resampler({
    inputSampleRate,
    outputSampleRate,
    channels: 1,
  });

  const resampled = resampler.resample(float32);

  // Convert Float32Array -> Int16Array -> Buffer
  const outInt16 = new Int16Array(resampled.length);
  for (let i = 0; i < resampled.length; i++) {
    let s = Math.max(-1, Math.min(1, resampled[i])); // clamp
    outInt16[i] = s < 0 ? s * 32768 : s * 32767;
  }

  return Buffer.from(outInt16.buffer);
}
  