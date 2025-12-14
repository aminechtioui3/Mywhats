// src/utils/imagePicker.ts
import * as ImagePicker from 'expo-image-picker';

export type PickedImage =
  | { uri: string; width?: number; height?: number; fileName?: string; mimeType?: string }
  | null;

/** Ask for media library permission (request if not granted). Returns true if granted. */
export async function ensureLibraryPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status === 'granted';
}

/** Ask for camera permission (request if not granted). Returns true if granted. */
export async function ensureCameraPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  return status === 'granted';
}

/** Open the photo library and return one picked image (or null if cancelled). */
export async function pickFromLibrary(
  options?: Partial<ImagePicker.ImagePickerOptions>
): Promise<PickedImage> {
  const ok = await ensureLibraryPermission();
  if (!ok) return null;

  const res = await ImagePicker.launchImageLibraryAsync({
    // New API: use 'images' media type instead of deprecated MediaTypeOptions
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 0.9,
    selectionLimit: 1,
    ...options,
  });

  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];

  return {
    uri: a.uri,
    width: a.width,
    height: a.height,
    fileName: (a as any).fileName ?? a.fileName, // handle SDK differences
    mimeType: a.mimeType,
  };
}

/** Open the camera and return one captured image (or null if cancelled). */
export async function pickFromCamera(
  options?: Partial<ImagePicker.ImagePickerOptions>
): Promise<PickedImage> {
  const ok = await ensureCameraPermission();
  if (!ok) return null;

  const res = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    quality: 0.9,
    ...options,
  });

  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];

  return {
    uri: a.uri,
    width: a.width,
    height: a.height,
    fileName: (a as any).fileName ?? a.fileName,
    mimeType: a.mimeType,
  };
}
