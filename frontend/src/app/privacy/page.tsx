export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center gap-3">
          <a href="/" className="flex items-center gap-2 text-brand-navy hover:opacity-80">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-navy">
              <img src="/123-mobile-track-logo.png" alt="" className="h-5 w-5 object-contain" />
            </div>
            <span className="font-bold text-brand-ink">123 Mobile Track</span>
          </a>
        </div>

        <h1 className="text-3xl font-bold text-brand-ink">Privacy Policy</h1>
        <p className="mt-2 text-sm text-slate-500">Last updated: May 28, 2026</p>

        <div className="mt-8 space-y-8 text-sm leading-7 text-slate-700">
          <section>
            <h2 className="mb-3 text-base font-semibold text-brand-ink">1. Who we are</h2>
            <p>
              123 Mobile Track (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) is a fleet tracking service operated at
              123mobiletrack.com. We provide GPS vehicle tracking, trip history, and fleet management tools
              for businesses.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-brand-ink">2. Information we collect</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li><strong>Account information:</strong> Your name and email address when you create an account.</li>
              <li><strong>Fleet data:</strong> Vehicle details, driver names, and maintenance records you enter into the app. This is stored per-account and is never shared.</li>
              <li><strong>GPS telemetry:</strong> Location, speed, and motion data transmitted by tracking devices installed in your vehicles. This data is associated with your account and device ID.</li>
              <li><strong>Usage data:</strong> Standard web server logs (IP address, browser type, pages visited). We do not use third-party analytics trackers.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-brand-ink">3. How we use your information</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>To provide the fleet tracking service and display data in your dashboard.</li>
              <li>To send account-related emails (password reset, email confirmation).</li>
              <li>To store and retrieve your fleet configuration across devices.</li>
            </ul>
            <p className="mt-3">We do not sell, rent, or share your data with third parties for marketing purposes.</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-brand-ink">4. GPS and location data</h2>
            <p>
              Location data is transmitted by hardware trackers installed in vehicles that you own or operate.
              This data is stored in your account and is only accessible to users you authorize.
              GPS data is retained indefinitely unless you delete your account or manually clear it.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-brand-ink">5. Data storage and security</h2>
            <p>
              Your data is stored on Netlify&apos;s infrastructure in the United States. We use HTTPS for all
              data in transit and access-controlled blob storage for fleet data. Authentication is handled
              via Netlify Identity using industry-standard JWT tokens.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-brand-ink">6. Cookies and local storage</h2>
            <p>
              We use browser localStorage to store your authentication token and cache fleet preferences.
              We do not use advertising cookies or third-party tracking cookies.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-brand-ink">7. Your rights</h2>
            <p>You may request to:</p>
            <ul className="list-disc space-y-2 pl-5 mt-2">
              <li>Access a copy of your data.</li>
              <li>Delete your account and all associated data.</li>
              <li>Export your fleet data in CSV format (available in the app).</li>
            </ul>
            <p className="mt-3">To exercise these rights, contact us at the email below.</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-brand-ink">8. Children</h2>
            <p>This service is not directed at children under 13. We do not knowingly collect data from minors.</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-brand-ink">9. Changes to this policy</h2>
            <p>
              We may update this policy from time to time. Changes will be posted on this page with an
              updated date. Continued use of the service after changes constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-brand-ink">10. Contact</h2>
            <p>
              Questions about this policy? Email us at{" "}
              <a href="mailto:privacy@123mobiletrack.com" className="text-brand-navy underline">
                privacy@123mobiletrack.com
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-12 border-t border-brand-line pt-6 text-xs text-slate-400">
          © {new Date().getFullYear()} 123 Mobile Track. All rights reserved.
        </div>
      </div>
    </div>
  );
}
