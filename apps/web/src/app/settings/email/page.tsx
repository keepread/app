"use client";

export default function EmailSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold mb-1">Email Ingestion</h1>
        <p className="text-sm text-muted-foreground">
          Your email ingestion settings.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Assigned Email Address</h2>
        <p className="text-sm text-muted-foreground">
          Forward newsletters to the email address configured in your
          Cloudflare Email Worker. Incoming emails will be automatically
          processed and added to your library.
        </p>
        <div className="rounded-lg border p-4 bg-muted/50">
          <p className="text-sm font-mono">
            Configure your email route in the Cloudflare dashboard under{" "}
            <span className="font-semibold">Email Routing &rarr; Email Workers</span>.
          </p>
        </div>
      </section>
    </div>
  );
}
