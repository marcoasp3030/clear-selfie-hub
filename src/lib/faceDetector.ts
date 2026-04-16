import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

let landmarkerPromise: Promise<FaceLandmarker> | null = null;

async function createLandmarker(): Promise<FaceLandmarker> {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm",
  );

  const modelAssetPath =
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

  const baseOpts = {
    runningMode: "VIDEO" as const,
    numFaces: 2,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
    minFaceDetectionConfidence: 0.5,
    minFacePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  };

  // iOS Safari frequently fails with GPU delegate. Try GPU first, fallback to CPU.
  try {
    return await FaceLandmarker.createFromOptions(vision, {
      ...baseOpts,
      baseOptions: { modelAssetPath, delegate: "GPU" },
    });
  } catch (gpuErr) {
    console.warn("[faceLandmarker] GPU delegate failed, falling back to CPU", gpuErr);
    return await FaceLandmarker.createFromOptions(vision, {
      ...baseOpts,
      baseOptions: { modelAssetPath, delegate: "CPU" },
    });
  }
}

export function getFaceLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = createLandmarker().catch((err) => {
      landmarkerPromise = null;
      throw err;
    });
  }
  return landmarkerPromise;
}

// Key landmark indices for the 478-point face mesh
export const KEY_LANDMARKS = {
  // Outline of face oval (used for bounding box)
  faceOval: [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379,
    378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127,
    162, 21, 54, 103, 67, 109,
  ],
  leftEye: [33, 133, 159, 145, 158, 153, 144, 163],
  rightEye: [362, 263, 386, 374, 385, 380, 373, 390],
  nose: [1, 2, 4, 5, 6, 19, 94, 168],
  mouth: [13, 14, 17, 78, 308, 61, 291, 0],
  leftCheek: [50, 101, 36, 205],
  rightCheek: [280, 330, 266, 425],
  forehead: [10, 67, 297, 109, 338],
  chin: [152, 175, 199, 200, 18],
};
