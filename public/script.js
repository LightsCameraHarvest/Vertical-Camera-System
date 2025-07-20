let socket = null;
let messageQueue = [];
let connectionAttempts = 0;
const maxReconnectAttempts = 5;

function connectWebSocket() {
  const wsURL = `wss://ws.earti.dev/`;

  console.log(`Attempting WebSocket connection to ${wsURL} (attempt ${connectionAttempts + 1})`);
  
  try {
    socket = new WebSocket(wsURL);
    
    socket.addEventListener("open", () => {
      console.log("WebSocket connected successfully");
      connectionAttempts = 0; // Reset counter on successful connection
      
      // Send any queued messages
      while (messageQueue.length > 0) {
        const message = messageQueue.shift();
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(message);
        }
      }
    });

    socket.addEventListener("message", (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("From Pi:", data);
        
        // Handle different message types
        if (data.status === "connected") {
          console.log("Successfully connected to EARTI controls");
        } else if (data.status === "executed") {
          console.log(`Command executed: ${data.command} for ${data.camera}`);
        } else if (data.status === "error") {
          console.error("Pi error:", data.message);
        }
      } catch (e) {
        console.log("Raw message from Pi:", event.data);
      }
    });

    socket.addEventListener("close", (event) => {
      console.warn(`WebSocket closed. Code: ${event.code}, Reason: ${event.reason}`);
      
      // Only attempt reconnect if we haven't exceeded max attempts
      if (connectionAttempts < maxReconnectAttempts) {
        connectionAttempts++;
        const delay = Math.min(1000 * Math.pow(2, connectionAttempts), 10000); // Exponential backoff, max 10s
        console.log(`Attempting reconnect in ${delay}ms...`);
        setTimeout(connectWebSocket, delay);
      } else {
        console.error("Max reconnection attempts reached. Please refresh the page.");
      }
    });

    socket.addEventListener("error", (err) => {
      console.error("WebSocket error:", err);
      
      // Close the socket to trigger reconnect logic
      if (socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
    });
    
  } catch (error) {
    console.error("Failed to create WebSocket:", error);
    
    // Retry connection after delay
    if (connectionAttempts < maxReconnectAttempts) {
      connectionAttempts++;
      const delay = Math.min(1000 * Math.pow(2, connectionAttempts), 10000);
      setTimeout(connectWebSocket, delay);
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  connectWebSocket();

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
  
  // Mobile detection
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);
  
  console.log("Device detection:", { isMobile, isIOS, isAndroid });
  
  // Enhanced mobile-friendly play button function
  function addPlayButton(videoElement, peerId) {
    // Check if play button already exists
    const existingButton = videoElement.parentElement.querySelector('.play-button');
    if (existingButton) return;
    
    const playButton = document.createElement('button');
    playButton.className = 'play-button';
    playButton.innerHTML = '▶ Tap to Play';
    playButton.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      padding: 12px 24px;
      font-size: 16px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      z-index: 1000;
      font-family: Arial, sans-serif;
      touch-action: manipulation;
    `;
    
    // Make the video container relative positioned
    videoElement.parentElement.style.position = 'relative';
    
    // Enhanced mobile play handling
    const playHandler = async () => {
      try {
        // For mobile, ensure proper video attributes
        videoElement.muted = true;
        videoElement.playsInline = true;
        videoElement.setAttribute('playsinline', 'true');
        videoElement.setAttribute('webkit-playsinline', 'true');
        
        await videoElement.play();
        playButton.remove();
        console.log(`Manual play successful for ${peerId}`);
      } catch (error) {
        console.error(`Manual play failed for ${peerId}:`, error);
        // Try again with different approach
        setTimeout(() => {
          videoElement.play().catch(e => console.error(`Retry play failed for ${peerId}:`, e));
        }, 1000);
      }
    };
    
    playButton.addEventListener('click', playHandler);
    playButton.addEventListener('touchstart', playHandler);
    
    videoElement.parentElement.appendChild(playButton);
  }

  // Better peer connection management
  let activePeers = new Map();
  let connectionAttempts = new Map();
  let reconnectTimers = new Map();

  // Enhanced RTC configuration for mobile
  const baseRtcConfig = {
    iceCandidatePoolSize: 10,
    iceTransportPolicy: "all",
    bundlePolicy: "max-bundle",
    rtcpMuxPolicy: "require",
    // Mobile-specific settings
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun3.l.google.com:19302" },
      { urls: "stun:stun4.l.google.com:19302" }
    ]
  };

  function sendCommand(data) {
    const msg = JSON.stringify(data);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(msg);
      console.log("Sent command: ", data);
    } else if (socket && socket.readyState === WebSocket.CONNECTING) {
      console.log("Socket connecting, queuing message");
      messageQueue.push(msg);
    } else {
      console.warn("WebSocket not open or closed, cannot send");
      messageQueue.push(msg);

      // Try reconnecting if not already trying 
      if (!socket || socket.readyState === WebSocket.CLOSED) {
        connectWebSocket();
      }
    }
  }

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
      // **TODO: Send preset change to Raspberry Pi
      sendCommand({ command: presetSelect.value, camera: label });
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
    let intervalId = null;

    if (dir === "") {
      btn.className = "empty";
      btn.disabled = true;
    } else {
      btn.textContent = dir;
      btn.style.touchAction = "manipulation";

      // Start sending repeatedly when pressed
      const startSending = () => {
        sendCommand({ command: dir, camera: label });
        intervalId = setInterval(() => {
          sendCommand({ command: dir, camera: label });
        }, 150);
      };

      // Stop sending when released
      const stopSending = () => {
        if (intervalId !== null) {
          clearInterval(intervalId);
          intervalId = null;
        }
      };

      // Mouse events
      btn.addEventListener("mousedown", startSending);
      btn.addEventListener("mouseup", stopSending);
      btn.addEventListener("mouseleave", stopSending);

      // Touch events
      btn.addEventListener("touchstart", (e) => {
        e.preventDefault();
        startSending();
      });
      btn.addEventListener("touchend", (e) => {
        e.preventDefault();
        stopSending();
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
      const turnRes = await fetch("turn.json");
      
      if (!turnRes.ok) {
        throw new Error(`Failed to load turn.json: ${turnRes.status} ${turnRes.statusText}`);
      }
      
      const turnData = await turnRes.json();
      console.log("TURN config loaded successfully:", turnData);
      
      if (!turnData.iceServers || !Array.isArray(turnData.iceServers)) {
        throw new Error("Invalid TURN configuration: missing or invalid iceServers array");
      }
      
      // Enhanced configuration for mobile
      const mobileConfig = {
        ...baseRtcConfig,
        iceServers: [
          // Keep existing STUN servers for fallback
          ...baseRtcConfig.iceServers,
          // Add TURN servers from config
          ...turnData.iceServers
        ]
      };
      
      // For mobile, force more aggressive ICE transport
      if (isMobile) {
        mobileConfig.iceTransportPolicy = "relay"; // Force TURN usage on mobile
        mobileConfig.iceCandidatePoolSize = 20; // More candidates for mobile
      }
      
      console.log("Final RTC config:", mobileConfig);
      return mobileConfig;
      
    } catch (error) {
      console.error("Error loading TURN config:", error);
      console.warn("Falling back to enhanced STUN-only configuration");
      
      // Enhanced fallback for mobile
      const fallbackConfig = {
        ...baseRtcConfig,
        iceServers: [
          ...baseRtcConfig.iceServers,
          // Add more public STUN servers
          { urls: "stun:stun.cloudflare.com:3478" },
          { urls: "stun:global.stun.twilio.com:3478" }
        ]
      };
      
      if (isMobile) {
        fallbackConfig.iceCandidatePoolSize = 20;
      }
      
      return fallbackConfig;
    }
  }

  // Enhanced mobile video element setup
  function setupVideoElement(videoElement, peerId) {
    // Mobile-specific video attributes
    videoElement.muted = true; // Required for mobile autoplay
    videoElement.playsInline = true;
    videoElement.setAttribute('playsinline', 'true');
    videoElement.setAttribute('webkit-playsinline', 'true');
    videoElement.setAttribute('x-webkit-airplay', 'allow');
    
    // iOS-specific settings
    if (isIOS) {
      videoElement.setAttribute('controls', 'false'); // Hide controls initially on iOS
      videoElement.setAttribute('preload', 'metadata');
    }
    
    // Enhanced video event handlers
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

    videoElement.oncanplay = () => {
      console.log(`Video can play for ${peerId}`);
    };

    videoElement.onplaying = () => {
      console.log(`Video is now playing for ${peerId}`);
    };

    videoElement.onwaiting = () => {
      console.log(`Video is waiting for ${peerId}`);
    };

    videoElement.onstalled = () => {
      console.log(`Video stalled for ${peerId}`);
    };
  }

  async function setupWebRTCStreamForVideo(streamUrl, videoElement, peerId, maxRetries = 3) {
    const attempts = connectionAttempts.get(peerId) || 0;
    
    if (attempts >= maxRetries) {
      console.error(`Max retry attempts reached for ${peerId}`);
      return null;
    }

    connectionAttempts.set(peerId, attempts + 1);
    
    try {
      console.log(`Setting up stream for ${peerId} (attempt ${attempts + 1}) - Mobile: ${isMobile}`);
      
      // Clean up any existing connection for this peer
      cleanupPeerConnection(peerId);
      
      // Setup video element with mobile-specific attributes
      setupVideoElement(videoElement, peerId);
      
      const config = await loadTurnConfig();
      const pc = new RTCPeerConnection(config);
      activePeers.set(peerId, pc);

      // Enhanced mobile-friendly stream handling
      pc.ontrack = (event) => {
        console.log(`Received remote stream for ${peerId}:`, event.streams[0]);
        
        if (event.streams && event.streams[0]) {
          const stream = event.streams[0];
          videoElement.srcObject = stream;
          console.log(`Video stream attached to element for ${peerId}`);
          
          // Enhanced mobile play handling
          const attemptPlay = async () => {
            try {
              console.log(`Attempting to play video for ${peerId}`);
              
              // Wait for video to be ready
              if (videoElement.readyState < 3) {
                console.log(`Video not ready for ${peerId}, waiting...`);
                return;
              }
              
              await videoElement.play();
              console.log(`Video started playing for ${peerId}`);
              
              // Show controls after successful play
              if (isIOS) {
                videoElement.controls = true;
              }
              
            } catch (error) {
              console.warn(`Autoplay failed for ${peerId}:`, error.name, error.message);
              
              // Add play button for user interaction
              addPlayButton(videoElement, peerId);
              
              // For mobile, try to play on next user interaction
              if (isMobile) {
                const playOnInteraction = async () => {
                  try {
                    await videoElement.play();
                    console.log(`Video started playing after user interaction for ${peerId}`);
                    document.removeEventListener('touchstart', playOnInteraction);
                    document.removeEventListener('click', playOnInteraction);
                  } catch (e) {
                    console.error(`Play on interaction failed for ${peerId}:`, e);
                  }
                };
                
                document.addEventListener('touchstart', playOnInteraction, { once: true });
                document.addEventListener('click', playOnInteraction, { once: true });
              }
            }
          };
          
          // Multiple trigger points for playing
          videoElement.oncanplay = attemptPlay;
          videoElement.oncanplaythrough = attemptPlay;
          
          // Try immediately if ready
          if (videoElement.readyState >= 3) {
            attemptPlay();
          }
          
          // Also try after a short delay
          setTimeout(attemptPlay, 1000);
          
        } else {
          console.error(`No stream received in track event for ${peerId}`);
        }
      };

      // Enhanced connection state monitoring
      pc.oniceconnectionstatechange = () => {
        console.log(`ICE connection state for ${peerId}:`, pc.iceConnectionState);
        
        if (pc.iceConnectionState === 'checking') {
          console.log(`${peerId}: ICE connectivity checks in progress...`);
        } else if (pc.iceConnectionState === 'connected') {
          console.log(`${peerId}: ICE connection established successfully`);
          connectionAttempts.set(peerId, 0);
        } else if (pc.iceConnectionState === 'completed') {
          console.log(`${peerId}: ICE connection completed`);
        } else if (pc.iceConnectionState === 'failed') {
          console.error(`${peerId}: ICE connection failed - likely NAT/firewall issue`);
          console.error(`${peerId}: Consider using TURN servers for mobile compatibility`);
          attemptReconnection(peerId, streamUrl, videoElement, maxRetries);
        } else if (pc.iceConnectionState === 'disconnected') {
          console.warn(`${peerId}: ICE connection disconnected`);
          attemptReconnection(peerId, streamUrl, videoElement, maxRetries);
        }
      };

      pc.onicegatheringstatechange = () => {
        console.log(`ICE gathering state for ${peerId}:`, pc.iceGatheringState);
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          console.log(`ICE candidate for ${peerId}:`, e.candidate.type, e.candidate.protocol);
          if (e.candidate.type === 'relay') {
            console.log(`${peerId}: TURN relay candidate found - excellent for mobile`);
          } else if (e.candidate.type === 'srflx') {
            console.log(`${peerId}: STUN server reflexive candidate found`);
          } else if (e.candidate.type === 'host') {
            console.log(`${peerId}: Host candidate found`);
          }
        } else {
          console.log(`ICE candidate gathering complete for ${peerId}`);
        }
      };

      // Create offer with mobile-optimized settings
      const offerOptions = {
        offerToReceiveVideo: true,
        offerToReceiveAudio: true
      };
      
      // Mobile-specific offer constraints
      if (isMobile) {
        offerOptions.voiceActivityDetection = false; // Reduce processing
      }
      
      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addTransceiver('audio', { direction: 'recvonly' });

      const offer = await pc.createOffer(offerOptions);
      await pc.setLocalDescription(offer);

      // Enhanced ICE gathering with mobile-appropriate timeout
      const iceGatheringTimeout = isMobile ? 10000 : 5000; // Longer timeout for mobile
      
      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.warn(`ICE gathering timeout for ${peerId} after ${iceGatheringTimeout}ms`);
          resolve();
        }, iceGatheringTimeout);

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
      
      // Enhanced SDP validation with mobile-specific checks
      if (!localSDP.includes("a=ice-ufrag:") || !localSDP.includes("a=ice-pwd:")) {
        throw new Error(`Local SDP for ${peerId} is missing ICE credentials`);
      }
      
      const hasRelayCandidates = localSDP.includes("typ relay");
      const hasSrflxCandidates = localSDP.includes("typ srflx");
      const hasHostCandidates = localSDP.includes("typ host");
      
      console.log(`${peerId} SDP analysis:`, {
        hasRelayCandidates,
        hasSrflxCandidates,
        hasHostCandidates,
        sdpLength: localSDP.length,
        mobile: isMobile
      });
      
      if (isMobile && !hasRelayCandidates) {
        console.warn(`${peerId}: Mobile device without TURN relay candidates - connection may fail`);
      }

      console.log(`Sending offer to streaming server for ${peerId}`);
      
      // Enhanced fetch with mobile-appropriate timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
      
      const res = await fetch(streamUrl, {
        method: "POST",
        headers: { 
          "Content-Type": "application/sdp",
          "Accept": "application/sdp"
        },
        body: localSDP,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Server error for ${peerId}: ${res.status} - ${text}`);
      }

      const answerSDP = await res.text();
      
      // Validate answer SDP
      if (!answerSDP.includes("a=ice-ufrag:") || !answerSDP.includes("a=ice-pwd:")) {
        throw new Error(`Answer SDP for ${peerId} is missing ICE credentials`);
      }
      
      await pc.setRemoteDescription(new RTCSessionDescription({ 
        type: "answer", 
        sdp: answerSDP 
      }));

      console.log(`Successfully set up stream for ${peerId}`);
      return pc;

    } catch (error) {
      console.error(`Error setting up stream for ${peerId}:`, error);
      
      // Enhanced error handling for mobile
      if (error.name === 'AbortError') {
        console.error(`${peerId}: Request timeout - check network connection`);
      } else if (error.name === 'NotAllowedError') {
        console.error(`${peerId}: Media access denied - check permissions`);
      }
      
      cleanupPeerConnection(peerId);
      
      // Retry logic with exponential backoff
      if (attempts < maxRetries) {
        const delay = Math.min(3000 * Math.pow(2, attempts), 10000); // Max 10s delay
        console.log(`Retrying connection for ${peerId} in ${delay}ms...`);
        const timer = setTimeout(() => {
          setupWebRTCStreamForVideo(streamUrl, videoElement, peerId, maxRetries);
        }, delay);
        reconnectTimers.set(peerId, timer);
      } else {
        console.error(`Failed to establish connection for ${peerId} after ${maxRetries} attempts`);
        
        // Show user-friendly error message
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(255, 0, 0, 0.8);
          color: white;
          padding: 20px;
          border-radius: 5px;
          text-align: center;
          z-index: 1000;
        `;
        errorDiv.innerHTML = `
          <h3>Connection Failed</h3>
          <p>Unable to connect to ${peerId}</p>
          <p>Please check your network connection</p>
          <button onclick="this.parentElement.remove()">Close</button>
        `;
        videoElement.parentElement.appendChild(errorDiv);
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
    video.muted = true;
    video.controls = true;
    video.style.width = isMobile ? "100%" : "640px";
    video.style.height = isMobile ? "auto" : "360px";
    video.style.maxWidth = "100%";
    video.style.backgroundColor = "#000";
    videoContainer.appendChild(video);

    const streamUrl = streamURLs[earti][cameraId];
    await setupWebRTCStreamForVideo(streamUrl, video, cameraId);
    
    controlsContainer.appendChild(createDPad(`Camera ${cameraId === "cam1" ? "1" : "2"}`));
  }

  async function setupBothCameras(earti) {
    cleanupAllConnections();
    videoContainer.innerHTML = "";
    controlsContainer.innerHTML = "";

    const bothContainer = document.createElement("div");
    bothContainer.style.display = "flex";
    bothContainer.style.gap = "20px";
    bothContainer.style.flexWrap = "wrap";
    bothContainer.style.justifyContent = "center";
    
    // Mobile-friendly responsive layout
    if (isMobile) {
      bothContainer.style.flexDirection = "column";
      bothContainer.style.gap = "10px";
    }

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
    video1.muted = true;
    video1.controls = true;
    video1.style.width = isMobile ? "100%" : "480px";
    video1.style.height = isMobile ? "auto" : "270px";
    video1.style.maxWidth = "100%";
    video1.style.backgroundColor = "#000";

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
    video2.muted = true;
    video2.controls = true;
    video2.style.width = isMobile ? "100%" : "480px";
    video2.style.height = isMobile ? "auto" : "270px";
    video2.style.maxWidth = "100%";
    video2.style.backgroundColor = "#000";

    cam2Container.appendChild(cam2Title);
    cam2Container.appendChild(video2);

    bothContainer.appendChild(cam1Container);
    bothContainer.appendChild(cam2Container);
    videoContainer.appendChild(bothContainer);

    // Enhanced mobile connection strategy
    console.log("Setting up both cameras with mobile-optimized connection...");
    
    try {
      if (isMobile) {
        // For mobile, connect cameras sequentially to reduce resource contention
        console.log("Mobile detected - connecting cameras sequentially");
        
        await setupWebRTCStreamForVideo(streamURLs[earti].cam1, video1, "cam1");
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s between connections
        await setupWebRTCStreamForVideo(streamURLs[earti].cam2, video2, "cam2");
      } else {
        // For desktop, connect in parallel with staggered timing
        const pc1Promise = setupWebRTCStreamForVideo(streamURLs[earti].cam1, video1, "cam1");
        await new Promise(resolve => setTimeout(resolve, 1000));
        const pc2Promise = setupWebRTCStreamForVideo(streamURLs[earti].cam2, video2, "cam2");
        
        await Promise.all([pc1Promise, pc2Promise]);
      }
      
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

    console.log(`Loading cameras: ${earti} - ${selection} (Mobile: ${isMobile})`);

    // Show loading indicator
    videoContainer.innerHTML = '<div style="text-align: center; padding: 20px;">Loading cameras...</div>';

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

  // Enhanced cleanup on page unload
  window.addEventListener("beforeunload", cleanupAllConnections);
  window.addEventListener("pagehide", cleanupAllConnections);
  
  // Mobile-specific event handlers
  if (isMobile) {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        console.log("Page hidden - maintaining connections");
      } else {
        console.log("Page visible - checking connections");
        // Could add connection health check here
      }
    });
  }

  // Initial load
  console.log("Starting initial camera load...");
  loadCameras();
});