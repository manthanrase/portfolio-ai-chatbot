import { AIChat } from "../components/AIChat";

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-black flex flex-col items-center justify-center px-6">
      {/* Floating chat widget */}
      <AIChat />
    </main>
  );
}
