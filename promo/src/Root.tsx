import { Composition } from 'remotion';
import { Promo, TOTAL } from './Promo';

export const Root = () => (
  <Composition id="Promo" component={Promo} durationInFrames={TOTAL} fps={30} width={1920} height={1080} />
);
