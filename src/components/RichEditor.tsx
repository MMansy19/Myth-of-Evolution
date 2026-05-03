import { useEditor, EditorContent, Node, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Youtube from "@tiptap/extension-youtube";
import { BubbleMenu, FloatingMenu } from "@tiptap/react/menus";
import { Plugin } from "@tiptap/pm/state";
import {
  Bold, Italic, Underline as UnderIcon, Strikethrough, Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Code, Link2, Link2Off, Image as ImageIcon, Youtube as YtIcon,
  AlignRight, AlignCenter, AlignLeft, AlignJustify, Undo2, Redo2, Minus, Palette,
  Video, Upload, Maximize2, Minimize2,
} from "lucide-react";
import { useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Resizable image: stores width as percentage so it survives serialization
const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: { default: null, parseHTML: el => el.getAttribute("width"), renderHTML: a => a.width ? { width: a.width } : {} },
    };
  },
});

// Minimal inline-video node so tiptap preserves <video controls src="...">
const VideoNode = Node.create({
  name: "video",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      src: { default: null },
      controls: { default: true },
      width: { default: null, parseHTML: el => el.getAttribute("width"), renderHTML: a => a.width ? { width: a.width } : {} },
    };
  },
  parseHTML() { return [{ tag: "video" }]; },
  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return ["video", { controls: "true", class: "rounded-xl my-3 mx-auto max-w-full", ...HTMLAttributes }];
  },
});

const COLORS = [
  "#ffffff", "#fbbf24", "#34d399", "#60a5fa", "#a78bfa", "#f472b6", "#f87171", "#94a3b8",
];

function Btn({ onClick, active, disabled, title, children }:
  { onClick: () => void; active?: boolean; disabled?: boolean; title: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title}
      className={`p-1.5 rounded-md text-xs transition disabled:opacity-30 disabled:cursor-not-allowed
        ${active ? "bg-primary/30 text-primary" : "hover:bg-white/10 text-foreground/80"}`}>
      {children}
    </button>
  );
}

function useEditorActions(editor: Editor) {
  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("أدخل الرابط (اتركه فارغاً للإزالة):", prev ?? "https://");
    if (url === null) return;
    if (url === "") { editor.chain().focus().extendMarkRange("link").unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url, target: "_blank" }).run();
  };

  const addImageUrl = () => {
    const url = window.prompt("رابط الصورة:");
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };

  const addYoutube = () => {
    const url = window.prompt("رابط فيديو يوتيوب:");
    if (url) editor.commands.setYoutubeVideo({ src: url, width: 560, height: 315 });
  };

  const uploadToBucket = async (f: File) => {
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "bin";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("post-media").upload(path, f, {
      contentType: f.type, upsert: false,
    });
    if (error) throw error;
    const { data } = supabase.storage.from("post-media").getPublicUrl(path);
    return data.publicUrl;
  };

  const onUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { toast.error("حجم الصورة الأقصى 10MB"); return; }
    try {
      const url = await uploadToBucket(f);
      editor.chain().focus().setImage({ src: url }).run();
    } catch (err: any) { toast.error("تعذّر رفع الصورة: " + err.message); }
  };

  const onUploadVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    if (f.size > 25 * 1024 * 1024) { toast.error("حجم الفيديو الأقصى 25MB"); return; }
    try {
      const url = await uploadToBucket(f);
      const html = `<video src="${url}" controls class="rounded-xl my-3 mx-auto max-w-full"></video><p></p>`;
      editor.chain().focus().insertContent(html).run();
    } catch (err: any) { toast.error("تعذّر رفع الفيديو: " + err.message); }
  };

  const setMediaWidth = (w: string | null) => {
    if (editor.isActive("image")) editor.chain().focus().updateAttributes("image", { width: w }).run();
    else if (editor.isActive("video")) editor.chain().focus().updateAttributes("video", { width: w }).run();
    else toast.info("اختر صورة أو فيديو أولاً");
  };
  return { setLink, addImageUrl, addYoutube, setMediaWidth, uploadToBucket };
}

