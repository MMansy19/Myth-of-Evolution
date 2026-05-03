import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { LogIn, LogOut, Home, Sparkles, Dna, Leaf, Microscope, Shield, Sun, Moon, Globe, Check, LayoutGrid } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import logo from "@/assets/logo.png";

const NAV = [
  { to: "/", label: "الرئيسية", icon: Home, color: "var(--c-home)" },
  { to: "/critic", label: "ناقد التطور الذكي", icon: Sparkles, color: "var(--c-critic)" },
  { to: "/critique", label: "نقد التطور", icon: Microscope, color: "var(--c-critique)" },
  { to: "/evolution", label: "أساسيات التطور", icon: Leaf, color: "var(--c-evolution)" },
  { to: "/genetics", label: "علم الوراثة", icon: Dna, color: "var(--c-genetics)" },
  { to: "/creation", label: "إبداع الخالق", icon: Sparkles, color: "var(--c-creation)" },
] as const;

export default function Layout() {
  const { user, isStaff, isOwner, signOut } = useAuth();
  const { location } = useRouterState();
  const path = location.pathname;
  // Show categories nav only on home, section pages and posting pages.
  const showNav = path === "/" || ["/critique", "/evolution", "/genetics", "/creation", "/guest-post"].some(p => path === p || path.startsWith(p + "/"));
  // Reading-focused pages should maximize horizontal space
  const isReadingFocus = path.startsWith("/post/") || path === "/critic";

  const [theme, setTheme] = useState<"dark" | "light">(() => (typeof window !== "undefined" && localStorage.getItem("theme") === "light") ? "light" : "dark");
  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Theme toggle — instant flip, with a tasteful emerald glow on the button itself.
  const toggleTheme = (e: React.MouseEvent<HTMLButtonElement>) => {
    const btn = e.currentTarget;
    btn.classList.remove("theme-press-glow");
    // restart the animation
    void btn.offsetWidth;
    btn.classList.add("theme-press-glow");
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <div className="ambient-orbs relative min-h-screen">
      <header className="site-header sticky top-0 z-20">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 group">
            <img src={logo} alt="وهم التطور" className="h-10 w-auto object-contain drop-shadow-[0_0_12px_rgba(250,200,80,0.45)]" />
          </Link>

          <div className="flex items-center gap-2">
            {showNav && <SectionsButton current={path}/>}
            <button onClick={toggleTheme}
              title={theme === "dark" ? "وضع نهاري" : "وضع ليلي"}
              className="liquid-glass inline-flex items-center justify-center h-9 w-9 rounded-full">
              {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </button>
            <TranslateButton />
            {isStaff && (
              <Link to="/admin" title={isOwner ? "لوحة المالك" : "لوحة المشرف"}
                className="liquid-glass inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold">
                <Shield className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{isOwner ? "لوحة المالك" : "لوحة المشرف"}</span>
              </Link>
            )}
            {user ? (
              <button onClick={signOut} className="liquid-glass inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold">
                <LogOut className="h-3.5 w-3.5" /> خروج
              </button>
            ) : (
              <Link to="/auth" className="liquid-glass inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-primary">
                <LogIn className="h-3.5 w-3.5" /> دخول
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className={`relative z-10 mx-auto px-2 sm:px-4 py-4 ${isReadingFocus ? "max-w-5xl" : "max-w-6xl"}`}>
        <Outlet />
      </main>

      <footer className="relative z-10 mx-auto max-w-6xl px-4 py-8 text-center text-xs text-muted-foreground">
        وهم التطور · منصة علمية للنقد المنهجي · {new Date().getFullYear()}
      </footer>
      {/* Hidden anchor required by Google Translate script */}
      <div id="google_translate_element" className="sr-only" aria-hidden="true"/>
    </div>
  );
}

/** Button that opens an inline dropdown panel below the sticky header. */
function SectionsButton({ current }: { current: string }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  return (
    <>
      <button ref={btnRef} onClick={() => setOpen(v => !v)} title="الأقسام" aria-label="الأقسام"
        className={`liquid-glass inline-flex items-center gap-1.5 h-8 sm:h-9 px-2.5 sm:px-3 rounded-full text-xs font-bold transition ${
          open ? "ring-2 ring-primary/40 bg-primary/10" : ""
        }`}>
        <LayoutGrid className="h-3.5 w-3.5"/>
        <span className="hidden sm:inline">الأقسام</span>
      </button>
      {open && (
        <div ref={panelRef} className="fixed inset-x-0 top-14 z-[30] px-3 pt-2 pb-3 animate-pop-in">
          <div className="mx-auto max-w-6xl">
            <div className="glass-strong rounded-2xl p-3 shadow-xl border border-white/10">
              <p className="text-[11px] font-bold text-muted-foreground px-1 pb-2 border-b border-white/10 mb-2 flex items-center gap-1.5">
                <LayoutGrid className="h-3 w-3" /> تصفّح الأقسام
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {NAV.map((item) => {
                  const Icon = item.icon;
                  const active = current === item.to;
                  return (
                    <Link key={item.to} to={item.to} onClick={() => setOpen(false)}
                      style={{ borderColor: active ? item.color : undefined }}
                      className={`flex items-center gap-2 p-3 rounded-2xl text-right transition border border-transparent ${
                        active ? "bg-white/10" : "hover:bg-white/10"
                      }`}>
                      <div className="h-8 w-8 rounded-full grid place-items-center shrink-0"
                        style={{ background: `color-mix(in oklab, ${item.color} 22%, transparent)`, color: item.color }}>
                        <Icon className="h-4 w-4"/>
                      </div>
                      <span className="text-xs font-bold" style={{ color: item.color }}>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Custom Google Translate launcher — neat vertical scrollable language list
const LANGS: { code: string; label: string; native: string }[] = [
  { code: "ar", label: "Arabic", native: "العربية" },
  { code: "en", label: "English", native: "English" },
  { code: "fr", label: "French", native: "Français" },
  { code: "es", label: "Spanish", native: "Español" },
  { code: "de", label: "German", native: "Deutsch" },
  { code: "it", label: "Italian", native: "Italiano" },
  { code: "pt", label: "Portuguese", native: "Português" },
  { code: "ru", label: "Russian", native: "Русский" },
  { code: "tr", label: "Turkish", native: "Türkçe" },
  { code: "fa", label: "Persian", native: "فارسی" },
  { code: "ur", label: "Urdu", native: "اردو" },
  { code: "id", label: "Indonesian", native: "Bahasa Indonesia" },
  { code: "ms", label: "Malay", native: "Bahasa Melayu" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "bn", label: "Bengali", native: "বাংলা" },
  { code: "zh-CN", label: "Chinese (Simplified)", native: "简体中文" },
  { code: "zh-TW", label: "Chinese (Traditional)", native: "繁體中文" },
  { code: "ja", label: "Japanese", native: "日本語" },
  { code: "ko", label: "Korean", native: "한국어" },
  { code: "nl", label: "Dutch", native: "Nederlands" },
  { code: "sv", label: "Swedish", native: "Svenska" },
  { code: "pl", label: "Polish", native: "Polski" },
  { code: "uk", label: "Ukrainian", native: "Українська" },
  { code: "el", label: "Greek", native: "Ελληνικά" },
  { code: "he", label: "Hebrew", native: "עברית" },
  { code: "th", label: "Thai", native: "ไทย" },
  { code: "vi", label: "Vietnamese", native: "Tiếng Việt" },
  { code: "sw", label: "Swahili", native: "Kiswahili" },
];

function getCurrentLang(): string {
  if (typeof document === "undefined") return "ar";
  const m = document.cookie.match(/googtrans=\/[^/]+\/([^;]+)/);
  if (m?.[1]) return m[1];
  try {
    const stored = localStorage.getItem("siteLang");
    if (stored) return stored;
  } catch {}
  return "ar";
}

function setLang(code: string) {
  // Set cookie on the current host AND the parent domain (Google reads either)
  const value = `/ar/${code}`;
  const host = window.location.hostname;
  const parts = host.split(".");
  const root = parts.length > 1 ? "." + parts.slice(-2).join(".") : host;
  // Clear prior cookie first (paths/domains that may linger).
  document.cookie = `googtrans=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT`;
  document.cookie = `googtrans=; path=/; domain=${root}; expires=Thu, 01 Jan 1970 00:00:01 GMT`;
  if (code !== "ar") {
    document.cookie = `googtrans=${value}; path=/`;
    document.cookie = `googtrans=${value}; path=/; domain=${root}`;
  }
  try { localStorage.setItem("siteLang", code); } catch {}
  // Trigger sweep animation then reload so Google Translate applies the new target language
  const sweep = document.createElement("div");
  sweep.className = "lang-sweep";
  document.body.appendChild(sweep);
  setTimeout(() => window.location.reload(), 700);
}

function TranslateButton() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("ar");
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setCurrent(getCurrentLang());
    // Restore last chosen language from localStorage if cookie was wiped
    try {
      const stored = localStorage.getItem("siteLang");
      const cookieMatch = document.cookie.match(/googtrans=\/[^/]+\/([^;]+)/);
      const cookieLang = cookieMatch?.[1];
      if (stored && stored !== "ar" && cookieLang !== stored) {
        const host = window.location.hostname;
        const parts = host.split(".");
        const root = parts.length > 1 ? "." + parts.slice(-2).join(".") : host;
        document.cookie = `googtrans=/ar/${stored}; path=/`;
        document.cookie = `googtrans=/ar/${stored}; path=/; domain=${root}`;
      }
    } catch {}
    // Load Google Translate script once globally so cookie-based translation applies on every page.
    if (!(window as any).__gt_loaded) {
      (window as any).__gt_loaded = true;
      (window as any).googleTranslateElementInit = () => {
        // eslint-disable-next-line no-new
        new (window as any).google.translate.TranslateElement(
          {
            pageLanguage: "ar",
            autoDisplay: false,
            // SIMPLE layout — no top banner / "show original" toolbar
            layout: (window as any).google?.translate?.TranslateElement?.InlineLayout?.SIMPLE ?? 0,
          },
          "google_translate_element",
        );
        // Belt-and-braces: continually strip the banner if Google re-injects it.
        const strip = () => {
          document.querySelectorAll<HTMLElement>(
            ".goog-te-banner-frame, iframe.goog-te-banner-frame, .goog-te-ftab, .goog-te-balloon-frame, #goog-gt-tt, .goog-tooltip"
          ).forEach(el => el.remove());
          // Google sometimes injects a visible <div class="skiptranslate"> wrapper containing the bar
          document.querySelectorAll<HTMLElement>("body > .skiptranslate").forEach(el => {
            // keep our hidden anchor (#google_translate_element) intact
            if (el.id !== "google_translate_element" && !el.contains(document.getElementById("google_translate_element"))) {
              el.style.display = "none";
            }
          });
          document.body.style.top = "0px";
          document.body.style.position = "static";
          document.documentElement.style.top = "0px";
        };
        strip();
        const mo = new MutationObserver(strip);
        mo.observe(document.body, { childList: true, subtree: true });
        // Extra polling for the first few seconds in case mutations fire before observer is ready
        let count = 0;
        const iv = setInterval(() => { strip(); if (++count > 20) clearInterval(iv); }, 250);
      };
      const s = document.createElement("script");
      s.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
      s.async = true;
      document.body.appendChild(s);
    }
  }, []);

  // Close on Escape and outside click
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  return (
    <>
      <button ref={btnRef} onClick={() => setOpen(v => !v)} title="ترجمة الموقع"
        className={`liquid-glass inline-flex items-center justify-center h-8 sm:h-9 w-8 sm:w-9 rounded-full transition ${
          open ? "ring-2 ring-primary/40 bg-primary/10" : ""
        }`}>
        <Globe className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div ref={panelRef} className="fixed inset-x-0 top-14 z-[30] px-3 pt-2 pb-3 animate-pop-in">
          <div className="mx-auto max-w-6xl">
            <div className="glass-strong rounded-2xl p-3 shadow-xl border border-white/10">
              <p className="text-[11px] font-bold text-muted-foreground px-1 pb-2 border-b border-white/10 mb-2 flex items-center gap-1.5">
                <Globe className="h-3 w-3" /> اختر لغة الترجمة
              </p>
              <ul className="max-h-[52vh] overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1 scrollbar-thin">
                {LANGS.map(l => (
                  <li key={l.code}>
                    <button onClick={() => setLang(l.code)}
                      className={`w-full flex items-center justify-between gap-2 text-right px-3 py-2 rounded-xl text-sm transition ${
                        l.code === current ? "bg-primary/20 text-primary font-bold" : "hover:bg-white/10"
                      }`}>
                      <span className="flex flex-col items-start">
                        <span>{l.native}</span>
                        <span className="text-[10px] text-muted-foreground">{l.label}</span>
                      </span>
                      {l.code === current && <Check className="h-3.5 w-3.5"/>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
}