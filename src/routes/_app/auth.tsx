import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { LogIn, UserPlus, Eye } from "lucide-react";

export const Route = createFileRoute("/_app/auth")({
  component: AuthPage,
  head: () => ({ meta: [{ title: "تسجيل الدخول · وهم التطور" }] }),
});

const schema = z.object({
  email: z.string().trim().email("بريد غير صالح").max(255),
  password: z.string().min(6, "كلمة المرور 6 أحرف على الأقل").max(72),
});

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) navigate({ to: "/" });
  }, [user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword(parsed.data);
        if (error) throw error;
        toast.success("أهلاً بعودتك");
        navigate({ to: "/" });
      } else {
        const { error } = await supabase.auth.signUp({
          ...parsed.data,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("تم إنشاء الحساب · تحقّق من بريدك الإلكتروني ثم سجّل الدخول");
      }
    } catch (e: any) {
      const message = e?.message?.includes("Email not confirmed")
        ? "يجب تأكيد البريد الإلكتروني أولاً قبل تسجيل الدخول"
        : e?.message ?? "حدث خطأ";
      toast.error(message);
    } finally { setLoading(false); }
  };

  const google = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
        extraParams: { prompt: "select_account" },
      });
      if (result.error) {
        toast.error(result.error.message ?? "تعذّر الدخول بحساب Google");
        return;
      }
      if (result.redirected) return;
      toast.success("أهلاً بعودتك");
      navigate({ to: "/" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-5">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-black text-gradient-emerald">
          {mode === "signin" ? "تسجيل الدخول" : "إنشاء حساب"}
        </h1>
        <p className="text-xs text-muted-foreground">
          المشرفون يستعيدون صلاحياتهم تلقائياً عند الدخول
        </p>
      </div>

      <div className="glass rounded-3xl p-6 space-y-4">
        <button
          onClick={google}
          disabled={loading}
          className="w-full glass-input rounded-xl py-3 px-4 font-semibold text-sm hover:bg-white/10 transition flex items-center justify-center gap-2"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          {loading ? "جارٍ المتابعة…" : "الدخول بحساب Google"}
        </button>

        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <div className="flex-1 h-px bg-white/10" /> أو <div className="flex-1 h-px bg-white/10" />
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input
            type="email" placeholder="البريد الإلكتروني" value={email} onChange={e=>setEmail(e.target.value)}
            className="w-full glass-input rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/50"
          />
          <input
            type="password" placeholder="كلمة المرور" value={password} onChange={e=>setPassword(e.target.value)}
            className="w-full glass-input rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/50"
          />
          <button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground rounded-xl py-3 font-bold text-sm hover:opacity-90 transition glow-emerald flex items-center justify-center gap-2 disabled:opacity-50">
            {mode === "signin" ? <><LogIn className="h-4 w-4"/> دخول</> : <><UserPlus className="h-4 w-4"/> تسجيل</>}
          </button>
        </form>

        <button onClick={()=>setMode(mode==="signin"?"signup":"signin")} className="w-full text-xs text-muted-foreground hover:text-foreground transition">
          {mode === "signin" ? "ليس لديك حساب؟ سجّل الآن" : "لديك حساب بالفعل؟ سجّل الدخول"}
        </button>
      </div>

      <Link to="/" className="block text-center glass rounded-2xl py-3 text-xs font-semibold hover:bg-white/5 transition">
        <Eye className="h-3.5 w-3.5 inline ml-1" /> الدخول كضيف (تصفح فقط)
      </Link>
    </div>
  );
}
