document.addEventListener("DOMContentLoaded", async () => {
  const eartiSelect = document.getElementById("earti-select");
  const cameraSelect = document.getElementById("camera-select");
  const videoContainer = document.getElementById("video-container");

  const streamURLs = {
    earti1: {
      cam1: "https://streaming.earti.dev/api/whep?src=cam",
      cam2: "https://streaming.earti.dev/api/whep?src=cam2"
    },
    earti2: {
      cam1: "https://streaming.earti2.dev/api/whep?src=cam1",
      cam2: "https://streaming.earti2.dev/api/whep?src=cam2"
    }
  };

  // 🔧 Dynamic STUN/TURN config like the Veet code
  const env = {};
  if (location.hostname === "localhost") {
    env.servers = {
      iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }]
    };
  } else {
    env.servers = await fetch("./turn.json").then((r) => r.json());
  }

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

    // Close previous peer connection
    if (currentPeer) {
      currentPeer.close();
      currentPeer = null;
    }

    // 👇 Use env.servers from Veet code here
    const pc = new RTCPeerConnection(env.servers);
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
});