/** Floating bubble toolbar — appears on text selection. */
function FloatingToolbar({ editor }: { editor: Editor }) {
  const { setLink, addImageUrl, addYoutube } = useEditorActions(editor);
  const imgRef = useRef<HTMLInputElement>(null);
  const vidRef = useRef<HTMLInputElement>(null);

  const uploadToBucket = async (f: File) => {
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "bin";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("post-media").upload(path, f, { contentType: f.type, upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from("post-media").getPublicUrl(path);
    return data.publicUrl;
  };
  const onUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []); e.target.value = "";
    if (files.length === 0) return;
    for (const f of files) {
      if (f.size > 10 * 1024 * 1024) { toast.error(`${f.name}: تجاوز 10MB`); continue; }
      try { const url = await uploadToBucket(f); editor.chain().focus().setImage({ src: url }).run(); }
      catch (err: any) { toast.error("تعذّر الرفع: " + err.message); }
    }
  };
  const onUploadVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    if (f.size > 25 * 1024 * 1024) { toast.error("حجم الفيديو الأقصى 25MB"); return; }
    try {
      const url = await uploadToBucket(f);
      const html = `<video src="${url}" controls class="rounded-xl my-3 mx-auto max-w-full"></video><p></p>`;
      editor.chain().focus().insertContent(html).run();
    } catch (err: any) { toast.error("تعذّر رفع الفيديو: " + err.message); }
  };
  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: "top", offset: 56 }}
      shouldShow={({ editor, from, to }) => {
        // show only when there is a non-empty text selection
        if (from === to) return false;
        if (editor.isActive("image") || editor.isActive("video")) return false;
        return editor.isEditable;
      }}
    >
      <div dir="rtl" style={{ zIndex: 2147483647, position: "relative" }} className="flex flex-wrap items-center gap-0.5 p-1.5 rounded-xl border border-white/20 bg-background/98 backdrop-blur-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.9)] -translate-y-10 max-w-[95vw]">
        <Btn title="عنوان كبير" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 className="h-3.5 w-3.5"/></Btn>
        <Btn title="عنوان متوسط" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="h-3.5 w-3.5"/></Btn>
        <Btn title="عنوان صغير" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 className="h-3.5 w-3.5"/></Btn>
        <div className="w-px h-5 bg-white/15 mx-1"/>
        <Btn title="عريض" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-3.5 w-3.5"/></Btn>
        <Btn title="مائل" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-3.5 w-3.5"/></Btn>
        <Btn title="تحته خط" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderIcon className="h-3.5 w-3.5"/></Btn>
        <Btn title="مشطوب" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="h-3.5 w-3.5"/></Btn>
        <Btn title="كود" active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}><Code className="h-3.5 w-3.5"/></Btn>
        <div className="w-px h-5 bg-white/15 mx-1"/>
        <Btn title="محاذاة يمين" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}><AlignRight className="h-3.5 w-3.5"/></Btn>
        <Btn title="توسيط" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}><AlignCenter className="h-3.5 w-3.5"/></Btn>
        <Btn title="محاذاة يسار" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}><AlignLeft className="h-3.5 w-3.5"/></Btn>
        <Btn title="ضبط" active={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()}><AlignJustify className="h-3.5 w-3.5"/></Btn>
        <div className="w-px h-5 bg-white/15 mx-1"/>
        <Btn title="قائمة نقطية" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-3.5 w-3.5"/></Btn>
        <Btn title="قائمة مرقمة" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-3.5 w-3.5"/></Btn>
        <Btn title="اقتباس" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="h-3.5 w-3.5"/></Btn>
        <div className="w-px h-5 bg-white/15 mx-1"/>
        <Btn title="رابط" active={editor.isActive("link")} onClick={setLink}><Link2 className="h-3.5 w-3.5"/></Btn>
        <Btn title="إزالة الرابط" disabled={!editor.isActive("link")} onClick={() => editor.chain().focus().unsetLink().run()}><Link2Off className="h-3.5 w-3.5"/></Btn>
        <div className="w-px h-5 bg-white/15 mx-1"/>
        <Btn title="رفع صور" onClick={() => imgRef.current?.click()}><Upload className="h-3.5 w-3.5"/></Btn>
        <Btn title="صورة من رابط" onClick={addImageUrl}><ImageIcon className="h-3.5 w-3.5"/></Btn>
        <Btn title="رفع فيديو" onClick={() => vidRef.current?.click()}><Video className="h-3.5 w-3.5"/></Btn>
        <Btn title="فيديو يوتيوب" onClick={addYoutube}><YtIcon className="h-3.5 w-3.5"/></Btn>
        <input ref={imgRef} type="file" accept="image/*" multiple className="hidden" onChange={onUploadImage}/>
        <input ref={vidRef} type="file" accept="video/*" className="hidden" onChange={onUploadVideo}/>
        <div className="w-px h-5 bg-white/15 mx-1"/>
        <div className="flex items-center gap-0.5">
          <Palette className="h-3.5 w-3.5 text-muted-foreground mx-0.5"/>
          {COLORS.map(c => (
            <button key={c} type="button" title={c} onClick={() => editor.chain().focus().setColor(c).run()}
              className="w-3.5 h-3.5 rounded-full border border-white/20 hover:scale-125 transition" style={{ background: c }}/>
          ))}
          <button type="button" title="إزالة اللون" onClick={() => editor.chain().focus().unsetColor().run()}
            className="text-[10px] px-1 text-muted-foreground hover:text-foreground">×</button>
        </div>
      </div>
    </BubbleMenu>
  );
}

