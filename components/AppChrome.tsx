'use client';

/**
 * Decides which chrome the current route gets. The operator console keeps the
 * full shell (sidebar, topbar, palette, conductor dock); the public site at
 * /site renders edge-to-edge with none of it, because it is a different
 * surface with its own header, palette and scroll model.
 *
 * The gate lives here rather than in the root layout because only a client
 * component can read the active pathname.
 */
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { CommandPalette } from '@/components/CommandPalette';
import { ConductorPanel } from '@/components/ConductorPanel';
import { isSiteRoute } from '@/lib/site/content';
import type { Command } from '@/lib/palette';

export function AppChrome({ commands, children }: { commands: Command[]; children: React.ReactNode }) {
  const pathname = usePathname();

  if (isSiteRoute(pathname)) return <>{children}</>;

  return (
    <>
      <Sidebar />
      {/* os-shell yields to the Conductor dock: the panel sets --conductor-w
          and the whole content column glides left instead of being covered */}
      <div className="os-shell ml-[232px] flex min-h-screen min-w-0 flex-col" style={{ marginRight: 'var(--conductor-w, 0px)' }}>
        <Topbar />
        <main className="min-w-0 flex-1 px-8 pb-16 pt-7 wide:px-10 ultra:px-12">
          {/* Width tiers: 1280 on laptops · 1760 on large monitors ·
              full-bleed on 32"/ultrawide. See tailwind screens wide/ultra. */}
          <div className="mx-auto max-w-[1280px] wide:max-w-[1760px] ultra:max-w-none">{children}</div>
        </main>
      </div>
      <CommandPalette commands={commands} />
      {/* Notion-style agent dock — the Conductor, aware of the current screen */}
      <ConductorPanel />
    </>
  );
}
