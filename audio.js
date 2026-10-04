// ══════════════════════════════════════════════
//  AUDIO ENGINE & SEQUENCER
// ══════════════════════════════════════════════

// Global Audio States (shared with game settings)
let sfxEnabled = true;
let sfxVolume = 0.6;
let musicVolume = 0;
let musicMuted = true;
let musicPlaying = false;
let musicInterval = null;
let musicStep = 0;
let currentMusicTheme = 'menu';

const BPM = 125;
const stepTime = 60 / BPM / 2; // eighth notes (0.24 seconds)

// Initialize Web Audio API Context
const AC = new (window.AudioContext || window.webkitAudioContext)();

// Fallback sine wave tone synthesizer
function playTone(f, d, v = 0.28, type = 'sine') {
  if (!sfxEnabled) return;
  try {
    const o = AC.createOscillator();
    const g = AC.createGain();
    o.type = type;
    o.connect(g);
    g.connect(AC.destination);
    o.frequency.setValueAtTime(f, AC.currentTime);
    g.gain.setValueAtTime(v * sfxVolume, AC.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, AC.currentTime + d);
    o.start(AC.currentTime);
    o.stop(AC.currentTime + d);
  } catch (e) { }
}

// Cached White Noise Buffer for crunch/impact/explosions
let cachedNoiseBuffer = null;
function getNoiseBuffer() {
  if (cachedNoiseBuffer) return cachedNoiseBuffer;
  try {
    const bufferSize = AC.sampleRate * 0.4; // 0.4 seconds
    const buffer = AC.createBuffer(1, bufferSize, AC.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    cachedNoiseBuffer = buffer;
    return cachedNoiseBuffer;
  } catch (e) {
    return null;
  }
}

// Lowpass noise trigger helper
function playNoise(duration, volume, bandpassFreq) {
  if (!sfxEnabled) return;
  try {
    const buffer = getNoiseBuffer();
    if (!buffer) return;
    const source = AC.createBufferSource();
    source.buffer = buffer;
    
    const filter = AC.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(bandpassFreq, AC.currentTime);
    filter.Q.setValueAtTime(1.5, AC.currentTime);
    
    const gain = AC.createGain();
    gain.gain.setValueAtTime(volume * sfxVolume, AC.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + duration);
    
    source.connect(filter);
    filter.connect(gain);
    gain.connect(AC.destination);
    source.start();
    source.stop(AC.currentTime + duration);
  } catch (e) { }
}

// SFX: Shoot Laser
const sndShoot = () => {
  if (!sfxEnabled) return;
  try {
    if (AC.state === 'suspended') AC.resume();
    const osc = AC.createOscillator();
    const gain = AC.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(600, AC.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, AC.currentTime + 0.1);
    
    const filter = AC.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, AC.currentTime);
    
    gain.gain.setValueAtTime(0.12 * sfxVolume, AC.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, AC.currentTime + 0.1);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(AC.destination);
    osc.start();
    osc.stop(AC.currentTime + 0.1);
  } catch (e) { }
};

// SFX: Bullet Hit (Crunch)
const sndHit = () => {
  if (!sfxEnabled) return;
  try {
    const osc = AC.createOscillator();
    const gain = AC.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, AC.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, AC.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.18 * sfxVolume, AC.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, AC.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(AC.destination);
    osc.start();
    osc.stop(AC.currentTime + 0.1);
  } catch (e) { }
  // Add quick noise burst for crunch
  playNoise(0.06, 0.08, 1500);
};

// SFX: Ammo Reload Zip
const sndReload = () => {
  if (!sfxEnabled) return;
  try {
    const now = AC.currentTime;
    const osc = AC.createOscillator();
    const gain = AC.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.15);
    gain.gain.setValueAtTime(0.08 * sfxVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(AC.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  } catch (e) { }
};

// SFX: Scrap pickup sweep
const sndScrap = () => {
  if (!sfxEnabled) return;
  try {
    const now = AC.currentTime;
    const playToneTime = (f, start, dur) => {
      const osc = AC.createOscillator();
      const gain = AC.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, start);
      gain.gain.setValueAtTime(0.08 * sfxVolume, start);
      gain.gain.exponentialRampToValueAtTime(0.002, start + dur);
      osc.connect(gain);
      gain.connect(AC.destination);
      osc.start(start);
      osc.stop(start + dur);
    };
    playToneTime(659.25, now, 0.08); // E5
    playToneTime(987.77, now + 0.06, 0.12); // B5
  } catch (e) { }
};

