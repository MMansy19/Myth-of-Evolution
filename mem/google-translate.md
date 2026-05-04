# How Google Translate Works on This Site

## What's already implemented

The site uses **Google Translate Element** — a free script from Google that translates the entire DOM client-side, no API key needed.

The code lives in `src/components/Layout.tsx` inside the `TranslateButton` function.

---

## How it works (step by step)

1. **User clicks the globe icon** in the header.
2. A dropdown panel opens showing all available languages.
3. When the user picks a language, the site:
   - Sets a `googtrans` cookie (e.g. `/ar/en` for Arabic → English).
   - Reloads the page.
4. On reload, the Google Translate script reads the cookie and automatically translates every visible text element on the page.
5. The chosen language is also saved to `localStorage` so it persists across sessions.

---

## The two required pieces

### 1. Hidden anchor div (in Layout.tsx)
```html
<div id="google_translate_element" class="sr-only" aria-hidden="true" />
```
Google's script needs this element to exist in the DOM. It's hidden visually.

### 2. The script loader (inside TranslateButton useEffect)
```js
window.googleTranslateElementInit = () => {
  new window.google.translate.TranslateElement(
    { pageLanguage: "ar", autoDisplay: false, layout: SIMPLE },
    "google_translate_element"
  );
};

const s = document.createElement("script");
s.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
document.body.appendChild(s);
```
This loads once globally (`window.__gt_loaded` flag prevents double-loading).

---

## The Google toolbar / banner problem

Google Translate injects an ugly top bar into the page by default. The site actively removes it using a `MutationObserver`:

```js
const strip = () => {
  document.querySelectorAll(".goog-te-banner-frame, iframe.goog-te-banner-frame, ...").forEach(el => el.remove());
  document.body.style.top = "0px"; // Google shifts the body down — reset it
};
const mo = new MutationObserver(strip);
mo.observe(document.body, { childList: true, subtree: true });
```

This runs continuously for the first few seconds to catch any re-injections.

---

## Cookie format

Google Translate reads a specific cookie format:

| Cookie name | Value format | Example |
|-------------|-------------|---------|
| `googtrans` | `/[source]/[target]` | `/ar/en` |

The cookie must be set on **both** the exact hostname and the root domain:
```js
document.cookie = `googtrans=/ar/${code}; path=/`;
document.cookie = `googtrans=/ar/${code}; path=/; domain=.example.com`;
```

To reset to Arabic (original): delete the cookie entirely (don't set it).

---

## Adding or removing languages

Open `src/components/Layout.tsx` and find the `LANGS` array:

```ts
const LANGS: { code: string; label: string; native: string }[] = [
  { code: "ar", label: "Arabic", native: "العربية" },
  { code: "en", label: "English", native: "English" },
  { code: "fr", label: "French", native: "Français" },
  // ... add or remove entries here
];
```

Use standard BCP-47 language codes supported by Google Translate:
https://cloud.google.com/translate/docs/languages

---

## Protecting Arabic-only content from translation

Add `translate="no"` and the class `notranslate` to any element you want Google Translate to skip:

```html
<p translate="no" class="notranslate">
  بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ
</p>
```

This is already applied to the Quranic verse on the home page.

---

## Limitations

- **No server-side translation** — text is translated in the browser only, after the page loads.
- **Quality** — machine translation quality varies by language pair.
- **Dynamic content** — content loaded after the initial page render (e.g. fetched posts) may not always be translated automatically. Google Translate's MutationObserver usually catches it, but it's not guaranteed.
- **No offline support** — requires a connection to Google's servers.
- **Cannot translate inside `<canvas>` or SVG text**.
