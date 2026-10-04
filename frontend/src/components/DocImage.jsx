import { useEffect, useState } from "react";
import { apiBlob } from "../api";

// Documents are private, so they are fetched with the login token and shown from a temporary blob URL.
export default function DocImage({ id }) {
  const [url, setUrl] = useState("");
  const [pdf, setPdf] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let created = "";
    apiBlob(`/kyc/documents/${id}/file`)
      .then((blob) => {
        created = URL.createObjectURL(blob);
        setPdf(blob.type === "application/pdf");
        setUrl(created);
      })
      .catch(() => setFailed(true));
    return () => created && URL.revokeObjectURL(created);
  }, [id]);

  if (failed) return <p className="error small">File could not be loaded.</p>;
  if (!url) return <p className="muted small">Loading file...</p>;
  return (
    <div className="doc-view">
      {pdf ? <a href={url} target="_blank" rel="noreferrer">Open PDF</a> : <img src={url} alt="Uploaded document" />}
    </div>
  );
}
