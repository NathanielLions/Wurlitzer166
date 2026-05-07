// --- Globals ---
let audioContext = null;
let player = null;
let parsedMidi = null;
let playbackTimeouts = [];
let isPlaying = false;

// NOTE: For this code to run out-of-the-box, we are using a default WebAudioFont piano 
// (_tone_0000_JCLive_sf2_file). You will replace this variable with your Wurlitzer 166 JS objects later.
const defaultInstrument = _tone_0000_JCLive_sf2_file; 

// --- UI Tab Switching ---
window.openTab = function(tabId, btnElement) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabId).style.display = 'block';
    btnElement.classList.add('active');
};

// --- Initialization ---
function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        player = new WebAudioFontPlayer();
        // Pre-load the instrument into the audio context
        player.adjustPreset(audioContext, defaultInstrument); 
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
}

// --- File Upload & Parsing ---
document.getElementById('midi-upload').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    document.getElementById('audio-status').innerText = "🔊 Parsing MIDI...";
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            // Parse the MIDI data using @tonejs/midi
            parsedMidi = new window.Midi(e.target.result);
            document.getElementById('audio-status').innerText = `🔊 Loaded: ${parsedMidi.name || file.name}`;
            
            // Auto-switch to the Editor tab
            document.getElementById('tab-editor').click();
        } catch (error) {
            console.error("Error parsing MIDI", error);
            document.getElementById('audio-status').innerText = "❌ Error parsing MIDI";
        }
    };
    reader.readAsArrayBuffer(file);
});

// --- Routing & Playback Logic ---

function getActiveStops(channelNumber) {
    // Look up the specific column for this channel (e.g., 'col-ch2' for Countermelody)
    const column = document.getElementById(`col-ch${channelNumber}`);
    if (!column) return [];

    const activeStops = [];
    const rows = column.querySelectorAll('.stop-row');
    
    rows.forEach(row => {
        const checkbox = row.querySelector('.stop-toggle');
        const pitchInput = row.querySelector('.pitch-offset');
        
        if (checkbox.checked) {
            activeStops.push({
                presetId: checkbox.getAttribute('data-preset'),
                pitchOffset: parseInt(pitchInput.value) || 0
            });
        }
    });
    
    return activeStops;
}

document.getElementById('play-btn').addEventListener('click', () => {
    if (!parsedMidi) return alert("Please load a MIDI file first.");
    if (isPlaying) return;
    
    initAudio();
    isPlaying = true;
    document.getElementById('audio-status').innerText = "🔊 Playing...";
    
    const startTime = audioContext.currentTime + 0.5; // Start half a second from now

    // Iterate through every track in the parsed MIDI
    parsedMidi.tracks.forEach((track, index) => {
        // Assume track order or internal channel data maps to our channels 1-4
        // (Adding +1 because MIDI channels are usually 1-indexed in DAWs)
        const channelNumber = track.channel + 1; 

        track.notes.forEach(note => {
            // Schedule the note
            const timeoutId = setTimeout(() => {
                
                // When it's time to play, check WHICH stops are currently checked in the HTML
                const activeStops = getActiveStops(channelNumber);
                
                activeStops.forEach(stop => {
                    // Calculate the final pitch based on the note + the offset in the HTML
                    const finalPitch = note.midi + stop.pitchOffset;
                    
                    // Trigger WebAudioFont
                    // NOTE: 'defaultInstrument' is used here. 
                    // To use your Wurlitzer, you would map `stop.presetId` to your specific loaded JS variables.
                    player.queueWaveTable(
                        audioContext, 
                        audioContext.destination, 
                        defaultInstrument, 
                        audioContext.currentTime, 
                        finalPitch, 
                        note.duration, 
                        note.velocity
                    );
                });

            }, note.time * 1000); // @tonejs/midi stores time in seconds, setTimeout uses ms
            
            playbackTimeouts.push(timeoutId);
        });
    });
});

document.getElementById('stop-btn').addEventListener('click', () => {
    isPlaying = false;
    document.getElementById('audio-status').innerText = "🔊 Stopped";
    
    // Clear all scheduled notes
    playbackTimeouts.forEach(id => clearTimeout(id));
    playbackTimeouts = [];
    
    if (player && audioContext) {
        player.cancelQueue(audioContext);
    }
});
