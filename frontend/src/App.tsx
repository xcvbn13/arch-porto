import Terminal from "./components/Terminal";
import AdminApp from "./admin/AdminApp";

export default function App() {
  // /admin = panel kelola data (setelah `config-admin` di shell)
  if (window.location.pathname.startsWith("/admin")) {
    return <AdminApp />;
  }

  // Terminal fullscreen murni — tanpa top bar.
  return (
    <div className="h-full">
      <Terminal />
    </div>
  );
}
