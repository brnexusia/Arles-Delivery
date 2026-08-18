import { useEffect, useMemo } from "react";

// Public marketing page renderer used at the product root for signed-out visitors.
type StaticLandingProps = {
  html: string;
  css: string;
};

export function StaticLanding({ html, css }: StaticLandingProps) {
  const body = useMemo(
    () =>
      html
        .replace(/^[\s\S]*?<body[^>]*>/i, "")
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<\/body>[\s\S]*$/i, ""),
    [html],
  );

  useEffect(() => {
    const year = document.getElementById("year");
    if (year) year.textContent = String(new Date().getFullYear());

    const faqButtons = Array.from(document.querySelectorAll<HTMLButtonElement>(".faq-q"));
    const cleanups = faqButtons.map((button) => {
      const handler = () => button.parentElement?.classList.toggle("open");
      button.addEventListener("click", handler);
      return () => button.removeEventListener("click", handler);
    });

    const revealElements = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
    const observer =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            (entries) => {
              entries.forEach((entry) => {
                if (entry.isIntersecting) {
                  entry.target.classList.add("visible");
                  observer.unobserve(entry.target);
                }
              });
            },
            { threshold: 0.1 },
          )
        : null;

    revealElements.forEach((element) => {
      if (observer) observer.observe(element);
      else element.classList.add("visible");
    });

    return () => {
      cleanups.forEach((cleanup) => cleanup());
      observer?.disconnect();
    };
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div dangerouslySetInnerHTML={{ __html: body }} />
    </>
  );
}
