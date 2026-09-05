'use client';

/**
 * Client-only entry points for the two WebGL scenes.
 *
 * Neither scene can render on the server (no GL context) and neither should
 * block first paint, so both arrive through next/dynamic behind a placeholder
 * that occupies exactly the space the canvas will take — the hero fills its
 * stage, the field keeps its square. Nothing shifts when they hydrate.
 */
import dynamic from 'next/dynamic';

const HeroPoster = () => (
  <div className="scene-stage h-full w-full">
    <div className="scene-poster h-full w-full" data-variant="monolith" />
    <div className="scene-scrim" />
  </div>
);

const FieldPoster = () => (
  <div className="scene-stage field aspect-square w-full">
    <div className="scene-poster h-full w-full" data-variant="field" />
  </div>
);

export const HeroMonolithLazy = dynamic(() => import('@/components/site/HeroMonolith').then((m) => m.HeroMonolith), {
  ssr: false,
  loading: HeroPoster,
});

export const AgentFieldLazy = dynamic(() => import('@/components/site/AgentField').then((m) => m.AgentField), {
  ssr: false,
  loading: FieldPoster,
});