// SFX: Purchase chime
const sndBuy = () => {
  if (!sfxEnabled) return;
  try {
    const now = AC.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((f, i) => {
      const osc = AC.createOscillator();
      const gain = AC.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + i * 0.06);
      gain.gain.setValueAtTime(0.1 * sfxVolume, now + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.15);
      osc.connect(gain);
      gain.connect(AC.destination);
      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 0.15);
    });
  } catch (e) { }
};

// SFX: Boss rumble announcement
function sndBossIntro() {
  if (!sfxEnabled) return;
  try {
    const now = AC.currentTime;
    const osc = AC.createOscillator();
    const gain = AC.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.linearRampToValueAtTime(50, now + 2.0);
    
    const filter = AC.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, now);
    filter.frequency.exponentialRampToValueAtTime(80, now + 2.0);
    
    gain.gain.setValueAtTime(0.25 * sfxVolume, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 2.0);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(AC.destination);
    osc.start(now);
    osc.stop(now + 2.0);
    
    // rumbling noise
    playNoise(1.8, 0.22, 100);
  } catch (e) { }
}

// SFX: Wave Completed chime
function sndWaveClear() {
  if (!sfxEnabled) return;
  try {
    const now = AC.currentTime;
    const notes = [587.33, 739.99, 880.00, 1174.66]; // D5, F#5, A5, D6
    notes.forEach((f, i) => {
      const osc = AC.createOscillator();
      const gain = AC.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + i * 0.08);
      gain.gain.setValueAtTime(0.12 * sfxVolume, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.3);
      osc.connect(gain);
      gain.connect(AC.destination);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.3);
    });
  } catch (e) { }
}

// SFX: Class Special power triggers
function sndClassPower(cls) {
  if (!sfxEnabled) return;
  if (cls === 'fire') {
    playNoise(0.7, 0.25, 250);
  } else if (cls === 'storm') {
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        try {
          const osc = AC.createOscillator();
          const gain = AC.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(1000 + Math.random() * 500, AC.currentTime);
          gain.gain.setValueAtTime(0.06 * sfxVolume, AC.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + 0.05);
          osc.connect(gain);
          gain.connect(AC.destination);
          osc.start();
          osc.stop(AC.currentTime + 0.05);
          playNoise(0.04, 0.08, 1200);
        } catch (e) { }
      }, i * 70);
    }
  } else if (cls === 'cryo') {
    try {
      const now = AC.currentTime;
      [880, 1109, 1318, 1760].forEach((f, i) => {
        const osc = AC.createOscillator();
        const gain = AC.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + i * 0.05);
        gain.gain.setValueAtTime(0.07 * sfxVolume, now + i * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.4);
        osc.connect(gain);
        gain.connect(AC.destination);
        osc.start(now + i * 0.05);
        osc.stop(now + i * 0.05 + 0.4);
      });
    } catch (e) { }
  } else if (cls === 'void') {
    try {
      const osc = AC.createOscillator();
      const gain = AC.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, AC.currentTime);
      osc.frequency.exponentialRampToValueAtTime(60, AC.currentTime + 0.65);
      
      const filter = AC.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400, AC.currentTime);
      filter.frequency.exponentialRampToValueAtTime(70, AC.currentTime + 0.65);
      filter.Q.setValueAtTime(8, AC.currentTime);
      
      gain.gain.setValueAtTime(0.18 * sfxVolume, AC.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + 0.65);
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(AC.destination);
      osc.start();
      osc.stop(AC.currentTime + 0.65);
    } catch (e) { }
  }
}

