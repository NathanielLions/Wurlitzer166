// Import SpessaSynth directly from the web
import { WorkletSynthesizer, Sequencer } from 'https://cdn.jsdelivr.net/npm/spessasynth_lib@latest/+esm';

// --- YOUR WURLITZER LOGIC ---
const organStructure = {
    "Countermelody (Ch 2)": [ { val: 15, name: "Prestant" }, { val: 82, name: "Soft Violin" }, { val: 40, name: "Loud Violin" }, { val: 75, name: "Flageolet" }, { val: 73, name: "Flute" }, { val: 8, name: "Bells" }, { val: 9, name: "Unaphone" } ],
    "Accompaniment (Ch 3)": [ { val: 11, name: "Stopped Flute" }, { val: 70, name: "Open Flute" }, { val: 79, name: "Strings" } ],
    "Trumpetmelody (Ch 1)": [ { val: 68, name: "Viola Bassoon" }, { val: 56, name: "Wooden Trumpet" }, { val: 66, name: "Brass Trumpet" } ],
    "Bass (Ch 4)": [ { val: 58, name: "Bass Flute" }, { val: 43, name: "Wooden Trombone" }, { val: 50, name: "Brass Trombone" }]
};

function initializeStopsUI() {
    const container = document.getElementById('stops-container');
    for (const [groupName, stops] of Object.entries(organStructure)) {
        const channelMatch = groupName.match(/Ch (\d+)/);
        const channel = channelMatch ? parseInt(channelMatch[1]) : 0;
        const groupDiv = document.createElement('div');
        groupDiv.className = 'stop-group';
        groupDiv.innerHTML = `<h3>${groupName}</h3>`;

        stops.forEach(stop => {
            const btn = document.createElement('button');
            btn.className = 'stop-btn';
            btn.innerText = stop.name;
            btn.dataset.cc = stop.val;
            btn.dataset.channel = channel;
            
            btn.addEventListener('click', () => {
                btn.classList.toggle('active');
            });

            groupDiv.appendChild(btn);
        });
        container.appendChild(groupDiv);
    }
}

// --- SPESSASYNTH AUDIO ENGINE ---
let audioContext;
let synth;
let sequencer;
let midiData; // Holds the uploaded MIDI file in memory

async function initAudioEngine() {
    if (audioContext) return; // Already initialized

    // Create the audio context
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    try {
        // Load the background audio processor file
        await audioContext.audioWorklet.addModule('https://cdn.jsdelivr.net/npm/spessasynth_lib@latest/dist/spessasynth_processor.min.js');
        
        // Initialize the Synthesizer
        synth = new WorkletSynthesizer(audioContext);
        await synth.isReady;
        console.log("Audio Engine Ready!");
    } catch (err) {
        console.error("Failed to load SpessaSynth Worklet:", err);
        alert("Could not load the audio engine. Check the console.");
    }
}

// --- EVENT LISTENERS ---

// 1. Upload SoundFont
document.getElementById('soundfont-upload').addEventListener('change', async (e) => {
    await initAudioEngine();
    
    const file = e.target.files[0];
    if (!file) return;

    const arrayBuffer = await file.arrayBuffer();
    
    // Pass the raw .sf2 data to SpessaSynth
    await synth.soundBankManager.addSoundBank(arrayBuffer, "main");
    console.log("SoundFont successfully loaded into SpessaSynth!");
});

// 2. Upload MIDI
document.getElementById('midi-upload').addEventListener('change', async (e) => {
    await initAudioEngine();

    const file = e.target.files[0];
    if (!file) return;

    const arrayBuffer = await file.arrayBuffer();
    // SpessaSynth reads the arraybuffer to parse the MIDI tracks
    midiData = [{ binary: new Uint8Array(arrayBuffer) }]; 

    // Enable the play button now that we have a file
    document.getElementById('play-btn').disabled = false;
    console.log("MIDI File loaded into memory!");
});

// 3. Play Button
document.getElementById('play-btn').addEventListener('click', async () => {
    if (!synth || !midiData) return;

    // Browsers suspend audio context if it isn't playing; we must wake it up
    if (audioContext.state === 'suspended') {
        await audioContext.resume();
    }

    // Stop existing sequence if one is playing
    if (sequencer) sequencer.stop();

    // Create a new sequencer instance with our MIDI data and the synthesizer
    sequencer = new Sequencer(midiData, synth);
    sequencer.play();
    
    document.getElementById('stop-btn').disabled = false;
    console.log("Playback started!");

    // TODO: We will hook up the MIDI CC listener here in the next step!
});

// 4. Stop Button
document.getElementById('stop-btn').addEventListener('click', () => {
    if (sequencer) {
        sequencer.stop();
        synth.stopAll(); // Instantly kill lingering reverb/notes
        console.log("Playback stopped.");
    }
});

// Initialize the buttons on the screen immediately
document.addEventListener('DOMContentLoaded', () => {
    initializeStopsUI();
});
