"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

/** Uploaded avatars are already resized WebP files served through a signed URL. */
export function ProfileImage(props: ImageProps) {
  const [failedSource, setFailedSource] = useState<ImageProps["src"] | null>(null);
  if (failedSource === props.src) {
    const initials = props.alt.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join("").toUpperCase() || "?";
    return <span role="img" aria-label={props.alt} className={`${props.fill ? "absolute inset-0" : ""} flex items-center justify-center bg-primary/10 text-primary font-semibold ${props.className || ""}`} style={{ width: props.fill ? undefined : props.width, height: props.fill ? undefined : props.height }}>{initials}</span>;
  }
  return <Image {...props} unoptimized onError={event => { setFailedSource(props.src); props.onError?.(event); }} />;
}
