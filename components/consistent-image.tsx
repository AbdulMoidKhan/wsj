import Image, { type ImageProps } from "next/image";
import type { RefAttributes } from "react";
import media from "@/lib/consistent-media.json";

export type ConsistentImageProps = ImageProps & RefAttributes<HTMLImageElement>;

type Derivative = { src: string; width: number; height: number };
const derivatives: Readonly<Record<string, Derivative>> = media;

/** Works in either component graph; React 19 passes ref through as a prop.
 * Only approved exact string paths are remapped. CSS owns rendered sizing/radii.
 */
export default function ConsistentImage(props: ConsistentImageProps) {
  const derivative = typeof props.src === "string" &&
    Object.prototype.hasOwnProperty.call(derivatives, props.src)
    ? derivatives[props.src]
    : undefined;
  const { alt = "", ...rest } = props;
  if (!derivative) return <Image alt={alt} {...rest} />;

  // Intrinsic attributes must describe the new crop, not the notched original.
  // Preserve caller width and all layout/style props; fill remains untouched.
  const width = Number(props.width);
  const intrinsicHeight = !props.fill && props.width !== undefined &&
    props.height !== undefined && Number.isFinite(width) && width > 0
    ? Math.max(1, Math.round(width * derivative.height / derivative.width))
    : props.height;

  return <Image alt={alt} {...rest} src={derivative.src} height={intrinsicHeight} />;
}
