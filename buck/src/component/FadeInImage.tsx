"use client";

import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react";

/**
 * An <img> that fades in once it has loaded instead of popping in (ADR-054).
 * Used for profile pictures, which load from /api/profile/avatar after the
 * page has painted. The `buck-fade-img` styles live in globals.css.
 */
export default function FadeInImage({
  className,
  onLoad,
  src,
  alt = "",
  ...props
}: ImgHTMLAttributes<HTMLImageElement>) {
  const ref = useRef<HTMLImageElement>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const source = typeof src === "string" ? src : null;

  // A cached image can finish loading before React attaches onLoad.
  useEffect(() => {
    const image = ref.current;
    if (source && image?.complete && image.naturalWidth > 0) {
      setLoadedSrc(source);
    }
  }, [source]);

  const loaded = source !== null && loadedSrc === source;

  return (
    <img
      ref={ref}
      src={src}
      alt={alt}
      {...props}
      className={`buck-fade-img${loaded ? " is-loaded" : ""}${className ? ` ${className}` : ""}`}
      onLoad={(event) => {
        if (source) setLoadedSrc(source);
        onLoad?.(event);
      }}
    />
  );
}
