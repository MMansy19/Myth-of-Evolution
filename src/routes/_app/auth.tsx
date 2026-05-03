import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
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
        const { error } = await supabase.auth.signUp(parsed.data);
        if (error) throw error;
        toast.success("مرحباً بك! تم إنشاء الحساب بنجاح");
        navigate({ to: "/" });
      }
    } catch (e: any) {
      const message = e?.message ?? "حدث خطأ";
      toast.error(message);
    } finally { setLoading(false); }
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
