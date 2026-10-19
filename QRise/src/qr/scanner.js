import { BrowserMultiFormatReader } from "@zxing/browser";

export function scanQrCode({ video, signal }) {
  if (!(video instanceof HTMLVideoElement)) {
    return Promise.reject(new Error("The camera preview is not available."));
  }

  const reader = new BrowserMultiFormatReader();
  let controls;
  let settled = false;

  return new Promise((resolve, reject) => {
    function releaseCamera() {
      signal.removeEventListener("abort", abortScan);
      controls?.stop();
      const stream = video.srcObject;
      if (stream instanceof MediaStream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      video.srcObject = null;
    }

    function abortScan() {
      if (settled) return;
      settled = true;
      releaseCamera();
      resolve(null);
    }

    signal.addEventListener("abort", abortScan, { once: true });
    if (signal.aborted) {
      abortScan();
      return;
    }

    reader.decodeFromVideoDevice(undefined, video, (result, _error, scanControls) => {
      controls = scanControls;
      if (!result || settled) return;
      settled = true;
      const payload = result.getText();
      releaseCamera();
      resolve(payload);
    }).then((scanControls) => {
      controls = scanControls;
      if (settled) releaseCamera();
    }).catch((error) => {
      if (settled) return;
      settled = true;
      releaseCamera();
      reject(error);
    });
  });
}
