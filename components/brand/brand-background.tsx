import { BRAND_LOGO_SRC } from "@/components/brand/brand-logo";

export function BrandBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[1] overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(79,70,229,0.14),transparent_26rem),radial-gradient(circle_at_82%_88%,rgba(15,23,42,0.10),transparent_30rem)] dark:bg-[radial-gradient(circle_at_18%_12%,rgba(129,140,248,0.16),transparent_26rem),radial-gradient(circle_at_82%_88%,rgba(148,163,184,0.08),transparent_30rem)]" />
      <img
        src={BRAND_LOGO_SRC}
        alt=""
        className="absolute left-1/2 top-1/2 h-[min(118vw,1120px)] w-[min(118vw,1120px)] -translate-x-1/2 -translate-y-1/2 select-none object-contain opacity-[0.16] mix-blend-multiply dark:opacity-[0.18] dark:mix-blend-screen"
      />
      <img
        src={BRAND_LOGO_SRC}
        alt=""
        className="absolute -right-20 -top-20 hidden h-[30rem] w-[30rem] select-none object-contain opacity-[0.08] mix-blend-multiply blur-[0.2px] dark:opacity-[0.10] dark:mix-blend-screen lg:block"
      />
      <img
        src={BRAND_LOGO_SRC}
        alt=""
        className="absolute -bottom-36 -left-28 hidden h-[34rem] w-[34rem] select-none object-contain opacity-[0.07] mix-blend-multiply dark:opacity-[0.095] dark:mix-blend-screen lg:block"
      />
    </div>
  );
}
