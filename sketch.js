let ax = 0;
let ay = 0;
let az = 0;

let wx = 0;
let wy = 0;
let wz = 0;

let isRecording = false;
let samples = [];
let smoothedSamples =[];

let recordingStartTime;

let startButton;
let statusText;
let tableContainer;

function setup() {
  let canvas = createCanvas(windowWidth, 400, WEBGL);
  canvas.parent("gesture-area");

  const enableButton = createButton("Enable motion permission");
  enableButton.elt.addEventListener("click", enableMotion);

  startButton = createButton("Start 8 second capture");
  startButton.mousePressed(startCapture);

  statusText = createP("Not recording");

  tableContainer = createDiv();
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

  samples = [];
  //smoothedSamples = [];

  recordingStartTime = performance.now();

  isRecording = true;

  statusText.html("Recording...");
  tableContainer.html("");

  setTimeout(stopCapture, 8000);
}


function stopCapture() {

  isRecording = false;
  smoothedSamples = gaussianSmooth(samples, 1000);

  statusText.html(
    `Finished! Captured ${samples.length} samples.`
  );

  //console.table(samples);

  //showTable();
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

function draw() {
  background(240);

  orbitControl();

  noFill();
  stroke(30);
  strokeWeight(2);

  beginShape();

  for (let sample of smoothedSamples) {


    vertex(
      sample.ax * 40,
      sample.ay * 40,
      sample.az * 40
    );
  }

  endShape();
}