"use client";

import { MessageType } from "@/types";
import { FileText, Download, ClipboardList, Check, CheckCheck } from "lucide-react";

type MessageBubbleProps = {
  id: string;
  body: string | null;
  messageType: MessageType;
  fileName: string | null;
  fileUrl: string | null;
  fileSizeBytes: number | null;
  isMine: boolean;
  isRead: boolean;
  senderName: string;
  createdAt: Date;
  showAvatar?: boolean;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MessageBubble({
  id,
  body,
  messageType,
  fileName,
  fileUrl,
  fileSizeBytes,
  isMine,
  isRead,
  senderName,
  createdAt,
  showAvatar = true,
}: MessageBubbleProps) {
  const isFile =
    messageType === "FILE" || messageType === "ASSIGNMENT";

  return (
    <div
      className={`flex ${isMine ? "justify-end" : "justify-start"} mb-2 group`}
    >
      <div
        className={`flex ${isMine ? "flex-row-reverse" : "flex-row"} items-end gap-2 max-w-[80%]`}
      >
        {/* Avatar */}
        {showAvatar && !isMine && (
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-cta flex items-center justify-center text-white text-[10px] font-bold uppercase shrink-0">
            {senderName.slice(0, 2)}
          </div>
        )}

        {/* Message Content */}
        <div
          className={`relative rounded-2xl px-4 py-2.5 text-sm leading-relaxed transition-shadow ${
            isMine
              ? "bg-primary text-white rounded-br-md shadow-sm"
              : "bg-white border border-border-subtle text-heading rounded-bl-md shadow-xs"
          }`}
        >
          {/* Assignment badge */}
          {messageType === "ASSIGNMENT" && (
            <div
              className={`flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold mb-1.5 ${
                isMine ? "text-white/70" : "text-accent-dark"
              }`}
            >
              <ClipboardList className="w-3 h-3" />
              Assignment
            </div>
          )}

          {/* File attachment */}
          {isFile && fileName && (
            <div
              className={`flex items-center gap-3 p-2.5 rounded-xl mb-2 ${
                isMine
                  ? "bg-white/10 border border-white/20"
                  : "bg-primary-subtle border border-border-subtle"
              }`}
            >
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  isMine ? "bg-white/20" : "bg-primary/10"
                }`}
              >
                <FileText
                  className={`w-4 h-4 ${isMine ? "text-white" : "text-primary"}`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-xs font-semibold truncate ${
                    isMine ? "text-white" : "text-heading"
                  }`}
                >
                  {fileName}
                </p>
                {fileSizeBytes && (
                  <p
                    className={`text-[10px] ${
                      isMine ? "text-white/60" : "text-body-muted"
                    }`}
                  >
                    {formatFileSize(fileSizeBytes)}
                  </p>
                )}
              </div>
              {fileUrl && (
                <a
                  href={`/api/files/message/${encodeURIComponent(id)}/download`}
                  download={fileName || "attachment"}
                  className={`p-1.5 rounded-lg transition-colors ${
                    isMine
                      ? "hover:bg-white/20 text-white/80 hover:text-white"
                      : "hover:bg-primary/10 text-primary/60 hover:text-primary"
                  }`}
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </a>
              )}
            </div>
          )}

          {/* Text body */}
          {body && (
            <p className="whitespace-pre-wrap break-words">{body}</p>
          )}

          {/* Timestamp + read receipt */}
          <div
            className={`flex items-center gap-1 mt-1 ${
              isMine ? "justify-end" : "justify-start"
            }`}
          >
            <span
              className={`text-[10px] ${
                isMine ? "text-white/50" : "text-body-muted"
              }`}
            >
              {formatTime(createdAt)}
            </span>
            {isMine && (
              <span className={`${isRead ? "text-white/70" : "text-white/40"}`}>
                {isRead ? (
                  <CheckCheck className="w-3 h-3" />
                ) : (
                  <Check className="w-3 h-3" />
                )}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
