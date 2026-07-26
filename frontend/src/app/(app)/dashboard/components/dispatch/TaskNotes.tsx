/**
 * Shared notes callout — "a line containing http becomes a link, everything
 * else prints as-is". `ActiveTaskPanel` ("Requirements:") and `TaskListPanel`
 * ("Details:") each carried a near-verbatim copy of this, differing only in
 * the heading text. Hoisted here so the parsing logic has one home.
 */
export function TaskNotes({ notes, heading }: { notes: string; heading: string }) {
  return (
    <div className="cm-notes">
      <strong>{heading}</strong>
      {notes.split("\n").map((line, i) => {
        const url = line.split(" ").find((w) => w.startsWith("http"));
        return (
          <p key={i}>
            {url ? (
              <a href={url} target="_blank" rel="noreferrer">
                View Prescription Document
              </a>
            ) : (
              line
            )}
          </p>
        );
      })}
    </div>
  );
}
