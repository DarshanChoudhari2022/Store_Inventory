"use client";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type InputHTMLAttributes, type TextareaHTMLAttributes, type RefObject } from "react";
import { Mic, Square } from "lucide-react";
import { voiceValue } from "./voice-domain";

type Recognition = {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
};
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
let activeRecognition: Recognition | null = null;
const subscribe = () => () => {};
const speechSupported = () => { const w = window as SpeechWindow; return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition); };

function VoiceControl({ target, disabled, statusId }: { target: RefObject<HTMLInputElement | HTMLTextAreaElement | null>; disabled?: boolean; statusId: string }) {
  const recognition = useRef<Recognition | null>(null);
  const supported = useSyncExternalStore(subscribe, speechSupported, () => false);
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState("");
  const [statusType, setStatusType] = useState<"info" | "error" | "listening" | "success">("info");
  const [isBrave, setIsBrave] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const nav = navigator as unknown as { brave?: { isBrave?: () => Promise<boolean> } };
      if (nav.brave?.isBrave) {
        nav.brave.isBrave().then((val: boolean) => {
          if (val) setIsBrave(true);
        }).catch(() => {});
      } else if (Boolean(nav.brave)) {
        setIsBrave(true);
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      const r = recognition.current;
      if (r) { r.onend = null; r.onerror = null; r.onresult = null; r.abort(); }
      if (activeRecognition === r) activeRecognition = null;
    };
  }, []);

  const toggle = () => {
    if (listening) { recognition.current?.stop(); setListening(false); return; }
    const field = target.current;
    if (!field || field.disabled || field.readOnly) return;
    const mr = document.documentElement.lang.startsWith("mr");
    const isWindows = typeof navigator !== "undefined" && /Win/i.test(navigator.userAgent || navigator.platform || "");

    // Brave blocks Google's proprietary Web Speech servers at the engine level.
    // Give immediate, helpful instructions so the user knows exactly what to do.
    if (isBrave) {
      field.focus();
      setStatusType("error");
      setMessage(isWindows
        ? (mr
            ? "Brave ब्राऊझर स्पीच सर्व्हिस ब्लॉक करतो. कृपया Google Chrome वापरा किंवा कीबोर्डवर Win + H दाबा."
            : "Brave blocks Google speech services. Use Google Chrome or press Win + H for Windows Voice Typing.")
        : (mr
            ? "Brave ब्राऊझर स्पीच सर्व्हिस ब्लॉक करतो. कृपया Google Chrome वापरा."
            : "Brave blocks Google speech services. Please open in Google Chrome for voice typing."));
      return;
    }

    const browser = window as SpeechWindow;
    const Constructor = browser.SpeechRecognition || browser.webkitSpeechRecognition;
    if (!Constructor) {
      field.focus();
      setStatusType("error");
      setMessage(isWindows
        ? (mr ? "स्पीच सर्व्हिस अनुपलब्ध आहे. कृपया Chrome वापरा किंवा Win + H दाबा." : "Speech recognition is unavailable. Open in Google Chrome or press Win + H.")
        : (mr ? "स्पीच सर्व्हिस अनुपलब्ध आहे. कृपया Google Chrome वापरा." : "Speech recognition is unavailable. Please open in Google Chrome."));
      return;
    }

    activeRecognition?.abort();
    const r = new Constructor();
    recognition.current = r; activeRecognition = r;
    const preferredLang = mr ? "mr-IN" : (typeof navigator !== "undefined" && navigator.language ? navigator.language : "en-IN");
    r.lang = preferredLang;
    r.interimResults = false; r.continuous = false;
    const start = field.selectionStart, end = field.selectionEnd;

    r.onresult = event => {
      if (recognition.current !== r || activeRecognition !== r || field.disabled || field.readOnly) return;
      const text = event.results[0]?.[0]?.transcript?.trim();
      if (!text) return;
      const type = field instanceof HTMLInputElement ? field.type : "textarea";
      const next = voiceValue(field.value, text, type, start, end);
      if (next === null) {
        setStatusType("error");
        setMessage(mr ? "ओळखलेले मूल्य तपासा आणि टाइप करा: " + text : "Could not use this value. Please type it: " + text);
        return;
      }
      const probe = field.cloneNode() as HTMLInputElement | HTMLTextAreaElement;
      probe.value = next;
      if (!probe.checkValidity() || (field.maxLength >= 0 && next.length > field.maxLength)) {
        setStatusType("error");
        setMessage(mr ? "हे मूल्य या फील्डसाठी योग्य नाही. कृपया तपासा." : "That value is outside this field’s format or limits. Please check it.");
        return;
      }
      const prototype = field instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(field, next);
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
      setStatusType("success");
      setMessage(mr ? "मजकूर भरला. जतन करण्यापूर्वी तपासा." : "Voice entry added. Review it before saving.");
      field.focus();
    };

    r.onerror = event => {
      setListening(false);
      if (event.error === "aborted") return;
      setStatusType("error");
      field.focus();

      if (event.error === "network") {
        const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
        if (!isOnline) {
          setMessage(mr ? "इंटरनेट कनेक्शन नाही. कृपया ऑनलाइन असताना पुन्हा प्रयत्न करा." : "Speech recognition needs an internet connection. Try again when online.");
        } else {
          // Online but network error => browser engine (Brave) or firewall is blocking Google's speech recognition endpoint
          setMessage(isWindows
            ? (mr
                ? "ब्राऊझर स्पीच सर्व्हिस ब्लॉक करत आहे (उदा. Brave). कृपया Google Chrome वापरा किंवा Win + H दाबा."
                : "Speech service blocked by browser (common in Brave). Open in Google Chrome or press Win + H.")
            : (mr
                ? "ब्राऊझर स्पीच सर्व्हिस ब्लॉक करत आहे. कृपया Google Chrome वापरा."
                : "Speech service blocked by browser. Please open in Google Chrome."));
        }
        return;
      }

      const errors: Record<string, string> = {
        "not-allowed": mr
          ? "मायक्रोफोन परवानगी नाकारली आहे. ब्राऊझर सेटिंग्जमध्ये ती सुरू करा."
          : "Microphone permission was denied. Allow it in browser settings or type normally.",
        "service-not-allowed": isWindows
          ? (mr
              ? "या ब्राऊझरमध्ये स्पीच सर्व्हिस अनुपलब्ध आहे. कृपया Chrome वापरा किंवा Win + H दाबा."
              : "Speech recognition is unavailable in this browser. Use Google Chrome or press Win + H.")
          : (mr
              ? "या ब्राऊझरमध्ये स्पीच सर्व्हिस अनुपलब्ध आहे. कृपया Google Chrome वापरा."
              : "Speech recognition is unavailable in this browser. Please use Google Chrome."),
        "no-speech": mr
          ? "कोणताही आवाज ऐकू आला नाही. कृपया पुन्हा प्रयत्न करा."
          : "No speech heard. Try again.",
        "audio-capture": mr
          ? "मायक्रोफोन आढळला नाही. कृपया माइक कनेक्ट करा."
          : "No microphone was found. Connect one or type normally.",
        "language-not-supported": mr
          ? "ही भाषा स्पीचसाठी सपोर्टेड नाही."
          : "Language not supported for speech recognition.",
      };
      setMessage(errors[event.error] || (mr ? "व्हॉइस टायपिंग सुरू होऊ शकले नाही. कृपया टाइप करा." : "Voice typing could not start. Try again or type normally."));
    };

    r.onend = () => {
      if (activeRecognition === r) activeRecognition = null;
      if (recognition.current === r) {
        setListening(false);
        recognition.current = null;
      }
    };

    try {
      r.start();
      setListening(true);
      setStatusType("listening");
      setMessage(mr ? "ऐकत आहे… (बोला)" : "Listening… speak now");
    } catch {
      r.abort();
      setListening(false);
      setStatusType("error");
      setMessage(mr ? "व्हॉइस टायपिंग सुरू होऊ शकले नाही. कृपया टाइप करा." : "Voice typing could not start. Try again or type normally.");
    }
  };

  return <>
    <button
      type="button"
      className={`voice-button${listening ? " listening" : ""}`}
      onClick={toggle}
      disabled={disabled || (!supported && !isBrave)}
      aria-pressed={listening}
      aria-label={listening ? "Stop voice typing" : "Start voice typing"}
      title={
        isBrave
          ? "Brave blocks Google speech services. Use Google Chrome or press Win + H for Windows Voice Typing."
          : supported
          ? "Dictate in the selected app language. On Windows, you can also press Win + H to dictate."
          : "Voice typing is unavailable in this browser. Press Win + H to dictate or type normally."
      }
    >
      {listening ? <Square size={16} /> : <Mic size={18} />}
    </button>
    <span className={`voice-status voice-status-${statusType}`} id={statusId} role="status">
      {message}
    </span>
  </>;
}

export default function VoiceInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const ref = useRef<HTMLInputElement>(null);
  const id = useId();
  if (["password", "checkbox", "radio", "file", "hidden", "range", "color", "submit", "button"].includes(props.type || "text")) return <input {...props} />;
  return <span className="voice-input"><input {...props} ref={ref} aria-describedby={[props["aria-describedby"], id].filter(Boolean).join(" ")} /><VoiceControl target={ref} disabled={props.disabled || props.readOnly} statusId={id} /></span>;
}

export function VoiceTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  return <span className="voice-input"><textarea {...props} ref={ref} aria-describedby={[props["aria-describedby"], id].filter(Boolean).join(" ")} /><VoiceControl target={ref} disabled={props.disabled || props.readOnly} statusId={id} /></span>;
}
