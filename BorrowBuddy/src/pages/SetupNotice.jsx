// Shown instead of a blank page when a developer hasn't added Firebase settings yet.
export function SetupNotice() {
  return (
    <main className="container simple-page">
      <h1>Passdown needs Firebase settings</h1>
      <p>
        Copy <code>.env.example</code> to <code>.env.local</code> and fill in your project's web
        config, or run <code>npm run dev:emulator</code> to try the app with local test data.
      </p>
    </main>
  );
}