// Soundtrack Sequencer
function startMusic(theme = 'menu') {
  if (musicPlaying) {
    if (currentMusicTheme === theme) return;
    stopMusic();
  }
  if (musicMuted) {
    currentMusicTheme = theme;
    return;
  }
  musicPlaying = true;
  currentMusicTheme = theme;
  musicStep = 0;
  
  const lookAheadTime = 0.1;
  let nextNoteTime = AC.currentTime;
  
  function scheduleNote(step, time) {
    const chordIdx = Math.floor(step / 8) % 4;
    const subStep = step % 8;
    
    let rootFreq = 55.00;
    let octaveFreq = 110.00;
    let melodyNotes = [];
    let isLeadStep = false;
    
    if (currentMusicTheme === 'menu') {
      // Bass chords: Am, F, C, G
      if (chordIdx === 0) { rootFreq = 55.00; octaveFreq = 110.00; }
      else if (chordIdx === 1) { rootFreq = 43.65; octaveFreq = 87.31; }
      else if (chordIdx === 2) { rootFreq = 65.41; octaveFreq = 130.81; }
      else if (chordIdx === 3) { rootFreq = 49.00; octaveFreq = 98.00; }

      melodyNotes = [
        [220, 261.63, 329.63, 440], // Am
        [174.61, 220, 261.63, 349.23], // F
        [261.63, 329.63, 392.00, 523.25], // C
        [196.00, 246.94, 293.66, 392.00] // G
      ][chordIdx];

      isLeadStep = (subStep === 0 || subStep === 3 || subStep === 6);
      
      // Bouncing Bassline (sawtooth filtered)
      const isOctave = subStep % 2 === 1;
      playBass(isOctave ? octaveFreq : rootFreq, time);
      
      // Simple drums
      if (subStep === 0 || subStep === 4) {
        playKick(time);
      } else if (subStep === 2 || subStep === 6) {
        playSnare(time);
      }

      if (isLeadStep && Math.random() > 0.35) {
        const noteFreq = melodyNotes[Math.floor(Math.random() * melodyNotes.length)];
        playLead(noteFreq, time);
      }
    }
    else if (currentMusicTheme === 'standard') {
      // Dark energy combat: Gm, Dm, Eb, Bb
      if (chordIdx === 0) { rootFreq = 49.00; octaveFreq = 98.00; } // Gm
      else if (chordIdx === 1) { rootFreq = 36.71; octaveFreq = 73.42; } // Dm
      else if (chordIdx === 2) { rootFreq = 38.89; octaveFreq = 77.78; } // Eb
      else if (chordIdx === 3) { rootFreq = 58.27; octaveFreq = 116.54; } // Bb

      melodyNotes = [
        [196.00, 233.08, 293.66, 392.00], // Gm
        [146.83, 174.61, 220.00, 293.66], // Dm
        [155.56, 196.00, 233.08, 311.13], // Eb
        [233.08, 293.66, 349.23, 466.16]  // Bb
      ][chordIdx];

      isLeadStep = (subStep === 0 || subStep === 2 || subStep === 4 || subStep === 6);

      const isOctave = subStep % 2 === 1;
      playBass(isOctave ? octaveFreq : rootFreq, time);

      // Syncopated drums
      if (subStep === 0 || subStep === 3 || subStep === 4 || subStep === 7) {
        playKick(time);
      }
      if (subStep === 2 || subStep === 6) {
        playSnare(time);
      }

      if (isLeadStep && Math.random() > 0.25) {
        const noteFreq = melodyNotes[Math.floor(Math.random() * melodyNotes.length)];
        playLead(noteFreq, time);
      }
    }
    else if (currentMusicTheme === 'fire') {
      // Tense metal Phrygian/Locrian: F#m, G, Bm, C
      if (chordIdx === 0) { rootFreq = 46.25; octaveFreq = 92.50; } // F#m
      else if (chordIdx === 1) { rootFreq = 49.00; octaveFreq = 98.00; } // G
      else if (chordIdx === 2) { rootFreq = 61.74; octaveFreq = 123.47; } // Bm
      else if (chordIdx === 3) { rootFreq = 65.41; octaveFreq = 130.81; } // C

      melodyNotes = [
        [185.00, 220.00, 277.18, 370.00],
        [196.00, 246.94, 293.66, 392.00],
        [246.94, 293.66, 370.00, 493.88],
        [261.63, 329.63, 392.00, 523.25]
      ][chordIdx];

      isLeadStep = (subStep % 2 === 0);

      // Heavy bass on every step
      playBass(rootFreq, time);

      // Fast double bass kick
      if (subStep === 0 || subStep === 1 || subStep === 4 || subStep === 5) {
        playKick(time, true);
      }
      if (subStep === 2 || subStep === 6) {
        playSnare(time, 1.3);
      }

      if (isLeadStep) {
        const noteFreq = melodyNotes[Math.floor(Math.random() * melodyNotes.length)];
        playLead(noteFreq, time);
      }
    }
    else if (currentMusicTheme === 'storm') {
      // Electric storm energy: Em, D, C, B7
      if (chordIdx === 0) { rootFreq = 41.20; octaveFreq = 82.41; } // Em
      else if (chordIdx === 1) { rootFreq = 36.71; octaveFreq = 73.42; } // D
      else if (chordIdx === 2) { rootFreq = 32.70; octaveFreq = 65.41; } // C
      else if (chordIdx === 3) { rootFreq = 61.74; octaveFreq = 123.47; } // B7

      melodyNotes = [
        [164.81, 196.00, 246.94, 329.63],
        [146.83, 220.00, 293.66, 369.99],
        [130.81, 196.00, 261.63, 329.63],
        [246.94, 311.13, 370.00, 493.88]
      ][chordIdx];

      isLeadStep = (subStep !== 1 && subStep !== 5);

      // Sawtooth electric bass
      playBass(octaveFreq, time);

      // Drums with snare roll / claps
      if (subStep === 0 || subStep === 4) {
        playKick(time);
      }
      if (subStep === 2 || subStep === 4 || subStep === 6) {
        playSnare(time, 0.7);
      }
      if (subStep % 2 === 1) {
        playHat(time);
      }

      if (isLeadStep) {
        const noteFreq = melodyNotes[Math.floor(Math.random() * melodyNotes.length)];
        playLead(noteFreq, time);
      }
    }
    else if (currentMusicTheme === 'cryo') {
      // Floating frost: Cmaj7, Am9, Fmaj7, E7
      if (chordIdx === 0) { rootFreq = 32.70; octaveFreq = 65.41; }
      else if (chordIdx === 1) { rootFreq = 27.50; octaveFreq = 55.00; }
      else if (chordIdx === 2) { rootFreq = 43.65; octaveFreq = 87.31; }
      else if (chordIdx === 3) { rootFreq = 41.20; octaveFreq = 82.41; }

      melodyNotes = [
        [261.63, 329.63, 392.00, 493.88],
        [220.00, 261.63, 329.63, 392.00],
        [174.61, 220.00, 261.63, 329.63],
        [164.81, 207.65, 246.94, 329.63]
      ][chordIdx];

      isLeadStep = (subStep === 0 || subStep === 4);

      // Sparse low sine bass
      if (subStep === 0 || subStep === 4) {
        playBass(rootFreq, time, 'sine', 80);
      }

      // Minimal sparse drums (half-time)
      if (subStep === 0) {
        playKick(time);
      }
      if (subStep === 4) {
        playSnare(time, 0.4);
      }

      // High pitch crystal bell lead
      if (subStep % 2 === 0 && Math.random() > 0.3) {
        const noteFreq = melodyNotes[Math.floor(Math.random() * melodyNotes.length)] * 2;
        playLead(noteFreq, time, true);
      }
    }
    else if (currentMusicTheme === 'void') {
      // Eerie cosmic ambient: Dm, Bbm, F#m, C#m
      if (chordIdx === 0) { rootFreq = 36.71; octaveFreq = 73.42; }
      else if (chordIdx === 1) { rootFreq = 58.27; octaveFreq = 116.54; }
      else if (chordIdx === 2) { rootFreq = 46.25; octaveFreq = 92.50; }
      else if (chordIdx === 3) { rootFreq = 69.30; octaveFreq = 138.59; }

      melodyNotes = [
        [146.83, 174.61, 220.00, 293.66],
        [233.08, 277.18, 349.23, 466.16],
        [185.00, 220.00, 277.18, 370.00],
        [277.18, 329.63, 415.30, 554.37]
      ][chordIdx];

      // Ambient bass drone
      if (subStep === 0) {
        playBass(rootFreq, time, 'triangle', 60, 1.2);
      }

      // Sparse space drums
      if (subStep === 0 || subStep === 5) {
        playKick(time);
      }
      if (subStep === 4) {
        playVoidSweep(time);
      }

      // Slow resonant sweep lead
      if (subStep === 2 || subStep === 6) {
        const noteFreq = melodyNotes[Math.floor(Math.random() * melodyNotes.length)];
        playLead(noteFreq, time, false, true);
      }
    }
  }
  
  function playBass(freq, time, type = 'sawtooth', filterFreq = 140, duration = stepTime) {
    try {
      const osc = AC.createOscillator();
      const gain = AC.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      
      const filter = AC.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(filterFreq, time);
      
      gain.gain.setValueAtTime(0.06 * musicVolume, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration - 0.02);
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(AC.destination);
      
      osc.start(time);
      osc.stop(time + duration);
    } catch (e) { }
  }
  
  function playKick(time, heavy = false) {
    try {
      const osc = AC.createOscillator();
      const gain = AC.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(heavy ? 150 : 120, time);
      osc.frequency.exponentialRampToValueAtTime(heavy ? 38 : 45, time + 0.12);
      
      gain.gain.setValueAtTime((heavy ? 0.23 : 0.18) * musicVolume, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
      
      osc.connect(gain);
      gain.connect(AC.destination);
      osc.start(time);
      osc.stop(time + 0.12);
    } catch (e) { }
  }
  
  function playSnare(time, decayFactor = 1.0) {
    try {
      const buffer = getNoiseBuffer();
      if (!buffer) return;
      const source = AC.createBufferSource();
      source.buffer = buffer;
      
      const filter = AC.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1000;
      filter.Q.value = 1.5;
      
      const gain = AC.createGain();
      gain.gain.setValueAtTime(0.04 * musicVolume, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.09 * decayFactor);
      
      source.connect(filter);
      filter.connect(gain);
      gain.connect(AC.destination);
      source.start(time);
      source.stop(time + 0.09 * decayFactor);
    } catch (e) { }
  }

  function playHat(time) {
    try {
      const buffer = getNoiseBuffer();
      if (!buffer) return;
      const source = AC.createBufferSource();
      source.buffer = buffer;
      
      const filter = AC.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 8000;
      
      const gain = AC.createGain();
      gain.gain.setValueAtTime(0.015 * musicVolume, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
      
      source.connect(filter);
      filter.connect(gain);
      gain.connect(AC.destination);
      source.start(time);
      source.stop(time + 0.03);
    } catch (e) { }
  }

  function playVoidSweep(time) {
    try {
      const buffer = getNoiseBuffer();
      if (!buffer) return;
      const source = AC.createBufferSource();
      source.buffer = buffer;
      
      const filter = AC.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.setValueAtTime(3.0, time);
      filter.frequency.setValueAtTime(300, time);
      filter.frequency.exponentialRampToValueAtTime(1800, time + 0.25);
      
      const gain = AC.createGain();
      gain.gain.setValueAtTime(0.02 * musicVolume, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);
      
      source.connect(filter);
      filter.connect(gain);
      gain.connect(AC.destination);
      source.start(time);
      source.stop(time + 0.25);
    } catch (e) { }
  }
  
  function playLead(freq, time, bellMode = false, sweepMode = false) {
    try {
      const osc = AC.createOscillator();
      const gain = AC.createGain();
      
      if (bellMode) {
        osc.type = 'sine';
        osc.frequency.value = freq;
        const mod = AC.createOscillator();
        const modGain = AC.createGain();
        mod.type = 'sine';
        mod.frequency.value = freq * 1.618;
        modGain.gain.value = freq * 0.8;
        mod.connect(modGain);
        modGain.connect(osc.frequency);
        mod.start(time);
        mod.stop(time + stepTime * 2.5);
      } else if (sweepMode) {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq * 0.5, time);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.5, time + stepTime * 1.5);
      } else {
        osc.type = currentMusicTheme === 'standard' ? 'sawtooth' : (currentMusicTheme === 'fire' ? 'sawtooth' : 'triangle');
        osc.frequency.value = freq;
      }
      
      const delay = AC.createDelay();
      delay.delayTime.value = stepTime * (bellMode ? 2.0 : 1.5);
      const delayGain = AC.createGain();
      delayGain.gain.value = bellMode ? 0.35 : 0.22;
      
      const filter = AC.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(bellMode ? 3500 : (currentMusicTheme === 'standard' ? 900 : (currentMusicTheme === 'fire' ? 1400 : 2500)), time);
      
      gain.gain.setValueAtTime((bellMode ? 0.02 : (currentMusicTheme === 'fire' ? 0.025 : 0.03)) * musicVolume, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + stepTime * (bellMode ? 2.5 : 1.8));
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(AC.destination);
      
      gain.connect(delay);
      delay.connect(delayGain);
      delayGain.connect(delay);
      delayGain.connect(AC.destination);
      
      osc.start(time);
      osc.stop(time + stepTime * (bellMode ? 2.5 : 1.8));
    } catch (e) { }
  }
  
  musicInterval = setInterval(() => {
    while (nextNoteTime < AC.currentTime + lookAheadTime) {
      scheduleNote(musicStep, nextNoteTime);
      nextNoteTime += stepTime;
      musicStep++;
    }
  }, 25);
}

