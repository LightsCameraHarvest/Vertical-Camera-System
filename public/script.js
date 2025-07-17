document.addEventListener("DOMContentLoaded", () => {
  const cameraSelect = document.getElementById("cameraSelect");
  const videoContainer = document.getElementById("videoContainer");
  const controlsContainer = document.getElementById("controlsContainer");

  function createVideoElement(streamUrl) {
    const iframe = document.createElement("iframe");
    iframe.src = streamUrl;
    iframe.width = "480";
    iframe.height = "270";
    iframe.allow = "autoplay; fullscreen";
    iframe.style.border = "none";
    return iframe;
  }

  function createArrowControls(label) {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = `<h3>${label}</h3>`;
    const controls = document.createElement("div");
    controls.className = "arrow-keys";

    ["↑", "←", "→", "↓"].forEach((arrow) => {
      const btn = document.createElement("button");
      btn.textContent = arrow;
      controls.appendChild(btn);
    });

    wrapper.appendChild(controls);
    return wrapper;
  }

  function loadCameras() {
    const selection = cameraSelect.value;
    videoContainer.innerHTML = "";
    controlsContainer.innerHTML = "";

    if (selection === "cam1" || selection === "both") {
      videoContainer.appendChild(createVideoElement("https://streaming.earti.dev/cam/"));
      controlsContainer.appendChild(createArrowControls("Camera 1"));
    }

    if (selection === "cam2" || selection === "both") {
      videoContainer.appendChild(createVideoElement("https://streaming2.earti.dev/cam/"));
      controlsContainer.appendChild(createArrowControls("Camera 2"));
    }
  }

  cameraSelect.addEventListener("change", loadCameras);

  // Load default view
  loadCameras();
});