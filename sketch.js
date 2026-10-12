let ax = 0;
let ay = 0;
let az = 0;

let wx = 0;
let wy = 0;
let wz = 0;

let isRecording = false;
let isPreparing = false;
let samples = [];
let smoothedSamples =[];
let gesturePalette = [
  [84, 0.025, 245, 0.5],
  [75, 0.050, 250, 0.5],
  [66, 0.075, 255, 0.5]
]; 
let recordingStartTime;
let playbackStartTime = null;

let startButton;
let statusText;
let tableContainer;

let viewYaw = 0;
let viewPitch = -0.2;
let viewDistance = 800;
let gestureRadius = 0;
let maxViewDistance = 1600;
let minViewDistance = 250;
let viewTargetX = 0;
let viewTargetY = 0;
let viewTargetZ = 0;

let activePointers = new Map();
let lastPinchDistance = null;


function setup() {
let gestureArea = document.getElementById("gesture-area");

gestureArea.style.display = "block";
let size = gestureArea.clientWidth;
gestureArea.style.display = "none";

let canvas = createCanvas(size, size, WEBGL);
  colorMode(OKLCH, 100, 0.4, 360, 1);

  canvas.parent("gesture-area");
  gestureArea.style.display = "none";

  canvas.elt.style.touchAction = "none";

  canvas.elt.addEventListener("pointerdown", startOrbit);
  canvas.elt.addEventListener("pointermove", moveOrbit);
  canvas.elt.addEventListener("pointerup", stopOrbit);
  canvas.elt.addEventListener("pointercancel", stopOrbit);

  const enableButton = createButton("Enable motion permission");
  enableButton.parent("controls")
  enableButton.elt.addEventListener("click", enableMotion);

  startButton = createButton("Begin 8-second recording");
  startButton.parent("capture-button-area");
  startButton.elt.addEventListener("click", startCapture);

  statusText = createP("Not recording");
  statusText.parent("recording-status-area");
  

  tableContainer = createDiv();
  let resetButton = createButton("Reset view");
  resetButton.parent("gesture-area");
  resetButton.elt.addEventListener("click", resetView);
}

function resetView() {
  viewYaw = 0;
  viewPitch = -0.2;
  viewDistance = 800;

  viewTargetX = 0;
  viewTargetY = 0;
  viewTargetZ = 0;
}

async function enableMotion() {
  statusText.html("Enable Motion function triggered");
  // iPhone / iPad Safari
  if (
    typeof DeviceMotionEvent !== "undefined" &&
    typeof DeviceMotionEvent.requestPermission === "function"
  ) {

    const permission = await DeviceMotionEvent.requestPermission();
    statusText.html(`Motion permission: ${permission}`);

    if (permission === "granted") {
      window.addEventListener("devicemotion", handleMotion);
    }

  }

  // Android and other browsers
  else {
    window.addEventListener("devicemotion", handleMotion);
  }
}


function handleMotion(event) {
  
  // Live sensor values
  ax = event.acceleration?.x ?? 0;
  ay = event.acceleration?.y ?? 0;
  az = event.acceleration?.z ?? 0;

  wx = event.rotationRate?.alpha ?? 0;
  wy = event.rotationRate?.beta ?? 0;
  wz = event.rotationRate?.gamma ?? 0;


  // Save them only while recording
  if (isRecording) {

    let sample = {
      time: performance.now() - recordingStartTime,
      ax,
      ay,
      az,
      wx,
      wy,
      wz
    };

    samples.push(sample);
  }
}


function startCapture() {

  if (isPreparing || isRecording) return;
  document.getElementById("gesture-area").style.display = "none";

  isPreparing = true;

  let secondsLeft = 5;

  startButton.html(`Get ready · ${secondsLeft}`);

  const countdown = setInterval(() => {

    secondsLeft--;

    if (secondsLeft > 0) {
      startButton.html(`Get ready · ${secondsLeft}`);
    } else {
      clearInterval(countdown);
      isPreparing = false;
      beginRecording();
    }

  }, 1000);
}

