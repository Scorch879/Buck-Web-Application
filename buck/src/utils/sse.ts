/**
 * Incremental Server-Sent Events reader. Network chunks do not line up with
 * event boundaries, so partial events are buffered until their blank-line
 * terminator arrives. Calls `onData` once per event with its joined `data:`
 * lines (other fields such as `event:` and `id:` are not used by Buck).
 */
export function createSseParser(onData: (data: string) => void) {
  let buffer = "";

  const emit = (rawEvent: string) => {
    const data = rawEvent
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).replace(/^ /, ""))
      .join("\n");
    if (data) onData(data);
  };

  return {
    feed(chunk: string) {
      buffer += chunk;
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? "";
      events.forEach(emit);
    },
    /** Emits a final event that arrived without its trailing blank line. */
    flush() {
      if (buffer.trim()) emit(buffer);
      buffer = "";
    },
  };
}

export function encodeSseEvent(payload: unknown) {
  return `data: ${JSON.stringify(payload)}\n\n`;
}
