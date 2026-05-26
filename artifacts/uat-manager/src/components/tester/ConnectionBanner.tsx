import { useState, useEffect, useRef } from "react";
import { Wifi, WifiOff } from "lucide-react";

/**
 * Global connection status banner.
 * Shows a red sticky banner when offline and a green "Connection restored"
 * banner that auto-dismisses after 3 seconds when transitioning back online.
 *
 * Render this once at the App level so every tester page gets coverage.
 */
export function ConnectionBanner() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [showRestored, setShowRestored] = useState(false);
  const wasOfflineRef = useRef(false);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleOffline = () => {
      setIsOnline(false);
      wasOfflineRef.current = true;
      // Cancel any pending "restored" dismiss timer
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
      setShowRestored(false);
    };

    const handleOnline = () => {
      setIsOnline(true);
      // Only show "restored" if we were previously offline
      if (wasOfflineRef.current) {
        setShowRestored(true);
        dismissTimerRef.current = setTimeout(() => {
          setShowRestored(false);
          wasOfflineRef.current = false;
          dismissTimerRef.current = null;
        }, 3000);
      }
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    // Sync initial state
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const isShowing = !isOnline || showRestored;
    if (isShowing) {
      document.body.classList.add("has-offline-banner");
    } else {
      document.body.classList.remove("has-offline-banner");
    }
    return () => {
      document.body.classList.remove("has-offline-banner");
    };
  }, [isOnline, showRestored]);

  // Nothing to show when online and no "restored" message pending
  if (isOnline && !showRestored) return null;

  return (
    <div
      className={`
        fixed top-0 left-0 right-0 z-50 h-10
        flex items-center justify-center gap-2
        px-4 text-sm font-medium text-white
        transition-all duration-300 ease-in-out
        ${isOnline
          ? "bg-green-600 animate-in fade-in slide-in-from-top-2"
          : "bg-red-600 animate-in fade-in slide-in-from-top-2"
        }
      `}
      role="alert"
      aria-live="assertive"
    >
      {isOnline ? (
        <>
          <Wifi className="w-4 h-4 shrink-0" />
          <span>Connection restored</span>
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4 shrink-0" />
          <span className="truncate">⚠ No connection — inputs saved as drafts locally.</span>
        </>
      )}
    </div>
  );
}