function beginRecording() {

  samples = [];
  smoothedSamples = [];
  playbackStartTime = null;

  recordingStartTime = performance.now();

  isRecording = true;

  tableContainer.html("");

  let secondsLeft = 8;

  startButton.html(`Recording · ${secondsLeft}`);

  const countdown = setInterval(() => {

    secondsLeft--;

    if (secondsLeft > 0) {
      startButton.html(`Recording · ${secondsLeft}`);
    } else {
      clearInterval(countdown);
      stopCapture();
    }

  }, 1000);
}

function stopCapture() {

  isRecording = false;
  smoothedSamples = gaussianSmooth(samples, 1000);
  gestureRadius = 0;
    for (let sample of smoothedSamples) {
      let distance = Math.hypot(
        sample.ax * 40,
        sample.ay * 40,
        sample.az * 40
      );

      gestureRadius = Math.max(gestureRadius, distance);
    }

  resetView();
  minViewDistance = 0.1;
  maxViewDistance = Math.max(1600, gestureRadius * 4.2);
  playbackStartTime = performance.now();

  statusText.html(
    `Finished! Captured ${samples.length} samples.`
  );

  //console.table(samples);

  //showTable();
  startButton.html("Begin another recording");
  document.getElementById("gesture-area").style.display = "block";
}


function showTable() {

  let html = `
    <table border="1" cellpadding="5">
      <tr>
        <th>time (ms)</th>
        <th>ax</th>
        <th>ay</th>
        <th>az</th>
        <th>wx</th>
        <th>wy</th>
        <th>wz</th>
      </tr>
  `;

  for (let sample of samples) {

    html += `
      <tr>
        <td>${sample.time.toFixed(1)}</td>
        <td>${sample.ax.toFixed(3)}</td>
        <td>${sample.ay.toFixed(3)}</td>
        <td>${sample.az.toFixed(3)}</td>
        <td>${sample.wx.toFixed(3)}</td>
        <td>${sample.wy.toFixed(3)}</td>
        <td>${sample.wz.toFixed(3)}</td>
      </tr>
    `;
  }

  html += `</table>`;

  tableContainer.html(html);
}

function gaussianSmooth(data, widthMS) {

  let result = [];

  let radius = widthMS / 2;
  let sigma = widthMS / 6;

  for (let sample of data) {
    let sumAx = 0;
    let sumAy = 0;
    let sumAz = 0;
    let totalWeight = 0;
   for (let neighbor of data) {

      let dt = neighbor.time - sample.time;

      if (Math.abs(dt) > radius) {
      continue;
     }

    let weight = Math.exp(-0.5 * (dt / sigma) ** 2);
      sumAx += neighbor.ax * weight;
      sumAy += neighbor.ay * weight;
      sumAz += neighbor.az * weight;

    totalWeight += weight;
   }
    result.push({
    ...sample,
    ax: sumAx / totalWeight,
    ay: sumAy / totalWeight,
    az: sumAz / totalWeight
    });

  }
  return result;



}

function getGestureColor(time, startTime, endTime, palette = gesturePalette) {

  let duration = endTime - startTime;

  if (duration <= 0) {
    return color(...palette[0]); 
  }

  let progress = (time - startTime) / duration;

  progress = constrain(progress, 0, 1);

  if (progress <= 0.5) {
    return lerpColor(
      color(...palette[0]),
      color(...palette[1]),
      progress * 2
    );
  } else {
    return lerpColor(
      color(...palette[1]),
      color(...palette[2]),
      (progress - 0.5) * 2
    );
  }
}

