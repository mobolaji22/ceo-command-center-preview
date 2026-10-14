import type { StaticImageData } from "next/image";
import corridor from "@/assets/agency-corridor.jpg";
import corridorDay from "@/assets/agency-corridor-day.jpg";
import office from "@/assets/ceo-office.jpg";
import officeDay from "@/assets/ceo-office-day.jpg";
import clientRoom from "@/assets/agency-client-room.jpg";
import clientRoomDay from "@/assets/agency-client-room-day.jpg";
import business from "@/assets/agency-room-business.jpg";
import businessDay from "@/assets/agency-room-business-day.jpg";
import market from "@/assets/agency-room-market.jpg";
import marketDay from "@/assets/agency-room-market-day.jpg";
import brand from "@/assets/agency-room-brand.jpg";
import brandDay from "@/assets/agency-room-brand-day.jpg";
import content from "@/assets/agency-room-content.jpg";
import contentDay from "@/assets/agency-room-content-day.jpg";
import design from "@/assets/agency-room-design.jpg";
import designDay from "@/assets/agency-room-design-day.jpg";
import marketing from "@/assets/agency-room-marketing.jpg";
import marketingDay from "@/assets/agency-room-marketing-day.jpg";
import engineering from "@/assets/agency-room-engineering.jpg";
import engineeringDay from "@/assets/agency-room-engineering-day.jpg";
import strategy from "@/assets/agency-room-strategy.jpg";
import strategyDay from "@/assets/agency-room-strategy-day.jpg";
import social from "@/assets/agency-room-social.jpg";
import socialDay from "@/assets/agency-room-social-day.jpg";
import media from "@/assets/agency-room-media.jpg";
import mediaDay from "@/assets/agency-room-media-day.jpg";
import product from "@/assets/agency-room-product.jpg";
import productDay from "@/assets/agency-room-product-day.jpg";
import measurement from "@/assets/agency-room-measurement.jpg";
import measurementDay from "@/assets/agency-room-measurement-day.jpg";
import compliance from "@/assets/agency-room-compliance.jpg";
import complianceDay from "@/assets/agency-room-compliance-day.jpg";

/** One place, two times of day. The photographs are atmosphere only: names, counts and status are always HTML. */
export type LitArt = { night: StaticImageData; day: StaticImageData };

/**
 * Each domain keeps one room, so it looks the same every visit. Growth and Communications use the rooms Marketing and Social Growth
 * had (v4 ADR-0018). "Other" (records that fit no domain) has no room of its own and shows the corridor.
 */
const ROOMS: Record<string, LitArt> = {
  STRATEGY: { night: strategy, day: strategyDay },
  MARKET: { night: market, day: marketDay },
  BUSINESS: { night: business, day: businessDay },
  BRAND: { night: brand, day: brandDay },
  DESIGN: { night: design, day: designDay },
  CONTENT: { night: content, day: contentDay },
  MEDIA: { night: media, day: mediaDay },
  PRODUCT: { night: product, day: productDay },
  ENGINEERING: { night: engineering, day: engineeringDay },
  GROWTH: { night: marketing, day: marketingDay },
  COMMUNICATIONS: { night: social, day: socialDay },
  MEASUREMENT: { night: measurement, day: measurementDay },
  COMPLIANCE: { night: compliance, day: complianceDay },
};

export const CORRIDOR_ART: LitArt = { night: corridor, day: corridorDay };
export const OFFICE_ART: LitArt = { night: office, day: officeDay };
export const CLIENT_ART: LitArt = { night: clientRoom, day: clientRoomDay };
export const roomArt = (code: string): LitArt | null => ROOMS[code] ?? null;
