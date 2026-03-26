type SaveFileFilter = {
  name: string;
  extensions: string[];
};

type SaveFileOptions = {
  defaultPath: string;
  filters: SaveFileFilter[];
  mimeType: string;
  content: string | ArrayBuffer | Uint8Array;
};

const encodeContentToUint8Array = (content: SaveFileOptions["content"]) => {
  if (typeof content === "string") {
    return new TextEncoder().encode(content);
  }

  if (content instanceof Uint8Array) {
    return Uint8Array.from(content);
  }

  return Uint8Array.from(new Uint8Array(content));
};

const encodeContentToBase64 = (content: SaveFileOptions["content"]) => {
  const uint8Array = encodeContentToUint8Array(content);
  let binary = "";

  uint8Array.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary);
};

const saveFileWithBrowserDownload = ({
  content,
  defaultPath,
  mimeType,
}: SaveFileOptions) => {
  const blob = new Blob([encodeContentToUint8Array(content)], { type: mimeType });
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = defaultPath;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(downloadUrl);
};

export const saveFileWithDesktopFallback = async (options: SaveFileOptions) => {
  if (window.salaryTaxDesktop?.saveFile) {
    const result = await window.salaryTaxDesktop.saveFile({
      defaultPath: options.defaultPath,
      filters: options.filters,
      base64Content: encodeContentToBase64(options.content),
    });

    if (!result.canceled) {
      return result;
    }
  }

  saveFileWithBrowserDownload(options);
  return { canceled: false } as const;
};
