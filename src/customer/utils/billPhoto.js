import { Capacitor } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";

export const isNativeCamera = () => Capacitor.isNativePlatform();

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const compressDataUrl = (dataUrl, maxDim = 1280, quality = 0.7) =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });

export const captureBillPhoto = async (sourcePref = "prompt") => {
  if (isNativeCamera()) {
    const source =
      sourcePref === "camera"
        ? CameraSource.Camera
        : sourcePref === "gallery"
        ? CameraSource.Photos
        : CameraSource.Prompt;
    const photo = await Camera.getPhoto({
      source,
      resultType: CameraResultType.DataUrl,
      quality: 70,
      allowEditing: false,
      correctOrientation: true,
      promptLabelHeader: "Bill photo",
      promptLabelPhoto: "Choose from Gallery",
      promptLabelPicture: "Take Photo",
      promptLabelCancel: "Cancel",
    });
    if (!photo?.dataUrl) return null;
    return compressDataUrl(photo.dataUrl);
  }

  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    if (sourcePref === "camera") input.capture = "environment";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const raw = await fileToDataUrl(file);
      resolve(await compressDataUrl(raw));
    };
    input.click();
  });
};
