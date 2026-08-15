import React, { useState, useEffect, useRef, useCallback } from "react";

export function ImageGallery({
  items = [],
  selectedIndex = 0,
  onSelect,
  accentColor = "#3B82F6",
  className = ""
}) {
  const [opened, setOpened] = useState(selectedIndex);
  const [inPlace, setInPlace] = useState(selectedIndex);
  const [disabled, setDisabled] = useState(false);
  const [gsapReady, setGsapReady] = useState(false);
  const autoplayTimer = useRef(null);

  // Sync external selectedIndex
  useEffect(() => {
    if (selectedIndex !== opened && !disabled) {
      setOpened(selectedIndex);
    }
  }, [selectedIndex]);

  useEffect(() => {
    const loadScripts = () => {
      if (window.gsap && window.MotionPathPlugin) {
        window.gsap.registerPlugin(window.MotionPathPlugin);
        setGsapReady(true);
        return;
      }

      const existingGsap = document.querySelector('script[src*="gsap.min.js"]');
      if (existingGsap) {
        if (window.gsap && window.MotionPathPlugin) {
          window.gsap.registerPlugin(window.MotionPathPlugin);
          setGsapReady(true);
        } else {
          existingGsap.addEventListener('load', () => {
            if (window.gsap && window.MotionPathPlugin) {
              window.gsap.registerPlugin(window.MotionPathPlugin);
              setGsapReady(true);
            }
          });
        }
        return;
      }

      const gsapScript = document.createElement("script");
      gsapScript.src = "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js";
      gsapScript.onload = () => {
        const motionPathScript = document.createElement("script");
        motionPathScript.src = "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/MotionPathPlugin.min.js";
        motionPathScript.onload = () => {
          if (window.gsap && window.MotionPathPlugin) {
            window.gsap.registerPlugin(window.MotionPathPlugin);
            setGsapReady(true);
          }
        };
        document.body.appendChild(motionPathScript);
      };
      document.body.appendChild(gsapScript);
    };

    loadScripts();
  }, []);

  const onClick = (index) => {
    if (!disabled) {
      setOpened(index);
      if (onSelect) onSelect(index);
    }
  };

  const onInPlace = (index) => setInPlace(index);

  const next = useCallback(() => {
    setOpened((currentOpened) => {
      let nextIndex = currentOpened + 1;
      if (nextIndex >= items.length) nextIndex = 0;
      if (onSelect) onSelect(nextIndex);
      return nextIndex;
    });
  }, [items.length, onSelect]);

  const prev = useCallback(() => {
    setOpened((currentOpened) => {
      let prevIndex = currentOpened - 1;
      if (prevIndex < 0) prevIndex = items.length - 1;
      if (onSelect) onSelect(prevIndex);
      return prevIndex;
    });
  }, [items.length, onSelect]);

  // Disable clicks during animation transitions
  useEffect(() => setDisabled(true), [opened]);
  useEffect(() => setDisabled(false), [inPlace]);

  // Autoplay timer
  useEffect(() => {
    if (!gsapReady) return;

    if (autoplayTimer.current) {
      clearInterval(autoplayTimer.current);
    }

    autoplayTimer.current = window.setInterval(next, 4500);

    return () => {
      if (autoplayTimer.current) {
        clearInterval(autoplayTimer.current);
      }
    };
  }, [opened, gsapReady, next]);

  return (
    <div className={`relative flex flex-col items-center justify-center w-full select-none ${className}`}>
      {/* Top Absolute Solid White Badge */}
      {items[opened] && (
        <div className="mb-3 text-center">
          <span className="inline-block bg-white text-zinc-950 font-black text-xs sm:text-sm px-5 py-1.5 rounded-full shadow-xl tracking-wider uppercase border border-white">
            {items[opened].title}
          </span>
        </div>
      )}

      {/* Enlarged Gallery Card with Liquid Clip-Path */}
      <div className="relative w-[320px] h-[340px] sm:w-[360px] sm:h-[380px] md:w-[400px] md:h-[420px] max-w-[92vw] overflow-hidden rounded-[24px] border border-white/15 shadow-[0_16px_50px_rgba(0,0,0,0.6)] bg-zinc-950">
        {gsapReady ? (
          items.map((image, i) => (
            <div
              key={image.url || i}
              className="absolute left-0 top-0 h-full w-full cursor-pointer"
              style={{ zIndex: inPlace === i ? i : items.length + 1 }}
              onClick={() => onClick(i)}
            >
              <GalleryImage
                total={items.length}
                id={i}
                url={image.url}
                title={image.title}
                open={opened === i}
                inPlace={inPlace === i}
                onInPlace={onInPlace}
              />
            </div>
          ))
        ) : (
          /* Fallback static preview while GSAP loads */
          <div className="w-full h-full">
            {items[opened] && (
              <img
                src={items[opened].url}
                alt={items[opened].title}
                className="w-full h-full object-cover object-top"
              />
            )}
          </div>
        )}

        {/* Bottom Interactive Thumbnail Tab Dots inside the card */}
        <div className="absolute left-0 top-0 z-[100] h-full w-full pointer-events-none">
          <Tabs images={items} selectedIndex={opened} onSelect={onClick} accentColor={accentColor} />
        </div>
      </div>

      {/* Relocated Side-by-Side Navigation Arrows Centered Below Image */}
      <div className="flex items-center justify-center gap-6 pt-3.5 z-[101]">
        <button
          type="button"
          className="flex h-11 w-11 sm:h-12 sm:w-12 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-zinc-900/90 text-white backdrop-blur-md shadow-xl outline-none transition-all duration-200 hover:scale-105 hover:bg-zinc-800 active:scale-95 disabled:opacity-40"
          onClick={prev}
          disabled={disabled}
          aria-label="Previous Preview"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <button
          type="button"
          className="flex h-11 w-11 sm:h-12 sm:w-12 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-zinc-900/90 text-white backdrop-blur-md shadow-xl outline-none transition-all duration-200 hover:scale-105 hover:bg-zinc-800 active:scale-95 disabled:opacity-40"
          onClick={next}
          disabled={disabled}
          aria-label="Next Preview"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function GalleryImage({ url, title, open, inPlace, id, onInPlace, total }) {
  const [firstLoad, setLoaded] = useState(true);
  const clip = useRef(null);

  const gap = 12;
  const circleRadius = 8;
  const defaults = { transformOrigin: "center center" };
  const duration = 0.45;
  const width = 400;
  const height = 400;
  const scale = 700;

  const bigSize = circleRadius * scale;
  const overlap = 0;

  const getPosSmall = () => ({
    cx: width / 2 - (total * (circleRadius * 2 + gap) - gap) / 2 + id * (circleRadius * 2 + gap),
    cy: height - 30,
    r: circleRadius,
  });
  const getPosSmallAbove = () => ({
    cx: width / 2 - (total * (circleRadius * 2 + gap) - gap) / 2 + id * (circleRadius * 2 + gap),
    cy: height / 2,
    r: circleRadius * 2,
  });
  const getPosCenter = () => ({ cx: width / 2, cy: height / 2, r: circleRadius * 7 });
  const getPosEnd = () => ({ cx: width / 2 - bigSize + overlap, cy: height / 2, r: bigSize });
  const getPosStart = () => ({ cx: width / 2 + bigSize - overlap, cy: height / 2, r: bigSize });

  useEffect(() => {
    const gsap = window.gsap;
    if (!gsap) return;

    setLoaded(false);
    if (clip.current) {
      const flipDuration = firstLoad ? 0 : duration;
      const upDuration = firstLoad ? 0 : 0.2;
      const bounceDuration = firstLoad ? 0.01 : 0.9;
      const delay = firstLoad ? 0 : flipDuration + upDuration;

      if (open) {
        gsap
          .timeline()
          .set(clip.current, { ...defaults, ...getPosSmall() })
          .to(clip.current, {
            ...defaults,
            ...getPosCenter(),
            duration: upDuration,
            ease: "power3.inOut",
          })
          .to(clip.current, {
            ...defaults,
            ...getPosEnd(),
            duration: flipDuration,
            ease: "power4.in",
            onComplete: () => onInPlace(id),
          });
      } else {
        gsap
          .timeline({ overwrite: true })
          .set(clip.current, { ...defaults, ...getPosStart() })
          .to(clip.current, {
            ...defaults,
            ...getPosCenter(),
            delay: delay,
            duration: flipDuration,
            ease: "power4.out",
          })
          .to(clip.current, {
            ...defaults,
            motionPath: {
              path: [getPosSmallAbove(), getPosSmall()],
              curviness: 1,
            },
            duration: bounceDuration,
            ease: "bounce.out",
          });
      }
    }
  }, [open]);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full"
    >
      <defs>
        <clipPath id={`${id}_circleClip`}>
          <circle className="clip" cx="0" cy="0" r={circleRadius} ref={clip}></circle>
        </clipPath>
        <clipPath id={`${id}_squareClip`}>
          <rect className="clip" width={width} height={height}></rect>
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}${inPlace ? "_squareClip" : "_circleClip"})`}>
        <image width={width} height={height} href={url} className="pointer-events-none" preserveAspectRatio="xMidYMid slice"></image>
      </g>
    </svg>
  );
}

function Tabs({ images, selectedIndex, onSelect, accentColor }) {
  const gap = 12;
  const circleRadius = 8;
  const width = 400;
  const height = 400;

  const getPosX = (i) =>
    width / 2 - (images.length * (circleRadius * 2 + gap) - gap) / 2 + i * (circleRadius * 2 + gap);
  const getPosY = () => height - 30;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full"
    >
      {images.map((image, i) => {
        const isSelected = selectedIndex === i;
        return (
          <g key={image.url || i} className="pointer-events-auto">
            <defs>
              <clipPath id={`tab_${i}_clip`}>
                <circle cx={getPosX(i)} cy={getPosY()} r={circleRadius} />
              </clipPath>
            </defs>
            <image
              x={getPosX(i) - circleRadius}
              y={getPosY() - circleRadius}
              width={circleRadius * 2}
              height={circleRadius * 2}
              href={image.url}
              clipPath={`url(#tab_${i}_clip)`}
              className="pointer-events-none"
              preserveAspectRatio="xMidYMid slice"
            />
            <circle
              onClick={() => onSelect(i)}
              className="cursor-pointer transition-all duration-200"
              fill={isSelected ? `${accentColor}35` : "transparent"}
              stroke={isSelected ? accentColor : "rgba(255,255,255,0.75)"}
              strokeWidth={isSelected ? "2.5" : "1.5"}
              cx={getPosX(i)}
              cy={getPosY()}
              r={circleRadius + 2.5}
            />
          </g>
        );
      })}
    </svg>
  );
}
