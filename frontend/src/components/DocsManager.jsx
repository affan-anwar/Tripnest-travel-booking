import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";

function SelfieCapture({ onFile }) {
  const video = useRef(null);
  const stream = useRef(null);
  const [on, setOn] = useState(false);
  const [err, setErr] = useState("");

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setOn(false);
  }, []);
  useEffect(() => stop, [stop]);

  const start = async () => {
    setErr("");
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      setOn(true);
    } catch {
      setErr("Camera not available. Upload a photo instead.");
    }
  };
  useEffect(() => {
    if (on && video.current) {
      video.current.srcObject = stream.current;
      video.current.play();
    }
  }, [on]);

  const capture = () => {
    const v = video.current;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d").drawImage(v, 0, 0);
    canvas.toBlob((blob) => {
      onFile(new File([blob], "selfie.jpg", { type: "image/jpeg" }));
      stop();
    }, "image/jpeg", 0.9);
  };

  return (
    <div>
      {on ? (
        <>
          <video ref={video} className="selfie-video" muted playsInline />
          <button type="button" className="btn btn-accent btn-sm" onClick={capture}>Take photo</button>{" "}
          <button type="button" className="btn btn-secondary btn-sm" onClick={stop}>Cancel</button>
        </>
      ) : (
        <button type="button" className="btn btn-secondary btn-sm" onClick={start}>Open camera</button>
      )}
      {err && <p className="error small">{err}</p>}
    </div>
  );
}

function DocCard({ item, doc, onSaved }) {
  const [number, setNumber] = useState("");
  const [file, setFile] = useState(null);
  const [fileKey, setFileKey] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const selfie = item.type === "selfie";

  const submit = async (e) => {
    e.preventDefault();
    if (!file) return setError("Choose a file first");
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("doc_type", item.type);
      form.append("number", number);
      form.append("file", file);
      await api("/kyc/documents", { method: "POST", body: form });
      setFile(null);
      setNumber("");
      setFileKey((k) => k + 1);
      onSaved();
    } catch (err2) {
      setError(err2.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="doc-card">
      <h3>{item.label}</h3>
      {doc && (
        <p className="small">
          Uploaded{doc.number_last4 ? ` (ending ${doc.number_last4})` : ""} <span className={`badge ${doc.status}`}>{doc.status}</span>
          {doc.note && <span className="muted"> - {doc.note}</span>}
        </p>
      )}
      <form onSubmit={submit}>
        {!selfie && (
          <label>
            Number
            <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder={item.hint} required />
          </label>
        )}
        {selfie && <SelfieCapture onFile={setFile} />}
        <label>
          {selfie ? "Or upload a photo" : "Photo or PDF (max 5 MB)"}
          <input
            key={fileKey}
            type="file"
            accept={selfie ? "image/*" : "image/*,application/pdf"}
            onChange={(e) => setFile(e.target.files[0] || null)}
          />
        </label>
        {file && <p className="muted small">Selected: {file.name}</p>}
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary full" disabled={busy}>{busy ? "Uploading..." : doc ? "Replace" : "Upload"}</button>
      </form>
    </div>
  );
}

// groups: [{ title, note, items: [{ type, label, hint }] }]
export default function DocsManager({ groups }) {
  const [docs, setDocs] = useState([]);
  const load = useCallback(() => api("/kyc/documents").then(setDocs).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  const byType = Object.fromEntries(docs.map((d) => [d.doc_type, d]));

  return (
    <div>
      <div className="info">
        Only the last 4 digits of each number are stored. Files are private to you and the verification team.
        While testing, use sample images, not real documents.
      </div>
      {groups.map((g) => (
        <section key={g.title}>
          <h3>{g.title}</h3>
          <p className="muted small">{g.note}</p>
          <div className="kyc-grid">
            {g.items.map((item) => <DocCard key={item.type} item={item} doc={byType[item.type]} onSaved={load} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

export const CUSTOMER_GROUPS = [
  { title: "Identity for trips within India", note: "Upload any one of these.", items: [
    { type: "aadhaar", label: "Aadhaar card", hint: "12-digit Aadhaar number" },
    { type: "pan", label: "PAN card", hint: "ABCDE1234F" },
    { type: "driving_licence", label: "Driving licence", hint: "MH1220110012345" },
  ] },
  { title: "International trips", note: "Passport is required. Add a visa if your destination needs one.", items: [
    { type: "passport", label: "Passport", hint: "Passport number" },
    { type: "visa", label: "Visa", hint: "Visa number" },
  ] },
  { title: "Selfie check", note: "A reviewer compares your photo with your ID.", items: [
    { type: "selfie", label: "Your selfie", hint: "" },
  ] },
];

export const DRIVER_GROUPS = [
  { title: "Driver and vehicle documents", note: "All five are needed before you can go online.", items: [
    { type: "aadhaar", label: "Aadhaar card", hint: "12-digit Aadhaar number" },
    { type: "pan", label: "PAN card", hint: "ABCDE1234F" },
    { type: "driving_licence", label: "Driving licence", hint: "MH1220110012345" },
    { type: "vehicle_rc", label: "Vehicle registration (RC)", hint: "KA01AB1234" },
    { type: "selfie", label: "Your selfie", hint: "" },
  ] },
];
