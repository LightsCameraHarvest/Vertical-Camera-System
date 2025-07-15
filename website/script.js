// === script.js ===
const eartiSelect = document.getElementById("earti-select");
const cameraSelect = document.getElementById("camera-select");
const videoContainer = document.getElementById("video-container");

// Example mapping: replace with real URLs later
const streamURLs = {
  earti1: {
    cam1: "stream",
    cam2: "stream"
  },
  earti2: {
    cam1: "stream",
    cam2: "stream"
  }
};

eartiSelect.addEventListener("change", () => {
  cameraSelect.disabled = false;
  cameraSelect.selectedIndex = 0;
  videoContainer.innerHTML = "";
});

cameraSelect.addEventListener("change", () => {
  const earti = eartiSelect.value;
  const cam = cameraSelect.value;
  const url = streamURLs[earti][cam];

  videoContainer.innerHTML = `
    <iframe src="${url}" width="100%" height="100%" frameborder="0" allowfullscreen></iframe>
  `;
});
