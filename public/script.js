document.addEventListener("DOMContentLoaded", () => {
  const cameraSelect = document.getElementById("cameraSelect");
  const videoContainer = document.getElementById("videoContainer");
  const controlsContainer = document.getElementById("controlsContainer");

  // Your stream URLs for each camera
  const streamURLs = {
    earti1: {
      cam1: "https://streaming.earti.dev/cam/whep",
      cam2: "https://streaming2.earti.dev/cam/whep"
    },
    earti2: {
      cam1: "https://streaming.earti.dev/cam/whep",
      cam2: "https://streaming2.earti.dev/cam/whep"
    }
  };

  const eartiSelect = document.getElementById("eartiSelect");
  
  // Better peer connection management
  let activePeers = new Map(); // Track multiple peer connections
  let connectionAttempts = new Map(); // Track retry attempts
  let reconnectTimers = new Map(); // Track reconnection timers

  // Base configuration - will be enhanced with TURN servers
  const baseRtcConfig = {
    iceCandidatePoolSize: 10, // Increased for better NAT traversal
    iceTransportPolicy: "all",
    bundlePolicy: "max-bundle",
    rtcpMuxPolicy: "require"
  };

  function createPresetSelect(label) {
    const presetSelect = document.createElement("select");
    presetSelect.className = "preset-select";
    presetSelect.ariaLabel = `${label} preset`;
    for (let i = 1; i <= 9; i++) {
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = `Preset ${i}`;
      presetSelect.appendChild(opt);
    }
    presetSelect.addEventListener("change", () => {
      console.log(`${label} preset selected:`, presetSelect.value);
      // TODO: Send preset change to Raspberry Pi
    });
    return presetSelect;
  }

  function createDPad(label) {
    const wrapper = document.createElement("div");
    wrapper.className = "control-group";
    const title = document.createElement("h3");
    title.textContent = label;

    const dpadWrapper = document.createElement("div");
    dpadWrapper.className = "dpad-wrapper";

    const dpad = document.createElement("div");
    dpad.className = "dpad";

    const directions = [
      "", "↑", "",
      "←", "", "→",
      "", "↓", ""
    ];

    directions.forEach(dir => {
      const btn = document.createElement("button");
      if (dir === "") {
        btn.className = "empty";
        btn.disabled = true;
      } else {
        btn.textContent = dir;
        btn.addEventListener("click", () => {
          console.log(`Move ${label} ${dir}`);
          // TODO: Send command to Raspberry Pi
        });
      }
      dpad.appendChild(btn);
    });

    dpadWrapper.appendChild(dpad);
    dpadWrapper.appendChild(createPresetSelect(label));
    wrapper.appendChild(title);
    wrapper.appendChild(dpadWrapper);
    return wrapper;
  }

  function cleanupPeerConnection(peerId) {
    if (activePeers.has(peerId)) {
      const pc = activePeers.get(peerId);
      pc.close();
      activePeers.delete(peerId);
      console.log(`Cleaned up peer connection: ${peerId}`);
    }
    
    if (reconnectTimers.has(peerId)) {
      clearTimeout(reconnectTimers.get(peerId));
      reconnectTimers.delete(peerId);
    }
    
    connectionAttempts.delete(peerId);
  }

  function cleanupAllConnections() {
    console.log("Cleaning up all connections...");
    activePeers.forEach((pc, peerId) => {
      cleanupPeerConnection(peerId);
    });
    activePeers.clear();
    connectionAttempts.clear();
    reconnectTimers.clear();
  }

  function attemptReconnection(peerId, streamUrl, videoElement, maxRetries) {
    console.log(`Attempting reconnection for ${peerId}...`);
    
    if (reconnectTimers.has(peerId)) {
      clearTimeout(reconnectTimers.get(peerId));
    }
    
    const timer = setTimeout(() => {
      setupWebRTCStreamForVideo(streamUrl, videoElement, peerId, maxRetries);
    }, 3000);
    
    reconnectTimers.set(peerId, timer);
  }

  async function loadTurnConfig() {
    try {
      console.log("Loading TURN configuration from /turn.json...");
      const turnRes = await fetch("/turn.json");
      
      if (!turnRes.ok) {
        throw new Error(`Failed to load turn.json: ${turnRes.status} ${turnRes.statusText}`);
      }
      
      const turnData = await turnRes.json();
      console.log("TURN config loaded successfully:", turnData);
      
      if (!turnData.iceServers || !Array.isArray(turnData.iceServers)) {
        throw new Error("Invalid TURN configuration: missing or invalid iceServers array");
      }
      
      // Validate that we have TURN servers (not just STUN)
      const hasTurnServers = turnData.iceServers.some(server => 
        server.urls && server.urls.some(url => url.includes('turn:') || url.includes('turns:'))
      );
      
      if (!hasTurnServers) {
        console.warn("No TURN servers found in configuration - may not work across different networks");
      } else {
        console.log("TURN servers found - should work across different networks");
      }
      
      return {
        ...baseRtcConfig,
        iceServers: turnData.iceServers
      };
      
    } catch (error) {
      console.error("Error loading TURN config:", error);
      console.warn("Falling back to basic STUN-only configuration");
      
      // Fallback to basic STUN servers
      return {
        ...baseRtcConfig,
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun2.l.google.com:19302" }
        ]
      };
    }
  }

  async function setupWebRTCStreamForVideo(streamUrl, videoElement, peerId, maxRetries = 3) {
    const attempts = connectionAttempts.get(peerId) || 0;
    
    if (attempts >= maxRetries) {
      console.error(`Max retry attempts reached for ${peerId}`);
      return null;
    }

    connectionAttempts.set(peerId, attempts + 1);
    
    try {
      console.log(`Setting up stream for ${peerId} (attempt ${attempts + 1})`);
      
      // Clean up any existing connection for this peer
      cleanupPeerConnection(peerId);
      
      const config = await loadTurnConfig();
      const pc = new RTCPeerConnection(config);
      activePeers.set(peerId, pc);

      // CRITICAL: Handle incoming remote stream
      pc.ontrack = (event) => {
        console.log(`Received remote stream for ${peerId}:`, event.streams[0]);
        
        if (event.streams && event.streams[0]) {
          videoElement.srcObject = event.streams[0];
          console.log(`Video stream attached to element for ${peerId}`);
          
          // Wait for the video to be ready before playing
          videoElement.oncanplay = () => {
            videoElement.play().catch(error => {
              console.error(`Error playing video for ${peerId}:`, error);
            });
          };
        } else {
          console.error(`No stream received in track event for ${peerId}`);
        }
      };

      // Add video element event handlers for debugging
      videoElement.onerror = (error) => {
        console.error(`Video element error for ${peerId}:`, error);
      };

      videoElement.onloadstart = () => {
        console.log(`Video started loading for ${peerId}`);
      };

      videoElement.onloadedmetadata = () => {
        console.log(`Video metadata loaded for ${peerId}`, {
          width: videoElement.videoWidth,
          height: videoElement.videoHeight,
          duration: videoElement.duration
        });
      };

      videoElement.onplaying = () => {
        console.log(`Video is now playing for ${peerId}`);
      };

      // Enhanced connection state monitoring with better logging
      pc.oniceconnectionstatechange = () => {
        console.log(`ICE connection state for ${peerId}:`, pc.iceConnectionState);
        
        if (pc.iceConnectionState === 'checking') {
          console.log(`${peerId}: ICE connectivity checks in progress...`);
        } else if (pc.iceConnectionState === 'connected') {
          console.log(`${peerId}: ICE connection established successfully`);
          connectionAttempts.set(peerId, 0); // Reset retry counter
        } else if (pc.iceConnectionState === 'completed') {
          console.log(`${peerId}: ICE connection completed (all checks done)`);
        } else if (pc.iceConnectionState === 'failed') {
          console.error(`${peerId}: ICE connection failed - may need TURN servers`);
          attemptReconnection(peerId, streamUrl, videoElement, maxRetries);
        } else if (pc.iceConnectionState === 'disconnected') {
          console.warn(`${peerId}: ICE connection disconnected - attempting reconnect`);
          attemptReconnection(peerId, streamUrl, videoElement, maxRetries);
        }
      };

      pc.onicegatheringstatechange = () => {
        console.log(`ICE gathering state for ${peerId}:`, pc.iceGatheringState);
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          console.log(`ICE candidate for ${peerId}:`, e.candidate.type, e.candidate.protocol);
          // Log if we're getting relay candidates (TURN)
          if (e.candidate.type === 'relay') {
            console.log(`${peerId}: TURN relay candidate found - good for NAT traversal`);
          }
        } else {
          console.log(`ICE candidate gathering complete for ${peerId}`);
        }
      };

      // Create offer with optimized settings
      const offer = await pc.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: true
      });
      await pc.setLocalDescription(offer);

      // Enhanced ICE gathering with shorter timeout for better performance
      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.warn(`ICE gathering timeout for ${peerId} - proceeding with available candidates`);
          resolve();
        }, 5000); // Reduced timeout for better performance

        if (pc.iceGatheringState === "complete") {
          clearTimeout(timeout);
          console.log(`ICE gathering already complete for ${peerId}`);
          resolve();
        } else {
          const onStateChange = () => {
            console.log(`ICE gathering state changed for ${peerId}:`, pc.iceGatheringState);
            if (pc.iceGatheringState === "complete") {
              clearTimeout(timeout);
              pc.removeEventListener("icegatheringstatechange", onStateChange);
              console.log(`ICE gathering complete for ${peerId}`);
              resolve();
            }
          };
          pc.addEventListener("icegatheringstatechange", onStateChange);
        }
      });

      const localSDP = pc.localDescription.sdp;
      
      // Enhanced SDP validation
      if (!localSDP.includes("a=ice-ufrag:") || !localSDP.includes("a=ice-pwd:")) {
        throw new Error(`Local SDP for ${peerId} is missing ICE credentials`);
      }
      
      // Check if we have TURN candidates in the SDP
      const hasRelayCandidates = localSDP.includes("typ relay");
      const hasSrflxCandidates = localSDP.includes("typ srflx");
      
      console.log(`${peerId} SDP analysis:`, {
        hasRelayCandidates,
        hasSrflxCandidates,
        sdpLength: localSDP.length
      });
      
      if (!hasRelayCandidates && !hasSrflxCandidates) {
        console.warn(`${peerId}: No TURN/STUN candidates found - may not work across different networks`);
      }

      console.log(`Sending offer to streaming server for ${peerId}`);
      
      const res = await fetch(streamUrl, {
        method: "POST",
        headers: { 
          "Content-Type": "application/sdp",
          "Accept": "application/sdp"
        },
        body: localSDP
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Server error for ${peerId}: ${res.status} - ${text}`);
      }

      const answerSDP = await res.text();
      await pc.setRemoteDescription(new RTCSessionDescription({ 
        type: "answer", 
        sdp: answerSDP 
      }));

      console.log(`Successfully set up stream for ${peerId}`);
      return pc;

    } catch (error) {
      console.error(`Error setting up stream for ${peerId}:`, error);
      cleanupPeerConnection(peerId);
      
      // Retry logic
      if (attempts < maxRetries) {
        console.log(`Retrying connection for ${peerId} in 3 seconds...`);
        const timer = setTimeout(() => {
          setupWebRTCStreamForVideo(streamUrl, videoElement, peerId, maxRetries);
        }, 3000);
        reconnectTimers.set(peerId, timer);
      } else {
        console.error(`Failed to establish connection for ${peerId} after ${maxRetries} attempts`);
      }
      
      return null;
    }
  }

  async function setupSingleCamera(earti, cameraId) {
    cleanupAllConnections();
    videoContainer.innerHTML = "";
    controlsContainer.innerHTML = "";

    const video = document.createElement("video");
    video.id = "video";
    video.autoplay = true;
    video.playsInline = true;
    video.controls = true;
    video.style.width = "640px";
    video.style.height = "360px";
    videoContainer.appendChild(video);

    const streamUrl = streamURLs[earti][cameraId];
    await setupWebRTCStreamForVideo(streamUrl, video, cameraId);
    
    controlsContainer.appendChild(createDPad(`Camera ${cameraId === "cam1" ? "1" : "2"}`));
  }

  async function setupBothCameras(earti) {
    cleanupAllConnections();
    videoContainer.innerHTML = "";
    controlsContainer.innerHTML = "";

    // Create containers for both cameras
    const bothContainer = document.createElement("div");
    bothContainer.style.display = "flex";
    bothContainer.style.gap = "20px";
    bothContainer.style.flexWrap = "wrap";
    bothContainer.style.justifyContent = "center";

    // Camera 1 container
    const cam1Container = document.createElement("div");
    cam1Container.style.display = "flex";
    cam1Container.style.flexDirection = "column";
    cam1Container.style.alignItems = "center";
    cam1Container.style.gap = "10px";

    const cam1Title = document.createElement("h3");
    cam1Title.textContent = "Camera 1";
    cam1Title.style.margin = "0";

    const video1 = document.createElement("video");
    video1.id = "video1";
    video1.autoplay = true;
    video1.playsInline = true;
    video1.controls = true;
    video1.style.width = "480px";
    video1.style.height = "270px";

    cam1Container.appendChild(cam1Title);
    cam1Container.appendChild(video1);

    // Camera 2 container
    const cam2Container = document.createElement("div");
    cam2Container.style.display = "flex";
    cam2Container.style.flexDirection = "column";
    cam2Container.style.alignItems = "center";
    cam2Container.style.gap = "10px";

    const cam2Title = document.createElement("h3");
    cam2Title.textContent = "Camera 2";
    cam2Title.style.margin = "0";

    const video2 = document.createElement("video");
    video2.id = "video2";
    video2.autoplay = true;
    video2.playsInline = true;
    video2.controls = true;
    video2.style.width = "480px";
    video2.style.height = "270px";

    cam2Container.appendChild(cam2Title);
    cam2Container.appendChild(video2);

    bothContainer.appendChild(cam1Container);
    bothContainer.appendChild(cam2Container);
    videoContainer.appendChild(bothContainer);

    // Setup WebRTC for both cameras with staggered connection
    console.log("Setting up both cameras with staggered connection...");
    
    try {
      // Connect to first camera
      const pc1Promise = setupWebRTCStreamForVideo(streamURLs[earti].cam1, video1, "cam1");
      
      // Wait a bit before connecting to second camera to reduce resource contention
      await new Promise(resolve => setTimeout(resolve, 500)); // Reduced delay
      
      // Connect to second camera
      const pc2Promise = setupWebRTCStreamForVideo(streamURLs[earti].cam2, video2, "cam2");
      
      // Wait for both connections to complete
      await Promise.all([pc1Promise, pc2Promise]);
      
      // Add controls for both cameras
      controlsContainer.appendChild(createDPad("Camera 1"));
      controlsContainer.appendChild(createDPad("Camera 2"));
      
    } catch (error) {
      console.error("Error setting up both cameras:", error);
      alert("Failed to connect to one or both camera streams. Please try again.");
    }
  }

  async function loadCameras() {
    const earti = eartiSelect ? eartiSelect.value : "earti1";
    const selection = cameraSelect.value;

    console.log(`Loading cameras: ${earti} - ${selection}`);

    if (selection === "both") {
      await setupBothCameras(earti);
    } else if (selection === "cam1" || selection === "cam2") {
      await setupSingleCamera(earti, selection);
    }
  }

  // Event listeners
  if (eartiSelect) {
    eartiSelect.addEventListener("change", () => {
      cameraSelect.disabled = false;
      cameraSelect.selectedIndex = 0;
      cleanupAllConnections();
      videoContainer.innerHTML = "";
      controlsContainer.innerHTML = "";
    });
  }

  cameraSelect.addEventListener("change", loadCameras);

  // Cleanup on page unload
  window.addEventListener("beforeunload", cleanupAllConnections);

  // Initial load
  loadCameras();
});