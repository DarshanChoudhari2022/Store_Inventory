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
  useEffect(() => {
    return () => {
      const r = recognition.current;
      if (r) { r.onend = null; r.onerror = null; r.onresult = null; r.abort(); }
      if (activeRecognition === r) activeRecognition = null;
    };
  }, []);
  const toggle = () => {
    if (listening) { recognition.current?.stop(); return; }
    const field = target.current;
    if (!field || field.disabled || field.readOnly) return;
    const browser = window as SpeechWindow;
    const Constructor = browser.SpeechRecognition || browser.webkitSpeechRecognition;
    if (!Constructor) return;
    activeRecognition?.abort();
    const r = new Constructor();
    recognition.current = r; activeRecognition = r;
    const mr = document.documentElement.lang.startsWith("mr");
    r.lang = mr ? "mr-IN" : "en-IN";
    r.interimResults = false; r.continuous = false;
    const start = field.selectionStart, end = field.selectionEnd;
    r.onresult = event => {
      if (recognition.current !== r || activeRecognition !== r || field.disabled || field.readOnly) return;
      const text = event.results[0]?.[0]?.transcript?.trim();
      if (!text) return;
      const type = field instanceof HTMLInputElement ? field.type : "textarea";
      const next = voiceValue(field.value, text, type, start, end);
      if (next === null) { setMessage(mr ? "ओळखलेले मूल्य तपासा आणि टाइप करा: " + text : "Could not use this value. Please type it: " + text); return; }
      const probe = field.cloneNode() as HTMLInputElement | HTMLTextAreaElement;
      probe.value = next;
      if (!probe.checkValidity() || (field.maxLength >= 0 && next.length > field.maxLength)) {
        setMessage(mr ? "हे मूल्य या फील्डसाठी योग्य नाही. कृपया तपासा." : "That value is outside this field’s format or limits. Please check it."); return;
      }
      const prototype = field instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(field, next);
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
      setMessage(mr ? "मजकूर भरला. जतन करण्यापूर्वी तपासा." : "Voice entry added. Review it before saving.");
      field.focus();
    };
    r.onerror = event => {
      setListening(false);
      if (event.error === "aborted") return;
      const errors: Record<string, string> = {
        "not-allowed": "Microphone permission was denied. Allow it in browser settings or type normally.",
        "service-not-allowed": "Speech recognition is unavailable. Use keyboard dictation or type normally.",
        "no-speech": "No speech heard. Try again.",
        "audio-capture": "No microphone was found. Connect one or type normally.",
        network: "Speech recognition needs a connection. Try again when online.",
      };
      setMessage(errors[event.error] || "Voice typing could not start. Try again or type normally.");
    };
    r.onend = () => { if (activeRecognition === r) activeRecognition = null; if (recognition.current === r) { setListening(false); recognition.current = null; } };
    try { r.start(); setListening(true); setMessage(mr ? "ऐकत आहे…" : "Listening…"); }
    catch { r.abort(); setListening(false); setMessage("Voice typing could not start. Try again or type normally."); }
  };
  return <>
    <button type="button" className={`voice-button${listening ? " listening" : ""}`} onClick={toggle} disabled={disabled || !supported} aria-pressed={listening} aria-label={listening ? "Stop voice typing" : "Start voice typing"} title={supported ? "Dictate in the selected app language. Your browser provider may process audio online." : "Voice typing is unavailable. Use keyboard dictation or type normally."}>{listening ? <Square size={16} /> : <Mic size={18} />}</button>
    <span className="voice-status" id={statusId} role="status">{message}</span>
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
