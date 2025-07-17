document.addEventListener("DOMContentLoaded", () => {
  const eartiSelect = document.getElementById("earti-select");
  const cameraSelect = document.getElementById("camera-select");
  const videoContainer = document.getElementById("video-container");

  const streamURLs = {
    earti1: {
      cam1: "https://streaming.earti.dev/cam/whep",
      cam2: "https://streaming.earti.dev/cam2/whep"
    },
    earti2: {
      cam1: "https://streaming.earti2.dev/cam1/whep",
      cam2: "https://streaming.earti2.dev/cam2/whep"
    }
  };

  let currentPeer = null;

  eartiSelect.addEventListener("change", () => {
    console.log("EARTI select changed");
    cameraSelect.disabled = false;
    cameraSelect.selectedIndex = 0;
    videoContainer.innerHTML = "";
  });

  cameraSelect.addEventListener("change", async () => {
    console.log("Camera select changed - handler start");

    const earti = eartiSelect.value;
    const cam = cameraSelect.value;
    const url = streamURLs[earti][cam];
    console.log("Selected earti:", earti, "Selected cam:", cam);
    console.log("Stream URL:", url);

    videoContainer.innerHTML = `<div id="video" autoplay playsinline controls></div>`;
    const video = document.getElementById("video");
    console.log("Video element created:", video);

    if (currentPeer) {
      console.log("Closing existing peer connection");
      currentPeer.close();
      currentPeer = null;
    }

    try {
      console.log("Loading TURN config from /turn.json...");
      const turnRes = await fetch("/turn.json");
      const turnData = await turnRes.json();

      if (!Array.isArray(turnData.iceServers)) {
        throw new Error("Invalid TURN configuration: missing iceServers array");
      }

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" }, // fallback STUN
          ...turnData.iceServers
        ]
      });
      currentPeer = pc;

      pc.ontrack = (event) => {
        console.log("Received track event", event);
        video.srcObject = event.streams[0];
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          console.log("ICE Candidate:", e.candidate);
        } else {
          console.log("ICE gathering done");
        }
      };

      console.log("Creating offer...");
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log("Local description set");

      console.log("Waiting for ICE gathering to complete (onicecandidate)...");
      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.warn("ICE gathering timeout");
          resolve();
        }, 8000);

        if (pc.iceGatheringState === "complete") {
          clearTimeout(timeout);
          console.log("ICE already complete");
          resolve();
        } else {
          pc.addEventListener("icegatheringstatechange", () => {
            if (pc.iceGatheringState === "complete") {
              clearTimeout(timeout);
              console.log("ICE gathering complete (via event)");
              resolve();
            }
          });
        }
      });

      console.log("Sending offer to streaming server:", url);
      console.log("Final SDP:\n", pc.localDescription.sdp);

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/sdp"
        },
        body: pc.localDescription.sdp
      });

      const text = await res.text();
      console.log("Response status:", res.status);
      console.log("Response body:", text);

      if (!res.ok) {
        console.error("Streaming server error:", res.status, text);
        alert(`Streaming error: ${res.status}`);
        return;
      }

      let answer;
      try {
        answer = JSON.parse(text);
      } catch (e) {
        console.error("Failed to parse SDP answer:", e);
        alert("Invalid answer from server.");
        return;
      }

      console.log("Setting remote description...");
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      console.log("Remote description set successfully");

    } catch (err) {
      console.error("Error setting up stream:", err);
      alert("Failed to connect to stream.");
    }
  });
});
