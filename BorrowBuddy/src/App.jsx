import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import { Layout } from "./components/Layout";
import { isFirebaseConfigured } from "./lib/firebase";
import { BrowsePage } from "./pages/BrowsePage";
import { CreateListingPage, EditListingPage, ItemDetailPage, MyListingsPage } from "./pages/ListingPages";
import { HomePage } from "./pages/HomePage";
import { DealDetailPage, DealsPage } from "./pages/DealPages";
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

            <Route path="list" element={<CreateListingPage />} />
            <Route path="items/:id" element={<ItemDetailPage />} />
            <Route path="items/:id/edit" element={<EditListingPage />} />
            <Route path="my-listings" element={<MyListingsPage />} />

            <Route path="deals" element={<DealsPage />} />
            <Route path="deals/:id" element={<DealDetailPage />} />

            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
