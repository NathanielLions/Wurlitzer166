// Import SpessaSynth directly from the web
import { WorkletSynthesizer, Sequencer } from 'https://cdn.jsdelivr.net/npm/spessasynth_lib@latest/+esm';

// Updated to your new channel structure
const organStructure = {
    "Trumpetmelody (Ch 3)": [ { val: 68, name: "Viola Bassoon" }, { val: 56, name: "Wooden Trumpet" }, { val: 66, name: "Brass Trumpet" } ],
    "Accompaniment (Ch 2)": [ { val: 11, name: "Stopped Flute" }, { val: 70, name: "Open Flute" }, { val: 79, name: "Strings" } ],
    "Countermelody (Ch 4)": [ { val: 15, name: "Prestant" }, { val: 82, name: "Soft Violin" }, { val: 40, name: "Loud Violin" }, { val: 75, name: "Flageolet" }, { val: 73, name: "Flute" }, { val: 8, name: "Bells" }, { val: 9, name: "Unaphone" } ],
    "Bass (Ch 4)": [ { val: 58, name: "Bass Flute" }, { val: 43, name: "Wooden Trombone" }, { val: 50, name: "Brass Trombone" }]
};

function initializeStopsUI() {
    const container = document.getElementById('stops-container');
    container.innerHTML = ''; // Clear container on load
    
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
let midiData; 

function handleMidiCC(channel, ccNumber, value) {
    const displayChannel = channel + 1; 
    const button = document.querySelector(`.stop-btn[data-channel="${displayChannel}"][data-cc="${ccNumber}"]`);
    
    if (button) {
        if (value > 63) button.classList.add('active');
        else button.classList.remove('active');
    }
}

function hookUpUI() {
    const originalControllerChange = synth.controllerChange.bind(synth);
    synth.controllerChange = (channel, cc, value) => {
        handleMidiCC(channel, cc, value);
        originalControllerChange(channel, cc, value);
    };
}

async function initAudioEngine() {
    if (audioContext) return; 
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Changed the URL slightly to avoid missing file errors on the CDN
        await audioContext.audioWorklet.addModule('https://cdn.jsdelivr.net/npm/spessasynth_lib@latest/dist/spessasynth_processor.js');
        
        synth = new WorkletSynthesizer(audioContext);
        await synth.isReady;
        hookUpUI(); 
        console.log("Audio Engine Ready!");
    } catch (err) {
        alert("Uh oh, the audio engine failed to load: " + err.message);
        console.error(err);
    }
}

// --- EVENT LISTENERS ---

document.getElementById('soundfont-upload').addEventListener('change', async (e) => {
    try {
        await initAudioEngine();
        const file = e.target.files[0];
        if (!file) return;
        const arrayBuffer = await file.arrayBuffer();
        await synth.soundBankManager.addSoundBank(arrayBuffer, "main");
        alert("SoundFont loaded successfully!"); // Added confirmation popup
    } catch (err) {
        alert("Error loading SoundFont: " + err.message);
    }
});

document.getElementById('midi-upload').addEventListener('change', async (e) => {
    try {
        await initAudioEngine();
        const file = e.target.files[0];
        if (!file) return;
        const arrayBuffer = await file.arrayBuffer();
        midiData = [{ binary: new Uint8Array(arrayBuffer) }]; 
        
        document.getElementById('play-btn').disabled = false;
        alert("MIDI loaded! You can now click Play."); // Added confirmation popup
    } catch (err) {
        alert("Error loading MIDI: " + err.message);
    }
});

document.getElementById('play-btn').addEventListener('click', async () => {
    if (!synth || !midiData) return;

    if (audioContext.state === 'suspended') {
        await audioContext.resume();
    }
    if (sequencer) sequencer.stop();

    sequencer = new Sequencer(midiData, synth);
    sequencer.play();
    
    document.getElementById('stop-btn').disabled = false;
});

document.getElementById('stop-btn').addEventListener('click', () => {
    if (sequencer) {
        sequencer.stop();
        synth.stopAll(); 
    }
});

document.addEventListener('DOMContentLoaded', () => {
    initializeStopsUI();
});
