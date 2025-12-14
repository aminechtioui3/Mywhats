// src/utils/uploadProfileImage.ts
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../api/firebase';
import type { PickedImage } from './ImagePicker'; 

export async function uploadProfileImage(
  userId: string,
  image: PickedImage
): Promise<string> {
  if (!image || !image.uri) {
    throw new Error('No image to upload');
  }

  const response = await fetch(image.uri);
  const blob = await response.blob();

  const ext =
    image.fileName?.split('.').pop() ||
    (image.mimeType?.split('/').pop() ?? 'jpg');
  const path = `profileImages/${userId}.${ext}`;

  const storageRef = ref(storage, path);

  await uploadBytes(storageRef, blob, {
    contentType: image.mimeType ?? 'image/jpeg',
  });

  const downloadURL = await getDownloadURL(storageRef);
  return downloadURL;
}
