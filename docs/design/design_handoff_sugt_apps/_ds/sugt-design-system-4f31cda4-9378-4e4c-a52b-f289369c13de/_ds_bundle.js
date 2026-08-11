/* @ds-bundle: {"format":4,"namespace":"SUGTDesignSystem_4f31cd","components":[{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Input","sourcePath":"components/core/Input.jsx"}],"sourceHashes":{"components/core/Badge.jsx":"5ed57720120d","components/core/Button.jsx":"492fe3bc11e9","components/core/Card.jsx":"f3ac7b16e114","components/core/Input.jsx":"793726962b93","ui_kits/internal/InternalTool.jsx":"953e31314a2c","ui_kits/public/PublicSite.jsx":"562d273be389"},"inlinedExternals":[],"unexposedExports":[{"name":"badgeCss","sourcePath":"components/core/Badge.jsx"},{"name":"buttonCss","sourcePath":"components/core/Button.jsx"},{"name":"cardCss","sourcePath":"components/core/Card.jsx"},{"name":"inputCss","sourcePath":"components/core/Input.jsx"}]} */

(() => {

const __ds_ns = (window.SUGTDesignSystem_4f31cd = window.SUGTDesignSystem_4f31cd || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* SUGT Badge — compact status / count pill (rounded, like everything else).
   Intentional addition. The palette has no green or amber, so the "how it went"
   scale is expressed within the red ramp: on-track reads as calm neutral,
   some-concerns as a soft red tint (chart-1), struggling as full destructive. */

const CSS = `
.sugt-badge{display:inline-flex;align-items:center;gap:var(--space-1);font-family:var(--font-sans);
  font-weight:var(--weight-medium);font-size:var(--text-xs);line-height:1;padding:3px var(--space-2);
  border:var(--border-width) solid transparent;border-radius:var(--radius-md);white-space:nowrap}
.sugt-badge svg{width:12px;height:12px}
.sugt-badge[data-variant="default"]{background:var(--secondary);color:var(--secondary-foreground)}
.sugt-badge[data-variant="primary"]{background:var(--primary);color:var(--primary-foreground)}
.sugt-badge[data-variant="outline"]{border-color:var(--border);color:var(--foreground);background:transparent}
.sugt-badge[data-variant="ontrack"]{background:var(--muted);color:var(--muted-foreground)}
.sugt-badge[data-variant="concern"]{background:color-mix(in oklch,var(--chart-1),transparent 78%);
  color:var(--chart-5);border-color:color-mix(in oklch,var(--chart-1),transparent 55%)}
.sugt-badge[data-variant="struggling"]{background:color-mix(in oklch,var(--destructive),transparent 88%);
  color:var(--destructive);border-color:color-mix(in oklch,var(--destructive),transparent 65%)}
`;
function inject() {
  if (typeof document === "undefined" || document.getElementById("sugt-badge-css")) return;
  const el = document.createElement("style");
  el.id = "sugt-badge-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
function Badge({
  variant = "default",
  className = "",
  children,
  ...props
}) {
  inject();
  return /*#__PURE__*/React.createElement("span", _extends({
    className: `sugt-badge ${className}`.trim(),
    "data-variant": variant
  }, props), children);
}
Object.assign(__ds_scope, { Badge, badgeCss: CSS });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* SUGT Button — faithful port of packages/ui/src/components/button.tsx
   (Base UI + cva, shadcn "base-rhea"). Tailwind is not present where the design
   system renders its specimens, so the exact class metrics are reproduced as a
   single injected stylesheet keyed off data-attributes. Values are copied 1:1:
   h-8/px-3/text-sm/font-medium, focus ring 3px @ ring/30, active translateY(1px),
   corners rounded via the --radius token. */

const CSS = `
.sugt-btn{--_bd:transparent;display:inline-flex;flex-shrink:0;align-items:center;justify-content:center;
  gap:var(--space-1-5);white-space:nowrap;font-family:var(--font-sans);font-weight:var(--weight-medium);
  font-size:var(--text-sm);line-height:1;border:var(--border-width) solid var(--_bd);
  background-clip:padding-box;border-radius:var(--radius-2xl);cursor:pointer;user-select:none;
  transition:background-color .15s ease,color .15s ease,border-color .15s ease,transform .05s ease;
  outline:none;height:var(--control-h);padding-inline:var(--space-3)}
.sugt-btn svg{width:16px;height:16px;flex-shrink:0;pointer-events:none}
.sugt-btn:focus-visible{border-color:var(--ring);box-shadow:0 0 0 var(--ring-width) var(--ring-color)}
.sugt-btn:active:not([data-haspopup]){transform:translateY(1px)}
.sugt-btn[disabled],.sugt-btn[aria-disabled="true"]{pointer-events:none;opacity:.5}

.sugt-btn[data-variant="default"]{background:var(--primary);color:var(--primary-foreground)}
.sugt-btn[data-variant="default"]:hover{background:color-mix(in oklch,var(--primary),transparent 20%)}
.sugt-btn[data-variant="outline"]{--_bd:var(--border);background:var(--background);color:var(--foreground)}
.sugt-btn[data-variant="outline"]:hover{background:var(--muted)}
.sugt-btn[data-variant="secondary"]{background:var(--secondary);color:var(--secondary-foreground)}
.sugt-btn[data-variant="secondary"]:hover{background:color-mix(in oklch,var(--secondary),var(--foreground) 5%)}
.sugt-btn[data-variant="ghost"]{background:transparent;color:var(--foreground)}
.sugt-btn[data-variant="ghost"]:hover{background:var(--muted)}
.sugt-btn[data-variant="destructive"]{background:color-mix(in oklch,var(--destructive),transparent 90%);color:var(--destructive)}
.sugt-btn[data-variant="destructive"]:hover{background:color-mix(in oklch,var(--destructive),transparent 80%)}
.sugt-btn[data-variant="link"]{background:transparent;color:var(--primary);padding-inline:0;height:auto;border:0}
.sugt-btn[data-variant="link"]:hover{text-decoration:underline;text-underline-offset:4px}

.sugt-btn[data-size="xs"]{height:var(--control-h-xs);gap:var(--space-1);padding-inline:var(--space-2-5);font-size:var(--text-xs)}
.sugt-btn[data-size="xs"] svg{width:12px;height:12px}
.sugt-btn[data-size="sm"]{height:var(--control-h-sm);gap:var(--space-1);padding-inline:var(--space-3)}
.sugt-btn[data-size="lg"]{height:var(--control-h-lg);gap:var(--space-1-5);padding-inline:var(--space-4)}
.sugt-btn[data-size="icon"]{width:var(--control-h);padding:0}
.sugt-btn[data-size="icon-xs"]{width:var(--control-h-xs);height:var(--control-h-xs);padding:0}
.sugt-btn[data-size="icon-xs"] svg{width:12px;height:12px}
.sugt-btn[data-size="icon-sm"]{width:var(--control-h-sm);height:var(--control-h-sm);padding:0}
.sugt-btn[data-size="icon-lg"]{width:var(--control-h-lg);height:var(--control-h-lg);padding:0}
`;
function useInjected() {
  if (typeof document === "undefined") return;
  if (document.getElementById("sugt-btn-css")) return;
  const el = document.createElement("style");
  el.id = "sugt-btn-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
function Button({
  variant = "default",
  size = "default",
  className = "",
  children,
  ...props
}) {
  useInjected();
  return /*#__PURE__*/React.createElement("button", _extends({
    "data-slot": "button",
    "data-variant": variant,
    "data-size": size === "default" ? undefined : size,
    className: `sugt-btn ${className}`.trim()
  }, props), children);
}
Object.assign(__ds_scope, { Button, buttonCss: CSS });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* SUGT Card — surface container. Not in the source component set yet (the apps
   are placeholders); added to compose the product surfaces described in
   docs/product.md, styled strictly to the base-rhea vocabulary: bg-card, a 1px
   --border, rounded corners, no shadow. */

const CSS = `
.sugt-card{background:var(--card);color:var(--card-foreground);border:var(--border-width) solid var(--border);
  border-radius:var(--radius-lg);display:flex;flex-direction:column;font-family:var(--font-sans)}
.sugt-card__hd{display:flex;flex-direction:column;gap:var(--space-1);padding:var(--space-4) var(--space-5)}
.sugt-card__hd.has-body{border-bottom:var(--border-width) solid var(--border)}
.sugt-card__title{font-weight:var(--weight-semibold);font-size:var(--text-base);letter-spacing:var(--tracking-tight)}
.sugt-card__desc{font-size:var(--text-sm);color:var(--muted-foreground);line-height:var(--leading-normal)}
.sugt-card__body{padding:var(--space-5);flex:1}
.sugt-card__ft{padding:var(--space-4) var(--space-5);border-top:var(--border-width) solid var(--border);
  display:flex;gap:var(--space-2);align-items:center}
`;
function inject() {
  if (typeof document === "undefined" || document.getElementById("sugt-card-css")) return;
  const el = document.createElement("style");
  el.id = "sugt-card-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
function Card({
  title,
  description,
  footer,
  children,
  className = "",
  ...props
}) {
  inject();
  const hasBody = children != null;
  return /*#__PURE__*/React.createElement("div", _extends({
    className: `sugt-card ${className}`.trim()
  }, props), (title || description) && /*#__PURE__*/React.createElement("div", {
    className: `sugt-card__hd${hasBody ? " has-body" : ""}`
  }, title && /*#__PURE__*/React.createElement("div", {
    className: "sugt-card__title"
  }, title), description && /*#__PURE__*/React.createElement("div", {
    className: "sugt-card__desc"
  }, description)), hasBody && /*#__PURE__*/React.createElement("div", {
    className: "sugt-card__body"
  }, children), footer && /*#__PURE__*/React.createElement("div", {
    className: "sugt-card__ft"
  }, footer));
}
Object.assign(__ds_scope, { Card, cardCss: CSS });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* SUGT Input — text field. Intentional addition, styled to base-rhea:
   1px --input border, rounded corners, h-8, px-3, text-sm, 3px focus ring. */

const CSS = `
.sugt-input{display:flex;width:100%;height:var(--control-h);padding-inline:var(--space-3);
  font-family:var(--font-sans);font-size:var(--text-sm);color:var(--foreground);background:var(--background);
  border:var(--border-width) solid var(--input);border-radius:var(--radius-lg);outline:none;
  transition:border-color .15s ease,box-shadow .15s ease}
.sugt-input::placeholder{color:var(--muted-foreground)}
.sugt-input:focus-visible{border-color:var(--ring);box-shadow:0 0 0 var(--ring-width) var(--ring-color)}
.sugt-input[disabled]{opacity:.5;pointer-events:none}
.sugt-input[aria-invalid="true"]{border-color:var(--destructive);
  box-shadow:0 0 0 var(--ring-width) color-mix(in oklch,var(--destructive),transparent 80%)}
textarea.sugt-input{height:auto;min-height:calc(var(--control-h) * 2.5);padding-block:var(--space-2);
  line-height:var(--leading-normal);resize:vertical}
`;
function inject() {
  if (typeof document === "undefined" || document.getElementById("sugt-input-css")) return;
  const el = document.createElement("style");
  el.id = "sugt-input-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
function Input({
  as = "input",
  className = "",
  ...props
}) {
  inject();
  const Tag = as === "textarea" ? "textarea" : "input";
  return /*#__PURE__*/React.createElement(Tag, _extends({
    className: `sugt-input ${className}`.trim()
  }, props));
}
Object.assign(__ds_scope, { Input, inputCss: CSS });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Input.jsx", error: String((e && e.message) || e) }); }

// ui_kits/internal/InternalTool.jsx
try { (() => {
/* SUGT Internal tool — interactive recreation of the surfaces in docs/product.md:
   Coverage view (landing), Concerns list, and the acquittal (Perjadin Report).
   The repo app is a placeholder, so this is built to spec with the real design
   system. Staff-facing, English domain terms, Indonesian UI copy where natural.
   Exports InternalTool to window. */

const {
  Button,
  Badge,
  Card,
  Input
} = window.SUGTDesignSystem_4f31cd;
const {
  useState,
  useEffect
} = React;
function Icon({
  name,
  size = 18,
  color,
  style
}) {
  return /*#__PURE__*/React.createElement("i", {
    "data-lucide": name,
    style: {
      width: size,
      height: size,
      color,
      ...style
    }
  });
}
const rupiah = n => "Rp " + n.toLocaleString("id-ID");
const CLUSTERS = [{
  name: "Cluster Priangan Timur",
  topic: "Ketahanan Pangan",
  schools: [{
    id: 1,
    name: "SMA Negeri 3 Bandung",
    done: 6
  }, {
    id: 2,
    name: "SMA Negeri 1 Garut",
    done: 3
  }, {
    id: 3,
    name: "SMA Negeri 2 Tasikmalaya",
    done: 1
  }, {
    id: 4,
    name: "SMA Negeri 1 Ciamis",
    done: 0
  }]
}, {
  name: "Cluster Pantura",
  topic: "Energi Terbarukan",
  schools: [{
    id: 5,
    name: "SMA Negeri 1 Cirebon",
    done: 8
  }, {
    id: 6,
    name: "SMA Negeri 2 Indramayu",
    done: 4
  }, {
    id: 7,
    name: "SMA Negeri 1 Subang",
    done: 2
  }]
}];
const CONCERNS = [{
  school: "SMA Negeri 2 Tasikmalaya",
  stream: "Research",
  klass: "Student Class",
  level: "struggling",
  note: "Kelas belum punya akses internet stabil untuk sesi daring.",
  when: "2 hari lalu"
}, {
  school: "SMA Negeri 1 Garut",
  stream: "STEM",
  klass: "GTK Class",
  level: "concern",
  note: "Guru meminta materi tambahan sebelum sesi berikutnya.",
  when: "5 hari lalu"
}, {
  school: "SMA Negeri 1 Subang",
  stream: "Research",
  klass: "MS Class",
  level: "concern",
  note: "Jadwal bentrok dengan agenda sekolah; perlu penyesuaian.",
  when: "1 minggu lalu"
}];
const TX = [{
  id: 1,
  cat: "Transportasi",
  desc: "Sewa kendaraan Bandung–Garut",
  amt: 1250000,
  ev: true
}, {
  id: 2,
  cat: "Penginapan",
  desc: "2 malam, 4 orang",
  amt: 2400000,
  ev: true
}, {
  id: 3,
  cat: "Konsumsi",
  desc: "Makan selama perjalanan dinas",
  amt: 860000,
  ev: true
}, {
  id: 4,
  cat: "Bahan",
  desc: "Perlengkapan sesi luring",
  amt: 430000,
  ev: false
}];
function Sidebar({
  view,
  setView
}) {
  const nav = [{
    id: "coverage",
    label: "Coverage",
    icon: "layout-grid"
  }, {
    id: "concerns",
    label: "Concerns",
    icon: "triangle-alert"
  }, {
    id: "acquittal",
    label: "Perjadin Report",
    icon: "receipt-text"
  }];
  return /*#__PURE__*/React.createElement("aside", {
    style: {
      width: 240,
      borderRight: "1px solid var(--sidebar-border)",
      background: "var(--sidebar)",
      display: "flex",
      flexDirection: "column",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 64,
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "0 20px",
      borderBottom: "1px solid var(--sidebar-border)"
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-sekolah-garuda.png",
    alt: "Sekolah Garuda",
    style: {
      height: 24,
      width: "auto"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10.5,
      color: "var(--muted-foreground)",
      fontWeight: 500
    }
  }, "Internal")), /*#__PURE__*/React.createElement("nav", {
    style: {
      padding: 12,
      display: "flex",
      flexDirection: "column",
      gap: 2
    }
  }, nav.map(n => {
    const active = view === n.id;
    return /*#__PURE__*/React.createElement("button", {
      key: n.id,
      onClick: () => setView(n.id),
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 12px",
        fontSize: 14,
        fontWeight: 500,
        fontFamily: "var(--font-sans)",
        cursor: "pointer",
        border: "none",
        textAlign: "left",
        borderRadius: "var(--radius-md)",
        background: active ? "var(--primary)" : "transparent",
        color: active ? "var(--primary-foreground)" : "var(--sidebar-foreground)"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: n.icon,
      size: 16,
      color: active ? "var(--primary-foreground)" : "var(--muted-foreground)"
    }), n.label);
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: "auto",
      padding: 16,
      borderTop: "1px solid var(--sidebar-border)",
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 32,
      height: 32,
      background: "var(--secondary)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 13,
      fontWeight: 600,
      borderRadius: "var(--radius-sm)"
    }
  }, "RN"), /*#__PURE__*/React.createElement("div", {
    style: {
      lineHeight: 1.3
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 500
    }
  }, "Rani N."), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "var(--muted-foreground)"
    }
  }, "Staff \xB7 DITSAMA"))));
}
function Topbar({
  title,
  sub,
  actions
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      borderBottom: "1px solid var(--border)",
      padding: "20px 28px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 22,
      fontWeight: 700,
      letterSpacing: "-0.02em",
      margin: 0
    }
  }, title), sub && /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      color: "var(--muted-foreground)",
      margin: "4px 0 0"
    }
  }, sub)), actions);
}
function SchoolRow({
  s,
  selected,
  onToggle
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: () => onToggle(s.id),
    style: {
      display: "flex",
      alignItems: "center",
      gap: 14,
      width: "100%",
      textAlign: "left",
      padding: "12px 16px",
      border: "1px solid var(--border)",
      borderTop: "none",
      cursor: "pointer",
      fontFamily: "var(--font-sans)",
      background: selected ? "color-mix(in oklch,var(--primary),transparent 92%)" : "var(--card)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 16,
      height: 16,
      border: "1px solid " + (selected ? "var(--primary)" : "var(--border)"),
      background: selected ? "var(--primary)" : "transparent",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      borderRadius: "var(--radius-sm)"
    }
  }, selected && /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 12,
    color: "var(--primary-foreground)"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      fontSize: 14,
      fontWeight: 500
    }
  }, s.name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: "var(--muted-foreground)",
      fontVariantNumeric: "tabular-nums"
    }
  }, s.done, " / 10"), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 84,
      height: 6,
      background: "var(--muted)",
      position: "relative",
      flexShrink: 0,
      borderRadius: 999,
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      inset: 0,
      width: s.done / 10 * 100 + "%",
      background: "var(--primary)",
      borderRadius: 999
    }
  })));
}
function Coverage() {
  const [sel, setSel] = useState([]);
  const toggle = id => setSel(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const [planning, setPlanning] = useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      height: "100%"
    }
  }, /*#__PURE__*/React.createElement(Topbar, {
    title: "Coverage",
    sub: "Setiap Sekolah dengan jumlah Sesi terlaksana, dikelompokkan per Cluster."
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: "auto",
      padding: 28
    }
  }, CLUSTERS.map(c => /*#__PURE__*/React.createElement("div", {
    key: c.name,
    style: {
      marginBottom: 28
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: 10,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 16,
      fontWeight: 600,
      margin: 0
    }
  }, c.name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12.5,
      color: "var(--muted-foreground)"
    }
  }, "Topik: ", c.topic)), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: "1px solid var(--border)"
    }
  }, c.schools.map(s => /*#__PURE__*/React.createElement(SchoolRow, {
    key: s.id,
    s: s,
    selected: sel.includes(s.id),
    onToggle: toggle
  })))))), sel.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: "1px solid var(--border)",
      background: "var(--card)",
      padding: "14px 28px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      boxShadow: "var(--shadow-lg)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14
    }
  }, /*#__PURE__*/React.createElement("b", null, sel.length), " Sekolah dipilih"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    onClick: () => setSel([])
  }, "Batal"), /*#__PURE__*/React.createElement(Button, {
    onClick: () => setPlanning(true)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 16,
    color: "var(--primary-foreground)"
  }), " Buat Perjadin"))), planning && /*#__PURE__*/React.createElement(PerjadinForm, {
    count: sel.length,
    onClose: () => {
      setPlanning(false);
      setSel([]);
    }
  }));
}
function PerjadinForm({
  count,
  onClose
}) {
  const fld = {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    marginBottom: 16
  };
  const lbl = {
    fontSize: 13,
    fontWeight: 500
  };
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: "absolute",
      inset: 0,
      background: "color-mix(in oklch,var(--foreground),transparent 55%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 30
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      width: 460,
      background: "var(--card)",
      border: "1px solid var(--border)",
      boxShadow: "var(--shadow-lg)",
      borderRadius: "var(--radius-lg)",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "18px 22px",
      borderBottom: "1px solid var(--border)",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 600
    }
  }, "Buat Perjadin"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: "var(--muted-foreground)",
      marginTop: 2
    }
  }, count, " Sekolah \xB7 membuat ", count, " Sesi")), /*#__PURE__*/React.createElement(Button, {
    size: "icon-sm",
    variant: "ghost",
    onClick: onClose
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "x",
    size: 16
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 22
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...fld,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: lbl
  }, "Tanggal berangkat"), /*#__PURE__*/React.createElement(Input, {
    type: "date",
    defaultValue: "2026-08-18"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      ...fld,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: lbl
  }, "Tanggal kembali"), /*#__PURE__*/React.createElement(Input, {
    type: "date",
    defaultValue: "2026-08-20"
  }))), /*#__PURE__*/React.createElement("div", {
    style: fld
  }, /*#__PURE__*/React.createElement("label", {
    style: lbl
  }, "PIC (Staff)"), /*#__PURE__*/React.createElement(Input, {
    defaultValue: "Rani N."
  })), /*#__PURE__*/React.createElement("div", {
    style: fld
  }, /*#__PURE__*/React.createElement("label", {
    style: lbl
  }, "Teaching Team \u2014 STEM"), /*#__PURE__*/React.createElement(Input, {
    placeholder: "Pilih anggota\u2026"
  })), /*#__PURE__*/React.createElement("div", {
    style: fld
  }, /*#__PURE__*/React.createElement("label", {
    style: lbl
  }, "Teaching Team \u2014 Research"), /*#__PURE__*/React.createElement(Input, {
    placeholder: "Pilih anggota\u2026"
  })), /*#__PURE__*/React.createElement("div", {
    style: fld
  }, /*#__PURE__*/React.createElement("label", {
    style: lbl
  }, "Advance"), /*#__PURE__*/React.createElement(Input, {
    defaultValue: "Rp 4.940.000"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "16px 22px",
      borderTop: "1px solid var(--border)",
      display: "flex",
      justifyContent: "flex-end",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    onClick: onClose
  }, "Batal"), /*#__PURE__*/React.createElement(Button, {
    onClick: onClose
  }, "Simpan Perjadin"))));
}
function Concerns() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      height: "100%"
    }
  }, /*#__PURE__*/React.createElement(Topbar, {
    title: "Concerns",
    sub: "Bagian Session Record yang ditandai some concerns atau struggling, terbaru dahulu."
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: "auto",
      padding: 28
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      border: "1px solid var(--border)",
      borderBottom: "none",
      borderRadius: "var(--radius-lg)",
      overflow: "hidden"
    }
  }, CONCERNS.map((c, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: "flex",
      gap: 16,
      padding: "16px 18px",
      borderBottom: "1px solid var(--border)",
      alignItems: "flex-start"
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    variant: c.level === "struggling" ? "struggling" : "concern"
  }, c.level === "struggling" ? "Struggling" : "Some concerns"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600
    }
  }, c.school), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "var(--muted-foreground)",
      margin: "2px 0 8px"
    }
  }, c.stream, " \xB7 ", c.klass), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      lineHeight: 1.5
    }
  }, c.note)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-end",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: "var(--muted-foreground)",
      whiteSpace: "nowrap"
    }
  }, c.when), /*#__PURE__*/React.createElement(Button, {
    size: "xs",
    variant: "ghost"
  }, "Buka Record ", /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-right",
    size: 12
  }))))))));
}
function Acquittal() {
  const [tx, setTx] = useState(TX);
  const total = tx.reduce((s, t) => s + t.amt, 0);
  const advance = 4940000;
  const remaining = advance - total;
  const allEvidenced = tx.every(t => t.ev);
  const cell = {
    padding: "12px 16px",
    fontSize: 13.5,
    borderBottom: "1px solid var(--border)"
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      height: "100%"
    }
  }, /*#__PURE__*/React.createElement(Topbar, {
    title: "Perjadin Report \u2014 Bandung\u2013Garut",
    sub: "PIC: Rani N. \xB7 18\u201320 Agu 2026 \xB7 tenggat dalam 6 hari",
    actions: /*#__PURE__*/React.createElement(Button, {
      disabled: !allEvidenced
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "file-down",
      size: 16,
      color: "var(--primary-foreground)"
    }), " Export acquittal")
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: "auto",
      padding: 28
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3,1fr)",
      gap: 16,
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement(Card, {
    title: "Advance"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 26,
      fontWeight: 800,
      letterSpacing: "-0.02em"
    }
  }, rupiah(advance))), /*#__PURE__*/React.createElement(Card, {
    title: "Terpakai"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 26,
      fontWeight: 800,
      letterSpacing: "-0.02em"
    }
  }, rupiah(total))), /*#__PURE__*/React.createElement(Card, {
    title: "Dikembalikan ke Treasurer"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 26,
      fontWeight: 800,
      letterSpacing: "-0.02em",
      color: remaining < 0 ? "var(--destructive)" : "var(--foreground)"
    }
  }, rupiah(remaining)))), !allEvidenced && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "12px 16px",
      border: "1px solid color-mix(in oklch,var(--destructive),transparent 65%)",
      background: "color-mix(in oklch,var(--destructive),transparent 92%)",
      color: "var(--destructive)",
      fontSize: 13,
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "info",
    size: 16
  }), " Ada transaksi tanpa bukti. Laporan tidak bisa di-export sampai semuanya berbukti \u2014 tenggat boleh lewat, dokumen tidak dibuat dari data yang belum lengkap."), /*#__PURE__*/React.createElement("div", {
    style: {
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-lg)",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "150px 1fr 140px 120px",
      background: "var(--muted)",
      fontSize: 11.5,
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: "0.05em",
      color: "var(--muted-foreground)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "10px 16px"
    }
  }, "Kategori"), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "10px 16px"
    }
  }, "Keterangan"), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "10px 16px",
      textAlign: "right"
    }
  }, "Jumlah"), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "10px 16px"
    }
  }, "Bukti")), tx.map(t => /*#__PURE__*/React.createElement("div", {
    key: t.id,
    style: {
      display: "grid",
      gridTemplateColumns: "150px 1fr 140px 120px",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: cell
  }, t.cat), /*#__PURE__*/React.createElement("div", {
    style: cell
  }, t.desc), /*#__PURE__*/React.createElement("div", {
    style: {
      ...cell,
      textAlign: "right",
      fontVariantNumeric: "tabular-nums",
      fontWeight: 500
    }
  }, rupiah(t.amt)), /*#__PURE__*/React.createElement("div", {
    style: cell
  }, t.ev ? /*#__PURE__*/React.createElement(Badge, {
    variant: "ontrack"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "paperclip",
    size: 12
  }), " Ada") : /*#__PURE__*/React.createElement(Button, {
    size: "xs",
    variant: "destructive",
    onClick: () => setTx(p => p.map(x => x.id === t.id ? {
      ...x,
      ev: true
    } : x))
  }, "Lampirkan")))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 140px 120px",
      background: "var(--secondary)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "12px 16px",
      fontSize: 13,
      fontWeight: 600,
      textAlign: "right"
    }
  }, "Total"), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "12px 16px",
      fontSize: 14,
      fontWeight: 700,
      textAlign: "right",
      fontVariantNumeric: "tabular-nums"
    }
  }, rupiah(total)), /*#__PURE__*/React.createElement("div", null))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 20
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "outline"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 16
  }), " Tambah transaksi"))));
}
function InternalTool() {
  const [view, setView] = useState("coverage");
  useEffect(() => {
    if (window.lucide) window.lucide.createIcons();
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      height: "100vh",
      overflow: "hidden",
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement(Sidebar, {
    view: view,
    setView: setView
  }), /*#__PURE__*/React.createElement("main", {
    style: {
      flex: 1,
      position: "relative",
      overflow: "hidden",
      background: "var(--background)"
    }
  }, view === "coverage" && /*#__PURE__*/React.createElement(Coverage, null), view === "concerns" && /*#__PURE__*/React.createElement(Concerns, null), view === "acquittal" && /*#__PURE__*/React.createElement(Acquittal, null)));
}
window.InternalTool = InternalTool;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/internal/InternalTool.jsx", error: String((e && e.message) || e) }); }

// ui_kits/public/PublicSite.jsx
try { (() => {
/* SUGT Public site — recreation of the launch homepage described in
   docs/product.md ("leads with scope, not delivery"). The app in the repo is a
   placeholder (<Button>Tes</Button>), so this is built to the product spec using
   the real design system: Montserrat, brick-red primary, rounded corners.
   Copy is Indonesian, as the spec requires. Exports PublicSite to window. */

const {
  Button,
  Badge,
  Card
} = window.SUGTDesignSystem_4f31cd;
const MAX = 1120;
const wrap = {
  maxWidth: MAX,
  margin: "0 auto",
  padding: "0 32px"
};
function Icon({
  name,
  size = 18,
  color
}) {
  return /*#__PURE__*/React.createElement("i", {
    "data-lucide": name,
    style: {
      width: size,
      height: size,
      color
    }
  });
}
function Header() {
  const link = {
    fontSize: 14,
    fontWeight: 500,
    color: "var(--foreground)",
    textDecoration: "none",
    cursor: "pointer"
  };
  return /*#__PURE__*/React.createElement("header", {
    style: {
      borderBottom: "1px solid var(--border)",
      position: "sticky",
      top: 0,
      background: "var(--background)",
      zIndex: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...wrap,
      height: 64,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-sekolah-garuda.png",
    alt: "Sekolah Garuda",
    style: {
      height: 30,
      width: "auto"
    }
  })), /*#__PURE__*/React.createElement("nav", {
    style: {
      display: "flex",
      gap: 28,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("a", {
    style: link
  }, "Program"), /*#__PURE__*/React.createElement("a", {
    style: link
  }, "Cluster"), /*#__PURE__*/React.createElement("a", {
    style: link
  }, "Cerita"), /*#__PURE__*/React.createElement("a", {
    style: link
  }, "Tentang"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "outline"
  }, "Portal Internal"))));
}
function Hero() {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      borderBottom: "1px solid var(--border)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...wrap,
      padding: "88px 32px 72px",
      maxWidth: 900
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      alignItems: "center",
      marginBottom: 22
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    variant: "primary"
  }, "STEM & Research Track"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12.5,
      color: "var(--muted-foreground)"
    }
  }, "Program Kementerian Pendidikan Tinggi")), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 52,
      fontWeight: 800,
      lineHeight: 1.05,
      letterSpacing: "-0.025em",
      margin: "0 0 22px",
      maxWidth: 780
    }
  }, "Membangun kapasitas riset di sekolah-sekolah unggul Indonesia."), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 18,
      lineHeight: 1.6,
      color: "var(--muted-foreground)",
      maxWidth: 620,
      margin: "0 0 32px"
    }
  }, "Sekolah Unggul Garuda Transformasi, dijalankan oleh DITSAMA ITB. Pengajaran STEM dan Riset yang dibawa langsung ke sekolah \u2014 luring dan daring \u2014 kepada guru, manajemen, dan siswa."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "lg"
  }, "Lihat Program"), /*#__PURE__*/React.createElement(Button, {
    size: "lg",
    variant: "outline"
  }, "Cerita Lapangan"))));
}
function Stat({
  figure,
  label,
  sub
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "4px 0"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 46,
      fontWeight: 800,
      letterSpacing: "-0.03em",
      lineHeight: 1
    }
  }, figure), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 600,
      marginTop: 10
    }
  }, label), sub && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: "var(--muted-foreground)",
      marginTop: 3
    }
  }, sub));
}
function Scope() {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      borderBottom: "1px solid var(--border)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...wrap,
      padding: "56px 32px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: "var(--muted-foreground)",
      marginBottom: 28
    }
  }, "Cakupan Program"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(4,1fr)",
      gap: 0
    }
  }, /*#__PURE__*/React.createElement(Stat, {
    figure: "42",
    label: "Sekolah peserta",
    sub: "tersebar di 9 provinsi"
  }), /*#__PURE__*/React.createElement(Stat, {
    figure: "2",
    label: "Stream",
    sub: "STEM & Research"
  }), /*#__PURE__*/React.createElement(Stat, {
    figure: "3",
    label: "Kelas / sekolah",
    sub: "GTK \xB7 MS \xB7 Siswa"
  }), /*#__PURE__*/React.createElement(Stat, {
    figure: "10",
    label: "Sesi / sekolah",
    sub: "4 luring \xB7 6 daring"
  }))));
}
function Delivery() {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      background: "var(--secondary)",
      borderBottom: "1px solid var(--border)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...wrap,
      padding: "40px 32px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 56
    }
  }, /*#__PURE__*/React.createElement(Stat, {
    figure: "128",
    label: "Sesi terlaksana"
  }), /*#__PURE__*/React.createElement(Stat, {
    figure: "19",
    label: "Sekolah terjangkau"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      fontSize: 12.5,
      color: "var(--muted-foreground)",
      maxWidth: 300
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "refresh-cw",
    size: 14
  }), "Angka penyampaian diperbarui seiring berjalannya Program.")));
}
function Streams() {
  const streams = [{
    t: "STEM",
    d: "Sains, teknologi, dan rekayasa — dibawa ke setiap Kelas untuk memperkuat penalaran dan praktik.",
    i: "flask-conical"
  }, {
    t: "Research",
    d: "Metode riset dan penyelidikan — mengangkat satu Problem nyata yang dikerjakan setiap Cluster.",
    i: "microscope"
  }];
  return /*#__PURE__*/React.createElement("section", {
    style: {
      borderBottom: "1px solid var(--border)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...wrap,
      padding: "64px 32px"
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 30,
      fontWeight: 700,
      letterSpacing: "-0.02em",
      margin: "0 0 8px"
    }
  }, "Dua Stream, satu Problem"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 15,
      color: "var(--muted-foreground)",
      margin: "0 0 32px",
      maxWidth: 560
    }
  }, "Setiap Cluster memegang satu Topik dan satu Problem; kedua Stream mengerjakannya dari sudut masing-masing."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 20
    }
  }, streams.map(s => /*#__PURE__*/React.createElement(Card, {
    key: s.t
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 14,
      alignItems: "flex-start"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 44,
      height: 44,
      background: "var(--primary)",
      color: "var(--primary-foreground)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      borderRadius: "var(--radius-md)"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: s.i,
    size: 22,
    color: "var(--primary-foreground)"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 19,
      fontWeight: 700,
      marginBottom: 6
    }
  }, s.t), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      lineHeight: 1.55,
      color: "var(--muted-foreground)"
    }
  }, s.d))))))));
}
function Stories() {
  const items = [{
    s: "SMA Negeri 3 Bandung",
    c: "Cluster Priangan Timur",
    tag: "STEM"
  }, {
    s: "SMA Negeri 1 Garut",
    c: "Cluster Priangan Timur",
    tag: "Research"
  }, {
    s: "SMA Negeri 2 Tasikmalaya",
    c: "Cluster Priangan Timur",
    tag: "STEM"
  }];
  return /*#__PURE__*/React.createElement("section", {
    style: {
      borderBottom: "1px solid var(--border)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...wrap,
      padding: "64px 32px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "space-between",
      marginBottom: 28
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 30,
      fontWeight: 700,
      letterSpacing: "-0.02em",
      margin: "0 0 8px"
    }
  }, "Cerita dari lapangan"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 15,
      color: "var(--muted-foreground)",
      margin: 0
    }
  }, "Ditulis dan dipilih oleh tim, bukan dipanen dari catatan.")), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost"
  }, "Semua cerita ", /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-right",
    size: 16
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3,1fr)",
      gap: 20
    }
  }, items.map((it, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-lg)",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      aspectRatio: "4/3",
      background: "repeating-linear-gradient(45deg,var(--muted),var(--muted) 12px,var(--secondary) 12px,var(--secondary) 24px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "var(--muted-foreground)",
      fontSize: 12,
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "image",
    size: 16
  }), " Foto lapangan"), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 16
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    variant: "outline"
  }, it.tag), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 600,
      margin: "10px 0 4px"
    }
  }, it.s), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: "var(--muted-foreground)"
    }
  }, it.c)))))));
}
function Footer() {
  const col = {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    fontSize: 13,
    color: "var(--muted-foreground)"
  };
  return /*#__PURE__*/React.createElement("footer", null, /*#__PURE__*/React.createElement("div", {
    style: {
      ...wrap,
      padding: "48px 32px",
      display: "flex",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: 40
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 300
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-sekolah-garuda.png",
    alt: "Sekolah Garuda",
    style: {
      height: 34,
      width: "auto"
    }
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      color: "var(--muted-foreground)",
      lineHeight: 1.55,
      marginTop: 12
    }
  }, "Sekolah Unggul Garuda Transformasi \u2014 STEM & Research Track, dijalankan oleh DITSAMA ITB.")), /*#__PURE__*/React.createElement("div", {
    style: col
  }, /*#__PURE__*/React.createElement("b", {
    style: {
      color: "var(--foreground)",
      fontWeight: 600
    }
  }, "Program"), /*#__PURE__*/React.createElement("a", null, "Cakupan"), /*#__PURE__*/React.createElement("a", null, "Stream"), /*#__PURE__*/React.createElement("a", null, "Cluster")), /*#__PURE__*/React.createElement("div", {
    style: col
  }, /*#__PURE__*/React.createElement("b", {
    style: {
      color: "var(--foreground)",
      fontWeight: 600
    }
  }, "Cerita"), /*#__PURE__*/React.createElement("a", null, "Lapangan"), /*#__PURE__*/React.createElement("a", null, "Sekolah"), /*#__PURE__*/React.createElement("a", null, "Final Project")), /*#__PURE__*/React.createElement("div", {
    style: col
  }, /*#__PURE__*/React.createElement("b", {
    style: {
      color: "var(--foreground)",
      fontWeight: 600
    }
  }, "Penyelenggara"), /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-dpb-full.jpeg",
    alt: "Direktorat Persiapan Bersama ITB",
    style: {
      height: 34,
      width: "auto",
      marginTop: 4,
      marginBottom: 6
    }
  }), /*#__PURE__*/React.createElement("a", null, "DITSAMA ITB"), /*#__PURE__*/React.createElement("a", null, "Kementerian Pendidikan Tinggi"))), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: "1px solid var(--border)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...wrap,
      padding: "18px 32px",
      fontSize: 12,
      color: "var(--muted-foreground)",
      display: "flex",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("span", null, "\xA9 2026 DITSAMA ITB"), /*#__PURE__*/React.createElement("span", null, "Direktorat Persiapan Bersama ITB"))));
}
function PublicSite() {
  React.useEffect(() => {
    if (window.lucide) window.lucide.createIcons();
  });
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Header, null), /*#__PURE__*/React.createElement(Hero, null), /*#__PURE__*/React.createElement(Scope, null), /*#__PURE__*/React.createElement(Delivery, null), /*#__PURE__*/React.createElement(Streams, null), /*#__PURE__*/React.createElement(Stories, null), /*#__PURE__*/React.createElement(Footer, null));
}
window.PublicSite = PublicSite;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/public/PublicSite.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Input = __ds_scope.Input;

})();
