/* MODULE: VIEW - SCAN */
VC.views.scan = function() {
  document.getElementById('app-breadcrumb').innerHTML = '/ Scan Product';
  document.getElementById('app-view').innerHTML = `
    <div class="scan-page">
      <div class="scan-header">
        <h1>Verify Product</h1>
        <p>Point your camera at a VerifyChain QR code</p>
      </div>

      <div class="scan-modes">
        <button class="scan-mode-btn active" id="btn-camera" onclick="VC.views.activateCameraMode()">📷 Camera Scan</button>
        <button class="scan-mode-btn" id="btn-manual" onclick="VC.views.activateManualMode()">⌨ Enter ID</button>
      </div>

      <div id="camera-mode">
        <div class="camera-frame">
          <video id="scan-video" autoplay playsinline muted></video>
          <canvas id="scan-canvas" style="display:none"></canvas>
          <div class="scan-reticle">
            <div class="reticle-corner tl"></div>
            <div class="reticle-corner tr"></div>
            <div class="reticle-corner bl"></div>
            <div class="reticle-corner br"></div>
            <div class="scan-line"></div>
          </div>
          <div class="scan-status" id="scan-status">Initializing camera...</div>
        </div>
        <div class="scan-tip">Hold steady · Auto-detects QR code · No tap needed</div>
      </div>

      <div id="manual-mode" style="display:none">
        <div class="manual-input-group">
          <input type="text" id="manual-batch-id" class="vc-input" placeholder="e.g. VC-2025-0047 or paste full token"/>
          <button class="btn-primary" onclick="VC.views.manualVerify()">Verify →</button>
        </div>
        <div class="manual-tip">Enter the Batch ID printed below the QR code, or paste the full URL/token</div>
      </div>
    </div>
  `;
  VC.views.startCamera();
};

VC.views.startCamera = async function() {
  const video = document.getElementById('scan-video');
  const statusEl = document.getElementById('scan-status');
  if (!video) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    video.srcObject = stream;
    video.play();
    statusEl.textContent = 'Scanning for QR code...';
    VC.views._scanLoop(video, statusEl);
  } catch (err) {
    statusEl.textContent = 'Camera unavailable - use manual entry';
    document.getElementById('camera-mode').style.display = 'none';
    document.getElementById('manual-mode').style.display = 'block';
  }
};

VC.views._scanLoop = function(video, statusEl) {
  const canvas = document.getElementById('scan-canvas');
  if (!canvas || !video.srcObject) return;

  const ctx = canvas.getContext('2d');
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;

  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
    if (code) {
      statusEl.textContent = '✓ QR detected - verifying...';
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      video.srcObject.getTracks().forEach((t) => t.stop());
      const qrData = code.data;
      let token = qrData;
      if (qrData.includes('#/verify/')) token = qrData.split('#/verify/')[1];
      VC.router.go(`verify/${token}`);
      return;
    }
  }
  requestAnimationFrame(() => VC.views._scanLoop(video, statusEl));
};

VC.views.manualVerify = function() {
  const input = document.getElementById('manual-batch-id').value.trim();
  if (!input) {
    VC.ui.toast('Enter a batch ID', 'error');
    return;
  }
  let token = input;
  if (input.includes('#/verify/')) token = input.split('#/verify/')[1];
  if (input.startsWith('VC-')) {
    VC.views.verifyByBatchId(input);
    return;
  }
  VC.router.go(`verify/${token}`);
};

VC.views.verifyByBatchId = async function(batchId) {
  try {
    const tokens = await VC.db.getBatchTokens(batchId);
    if (!tokens.length) {
      VC.ui.toast('No QR token found for this batch', 'error');
      return;
    }
    VC.router.go(`verify/${tokens[0].token}`);
  } catch {
    VC.ui.toast('Unable to look up batch token', 'error');
  }
};

VC.views.activateCameraMode = function() {
  document.getElementById('camera-mode').style.display = 'block';
  document.getElementById('manual-mode').style.display = 'none';
  document.getElementById('btn-camera').classList.add('active');
  document.getElementById('btn-manual').classList.remove('active');
  VC.views.startCamera();
};

VC.views.activateManualMode = function() {
  const video = document.getElementById('scan-video');
  if (video && video.srcObject) video.srcObject.getTracks().forEach((t) => t.stop());
  document.getElementById('camera-mode').style.display = 'none';
  document.getElementById('manual-mode').style.display = 'block';
  document.getElementById('btn-camera').classList.remove('active');
  document.getElementById('btn-manual').classList.add('active');
};
