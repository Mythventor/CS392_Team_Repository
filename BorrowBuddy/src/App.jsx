import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import { Layout } from "./components/Layout";
import { isFirebaseConfigured } from "./lib/firebase";
import { BrowsePage } from "./pages/BrowsePage";
import { ComingSoonPage } from "./pages/ComingSoonPage";
import { HomePage } from "./pages/HomePage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ProfilePage } from "./pages/ProfilePage";
import { SetupNotice } from "./pages/SetupNotice";
import { SignInPage } from "./pages/SignInPage";

export default function App() {
  if (!isFirebaseConfigured) return <SetupNotice />;

  return (
    <AuthProvider>
      {/* Browse filters live in the URL, so it must update immediately or fast typing drops letters. */}
      <BrowserRouter useTransitions={false}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="browse" element={<BrowsePage />} />
            <Route path="signin" element={<SignInPage />} />
            <Route path="profile" element={<ProfilePage />} />

            {/* Placeholders so navigation works until the listing pages are built. */}
            <Route
              path="list"
              element={<ComingSoonPage title="List an item" message="Soon you'll be able to post something for other students to borrow." />}
            />
            <Route
              path="items/:id"
              element={<ComingSoonPage title="Item details" message="Soon you'll be able to see full details and request this item here." />}
            />

            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
