export class AlarmSound {
  context = null;
  source = null;
  async enable() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) throw new Error('This browser does not support alarm audio.');
    this.context ??= new AudioContext();
    await this.context.resume();
    if (this.context.state !== 'running') throw new Error('Sound is blocked. Tap Enable alarm sound again.');
  }
  start() {
    if (!this.context || this.context.state !== 'running') throw new Error('Tap Enable alarm sound to hear the alarm.');
    if (this.source) return;
    // A looping audio buffer keeps the pulse independent of JavaScript timers.
    const rate = this.context.sampleRate;
    const buffer = this.context.createBuffer(1, rate, rate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < rate; i++) {
      const t = i / rate;
      const phase = t % 0.5;
      const envelope = phase < 0.3 ? Math.min(1, phase / 0.01, (0.3 - phase) / 0.02) : 0;
      samples[i] = 0.25 * envelope * Math.sin(2 * Math.PI * 880 * t);
    }
    this.source = this.context.createBufferSource();
    this.source.buffer = buffer;
    this.source.loop = true;
    this.source.connect(this.context.destination);
    this.source.start();
  }
  stop() {
    this.source?.stop();
    this.source?.disconnect();
    this.source = null;
  }
  dispose() {
    this.stop();
    const context = this.context;
    this.context = null;
    if (context) void context.close().catch(() => {});
  }
}
