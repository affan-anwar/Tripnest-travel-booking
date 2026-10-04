import { useEffect, useState } from "react";
import { resolveImage } from "../images";

const trusted = (src) => /^https:\/\/images\.unsplash\.com\//.test(src || "");

// Tries the given photo first (if it is a trusted source), then a Wikipedia/Wikimedia photo found from the
// name in `alt`, then the original address. If every photo fails it shows the name on a plain block.
export default function SafeImg({ src, alt, className = "" }) {
  const [list, setList] = useState([]);
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let live = true;
    const direct = trusted(src) ? [src] : [];
    setList(direct);
    setIndex(0);
    setDone(false);
    resolveImage(alt).then((found) => {
      if (!live) return;
      const extra = [];
      if (found) extra.push(found);
      if (src && !direct.length) extra.push(src);
      setList([...direct, ...extra]);
      setDone(true);
    });
    return () => { live = false; };
  }, [src, alt]);

  const current = list[index];
  if (!current) {
    return (
      <div className={`img-fallback ${className}`} role="img" aria-label={alt}>
        {done ? alt : ""}
      </div>
    );
  }
  return (
    <img
      className={className}
      src={current}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setIndex((i) => i + 1)}
    />
  );
}
