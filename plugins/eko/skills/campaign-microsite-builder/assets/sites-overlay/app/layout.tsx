import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  icons: {
    icon: "/assets/eko-logo-purple.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#6400ff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          defer
          src="https://js.braintreegateway.com/web/3.101.2/js/client.min.js"
        />
        <script
          defer
          src="https://js.braintreegateway.com/web/3.101.2/js/hosted-fields.min.js"
        />
        <script
          defer
          src="https://js.braintreegateway.com/web/3.101.2/js/three-d-secure.min.js"
        />
        <script
          defer
          src="https://js.braintreegateway.com/web/3.101.2/js/data-collector.min.js"
        />
        <script defer src="/site.js" />
      </head>
      <body>{children}</body>
    </html>
  );
}
