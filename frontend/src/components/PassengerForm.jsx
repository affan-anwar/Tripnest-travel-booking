// Collects name, age and gender for each traveller. "Fill from saved" copies a saved passenger.
export default function PassengerForm({ count, value, onChange, saved = [] }) {
  const rows = Array.from({ length: count }, (_, i) => value[i] || { name: "", age: "", gender: "male" });
  const set = (i, patch) => onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  return (
    <div>
      {rows.map((r, i) => (
        <div className="pax-row" key={i}>
          <input placeholder={`Traveller ${i + 1} full name`} value={r.name} onChange={(e) => set(i, { name: e.target.value })} required minLength={2} />
          <input type="number" min="0" max="120" placeholder="Age" value={r.age} onChange={(e) => set(i, { age: e.target.value })} required />
          <select value={r.gender} onChange={(e) => set(i, { gender: e.target.value })}>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
          {saved.length > 0 && (
            <select
              value=""
              onChange={(e) => {
                const s = saved.find((p) => String(p.id) === e.target.value);
                if (s) set(i, { name: s.full_name, age: s.age, gender: s.gender });
              }}
            >
              <option value="">Fill from saved passengers</option>
              {saved.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          )}
        </div>
      ))}
    </div>
  );
}

export const cleanPassengers = (rows) => rows.map((r) => ({ name: r.name.trim(), age: Number(r.age), gender: r.gender }));
