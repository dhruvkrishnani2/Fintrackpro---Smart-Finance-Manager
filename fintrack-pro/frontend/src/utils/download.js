import client from "../api/client.js";

/**
 * Hits an export endpoint that returns a binary file (xlsx/pdf), then
 * triggers a browser download using the filename the server suggests via
 * Content-Disposition (falling back to `fallbackName`).
 */
export async function downloadFile(url, fallbackName, params = {}) {
  const response = await client.get(url, {
    params,
    responseType: "blob",
  });

  const disposition = response.headers["content-disposition"] || "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match ? match[1] : fallbackName;

  const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
}
