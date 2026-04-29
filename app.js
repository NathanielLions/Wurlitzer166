// Using @latest ensures the Sequencer and the Synthesizer versions perfectly match
import { WorkletSynthesizer, Sequencer } from 'https://cdn.jsdelivr.net/npm/spessasynth_lib@latest/+esm';

// We map the default channels so they can be changed via the dropdowns
const organStructure = {
    "Trumpet Melody": {
        defaultChannel: 3,
        stops: [ { val: 68, name: "Viola Bassoon" }, { val: 56, name: "Wooden Trumpet" }, { val: 66, name: "Brass Trumpet" } ]
    },
    "Accompaniment": {
        defaultChannel: 2,
        stops: [ { val: 11, name: "Stopped Flute" }, { val: 70, name: "Open Flute" }, { val: 79, name: "Strings" } ]
    },
    "Countermelody": {
        defaultChannel: 4,
        stops: [ { val: 15, name: "Prestant" }, { val: 82, name: "Soft Violin" }, { val: 40, name: "Loud Violin" }, { val: 75, name: "Flageolet" }, { val: 73, name: "Flute" }, { val: 8, name: "Bells" }, { val: 9, name: "Unaphone" } ]
    },
    "Bass": {
        defaultChannel: 4,
        stops: [ { val: 58, name: "Bass Flute" }, { val: 43, name: "Wooden Trombone" }, { val: 50, name: "Brass Trombone" } ]
    }
};

// This object actively tracks what channel each group is currently assigned to
const currentChannels = {
    "Trumpet Melody": 3,
    "Accompaniment": 2,
    "Countermelody": 4,
    "Bass": 4
};

// --- UI GENERATION ---
function initializeStopsUI() {
    const container = document.getElementById('stops-container');
    container.innerHTML = ''; 
    
    for (const [groupName, data] of Object.entries(organStructure)) {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'stop-group';
        
        // Create Header with Dropdown
        const headerDiv = document.createElement('div');
        headerDiv.className = 'group-header';
        headerDiv.innerHTML = `<h3>${groupName}</h3>`;
        
        const channelSelect = document.createElement('select');
        channelSelect.className = 'channel-select';
        channelSelect.title = "Change MIDI Channel";
        
        // Generate options 1-16
        for(let i = 1; i <= 16; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.innerText = `Ch ${i}`;
            if (i === data.defaultChannel) option.selected = true;
            channelSelect.appendChild(option);
        }
        
        // Update the live channel tracker when the user changes the dropdown
        channelSelect.addEventListener('change', (e) => {
            currentChannels[groupName] = parseInt(e.target.value);
            console.log(`${groupName} is now listening to Channel ${e.target.value}`);
        });
        
        headerDiv.appendChild(channelSelect);
        groupDiv.appendChild(headerDiv);

        // Create the buttons
        data.stops.forEach(stop => {
            const btn = document.createElement('button');
            btn.className = 'stop-btn';
            btn.innerText = stop.name;
            btn.dataset.cc = stop.val;
            btn.dataset.group = groupName;
            
            btn.addEventListener('click', () => btn.classList.toggle('active'));
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
    const displayChannel = channel + 1; // Translate code channel (0-15) to human channel (1-16)
    
    // Find ALL buttons that match this CC
    const buttons = document.querySelectorAll(`.stop-btn[data-cc="${ccNumber}"]`);
    
    buttons.forEach(btn => {
        const parentGroup = btn.dataset.group;
        
        // Only flip the switch if its parent group is currently set to this channel
        if (currentChannels[parentGroup] === displayChannel) {
            if (value > 63) btn.classList.add('active');
            else btn.classList.remove('active');
        }
    });
}

function hookUpUI() {
    const originalControllerChange = synth.controllerChange.bind(synth);
    
    synth.controllerChange = (channel, cc, value) => {
        handleMidiCC(channel, cc, value);
        
        // Custom Wurlitzer Gate (CC 80)
        if (cc === 80) {
            const volumeLevel = value > 63 ? 127 : 0;
            originalControllerChange(channel, 7, volumeLevel); // Overwrite with CC 7 (Standard Volume)
        }
        
        originalControllerChange(channel, cc, value);
    };
}

async function initAudioEngine() {
    if (audioContext) return; 
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Load the latest processor explicitly to prevent 404s
        await audioContext.audioWorklet.addModule('https://cdn.jsdelivr.net/npm/spessasynth_lib@latest/dist/spessasynth_processor.min.js');
        
        synth = new WorkletSynthesizer(audioContext);
        await synth.isReady;
        hookUpUI(); 
        console.log("Audio Engine Ready!");
    } catch (err) {
        alert("Audio engine failed to load! Check console.");
        console.error("SpessaSynth Error:", err);
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
        alert(`SoundFont loaded successfully!`); 
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
        alert(`Song loaded! You can now press Play.`); 
    } catch (err) {
        alert("Error loading MIDI: " + err.message);
    }
});

document.getElementById('play-btn').addEventListener('click', async () => {
    if (!synth || !midiData) return;
    if (audioContext.state === 'suspended') await audioContext.resume();
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

// Build the UI instantly on load
document.addEventListener('DOMContentLoaded', initializeStopsUI);
