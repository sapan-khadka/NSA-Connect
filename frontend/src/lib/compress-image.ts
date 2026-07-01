const MAX_EDGE_PX = 2040;
const JPEG_QUALITY = 0.85;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/heic", "image/heif"]);

export const PHOTO_UPLOAD_MAX_BYTES = 15 * 1024 * 1024;
export const PHOTO_UPLOAD_MAX_BATCH = 20;

export function isAllowedPhotoFile(file: File): boolean {
  const type = file.type.toLowerCase();
  if (ALLOWED_TYPES.has(type)) {
    return true;
  }
  return file.name.toLowerCase().endsWith(".heic");
}

export function validatePhotoBatch(files: File[]): string | null {
  if (files.length === 0) {
    return "Select at least one image.";
  }
  if (files.length > PHOTO_UPLOAD_MAX_BATCH) {
    return `You can upload up to ${PHOTO_UPLOAD_MAX_BATCH} images at a time.`;
  }

  for (const file of files) {
    if (!isAllowedPhotoFile(file)) {
      return `${file.name} is not a supported image type (JPG, PNG, or HEIC).`;
    }
    if (file.size > PHOTO_UPLOAD_MAX_BYTES) {
      return `${file.name} exceeds the 15 MB limit.`;
    }
  }

  return null;
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Unable to read ${file.name}`));
    };
    image.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Unable to compress image"));
          return;
        }
        resolve(blob);
      },
      type,
      quality,
    );
  });
}

export async function compressImageForUpload(file: File): Promise<File> {
  const isHeic =
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    file.name.toLowerCase().endsWith(".heic");

  if (isHeic) {
    return file;
  }

  const image = await loadImageFromFile(file);
  const scale = Math.min(1, MAX_EDGE_PX / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    return file;
  }

  context.drawImage(image, 0, 0, width, height);

  const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await canvasToBlob(canvas, outputType, JPEG_QUALITY);
  const extension = outputType === "image/png" ? "png" : "jpg";
  const baseName = file.name.replace(/\.[^.]+$/, "");

  return new File([blob], `${baseName}.${extension}`, {
    type: outputType,
    lastModified: Date.now(),
  });
}

export async function preparePhotosForUpload(files: File[]): Promise<File[]> {
  const validationError = validatePhotoBatch(files);
  if (validationError) {
    throw new Error(validationError);
  }

  const prepared: File[] = [];
  for (const file of files) {
    const compressed = await compressImageForUpload(file);
    if (compressed.size > PHOTO_UPLOAD_MAX_BYTES) {
      throw new Error(`${file.name} is still too large after compression.`);
    }
    prepared.push(compressed);
  }
  return prepared;
}
