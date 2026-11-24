/** Keep the request below both the Server Action and hosting payload limits. */
export async function prepareAvatar(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare the photo. Please try another browser.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      result => result ? resolve(result) : reject(new Error("Could not read this photo. Please select another image.")),
      "image/webp", 0.85,
    ));
    if (blob.size > 750_000) throw new Error("Please choose a smaller photo.");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}