function stopMusic() {
  musicPlaying = false;
  if (musicInterval) {
    clearInterval(musicInterval);
    musicInterval = null;
  }
}

// UI Settings handlers
function toggleSFXSetting() {
  const checkbox = document.getElementById("sfxToggle");
  const slider = document.getElementById("sfxVolumeSlider");
  const label = document.getElementById("sfxVolVal");
  
  sfxEnabled = checkbox.checked;
  if (!sfxEnabled) {
    slider.value = 0;
    label.textContent = "0%";
    sfxVolume = 0;
  } else {
    if (parseFloat(slider.value) === 0) {
      slider.value = 0.6;
    }
    sfxVolume = parseFloat(slider.value);
    label.textContent = Math.round(sfxVolume * 100) + "%";
    sndScrap();
  }
}

function updateSFXVolumeSetting(val) {
  const checkbox = document.getElementById("sfxToggle");
  const label = document.getElementById("sfxVolVal");
  
  sfxVolume = parseFloat(val);
  label.textContent = Math.round(sfxVolume * 100) + "%";
  
  if (sfxVolume > 0) {
    checkbox.checked = true;
    sfxEnabled = true;
    sndScrap();
  } else {
    checkbox.checked = false;
    sfxEnabled = false;
  }
}

function toggleMusicSetting() {
  const checkbox = document.getElementById("musicToggle");
  const slider = document.getElementById("musicVolumeSlider");
  const label = document.getElementById("musicVolVal");
  
  musicMuted = !checkbox.checked;
  if (musicMuted) {
    slider.value = 0;
    label.textContent = "0%";
    musicVolume = 0;
    stopMusic();
  } else {
    if (parseFloat(slider.value) === 0) {
      slider.value = 0.4;
    }
    musicVolume = parseFloat(slider.value);
    label.textContent = Math.round(musicVolume * 100) + "%";
    if (AC.state === 'suspended') AC.resume();
    startMusic(currentMusicTheme);
  }
}

function updateMusicVolumeSetting(val) {
  const checkbox = document.getElementById("musicToggle");
  const label = document.getElementById("musicVolVal");
  
  musicVolume = parseFloat(val);
  label.textContent = Math.round(musicVolume * 100) + "%";
  
  if (musicVolume > 0) {
    checkbox.checked = true;
    musicMuted = false;
    if (AC.state === 'suspended') AC.resume();
    startMusic(currentMusicTheme);
  } else {
    checkbox.checked = false;
    musicMuted = true;
    stopMusic();
  }
}
