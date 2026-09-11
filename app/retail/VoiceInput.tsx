"use client";
import { useRef, useState } from "react";

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onerror: () => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
};

/** Adds browser-native speech-to-text without sending audio anywhere. */
export default function VoiceInput({
  name,
  defaultValue,
  value,
  type = "text",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { name: string }) {
  const input = useRef<HTMLInputElement>(null);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const [listening, setListening] = useState(false);
  const supported = typeof window !== "undefined" && Boolean((window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition);
  const toggle = () => {
    if (!supported) return;
    if (listening) { recognition.current?.stop(); return; }
    const Ctor = (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("mr") ? "mr-IN" : "en-IN";
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript?.trim();
      if (!text || !input.current) return;
      const next = input.current.value ? `${input.current.value} ${text}` : text;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input.current, next);
      input.current.dispatchEvent(new Event("input", { bubbles: true }));
    };
    r.onerror = () => setListening(false);
    r.onend = () => { setListening(false); recognition.current = null; };
    recognition.current = r;
    setListening(true);
    r.start();
  };
  return <span className="voice-input"><input ref={input} name={name} defaultValue={defaultValue} value={value} type={type} {...props} /><button type="button" className={listening ? "voice-button listening" : "voice-button"} onClick={toggle} disabled={!supported} aria-label={supported ? (listening ? "Stop voice typing" : "Start voice typing") : "Voice typing is not supported in this browser"} title={supported ? (listening ? "Stop voice typing" : "Voice typing") : "Voice typing is not supported in this browser"}>🎙</button></span>;
}