/** Floating bubble for image/video selection — resize controls. */
function MediaBubble({ editor }: { editor: Editor }) {
  const { setMediaWidth } = useEditorActions(editor);
  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: "top", offset: 56 }}
      shouldShow={({ editor }) => editor.isActive("image") || editor.isActive("video")}
    >
      <div dir="rtl" style={{ zIndex: 99999 }} className="relative z-[99999] flex items-center gap-0.5 p-1.5 rounded-xl border border-white/20 bg-background/98 backdrop-blur-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.9)] -translate-y-10 max-w-[95vw]">
        <span className="text-[10px] text-muted-foreground px-1">حجم:</span>
        <Btn title="30%" onClick={() => setMediaWidth("30%")}><span className="text-[10px] font-bold">30٪</span></Btn>
        <Btn title="50%" onClick={() => setMediaWidth("50%")}><span className="text-[10px] font-bold">50٪</span></Btn>
        <Btn title="75%" onClick={() => setMediaWidth("75%")}><span className="text-[10px] font-bold">75٪</span></Btn>
        <Btn title="كامل" onClick={() => setMediaWidth("100%")}><Maximize2 className="h-3.5 w-3.5"/></Btn>
        <Btn title="أصلي" onClick={() => setMediaWidth(null)}><Minimize2 className="h-3.5 w-3.5"/></Btn>
      </div>
    </BubbleMenu>
  );
}

/** FloatingMenu — appears at cursor on an empty line for quick media/link insert. */
function EmptyLineMenu({ editor }: { editor: Editor }) {
  const { setLink, addImageUrl, addYoutube } = useEditorActions(editor);
  const imgRef = useRef<HTMLInputElement>(null);
  const vidRef = useRef<HTMLInputElement>(null);
  const uploadToBucket = async (f: File) => {
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "bin";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("post-media").upload(path, f, { contentType: f.type, upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from("post-media").getPublicUrl(path);
    return data.publicUrl;
  };
  const onUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { toast.error("حجم الصورة الأقصى 10MB"); return; }
    try { const url = await uploadToBucket(f); editor.chain().focus().setImage({ src: url }).run(); }
    catch (err: any) { toast.error("تعذّر الرفع: " + err.message); }
  };
  const onUploadVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    if (f.size > 25 * 1024 * 1024) { toast.error("حجم الفيديو الأقصى 25MB"); return; }
    try {
      const url = await uploadToBucket(f);
      const html = `<video src="${url}" controls class="rounded-xl my-3 mx-auto max-w-full"></video><p></p>`;
      editor.chain().focus().insertContent(html).run();
    } catch (err: any) { toast.error("تعذّر رفع الفيديو: " + err.message); }
  };
  return (
    <FloatingMenu editor={editor} options={{ placement: "right-start", offset: 8 }}>
      <div dir="rtl" className="flex items-center gap-0.5 p-1 rounded-full border border-white/20 bg-background/95 backdrop-blur-xl shadow-lg">
        <Btn title="رفع صورة" onClick={() => imgRef.current?.click()}><ImageIcon className="h-3.5 w-3.5"/></Btn>
        <Btn title="رفع فيديو" onClick={() => vidRef.current?.click()}><Video className="h-3.5 w-3.5"/></Btn>
        <Btn title="فيديو يوتيوب" onClick={addYoutube}><YtIcon className="h-3.5 w-3.5"/></Btn>
        <Btn title="رابط صورة" onClick={addImageUrl}><Upload className="h-3.5 w-3.5"/></Btn>
        <Btn title="رابط" onClick={setLink}><Link2 className="h-3.5 w-3.5"/></Btn>
        <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={onUploadImage}/>
        <input ref={vidRef} type="file" accept="video/*" className="hidden" onChange={onUploadVideo}/>
      </div>
    </FloatingMenu>
  );
}

