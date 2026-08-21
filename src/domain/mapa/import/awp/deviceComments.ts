import type { AwpDocument } from "./types";

const DEVICE_COMMENT_KEY = /^C(\d+)$/i;

/**
 * Índice do registro → comentário do equipamento (`C13=Sem sinal`).
 */
export function readDeviceComments(document: AwpDocument): Map<number, string> {
  const comments = new Map<number, string>();

  for (const entry of document.metadata) {
    const match = DEVICE_COMMENT_KEY.exec(entry.key.trim());
    if (!match) continue;
    const index = Number(match[1]);
    const text = entry.value.trim();
    if (!Number.isFinite(index) || !text) continue;
    comments.set(index, text);
  }

  return comments;
}
