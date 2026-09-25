import { Navigate, Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import CreatePoll from "./components/CreatePoll.jsx";
import PollView from "./components/PollView.jsx";

export default function App() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="ambient-orb left-[-6rem] top-[-4rem] h-72 w-72 bg-violet-300/40" />
      <div className="ambient-orb right-[-4rem] top-24 h-64 w-64 bg-sky-300/35" />
      <div className="ambient-orb bottom-[-6rem] left-1/3 h-80 w-80 bg-indigo-200/30" />
      <Navbar />
      <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-8 sm:px-6">
        <Routes>
          <Route path="/" element={<CreatePoll />} />
          <Route path="/poll/:id" element={<PollView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