/** Compact persistent insert bar — actions that don't require a selection. */
function InsertBar({ editor }: { editor: Editor }) {
  const { addImageUrl, addYoutube, setLink } = useEditorActions(editor);
  const imgRef = useRef<HTMLInputElement>(null);
  const vidRef = useRef<HTMLInputElement>(null);

  const uploadToBucket = async (f: File) => {
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "bin";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("post-media").upload(path, f, { contentType: f.type, upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from("post-media").getPublicUrl(path);
    return data.publicUrl;
  };
  const onUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []); e.target.value = "";
    if (files.length === 0) return;
    const big = files.filter(f => f.size > 10 * 1024 * 1024);
    if (big.length) toast.error(`${big.length} صورة تجاوزت 10MB وتم تجاهلها`);
    const ok = files.filter(f => f.size <= 10 * 1024 * 1024);
    if (ok.length > 1) toast.info(`جارٍ رفع ${ok.length} صور…`);
    for (const f of ok) {
      try { const url = await uploadToBucket(f); editor.chain().focus().setImage({ src: url }).run(); editor.chain().focus().createParagraphNear().run(); }
      catch (err: any) { toast.error("تعذّر رفع الصورة: " + err.message); }
    }
    if (ok.length > 1) toast.success("تم رفع جميع الصور");
  };
  const onUploadVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    if (f.size > 25 * 1024 * 1024) { toast.error("حجم الفيديو الأقصى 25MB"); return; }
    try {
      const url = await uploadToBucket(f);
      const html = `<video src="${url}" controls class="rounded-xl my-3 mx-auto max-w-full"></video><p></p>`;
      editor.chain().focus().insertContent(html).run();
    } catch (err: any) { toast.error("تعذّر رفع الفيديو: " + err.message); }
  };

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 p-2 border-b border-white/10 bg-background/85 backdrop-blur-xl rounded-t-xl">
      <Btn title="عنوان كبير" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 className="h-3.5 w-3.5"/></Btn>
      <Btn title="عنوان متوسط" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="h-3.5 w-3.5"/></Btn>
      <Btn title="عنوان صغير" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 className="h-3.5 w-3.5"/></Btn>
      <div className="w-px h-5 bg-white/10 mx-1"/>
      <Btn title="عريض" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-3.5 w-3.5"/></Btn>
      <Btn title="مائل" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-3.5 w-3.5"/></Btn>
      <Btn title="تحته خط" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderIcon className="h-3.5 w-3.5"/></Btn>
      <Btn title="مشطوب" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="h-3.5 w-3.5"/></Btn>
      <div className="w-px h-5 bg-white/10 mx-1"/>
      <Btn title="قائمة نقطية" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-3.5 w-3.5"/></Btn>
      <Btn title="قائمة مرقمة" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-3.5 w-3.5"/></Btn>
      <Btn title="اقتباس" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="h-3.5 w-3.5"/></Btn>
      <Btn title="رابط" active={editor.isActive("link")} onClick={setLink}><Link2 className="h-3.5 w-3.5"/></Btn>
      <div className="w-px h-5 bg-white/10 mx-1"/>
      <Btn title="محاذاة يمين" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}><AlignRight className="h-3.5 w-3.5"/></Btn>
      <Btn title="توسيط" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}><AlignCenter className="h-3.5 w-3.5"/></Btn>
      <Btn title="محاذاة يسار" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}><AlignLeft className="h-3.5 w-3.5"/></Btn>
      <div className="w-px h-5 bg-white/10 mx-1"/>
      <Btn title="تراجع" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}><Undo2 className="h-3.5 w-3.5"/></Btn>
      <Btn title="إعادة" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}><Redo2 className="h-3.5 w-3.5"/></Btn>
      <div className="w-px h-5 bg-white/10 mx-1"/>
      <Btn title="فاصل أفقي" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus className="h-3.5 w-3.5"/></Btn>
      <Btn title="صورة من رابط" onClick={addImageUrl}><ImageIcon className="h-3.5 w-3.5"/></Btn>
      <Btn title="رفع صور (متعدد)" onClick={() => imgRef.current?.click()}><Upload className="h-3.5 w-3.5"/></Btn>
      <Btn title="رفع فيديو" onClick={() => vidRef.current?.click()}><Video className="h-3.5 w-3.5"/></Btn>
      <Btn title="فيديو يوتيوب" onClick={addYoutube}><YtIcon className="h-3.5 w-3.5"/></Btn>
      <input ref={imgRef} type="file" accept="image/*" multiple className="hidden" onChange={onUploadImage}/>
      <input ref={vidRef} type="file" accept="video/*" className="hidden" onChange={onUploadVideo}/>
    </div>
  );
}

