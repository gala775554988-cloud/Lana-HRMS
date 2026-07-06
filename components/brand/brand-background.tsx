import { BRAND_LOGO_SRC } from "@/components/brand/brand-logo";

export function BrandBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[1] overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(79,70,229,0.12),transparent_25rem),radial-gradient(circle_at_82%_88%,rgba(15,23,42,0.08),transparent_28rem)] dark:bg-[radial-gradient(circle_at_18%_12%,rgba(129,140,248,0.14),transparent_25rem),radial-gradient(circle_at_82%_88%,rgba(148,163,184,0.07),transparent_28rem)]" />
      <img
        src={BRAND_LOGO_SRC}
        alt=""
        className="absolute left-1/2 top-1/2 h-[min(104vw,980px)] w-[min(104vw,980px)] -translate-x-1/2 -translate-y-1/2 select-none object-contain opacity-[0.075] mix-blend-multiply dark:opacity-[0.095] dark:mix-blend-screen"
      />
      <img
        src={BRAND_LOGO_SRC}
        alt=""
        className="absolute -right-24 -top-24 hidden h-96 w-96 select-none object-contain opacity-[0.045] mix-blend-multiply blur-[0.2px] dark:opacity-[0.07] dark:mix-blend-screen lg:block"
      />
      <img
        src={BRAND_LOGO_SRC}
        alt=""
        className="absolute -bottom-36 -left-28 hidden h-[28rem] w-[28rem] select-none object-contain opacity-[0.04] mix-blend-multiply dark:opacity-[0.065] dark:mix-blend-screen lg:block"
      />
    </div>
  );
}
