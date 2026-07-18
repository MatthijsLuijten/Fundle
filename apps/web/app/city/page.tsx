import { notFound } from "next/navigation";
import { CityGame } from "@/components/CityGame";
import { isCityEnabled } from "@/lib/cityData";

export default function CityPage() {
  // 404 until city mode is released in production (set NEXT_PUBLIC_CITY_ENABLED=1).
  if (!isCityEnabled()) notFound();
  return <CityGame />;
}
