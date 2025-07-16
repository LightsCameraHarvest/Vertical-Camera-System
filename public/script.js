// === script.js ===
const eartiSelect = document.getElementById("earti-select");
const cameraSelect = document.getElementById("camera-select");
const videoContainer = document.getElementById("video-container");

const streamURLs = {
  earti1: {
    cam1: "https://streaming.earti.dev/api/whep?src=cam", // <-- update this with real stream name
    cam2: "https://streaming.earti.dev/api/whep?src=cam2"
  },
  earti2: {
    cam1: "https://streaming.earti2.dev/api/whep?src=cam1", // example
    cam2: "https://streaming.earti2.dev/api/whep?src=cam2"
  }
};

let currentPeer = null;

eartiSelect.addEventListener("change", () => {
  cameraSelect.disabled = false;
  cameraSelect.selectedIndex = 0;
  videoContainer.innerHTML = "";
});

cameraSelect.addEventListener("change", async () => {
  const earti = eartiSelect.value;
  const cam = cameraSelect.value;
  const url = streamURLs[earti][cam];

  videoContainer.innerHTML = `<video id="video" autoplay playsinline controls></video>`;
  const video = document.getElementById("video");

  if (currentPeer) {
    currentPeer.close();
    currentPeer = null;
  }

  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });
  currentPeer = pc;

  pc.ontrack = (event) => {
    video.srcObject = event.streams[0];
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "offer", sdp: offer.sdp })
  });

  const answer = await res.json();
  await pc.setRemoteDescription(new RTCSessionDescription(answer));
});
