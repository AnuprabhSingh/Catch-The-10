let audioCtx = null;

const ensureContext = () => {
	if (typeof window === "undefined") return null;
	if (!audioCtx) {
		audioCtx = new (window.AudioContext || window.webkitAudioContext)();
	}
	if (audioCtx.state === "suspended") {
		audioCtx.resume();
	}
	return audioCtx;
};

const makeEnvelope = (ctx, gain, { attack = 0.005, decay = 0.1, sustain = 0.5, release = 0.08, peak = 0.12 } = {}) => {
	const now = ctx.currentTime;
	gain.gain.cancelScheduledValues(now);
	gain.gain.setValueAtTime(0.0001, now);
	gain.gain.exponentialRampToValueAtTime(peak, now + attack);
	gain.gain.exponentialRampToValueAtTime(peak * sustain, now + attack + decay);
	gain.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay + release);
};

const playClick = (ctx, volume) => {
	const osc = ctx.createOscillator();
	const gain = ctx.createGain();
	osc.type = "square";
	osc.frequency.setValueAtTime(360, ctx.currentTime);
	gain.gain.setValueAtTime(0.0001, ctx.currentTime);
	gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + 0.005);
	gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
	osc.connect(gain).connect(ctx.destination);
	osc.start();
	osc.stop(ctx.currentTime + 0.1);
};

const playShuffle = (ctx, volume) => {
	const bufferSize = ctx.sampleRate * 0.6;
	const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
	const data = buffer.getChannelData(0);
	for (let i = 0; i < bufferSize; i += 1) {
		data[i] = (Math.random() * 2 - 1) * 0.4;
	}
	const source = ctx.createBufferSource();
	source.buffer = buffer;
	const filter = ctx.createBiquadFilter();
	filter.type = "bandpass";
	filter.frequency.value = 1200;
	const gain = ctx.createGain();
	gain.gain.setValueAtTime(0.0001, ctx.currentTime);
	gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + 0.06);
	gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
	source.connect(filter).connect(gain).connect(ctx.destination);
	source.start();
};

const playCardDrop = (ctx, volume) => {
	const osc = ctx.createOscillator();
	const gain = ctx.createGain();
	osc.type = "triangle";
	osc.frequency.setValueAtTime(520, ctx.currentTime);
	osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.08);
	makeEnvelope(ctx, gain, { attack: 0.003, decay: 0.06, sustain: 0.3, release: 0.08, peak: volume });
	osc.connect(gain).connect(ctx.destination);
	osc.start();
	osc.stop(ctx.currentTime + 0.2);
};

export const playSound = (type, volume = 0.15) => {
	const ctx = ensureContext();
	if (!ctx) return;

	const safeVol = Math.max(0.02, Math.min(volume, 0.6));

	switch (type) {
		case "shuffle":
			playShuffle(ctx, safeVol);
			break;
		case "deal":
			playClick(ctx, safeVol * 0.6);
			break;
		case "cardPlay":
			playCardDrop(ctx, safeVol);
			break;
		default:
			playClick(ctx, safeVol * 0.5);
			break;
	}
};
