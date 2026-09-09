import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

export const BRAND_LOGO_SRC = "";

type BrandLogoSize = "xs" | "sm" | "md" | "lg" | "xl" | "hero";

const logoSizes: Record<BrandLogoSize, string> = {
  xs: "h-8 w-8 rounded-xl",
  sm: "h-10 w-10 rounded-2xl",
  md: "h-12 w-12 rounded-2xl",
  lg: "h-16 w-16 rounded-3xl",
  xl: "h-24 w-24 rounded-[2rem]",
  hero: "h-36 w-36 rounded-[2.5rem] sm:h-44 sm:w-44"
};

const titleSizes: Record<BrandLogoSize, string> = {
  xs: "text-sm",
  sm: "text-base",
  md: "text-lg",
  lg: "text-2xl",
  xl: "text-4xl",
  hero: "text-4xl sm:text-5xl"
};

const subtitleSizes: Record<BrandLogoSize, string> = {
  xs: "text-[10px]",
  sm: "text-[10px]",
  md: "text-xs",
  lg: "text-sm",
  xl: "text-base",
  hero: "text-base sm:text-lg"
};

interface BrandLogoProps {
  href?: string | null;
  showText?: boolean;
  title?: string;
  subtitle?: string;
  src?: string | null;
  size?: BrandLogoSize;
  className?: string;
  logoClassName?: string;
  imageClassName?: string;
  textClassName?: string;
  titleClassName?: string;
  subtitleClassName?: string;
}

export function BrandLogo({
  href = "/",
  showText = true,
  title = "HRMS",
  subtitle = "نظام إدارة الموارد البشرية",
  src,
  size = "md",
  className,
  logoClassName,
  imageClassName,
  textClassName,
  titleClassName,
  subtitleClassName
}: BrandLogoProps) {
  const logoSrc = src || BRAND_LOGO_SRC;
  const content = (
    <>
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center overflow-hidden border border-white/15 bg-primary text-primary-foreground shadow-sm",
          logoSizes[size],
          logoClassName
        )}
      >
        {logoSrc ? (
          <Image src={logoSrc} alt="شعار HRMS" width={176} height={176} unoptimized className={cn("h-full w-full object-contain p-1", imageClassName)} />
        ) : (
          <span className="text-[0.58em] font-black tracking-[-0.06em]" aria-hidden="true">HR</span>
        )}
      </span>
      {showText ? (
        <span className={cn("min-w-0 leading-tight", textClassName)}>
          <span className={cn("block truncate font-bold tracking-tight", titleSizes[size], titleClassName)}>{title}</span>
          {subtitle ? (
            <span className={cn("block truncate text-muted-foreground", subtitleSizes[size], subtitleClassName)}>{subtitle}</span>
          ) : null}
        </span>
      ) : null}
    </>
  );

  const classes = cn("inline-flex items-center gap-3", className);

  if (!href) {
    return <div className={classes}>{content}</div>;
  }

  return (
    <Link href={href} className={classes} aria-label="الصفحة الرئيسية لنظام HRMS">
      {content}
    </Link>
  );
}
