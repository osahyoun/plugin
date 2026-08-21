import type { Metadata } from "next";
import campaignConfig from "../campaign.config.json";
import markup from "../public/page-fragment.html?raw";

export const metadata: Metadata = {
  title: campaignConfig.campaign.title,
  description: campaignConfig.campaign.summary,
  openGraph: {
    title: campaignConfig.campaign.title,
    description: campaignConfig.campaign.summary,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: campaignConfig.campaign.title,
    description: campaignConfig.campaign.summary,
  },
};

export default function CampaignPage() {
  return <div dangerouslySetInnerHTML={{ __html: markup }} />;
}
