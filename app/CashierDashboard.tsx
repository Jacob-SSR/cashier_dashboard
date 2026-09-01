"use client";

// app/CashierDashboard.tsx
// หน้าจอหลัก "ห้องเก็บเงินแดง" — ยกหน้าตาจากต้นแบบ cashier_dashboard.html มาเป็น React
// ข้อมูลจริงมาจาก /api/cashier (HOSxP) และรีเฟรชอัตโนมัติ
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deptStyle } from "./dept";
import type { CashierData, CashierRow, CashierStatus } from "@/lib/cashier.types";

const STATUS_CLASS: Record<CashierStatus, string> = {
  รอชำระ: "status-wait",
  กำลังชำระ: "status-serve",
  ชำระแล้ว: "status-done",
};

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
const THAI_DAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

const pad = (n: number) => String(n).padStart(2, "0");
const hhmmss = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

// ฟอร์แมตเวลา "อัปเดตล่าสุด" — ตรึง timezone ไว้ ค่าที่ render ฝั่ง server กับ client
// จะได้ตรงกันเสมอ (ไม่เกิด hydration mismatch เวลา container รันเป็น UTC)
const UPDATED_FMT = new Intl.DateTimeFormat("th-TH", {
  timeZone: "Asia/Bangkok",
  hour12: false,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

type SortKey =
  | "time" | "vn" | "hn" | "name" | "dept" | "amount" | "status" | "route";

interface Props {
  initialData: CashierData;
  hospitalName: string;
  callDisplayUrl: string;
  /** ระยะรีเฟรชอัตโนมัติ (วินาที) */
  refreshSeconds: number;
}

export default function CashierDashboard({
  initialData,
  hospitalName,
  callDisplayUrl,
  refreshSeconds,
}: Props) {
  const [data, setData] = useState<CashierData>(initialData);
  const [loadError, setLoadError] = useState<string | null>(null);
  const lastUpdate = UPDATED_FMT.format(new Date(data.updatedAt));

  const [query, setQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | CashierStatus>("all");
  const [sortKey, setSortKey] = useState<SortKey>("time");
  const [sortAsc, setSortAsc] = useState(true);

  // สถานะ "กำลังชำระ" ที่พนักงานกดเองบนหน้าจอ (ไม่เขียนกลับ HOSxP)
  // เก็บเป็น local override ต่อ VN — หายเมื่อ HOSxP บอกว่าชำระแล้ว
  const [serving, setServing] = useState<Set<string>>(new Set());

  const [clock, setClock] = useState("00:00:00");
  const [clockDate, setClockDate] = useState("");
  const [callingId, setCallingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const callWin = useRef<Window | null>(null);
  const callTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── นาฬิกา ────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(hhmmss(now));
      setClockDate(
        `วัน${THAI_DAYS[now.getDay()]}ที่ ${now.getDate()} ${THAI_MONTHS[now.getMonth()]} พ.ศ. ${now.getFullYear() + 543}`,
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ── ดึงข้อมูล ─────────────────────────────────────────────
  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/cashier", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: CashierData = await res.json();
      setData(json);
      setLoadError(null);
      // คนที่ HOSxP บันทึกว่าชำระแล้ว ไม่ต้องเก็บ override ไว้อีก
      const paid = new Set(
        json.rows.filter((r) => r.status === "ชำระแล้ว").map((r) => r.id),
      );
      setServing((prev) => {
        if (prev.size === 0) return prev;
        const next = new Set([...prev].filter((id) => !paid.has(id)));
        return next.size === prev.size ? prev : next;
      });
    } catch {
      // ดึงไม่ได้ = แสดงข้อมูลชุดเดิมต่อ ดีกว่าจอว่าง แล้วขึ้นแถบเตือน
      setLoadError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — กำลังแสดงข้อมูลล่าสุดที่ดึงมาได้");
    }
  }, []);

  useEffect(() => {
    const id = setInterval(refresh, Math.max(5, refreshSeconds) * 1000);
    return () => clearInterval(id);
  }, [refresh, refreshSeconds]);

  // ── รวม override เข้ากับข้อมูลจริง ────────────────────────
  const rows: CashierRow[] = useMemo(
    () =>
      data.rows.map((r) =>
        serving.has(r.id) && r.status === "รอชำระ"
          ? { ...r, status: "กำลังชำระ" as CashierStatus }
          : r,
      ),
    [data.rows, serving],
  );

  const summary = useMemo(() => {
    const wait = rows.filter((r) => r.status === "รอชำระ").length;
    const servingCount = rows.filter((r) => r.status === "กำลังชำระ").length;
    const done = rows.filter((r) => r.status === "ชำระแล้ว").length;
    return { wait, serving: servingCount, done, total: rows.length };
  }, [rows]);

  const depts = useMemo(() => {
    const seen = new Map<string, number>();
    for (const r of rows) seen.set(r.dept, (seen.get(r.dept) ?? 0) + 1);
    return [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([d]) => d);
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (deptFilter !== "all" && r.dept !== deptFilter) return false;
        if (statusFilter !== "all" && r.status !== statusFilter) return false;
        if (!q) return true;
        return (
          r.name.toLowerCase().includes(q) ||
          r.hn.toLowerCase().includes(q) ||
          r.vn.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        if (typeof av === "number" && typeof bv === "number")
          return sortAsc ? av - bv : bv - av;
        return sortAsc
          ? String(av).localeCompare(String(bv), "th")
          : String(bv).localeCompare(String(av), "th");
      });
  }, [rows, query, deptFilter, statusFilter, sortKey, sortAsc]);

  function sortBy(key: SortKey) {
    if (key === sortKey) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  // ── เรียกชื่อ: เปิดจอแสดงผล + อ่านออกเสียง ───────────────
  function openCallDisplay(p: CashierRow) {
    const params = new URLSearchParams({
      name: p.name,
      hn: p.hn,
      vn: p.vn,
      dept: p.dept,
      hosp: hospitalName,
    });
    const url = `${callDisplayUrl}?${params.toString()}`;
    const features =
      "width=1280,height=720,menubar=no,toolbar=no,location=no,status=no";

    if (!callWin.current || callWin.current.closed) {
      callWin.current = window.open(url, "callDisplay", features);
    } else {
      try {
        callWin.current.location.href = url;
      } catch {
        callWin.current = window.open(url, "callDisplay", features);
      }
    }
  }

  const resetCall = useCallback((id: string) => {
    setCallingId((cur) => (cur === id ? null : cur));
    setToast(null);
  }, []);

  function callName(id: string) {
    const p = rows.find((r) => r.id === id);
    if (!p) return;

    window.speechSynthesis?.cancel();
    if (callTimer.current) clearTimeout(callTimer.current);

    setCallingId(id);
    setToast(`เชิญ ${p.name} ชำระเงินที่ห้องเก็บเงินแดง`);

    openCallDisplay(p);

    const announcement =
      `เชิญ ${p.name} ชำระเงินที่ห้องเก็บเงินแดง . . ` +
      `เชิญ ${p.name} ชำระเงินที่ห้องเก็บเงินแดง . . เชิญ ${p.name} ค่ะ`;

    if ("speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance(announcement);
      u.lang = "th-TH";
      u.rate = 0.88;
      u.pitch = 1.05;
      u.volume = 1;
      const thai = window.speechSynthesis
        .getVoices()
        .find((v) => v.lang === "th-TH" || v.lang === "th");
      if (thai) u.voice = thai;
      u.onend = () => resetCall(id);
      u.onerror = () => resetCall(id);
      window.speechSynthesis.speak(u);
    }

    // กันค้าง: ถ้าเสียงไม่เล่น/ไม่จบ ให้คืนปุ่มเองใน 16 วิ
    callTimer.current = setTimeout(() => resetCall(id), 16000);
  }

  // เบราว์เซอร์โหลดรายชื่อเสียงหลัง interaction แรก — แตะครั้งเดียวพอ
  useEffect(() => {
    const warm = () => window.speechSynthesis?.getVoices();
    document.addEventListener("click", warm, { once: true });
    return () => document.removeEventListener("click", warm);
  }, []);

  useEffect(() => {
    return () => {
      if (callTimer.current) clearTimeout(callTimer.current);
    };
  }, []);

  function markServing(id: string) {
    setServing((prev) => new Set(prev).add(id));
  }

  function toggleTheme() {
    const root = document.documentElement;
    if (root.dataset.theme === "dark") root.dataset.theme = "light";
    else if (root.dataset.theme === "light") delete root.dataset.theme;
    else root.dataset.theme = "dark";
  }

  return (
    <>
      <div className={`call-toast${toast ? " visible" : ""}`}>
        <span className="call-toast-icon">📢</span>
        <span>{toast ?? "เชิญผู้ป่วย…"}</span>
      </div>

      <header className="header">
        <div className="header-brand">
          <div className="brand-icon">🏦</div>
          <div className="brand-text">
            <h1>ห้องเก็บเงินแดง</h1>
            <p>{hospitalName} · ระบบจัดการคิวชำระเงิน</p>
          </div>
        </div>

        <div className="header-clock">
          <div id="clock">{clock}</div>
          <div id="clockDate">{clockDate}</div>
        </div>

        <div className="header-actions">
          <a
            className="theme-btn"
            href="/tv"
            target="tvBoard"
            title="เปิดจอคิวสำหรับทีวี"
            style={{ textDecoration: "none" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="2" y="7" width="20" height="13" rx="2" />
              <polyline points="7 3 12 7 17 3" />
            </svg>
            จอ TV
          </a>
          <a
            className="theme-btn"
            href={callDisplayUrl}
            target="callDisplay"
            title="เปิดหน้าจอเรียกชื่อ"
            style={{ textDecoration: "none" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <polyline points="8 21 12 17 16 21" />
            </svg>
            จอแสดงผล
          </a>
          <button className="refresh-btn" onClick={refresh}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            รีเฟรช
          </button>
          <button className="theme-btn" onClick={toggleTheme} title="สลับธีม">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="5" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          </button>
          <div className="last-update">อัปเดต: {lastUpdate}</div>
        </div>
      </header>

      {(loadError || data.source === "demo") && (
        <div className="banner">
          {loadError ??
            "โหมดสาธิต — ยังไม่ได้ตั้งค่าเชื่อมต่อ HOSxP (ดู .env.example)"}
        </div>
      )}

      <div className="stats-bar">
        <div className="stat-card stat-wait">
          <div className="stat-icon">⏳</div>
          <div className="stat-info">
            <div className="stat-value">{summary.wait}</div>
            <div className="stat-label">รอชำระเงิน</div>
          </div>
        </div>
        <div className="stat-card stat-serve">
          <div className="stat-icon">💳</div>
          <div className="stat-info">
            <div className="stat-value">{summary.serving}</div>
            <div className="stat-label">กำลังชำระ</div>
          </div>
        </div>
        <div className="stat-card stat-done">
          <div className="stat-icon">✅</div>
          <div className="stat-info">
            <div className="stat-value">{summary.done}</div>
            <div className="stat-label">ชำระแล้ว</div>
          </div>
        </div>
        <div className="stat-card stat-total">
          <div className="stat-icon">📋</div>
          <div className="stat-info">
            <div className="stat-value">{summary.total}</div>
            <div className="stat-label">ทั้งหมดวันนี้</div>
          </div>
        </div>
      </div>

      <div className="controls">
        <div className="search-wrap">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            className="search-input"
            type="text"
            placeholder="ค้นหา ชื่อ / HN / VN…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="filter-pills">
          <button
            className={`pill${deptFilter === "all" ? " active" : ""}`}
            onClick={() => setDeptFilter("all")}
          >
            ทั้งหมด
          </button>
          {depts.map((d) => (
            <button
              key={d}
              className={`pill${deptFilter === d ? " active" : ""}`}
              onClick={() => setDeptFilter(d)}
            >
              {deptStyle(d).icon} {d}
            </button>
          ))}
        </div>

        <select
          className="status-select"
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as "all" | CashierStatus)
          }
        >
          <option value="all">สถานะทั้งหมด</option>
          <option value="รอชำระ">รอชำระ</option>
          <option value="กำลังชำระ">กำลังชำระ</option>
          <option value="ชำระแล้ว">ชำระแล้ว</option>
        </select>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th onClick={() => sortBy("time")}>⏰ เวลาส่ง</th>
              <th onClick={() => sortBy("vn")}>VN</th>
              <th onClick={() => sortBy("hn")}>HN</th>
              <th onClick={() => sortBy("name")}>ชื่อ-นามสกุล</th>
              <th onClick={() => sortBy("dept")}>แผนกที่ส่ง</th>
              <th onClick={() => sortBy("amount")} style={{ textAlign: "right" }}>
                ยอดชำระ (฿)
              </th>
              <th onClick={() => sortBy("status")}>สถานะ</th>
              <th onClick={() => sortBy("route")}>ไปต่อ</th>
              <th>เรียกชื่อ</th>
              <th>การดำเนินการ</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={11}>
                  <div className="empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.35-4.35" />
                    </svg>
                    <p>ไม่พบรายการที่ตรงกับเงื่อนไขการค้นหา</p>
                  </div>
                </td>
              </tr>
            ) : (
              visible.map((p, i) => {
                const ds = deptStyle(p.dept);
                const rowCls = [
                  p.status === "กำลังชำระ" ? "serving" : "",
                  p.status === "ชำระแล้ว" ? "done" : "",
                  callingId === p.id ? "calling-row" : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <tr key={p.id} className={rowCls}>
                    <td className="col-num">{i + 1}</td>
                    <td className="col-time">{p.time}</td>
                    <td className="col-vn">{p.vn}</td>
                    <td className="col-hn">{p.hn}</td>
                    <td className="col-name">{p.name}</td>
                    <td>
                      <span className={`dept-badge ${ds.cls}`}>
                        {ds.icon} {p.dept}
                      </span>
                    </td>
                    <td className="col-amount">
                      {p.amount.toLocaleString("th-TH")}
                    </td>
                    <td>
                      <span className={`status-badge ${STATUS_CLASS[p.status]}`}>
                        {p.status === "กำลังชำระ" && <span className="pulse-dot" />}
                        {p.status}
                      </span>
                    </td>
                    <td className="col-route">
                      <span
                        className={`route-badge${p.route === "มียา" ? " route-drug" : ""}`}
                      >
                        {p.route === "มียา" ? "💊 ห้องยา" : "🏠 กลับบ้าน"}
                      </span>
                      {/* ชำระแล้วแต่ยังไม่ได้รับยา = ยังมีขั้นตอนค้างตาม flow */}
                      {p.nextStep === "กลับไปรับยาที่ห้องยา" && (
                        <div className="route-next">ยังไม่รับยา</div>
                      )}
                    </td>
                    <td>
                      <button
                        className={`call-btn${callingId === p.id ? " calling" : ""}`}
                        onClick={() => callName(p.id)}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                        </svg>
                        {callingId === p.id ? "กำลังเรียก…" : "เรียกชื่อ"}
                      </button>
                    </td>
                    <td>
                      {p.status === "รอชำระ" ? (
                        <button
                          className="action-btn"
                          onClick={() => markServing(p.id)}
                        >
                          เริ่มชำระ
                        </button>
                      ) : (
                        <button
                          className="action-btn"
                          style={{ opacity: 0.45, cursor: "default" }}
                          disabled
                        >
                          {p.status}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={11}>
                <div className="table-footer">
                  <span>แสดง {visible.length} รายการ</span>
                  <span>อัปเดตล่าสุด: {lastUpdate}</span>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
