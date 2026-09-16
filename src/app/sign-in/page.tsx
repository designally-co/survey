import { redirect } from 'next/navigation';

import { FlatMark } from '../mark';
import { auth, signIn, ALLOWED_DOMAIN, devSignInEnabled, hasGoogleCredentials } from '@/auth';

export const dynamic = 'force-dynamic';

/**
 * The door, drawn as Article Studio draws its own.
 *
 * **Changed on 16 September 2026, asked for.** It was this product's own
 * graphic — the Cut laid horizontally with the Point on it, on parchment — and
 * that was the right screen while the two internal apps lived in different
 * places. They now sit on one server, behind one Workspace, with one way in
 * for the same five people, and the request was for the two doors to be the
 * same door rather than cousins.
 *
 * So the composition is Article Studio's, to the colour: the grey ground, one
 * white plate with a hairline, the flat mark, an eyebrow, the product in the
 * display face, one line saying what it is for, and the accent pill. The
 * values live in `.as-door` in globals.css, which says why they are hard-coded
 * rather than taken from this app's tokens.
 *
 * WHAT DID NOT CHANGE. Google SSO on a Designally Workspace account is still
 * the only way in, the development sign-in still exists only where no OAuth
 * client does, and both still refuse any address outside the domain.
 */
export default async function SignIn(props: PageProps<'/sign-in'>) {
  const session = await auth();
  const { from } = await props.searchParams;
  // A path inside this app, never an absolute URL — an open redirect on a
  // sign-in page hands somebody else's site the trust of this domain.
  const target =
    typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/';

  if (session?.user) redirect(target);

  return (
    <main className="as-door">
      <section aria-labelledby="signin-title" className="as-plate">
        {/* The flat mark: the D in ink, the full stop in the accent. The disc
            version is heavier than anything else here, and the plate is
            already the object. */}
        <FlatMark size={36} />

        <p className="as-eyebrow">Designally</p>
        <h1 id="signin-title" className="as-title">
          Survey Platform
        </h1>
        {/* What the platform is for, in the one place the team sees it stated.
            A summary read *before* the answers, not instead of them — the team
            still sees every answer, which is the promise this can keep. */}
        <p className="as-deck">The summary you read before the answers.</p>

        {hasGoogleCredentials ? (
          <form
            action={async () => {
              'use server';
              await signIn('google', { redirectTo: target });
            }}
          >
            <button className="as-cta" type="submit">
              <GoogleGlyph />
              Continue with Google
            </button>
          </form>
        ) : devSignInEnabled ? null : (
          <p className="as-note">
            <strong>Sign-in is not configured.</strong> Set <code>AUTH_GOOGLE_ID</code> and{' '}
            <code>AUTH_GOOGLE_SECRET</code>, and add this origin&rsquo;s{' '}
            <code>/api/auth/callback/google</code> to the OAuth client&rsquo;s authorised redirect
            URIs.
          </p>
        )}

        {devSignInEnabled && (
          <form
            action={async (formData: FormData) => {
              'use server';
              await signIn('dev', {
                email: String(formData.get('email') ?? ''),
                name: String(formData.get('name') ?? ''),
                redirectTo: target,
              });
            }}
          >
            <p className="as-note">
              <strong>Development sign-in.</strong> No Google OAuth client is configured, so this
              stands in for it. It is not built into a production bundle, and it still refuses any
              address outside {ALLOWED_DOMAIN}.
            </p>
            <div className="as-dev">
              <label htmlFor="dev-email">Email</label>
              <input
                id="dev-email"
                name="email"
                type="email"
                required
                defaultValue={`you@${ALLOWED_DOMAIN}`}
              />
              <label htmlFor="dev-name">Name</label>
              <input id="dev-name" name="name" type="text" defaultValue="Khun Nan" />
            </div>
            <button className="as-cta" type="submit">
              Sign in
            </button>
          </form>
        )}

        {/* Who can come in, stated under the door rather than discovered at it:
            a personal Google account gets as far as the consent screen and is
            turned away, which is a worse place to learn the rule. */}
        <p className="as-foot">Designally Google Workspace accounts only.</p>
      </section>
    </main>
  );
}

/** Google's mark, one colour, at the size the button's other glyphs are. */
function GoogleGlyph() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5c-.3 1.5-1.1 2.8-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7zM12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.7-4.9H1.4v3.1C3.4 21.4 7.4 24 12 24zM5.3 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.6.4-2.4V6.5H1.4C.5 8.2 0 10 0 12s.5 3.8 1.4 5.5l3.9-3.1zM12 4.7c1.8 0 3.3.6 4.6 1.8l3.4-3.4C18 1.2 15.2 0 12 0 7.4 0 3.4 2.6 1.4 6.5l3.9 3.1c1-2.8 3.6-4.9 6.7-4.9z" />
    </svg>
  );
}
