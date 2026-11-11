import React from 'react';
import {registerRoot, Composition} from 'remotion';
import {Shot} from './Shot';

const meta = ({props: p}) => {
  const fps = p.fps || 30, q = p.quality || 1080;
  const [a, b] = (p.aspect || '16:9').split(':').map(Number);
  const even = (n) => Math.round(n / 2) * 2;
  const w = a >= b ? even((q * a) / b) : q, h = a >= b ? q : even((q * b) / a);
  return {fps, width: w, height: h, durationInFrames: Math.max(1, Math.round((p.duration || 5) * fps))};
};

registerRoot(() => (
  <Composition id="Shot" component={Shot} defaultProps={{objects: [{shape: 'sphere'}]}}
    calculateMetadata={meta} width={1920} height={1080} fps={30} durationInFrames={150} />
));