export function RichEditor({ value, onChange, placeholder }:
  { value: string; onChange: (html: string) => void; placeholder?: string }) {
  // Upload helper used by paste/drop interception
  const uploadFile = async (f: File): Promise<string> => {
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "bin";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("post-media").upload(path, f, {
      contentType: f.type, upsert: false,
    });
    if (error) throw error;
    const { data } = supabase.storage.from("post-media").getPublicUrl(path);
    return data.publicUrl;
  };

  // Plugin: intercept pasted/dropped images so they upload to storage instead of becoming blob: URLs
  const PasteUploadPlugin = () =>
    new Plugin({
      props: {
        handlePaste(view, event) {
          const files = Array.from(event.clipboardData?.files ?? []).filter(f => f.type.startsWith("image/"));
          if (files.length === 0) return false;
          event.preventDefault();
          (async () => {
            for (const f of files) {
              if (f.size > 10 * 1024 * 1024) { toast.error("حجم الصورة الأقصى 10MB"); continue; }
              try {
                const url = await uploadFile(f);
                const node = view.state.schema.nodes.image.create({ src: url });
                view.dispatch(view.state.tr.replaceSelectionWith(node));
              } catch (err: any) { toast.error("تعذّر رفع الصورة: " + err.message); }
            }
          })();
          return true;
        },
        handleDrop(view, event) {
          const files = Array.from((event as DragEvent).dataTransfer?.files ?? []).filter(f => f.type.startsWith("image/") || f.type.startsWith("video/"));
          if (files.length === 0) return false;
          event.preventDefault();
          (async () => {
            for (const f of files) {
              const isVideo = f.type.startsWith("video/");
              const max = isVideo ? 25 : 10;
              if (f.size > max * 1024 * 1024) { toast.error(`الحجم الأقصى ${max}MB`); continue; }
              try {
                const url = await uploadFile(f);
                if (isVideo) {
                  const html = `<video src="${url}" controls class="rounded-xl my-3 mx-auto max-w-full"></video><p></p>`;
                  view.dispatch(view.state.tr.insertText("")); // ensure cursor
                  (view as any).pasteHTML?.(html);
                  // Fallback: use editor command via ref later
                } else {
                  const node = view.state.schema.nodes.image.create({ src: url });
                  view.dispatch(view.state.tr.replaceSelectionWith(node));
                }
              } catch (err: any) { toast.error("تعذّر الرفع: " + err.message); }
            }
          })();
          return true;
        },
      },
    });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TextStyle,
      Color,
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { class: "text-primary underline" } }),
      ResizableImage.configure({ HTMLAttributes: { class: "rounded-xl my-3 max-w-full mx-auto" } }),
      TextAlign.configure({ types: ["heading", "paragraph"], defaultAlignment: "right" }),
      Youtube.configure({ controls: true, nocookie: true, HTMLAttributes: { class: "rounded-xl my-3 mx-auto max-w-full" } }),
      VideoNode,
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class: "prose-content min-h-[280px] p-4 outline-none text-sm leading-loose",
        dir: "rtl",
        "data-placeholder": placeholder ?? "اكتب هنا…",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Register paste/drop interceptor once editor is ready
  if (editor && !(editor as any)._pasteUploadRegistered) {
    editor.registerPlugin(PasteUploadPlugin());
    (editor as any)._pasteUploadRegistered = true;
  }

  if (!editor) return <div className="glass-input rounded-xl h-72 animate-pulse"/>;

  return (
    <div className="rounded-xl overflow-hidden border border-white/10 bg-background/40">
      <InsertBar editor={editor}/>
      <FloatingToolbar editor={editor}/>
      <MediaBubble editor={editor}/>
      <EmptyLineMenu editor={editor}/>
      <EditorContent editor={editor}/>
    </div>
  );
}

export function RichContent({ html }: { html: string }) {
  // Detect legacy plain text (no HTML tags) and preserve line breaks
  const isHtml = /<\/?[a-z][\s\S]*>/i.test(html);
  if (!isHtml) {
    return <div className="prose-content text-sm leading-loose whitespace-pre-wrap">{html}</div>;
  }
  // Strip dead blob: image/video sources (they expire after the upload session)
  const cleaned = html
    .replace(/<img[^>]*src=["']blob:[^"']*["'][^>]*>/gi, '<p class="text-xs text-muted-foreground italic">[صورة فُقدت — يرجى من الكاتب إعادة رفعها]</p>')
    .replace(/<video[^>]*src=["']blob:[^"']*["'][^>]*>(.*?<\/video>)?/gi, '<p class="text-xs text-muted-foreground italic">[فيديو فُقد — يرجى من الكاتب إعادة رفعه]</p>');
  return <div className="prose-content text-sm leading-loose" dangerouslySetInnerHTML={{ __html: cleaned }}/>;
}