const organStructure = {
    "Countermelody (Ch 2)": [ { val: 15, name: "Prestant" }, { val: 82, name: "Soft Violin" }, { val: 40, name: "Loud Violin" }, { val: 75, name: "Flageolet" }, { val: 73, name: "Flute" }, { val: 8, name: "Bells" }, { val: 9, name: "Unaphone" } ],
    "Accompaniment (Ch 3)": [ { val: 11, name: "Stopped Flute" }, { val: 70, name: "Open Flute" }, { val: 79, name: "Strings" } ],
    "Trumpetmelody (Ch 1)": [ { val: 68, name: "Viola Bassoon" }, { val: 56, name: "Wooden Trumpet" }, { val: 66, name: "Brass Trumpet" } ],
    "Bass (Ch 4)": [ { val: 58, name: "Bass Flute" }, { val: 43, name: "Wooden Trombone" }, { val: 50, name: "Brass Trombone" }]
};

// 1. Build the UI
function initializeStopsUI() {
    const container = document.getElementById('stops-container');
    
    for (const [groupName, stops] of Object.entries(organStructure)) {
        // Extract channel number from the string (e.g., "Countermelody (Ch 2)" -> 2)
        const channelMatch = groupName.match(/Ch (\d+)/);
        const channel = channelMatch ? parseInt(channelMatch[1]) : 0;

        const groupDiv = document.createElement('div');
        groupDiv.className = 'stop-group';
        groupDiv.innerHTML = `<h3>${groupName}</h3>`;

        stops.forEach(stop => {
            const btn = document.createElement('button');
            btn.className = 'stop-btn';
            btn.innerText = stop.name;
            // Store the CC and Channel in data attributes for easy access
            btn.dataset.cc = stop.val;
            btn.dataset.channel = channel;
            
            // Allow manual clicking
            btn.addEventListener('click', () => {
                btn.classList.toggle('active');
                const isNowOn = btn.classList.contains('active');
                // TODO: Send this manual override back to SpessaSynth
                // e.g., synth.controllerChange(channel - 1, stop.val, isNowOn ? 127 : 0);
            });

            groupDiv.appendChild(btn);
        });
        container.appendChild(groupDiv);
    }
}

// 2. Intercept MIDI from SpessaSynth
// This function will be called by your SpessaSynth MIDI event listener
function handleMidiCC(channel, ccNumber, value) {
    // Note: MIDI channels in code are usually 0-15. Your labels are 1-16.
    const displayChannel = channel + 1; 
    
    // Find the button that matches this channel and CC
    const button = document.querySelector(`.stop-btn[data-channel="${displayChannel}"][data-cc="${ccNumber}"]`);
    
    if (button) {
        // MIDI CC > 63 is generally considered "ON"
        if (value > 63) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    }
}

// 3. Audio Export Logic (Web Audio API MediaRecorder)
let mediaRecorder;
let audioChunks = [];

function setupRecording(audioContext, synthOutputNode) {
    const dest = audioContext.createMediaStreamDestination();
    synthOutputNode.connect(dest);
    
    mediaRecorder = new MediaRecorder(dest.stream);
    const exportBtn = document.getElementById('export-btn');
    exportBtn.disabled = false;

    mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // Create an automatic download link
        const a = document.createElement('a');
        a.href = audioUrl;
        a.download = 'Wurlitzer-166-Export.webm';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        audioChunks = []; // Reset for next recording
    };

    exportBtn.addEventListener('click', () => {
        if (mediaRecorder.state === 'inactive') {
            mediaRecorder.start();
            exportBtn.innerText = 'Stop Recording & Save';
            exportBtn.style.background = '#e74c3c';
        } else {
            mediaRecorder.stop();
            exportBtn.innerText = 'Start Recording';
            exportBtn.style.background = '';
        }
    });
}

// Initialize the UI on load
document.addEventListener('DOMContentLoaded', () => {
    initializeStopsUI();
});
