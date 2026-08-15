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
        <div className="mb-4 text-center">
          <span className="inline-block bg-white text-zinc-950 font-black text-xs sm:text-sm md:text-base lg:text-lg px-6 sm:px-8 py-2 sm:py-2.5 rounded-full shadow-2xl tracking-wider uppercase border-2 border-white">
            {items[opened].title}
          </span>
        </div>
      )}

      {/* Enlarged Fluid Responsive Gallery Card */}
      <div className="relative w-[310px] h-[340px] sm:w-[400px] sm:h-[440px] md:w-[480px] md:h-[520px] lg:w-[560px] lg:h-[580px] xl:w-[620px] xl:h-[620px] max-w-[95vw] overflow-hidden rounded-[28px] border border-white/20 shadow-[0_25px_70px_rgba(0,0,0,0.8)] bg-zinc-950">
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
          /* Fallback static preview */
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

        {/* Bottom Interactive Thumbnail Tab Dots */}
        <div className="absolute left-0 top-0 z-[100] h-full w-full pointer-events-none">
          <Tabs images={items} selectedIndex={opened} onSelect={onClick} accentColor={accentColor} />
        </div>
      </div>

      {/* Side-by-Side Navigation Arrows Centered Below Image */}
      <div className="flex items-center justify-center gap-8 sm:gap-12 pt-5 z-[101]">
        <button
          type="button"
          className="flex h-12 w-12 sm:h-16 sm:w-16 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-zinc-900/90 text-white backdrop-blur-md shadow-2xl outline-none transition-all duration-200 hover:scale-110 hover:bg-zinc-800 active:scale-95 disabled:opacity-40"
          onClick={prev}
          disabled={disabled}
          aria-label="Previous Preview"
        >
          <svg
            width="26"
            height="26"
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
          className="flex h-12 w-12 sm:h-16 sm:w-16 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-zinc-900/90 text-white backdrop-blur-md shadow-2xl outline-none transition-all duration-200 hover:scale-110 hover:bg-zinc-800 active:scale-95 disabled:opacity-40"
          onClick={next}
          disabled={disabled}
          aria-label="Next Preview"
        >
          <svg
            width="26"
            height="26"
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

  const gap = 14;
  const circleRadius = 9;
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
  const gap = 14;
  const circleRadius = 9;
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
              fill={isSelected ? `${accentColor}40` : "transparent"}
              stroke={isSelected ? accentColor : "rgba(255,255,255,0.8)"}
              strokeWidth={isSelected ? "3" : "1.5"}
              cx={getPosX(i)}
              cy={getPosY()}
              r={circleRadius + 3}
            />
          </g>
        );
      })}
    </svg>
  );
}
