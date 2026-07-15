import { useEffect, useRef } from "react";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

/**
 * Renders Google's official "Sign in with Google" button and forwards the
 * resulting ID token credential to onCredential(credential).
 *
 * Uses Google Identity Services (https://accounts.google.com/gsi/client),
 * loaded via a <script> tag in index.html.
 */
export default function GoogleSignInButton({ onCredential, text = "continue_with" }) {
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    let cancelled = false;

    const render = () => {
      if (cancelled || !window.google?.accounts?.id || !buttonRef.current) return;

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => onCredential(response.credential),
      });

      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: "outline",
        size: "large",
        width: 320,
        text, // "signin_with" | "signup_with" | "continue_with"
        shape: "rectangular",
      });
    };

    if (window.google?.accounts?.id) {
      render();
    } else {
      // The GIS script loads with `defer`, so it may not be ready yet.
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(interval);
          render();
        }
      }, 100);
      return () => {
        cancelled = true;
        clearInterval(interval);
      };
    }
  }, [onCredential, text]);

  if (!GOOGLE_CLIENT_ID) {
    // Fail quietly in dev if no client ID has been configured yet, rather
    // than showing a broken/non-functional button.
    return null;
  }

  return <div ref={buttonRef} className="flex justify-center" />;
}
