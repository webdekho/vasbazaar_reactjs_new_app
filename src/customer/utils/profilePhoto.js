import { Capacitor } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";

export const shouldUseNativeCamera = () => Capacitor.isNativePlatform();

export const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export const captureProfilePhotoDataUrl = async () => {
  const photo = await Camera.getPhoto({
    source: CameraSource.Prompt,
    resultType: CameraResultType.Uri,
    quality: 90,
    allowEditing: false,
    correctOrientation: true,
    saveToGallery: false,
    promptLabelHeader: "Profile Photo",
    promptLabelPhoto: "Choose from Gallery",
    promptLabelPicture: "Take Photo",
    promptLabelCancel: "Cancel",
  });

  if (!photo?.webPath) return null;

  const response = await fetch(photo.webPath);
  const blob = await response.blob();
  const file = new File([blob], `profile_${Date.now()}.${photo.format || "jpg"}`, {
    type: blob.type || "image/jpeg",
  });

  return fileToDataUrl(file);
};