function draw() {
  background(12, 0.015, 260);
  perspective(
    PI / 3,
    width / height,
    1,
    maxViewDistance + gestureRadius + 1000
  );

 let camX = viewTargetX + viewDistance * cos(viewPitch) * sin(viewYaw);
  let camY = viewTargetY + viewDistance * sin(viewPitch);
  let camZ = viewTargetZ + viewDistance * cos(viewPitch) * cos(viewYaw);

  camera(
    camX, camY, camZ,
    viewTargetX, viewTargetY, viewTargetZ,
    0, 1, 0
  );
  
  if (smoothedSamples.length < 2) {
  return;
  }

  noFill();
  let startTime = smoothedSamples[0].time;
  let endTime = smoothedSamples[smoothedSamples.length - 1].time;
  let duration = endTime - startTime;

  if (duration <= 0 || playbackStartTime === null) {
    return;
  }

  let elapsed = performance.now() - playbackStartTime;

  let playbackTime = startTime + (elapsed % duration);
    strokeWeight(.5
    );
  let highlightWidth = 50;
  let highlightPalette = gesturePalette.map(([l, c, h]) => [
  Math.min(l + 12, 100),
  c,
  h,
  1
]);

  beginShape();

  for (let sample of smoothedSamples) {

    stroke(getGestureColor(sample.time, startTime, endTime));
    vertex(
      sample.ax * 40,
      sample.ay * 40,
      sample.az * 40
    );
  }

  endShape();

  // Traveling highlight

  strokeWeight(.7);

  beginShape();

  for (let sample of smoothedSamples) {

    let distance = Math.abs(sample.time - playbackTime);

    if (distance <= highlightWidth) {
      let strength = 1 - distance / highlightWidth;
      let fadedPalette = highlightPalette.map(([l, c, h]) => [
        l, c, h, strength
     ]);

    stroke(getGestureColor(
      sample.time,
      startTime,
      endTime,
      fadedPalette
    ));

      vertex(
        sample.ax * 40,
        sample.ay * 40,
        sample.az * 40
      );

    }
}

endShape();
}

function startOrbit(event) {

  if (event.pointerType === "mouse" && event.button !== 0) {
    return;
  }

  if (activePointers.size >= 2) {
    return;
  }

  activePointers.set(event.pointerId, {
    x: event.clientX,
    y: event.clientY
  });

  event.currentTarget.setPointerCapture(event.pointerId);

  if (activePointers.size === 2) {
    lastPinchDistance = getPinchDistance();
  }
}


function moveOrbit(event) {

  if (!activePointers.has(event.pointerId)) {
    return;
  }

  let previous = activePointers.get(event.pointerId);

  let deltaX = event.clientX - previous.x;
  let deltaY = event.clientY - previous.y;

  activePointers.set(event.pointerId, {
    x: event.clientX,
    y: event.clientY
  });

  if (activePointers.size === 1) {

    viewYaw += deltaX * 0.008;

    viewPitch = constrain(
      viewPitch + deltaY * 0.008,
      -PI / 3,
      PI / 3
    );

  } else if (activePointers.size === 2) {
     let panX = deltaX / 2;
    let panY = deltaY / 2;

    let panScale = (
      2 * viewDistance * Math.tan(Math.PI / 6)
    ) / height;

    viewTargetX -= panScale * (
      panX * cos(viewYaw)
      - panY * sin(viewPitch) * sin(viewYaw)
    );

    viewTargetY -= panScale * (
      panY * cos(viewPitch)
    );

    viewTargetZ -= panScale * (
      -panX * sin(viewYaw)
      - panY * sin(viewPitch) * cos(viewYaw)
    );

    let pinchDistance = getPinchDistance();

    if (lastPinchDistance !== null && pinchDistance > 0) {

      viewDistance = constrain(
        viewDistance * (lastPinchDistance / pinchDistance),
        minViewDistance,
        maxViewDistance
      );
    }

    lastPinchDistance = pinchDistance;
  }
}


function stopOrbit(event) {

  if (!activePointers.has(event.pointerId)) {
    return;
  }

  activePointers.delete(event.pointerId);

  lastPinchDistance = null;
}

function getPinchDistance() {

  let pointers = [...activePointers.values()];

  let first = pointers[0];
  let second = pointers[1];

  return Math.hypot(
    second.x - first.x,
    second.y - first.y
  );
}