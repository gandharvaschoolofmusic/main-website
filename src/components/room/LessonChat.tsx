"use client";

import { useState, useRef, useEffect } from "react";
import { useChat } from "@livekit/components-react";
import { X, Send } from "lucide-react";
import { RoomIconButton } from "./MeetPrimitives";

interface LessonChatProps {
  isOpen: boolean;
  onClose: () => void;
  isTeacher: boolean;
  participantName: string;
  onNewMessage?: (count: number) => void;
}

// Comprehensive PII patterns for student and teacher safety
const PII_RULES = [
  {
    type: "phone",
    label: "phone number",
    pattern: /(?:(?:\+|00)\d{1,3}[\s.-]*)?(?:\(?\d{2,5}\)?[\s.-]*)?\d{3,5}[\s.-]*\d{3,5}/,
    customCheck: (text: string) => {
      // Check for 10 or more contiguous or space/dash-separated digits
      const digitsOnly = text.replace(/\D/g, "");
      return digitsOnly.length >= 10;
    },
  },
  {
    type: "email",
    label: "email address",
    pattern: /[a-zA-Z0-9._%+-]+(?:\s*@\s*|\s*\[at\]\s*|\s*\(at\)\s*)[a-zA-Z0-9.-]+(?:\s*\.\s*|\s*\[dot\]\s*|\s*\(dot\)\s*)[a-zA-Z]{2,}/i,
  },
  {
    type: "social",
    label: "social media handle or external app",
    pattern: /(?:instagram|insta|ig|snapchat|snap|telegram|tg|whatsapp|wa|facebook|fb|twitter|tiktok|discord|zoom|skype|wechat|linkedin)[\s:@./_-]*[\w.-]+/i,
  },
  {
    type: "handle",
    label: "handle (@username)",
    pattern: /(^|\s)@[\w.]{3,30}\b/,
  },
  {
    type: "url",
    label: "external link or website",
    pattern: /(?:https?:\/\/|www\.)[^\s/$.?#].[^\s]*/i,
  },
  {
    type: "domain",
    label: "website link",
    pattern: /\b[a-zA-Z0-9-]+\.(?:com|org|net|io|co|in|edu|gov|xyz|app|me|site|link|info)\b/i,
  },
  {
    type: "address",
    label: "physical street address",
    pattern: /\b\d{1,5}\s+[\w\s]{2,20}\s+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct|circle|cir|way)\b/i,
  },
];

/**
 * Validates text against safety policies. Returns detected violation description or null if clean.
 */
function checkPIIViolation(text: string): string | null {
  if (!text || text.trim().length === 0) return null;

  for (const rule of PII_RULES) {
    if (rule.pattern && rule.pattern.test(text)) {
      return rule.label;
    }
    if (rule.customCheck && rule.customCheck(text)) {
      return rule.label;
    }
  }
  return null;
}



export function LessonChat({
  isOpen,
  onClose,

  participantName,
  onNewMessage,
}: LessonChatProps) {
  const { chatMessages, send, isSending } = useChat();
  const [inputText, setInputText] = useState("");
  const [safetyWarning, setSafetyWarning] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastMsgCountRef = useRef(chatMessages.length);
  const onNewMessageRef = useRef(onNewMessage);

  useEffect(() => {
    onNewMessageRef.current = onNewMessage;
  });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      const timeout = setTimeout(() => {
        inputRef.current?.focus();
        setSafetyWarning(null);
      }, 150);
      return () => clearTimeout(timeout);
    }
  }, [isOpen]);

  // Track unread messages when closed
  useEffect(() => {
    if (!isOpen) {
      if (chatMessages.length > lastMsgCountRef.current) {
        const diff = chatMessages.length - lastMsgCountRef.current;
        lastMsgCountRef.current = chatMessages.length;
        onNewMessageRef.current?.(diff);
      } else if (chatMessages.length < lastMsgCountRef.current) {
        lastMsgCountRef.current = chatMessages.length;
      }
    } else {
      lastMsgCountRef.current = chatMessages.length;
      onNewMessageRef.current?.(0);
    }
  }, [chatMessages.length, isOpen]);

  // Check PII in real-time as user types
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setInputText(text);

    const violation = checkPIIViolation(text);
    if (violation) {
      setSafetyWarning(`Sharing personal info (${violation}) is restricted for student safety.`);
    } else {
      setSafetyWarning(null);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || isSending) return;

    // Strict PII filter before dispatch
    const violation = checkPIIViolation(trimmed);
    if (violation) {
      setSafetyWarning(
        `🛡️ Message blocked: Cannot share ${violation}. Personal contact details are not permitted in lesson chat.`,
      );


      inputRef.current?.focus();
      return;
    }

    try {
      await send(trimmed);
      setInputText("");
      setSafetyWarning(null);
    } catch (err) {
      console.error("Failed to send chat message:", err);
      setSafetyWarning("Failed to send message. Please try again.");
    }
  };



  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  if (!isOpen) return null;

  return (
    <aside className="meet-panel meet-chat" aria-label="In-call messages">
      <header className="meet-panel-header"><h2>In-call messages</h2><RoomIconButton label="Close messages" onClick={onClose}><X/></RoomIconButton></header>
      <div className="meet-chat-notice"><strong>Messages are visible to everyone in this call</strong>Messages are only available during the call. Personal contact details and external links remain restricted.</div>
      <div className="meet-chat-messages" role="log" aria-live="polite" aria-label="Messages">
        {chatMessages.length === 0 ? <p className="meet-chat-empty">Send a message to start the conversation.</p> : chatMessages.map((message, index) => (
          <article key={`${message.timestamp}-${index}`} className="meet-chat-message">
            <header><strong>{!message.from || message.from.isLocal ? "You" : message.from.name || participantName}</strong><time>{formatTime(message.timestamp)}</time></header>
            <p>{message.message}</p>
          </article>
        ))}
        <div ref={messagesEndRef}/>
      </div>
      {safetyWarning && <div className="meet-chat-warning" role="alert"><span>{safetyWarning}</span><RoomIconButton label="Dismiss message warning" onClick={() => setSafetyWarning(null)}><X size={16}/></RoomIconButton></div>}
      <form className="meet-chat-compose" onSubmit={handleSendMessage}>
        <input ref={inputRef} aria-label="Send a message" value={inputText} onChange={handleInputChange} placeholder="Send a message" maxLength={500}/>
        <button type="submit" className="meet-icon-button" aria-label="Send message" disabled={!inputText.trim() || isSending || !!safetyWarning}><Send size={21}/></button>
      </form>
    </aside>
  );
}

