const UPLOAD_MAX_LONG_EDGE = 3200;
const PRINT_MAX_LONG_EDGE = 2600;
const OPTIMIZED_IMAGE_QUALITY = 0.88;
const PNG_SKIP_BYTES = 1_500_000;

export interface PreparedUploadItem {
  file: File;
  width: number;
  height: number;
}

export interface UploadOptimizationProgress {
  totalFiles: number;
  completedFiles: number;
  currentFileName: string;
  optimizedBytes: number;
}

export interface PreparedUploadBatch {
  items: PreparedUploadItem[];
  originalBytes: number;
  optimizedBytes: number;
}

function replaceExtension(filename: string, nextExtension: string) {
  const trimmed = filename.trim();
  const extensionIndex = trimmed.lastIndexOf('.');
  const basename = extensionIndex > 0 ? trimmed.slice(0, extensionIndex) : trimmed || 'upload';
  return `${basename}${nextExtension}`;
}

function readBlobAsDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Unable to read image data."));
    reader.readAsDataURL(blob);
  });
}

function loadImageSource(source: Blob | string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.decoding = "async";
    image.onload = () => {
      resolve(image);
    };
    image.onerror = () => {
      reject(new Error("Unable to decode image."));
    };

    if (typeof source === "string") {
      image.src = source;
      return;
    }

    void readBlobAsDataUrl(source)
      .then((dataUrl) => {
        image.src = dataUrl;
      })
      .catch(reject);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Unable to encode image.'));
          return;
        }

        resolve(blob);
      },
      type,
      quality,
    );
  });
}

async function renderOptimizedBlob(source: Blob | string, maxLongEdge: number, quality = OPTIMIZED_IMAGE_QUALITY) {
  const image = await loadImageSource(source);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const longEdge = Math.max(width, height, 1);
  const scale = Math.min(1, maxLongEdge / longEdge);
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Unable to prepare image canvas.');
  }

  canvas.width = targetWidth;
  canvas.height = targetHeight;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, targetWidth, targetHeight);
  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  return {
    blob: await canvasToBlob(canvas, 'image/jpeg', quality),
    scaledDown: scale < 0.999,
    width,
    height,
  };
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Unable to read encoded image.'));
    reader.readAsDataURL(blob);
  });
}

function shouldKeepOriginalFile(file: File, scaledDown: boolean, optimizedBlob: Blob) {
  if (file.type === 'image/gif') {
    return true;
  }

  if (file.type === 'image/png' && !scaledDown && file.size <= PNG_SKIP_BYTES) {
    return true;
  }

  return !scaledDown && optimizedBlob.size >= file.size * 0.96;
}

async function optimizeImageFile(file: File) {
  if (file.type === 'image/gif') {
    const image = await loadImageSource(file);
    return {
      file,
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
    } satisfies PreparedUploadItem;
  }

  const { blob, scaledDown, width, height } = await renderOptimizedBlob(file, UPLOAD_MAX_LONG_EDGE);
  if (shouldKeepOriginalFile(file, scaledDown, blob)) {
    return {
      file,
      width,
      height,
    } satisfies PreparedUploadItem;
  }

  return {
    file: new File([blob], replaceExtension(file.name, '.jpg'), {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    }),
    width,
    height,
  } satisfies PreparedUploadItem;
}

export async function optimizeUploadFiles(
  files: File[],
  onProgress?: (progress: UploadOptimizationProgress) => void,
): Promise<PreparedUploadBatch> {
  const originalBytes = files.reduce((total, file) => total + file.size, 0);
  const optimizedItems: PreparedUploadItem[] = [];
  let optimizedBytes = 0;

  for (let index = 0; index < files.length; index += 1) {
    const optimizedItem = await optimizeImageFile(files[index]);
    optimizedItems.push(optimizedItem);
    optimizedBytes += optimizedItem.file.size;
    onProgress?.({
      totalFiles: files.length,
      completedFiles: index + 1,
      currentFileName: files[index].name,
      optimizedBytes,
    });
  }

  return {
    items: optimizedItems,
    originalBytes,
    optimizedBytes,
  };
}

export async function readImageIntrinsicSize(source: Blob | string) {
  const image = await loadImageSource(source);
  return {
    width: image.naturalWidth || image.width,
    height: image.naturalHeight || image.height,
  };
}

export async function createPrintDataUrl(assetSrc: string) {
  const response = await fetch(assetSrc);
  if (!response.ok) {
    throw new Error('Unable to read image for print.');
  }

  const sourceBlob = await response.blob();
  const { blob } = await renderOptimizedBlob(sourceBlob, PRINT_MAX_LONG_EDGE);

  return {
    dataUrl: await blobToDataUrl(blob),
    originalBytes: sourceBlob.size,
    optimizedBytes: blob.size,
  };
}

export async function createExportDataUrl(
  assetSrc: string,
  {
    maxLongEdge = PRINT_MAX_LONG_EDGE,
    jpegQuality = OPTIMIZED_IMAGE_QUALITY,
  }: {
    maxLongEdge?: number;
    jpegQuality?: number;
  } = {},
) {
  const response = await fetch(assetSrc);
  if (!response.ok) {
    throw new Error('Unable to read image for export.');
  }

  const sourceBlob = await response.blob();
  const { blob } = await renderOptimizedBlob(sourceBlob, maxLongEdge, jpegQuality);

  return {
    dataUrl: await blobToDataUrl(blob),
    originalBytes: sourceBlob.size,
    optimizedBytes: blob.size,
  };
}
