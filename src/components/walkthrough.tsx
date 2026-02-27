"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { HelpCircle, ChevronLeft, ChevronRight, X } from "lucide-react";

interface TourStep {
  target: string;
  title: string;
  description: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    target: "search-bar",
    title: "Semantic Search",
    description:
      "Type a natural-language description of what you're looking for. The search finds traces by meaning, not keywords.",
  },
  {
    target: "facet-panel",
    title: "Filter Results",
    description:
      "Narrow down results by tags, role, framework, or trace. Combine multiple filters to find exactly what you need.",
  },
  {
    target: "index-selector",
    title: "Switch Indexes",
    description:
      "Choose which Pinecone index to explore. Each index may contain different trace datasets.",
  },
  {
    target: "actions",
    title: "Compare & Upload",
    description:
      "Compare indexes side-by-side, or upload new trace data to index.",
  },
  {
    target: "behavior-patterns",
    title: "Behavior Patterns",
    description:
      "Automatically discovered patterns in agent behavior. Click any card to search for matching traces.",
  },
];

interface WalkthroughContextValue {
  active: boolean;
  start: () => void;
  close: () => void;
}

const WalkthroughContext = createContext<WalkthroughContextValue>({
  active: false,
  start: () => {},
  close: () => {},
});

function useWalkthrough() {
  return useContext(WalkthroughContext);
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 8;

function getTooltipPosition(
  targetRect: Rect,
  tooltipWidth: number,
  tooltipHeight: number
) {
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;
  const gap = 12;

  const spaceBelow = viewportH - (targetRect.top + targetRect.height + gap);
  const spaceAbove = targetRect.top - gap;

  let top: number;
  let placement: "below" | "above";

  if (spaceBelow >= tooltipHeight || spaceBelow >= spaceAbove) {
    top = targetRect.top + targetRect.height + gap;
    placement = "below";
  } else {
    top = targetRect.top - tooltipHeight - gap;
    placement = "above";
  }

  let left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
  left = Math.max(16, Math.min(left, viewportW - tooltipWidth - 16));
  top = Math.max(16, Math.min(top, viewportH - tooltipHeight - 16));

  return { top, left, placement };
}

function WalkthroughOverlay({
  onClose,
}: {
  onClose: () => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{
    top: number;
    left: number;
    placement: "below" | "above";
  } | null>(null);
  const [visible, setVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const availableSteps = TOUR_STEPS.filter(
    (step) => !!document.querySelector(`[data-tour="${step.target}"]`)
  );

  const currentStep = availableSteps[stepIndex];

  const measureAndPosition = useCallback(() => {
    if (!currentStep) return;
    const el = document.querySelector(`[data-tour="${currentStep.target}"]`);
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const padded: Rect = {
      top: rect.top - PADDING,
      left: rect.left - PADDING,
      width: rect.width + PADDING * 2,
      height: rect.height + PADDING * 2,
    };
    setTargetRect(padded);

    if (tooltipRef.current) {
      const tw = tooltipRef.current.offsetWidth;
      const th = tooltipRef.current.offsetHeight;
      setTooltipPos(getTooltipPosition(padded, tw, th));
    }
  }, [currentStep]);

  useEffect(() => {
    if (!currentStep) return;
    const el = document.querySelector(`[data-tour="${currentStep.target}"]`);
    if (!el) return;

    el.scrollIntoView({ behavior: "smooth", block: "center" });

    const timer = setTimeout(() => {
      measureAndPosition();
      setVisible(true);
    }, 350);

    return () => clearTimeout(timer);
  }, [currentStep, measureAndPosition]);

  useEffect(() => {
    if (!visible) return;
    measureAndPosition();
  }, [visible, measureAndPosition]);

  useEffect(() => {
    const handler = () => measureAndPosition();
    window.addEventListener("resize", handler);
    window.addEventListener("scroll", handler, true);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [measureAndPosition]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        goNext();
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        goBack();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const goNext = () => {
    if (stepIndex < availableSteps.length - 1) {
      setVisible(false);
      setTargetRect(null);
      setTooltipPos(null);
      setTimeout(() => setStepIndex((i) => i + 1), 150);
    } else {
      onClose();
    }
  };

  const goBack = () => {
    if (stepIndex > 0) {
      setVisible(false);
      setTargetRect(null);
      setTooltipPos(null);
      setTimeout(() => setStepIndex((i) => i - 1), 150);
    }
  };

  if (!currentStep) return null;

  const isLast = stepIndex === availableSteps.length - 1;
  const isFirst = stepIndex === 0;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999]"
      style={{ pointerEvents: "auto" }}
    >
      {/* Backdrop with spotlight cutout */}
      {targetRect && (
        <div
          className="absolute rounded-xl transition-all duration-300 ease-in-out"
          style={{
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
            boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.6)",
            pointerEvents: "none",
            opacity: visible ? 1 : 0,
          }}
        />
      )}

      {/* Click-to-close backdrop (behind the spotlight) */}
      <div
        className="absolute inset-0"
        style={{ pointerEvents: "auto" }}
        onClick={onClose}
      />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="bg-popover text-popover-foreground absolute w-80 rounded-xl border shadow-2xl transition-all duration-300 ease-in-out"
        style={{
          top: tooltipPos?.top ?? -9999,
          left: tooltipPos?.left ?? -9999,
          opacity: visible && tooltipPos ? 1 : 0,
          transform: visible && tooltipPos
            ? "translateY(0)"
            : tooltipPos?.placement === "above"
              ? "translateY(8px)"
              : "translateY(-8px)",
          pointerEvents: visible && tooltipPos ? "auto" : "none",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold leading-none">
                {currentStep.title}
              </h3>
              <p className="text-muted-foreground text-xs">
                {stepIndex + 1} of {availableSteps.length}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground -mr-1 -mt-1 shrink-0"
            >
              <X className="size-3.5" />
            </Button>
          </div>

          <p className="text-muted-foreground text-sm leading-relaxed">
            {currentStep.description}
          </p>

          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex gap-1">
              {availableSteps.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 rounded-full transition-all duration-200 ${
                    i === stepIndex
                      ? "w-4 bg-primary"
                      : i < stepIndex
                        ? "w-1.5 bg-primary/40"
                        : "w-1.5 bg-muted-foreground/30"
                  }`}
                />
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              {!isFirst && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={goBack}
                  className="gap-1"
                >
                  <ChevronLeft className="size-3" />
                  Back
                </Button>
              )}
              <Button size="xs" onClick={goNext} className="gap-1">
                {isLast ? (
                  "Done"
                ) : (
                  <>
                    Next
                    <ChevronRight className="size-3" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function WalkthroughProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [active, setActive] = useState(false);

  const start = useCallback(() => setActive(true), []);
  const close = useCallback(() => setActive(false), []);

  return (
    <WalkthroughContext.Provider value={{ active, start, close }}>
      {children}
      {active && <WalkthroughOverlay onClose={close} />}
    </WalkthroughContext.Provider>
  );
}

export function WalkthroughTrigger() {
  const { start } = useWalkthrough();

  return (
    <Button
      variant="outline"
      size="icon-sm"
      onClick={start}
      title="App walkthrough"
      className="text-muted-foreground hover:text-foreground"
    >
      <HelpCircle className="size-4" />
    </Button>
  );
}
